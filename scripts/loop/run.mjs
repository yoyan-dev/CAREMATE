#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  appendEscalation,
  appendProgress,
  buildPrompt,
  commitAll,
  commitControllerState,
  currentBranch,
  diffHash,
  ensureBranch,
  ensureClean,
  getAgentChangedFiles,
  loadBacklog,
  loadConfig,
  loadState,
  nowIso,
  pendingTasks,
  resetToHead,
  saveState,
  selectNextTask,
  taskState,
  verifyTask,
} from "./lib.mjs";

function usage() {
  return `CAREMATE development loop

Usage:
  npm run loop -- [options]
  node scripts/loop/run.mjs [options]

Options:
  --once                     Run at most one task, then exit.
  --task <id>                Run a specific task id (for example P0-01).
  --max-iterations <n>       Override the per-run iteration budget.
  --max-minutes <n>          Override the per-run wall-clock budget.
  --include-optional         Include Phase 6 optional tasks.
  --no-commit                Do not commit successful tasks.
  --dry-run                  Print the next prompt without calling the agent.
  --help                     Show this help.

The loop stops at blocking human gates. Approve a gate with:
  npm run loop:approve -- <task-id> "review note"
`;
}

function parseArgs(argv) {
  const out = {
    once: false,
    task: null,
    maxIterations: null,
    maxMinutes: null,
    includeOptional: false,
    commit: true,
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--once":
        out.once = true;
        break;
      case "--task":
        out.task = argv[++i];
        break;
      case "--max-iterations":
        out.maxIterations = Number(argv[++i]);
        break;
      case "--max-minutes":
        out.maxMinutes = Number(argv[++i]);
        break;
      case "--include-optional":
        out.includeOptional = true;
        break;
      case "--no-commit":
        out.commit = false;
        break;
      case "--dry-run":
        out.dryRun = true;
        break;
      case "--help":
      case "-h":
        out.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return out;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function summarizeVerification(verification, agentResult) {
  const lines = [];
  if (agentResult && !agentResult.ok) {
    lines.push(`Agent exited with code ${agentResult.code ?? "unknown"}.`);
    if (agentResult.stderr) lines.push(agentResult.stderr.slice(-2000));
  }
  for (const result of verification.results) {
    if (!result.ok) lines.push(`${result.name}: ${result.detail}`);
  }
  for (const failure of verification.guardFailures) lines.push(`guard: ${failure}`);
  return lines.join("\n") || "Unknown verification failure";
}

function runAgent(root, config, promptPath, task) {
  const command = config.agent?.command ?? "opencode";
  const args = [
    ...(config.agent?.args ?? []),
    "--file",
    promptPath,
    `Implement task ${task.id}. Follow the attached prompt exactly.`,
  ];

  const runDir = path.dirname(promptPath);
  const stdoutPath = path.join(runDir, "agent.stdout.log");
  const stderrPath = path.join(runDir, "agent.stderr.log");

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: root,
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, config.agent?.timeoutMs ?? 1800000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      fs.writeFileSync(stdoutPath, stdout, "utf8");
      fs.writeFileSync(stderrPath, `${stderr}\n${String(error.message ?? error)}`, "utf8");
      resolve({ ok: false, code: null, stdout, stderr: String(error.message ?? error), timedOut });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      fs.writeFileSync(stdoutPath, stdout, "utf8");
      fs.writeFileSync(stderrPath, stderr, "utf8");
      resolve({ ok: code === 0 && !timedOut, code, stdout, stderr, timedOut });
    });
  });
}

function finalStatus(tasks, state, includeOptional) {
  const pending = pendingTasks(tasks, state, { includeOptional });
  const entries = Object.values(state.tasks ?? {});
  const blocked = entries.some((entry) => entry.status === "blocked");
  const awaiting = entries.some((entry) => entry.status === "awaiting_human");

  if (pending.length === 0) {
    if (blocked) return "blocked";
    if (awaiting) return "awaiting_human";
    return "complete";
  }

  if (blocked) return "blocked";
  if (awaiting) return "awaiting_human";
  return "paused";
}

function printVerification(verification) {
  for (const result of verification.results) {
    const marker = result.ok ? "PASS" : "FAIL";
    console.log(`  ${marker} ${result.name}: ${result.detail}`);
  }
  for (const failure of verification.guardFailures) {
    console.log(`  FAIL guard: ${failure}`);
  }
}

async function main() {
  const root = process.cwd();
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(usage());
    return 0;
  }

  const config = loadConfig(root);
  const state = loadState(root);
  const tasks = loadBacklog(root);

  if (options.task && !tasks.some((task) => task.id === options.task)) {
    console.error(`Unknown task: ${options.task}`);
    return 1;
  }

  const startedAt = Date.now();
  const maxIterations = options.maxIterations ?? config.budget?.maxIterationsPerRun ?? 20;
  const maxMinutes = options.maxMinutes ?? config.budget?.maxMinutesPerRun ?? 480;
  const maxAttempts = config.budget?.maxAttemptsPerTask ?? 3;
  const maxConsecutiveFailures = config.budget?.maxConsecutiveFailures ?? 2;
  const maxNoProgress = config.budget?.maxNoProgressRepeats ?? 2;

  if (!options.dryRun) {
    const branch = ensureBranch(root, config);
    if (!branch.ok) {
      console.error(`Loop refused to start: ${branch.message}`);
      return 1;
    }

    const clean = ensureClean(root);
    if (!clean.ok) {
      console.error("Loop refused to start: working tree is not clean.");
      console.error(clean.status);
      console.error("Commit or stash your changes before running the loop.");
      return 1;
    }
  }

  state.status = "running";
  state.currentTaskId = null;
  state.lastRun = {
    startedAt: nowIso(),
    branch: currentBranch(root),
    iterations: 0,
  };
  if (!options.dryRun) saveState(root, state);

  let iterations = 0;
  let lastExitCode = 0;

  while (true) {
    if (iterations >= maxIterations) {
      state.status = "paused";
      state.lastRun.reason = `iteration budget reached (${maxIterations})`;
      break;
    }

    const elapsedMinutes = (Date.now() - startedAt) / 60000;
    if (elapsedMinutes >= maxMinutes) {
      state.status = "paused";
      state.lastRun.reason = `wall-clock budget reached (${maxMinutes}m)`;
      break;
    }

    const task = options.task
      ? tasks.find((entry) => entry.id === options.task)
      : selectNextTask(tasks, state, { includeOptional: options.includeOptional });

    if (!task) {
      state.status = finalStatus(tasks, state, options.includeOptional);
      state.lastRun.reason = "no runnable tasks";
      break;
    }

    if (task.optional && !options.includeOptional) {
      state.status = finalStatus(tasks, state, options.includeOptional);
      state.lastRun.reason = "only optional tasks remain";
      break;
    }

    if (task.humanGate) {
      const current = taskState(state, task.id);
      state.tasks[task.id] = {
        ...current,
        status: "awaiting_human",
        waitingSince: current.waitingSince ?? nowIso(),
      };
      appendEscalation(root, task, "Human gate reached.", "Review the task, then approve it.");
      appendProgress(root, task, "awaiting_human", null, { note: "Human gate reached." });
      iterations += 1;

      if (task.blocking !== false) {
        state.status = "awaiting_human";
        state.lastRun.reason = `blocking human gate ${task.id}`;
      }

      saveState(root, state);
      if (options.commit && config.git?.commit !== false) {
        commitControllerState(root, `${config.git?.commitPrefix ?? "loop"}(${task.id}): human gate`);
      }

      if (task.blocking !== false) break;
      continue;
    }

    const current = taskState(state, task.id);
    if ((current.attempts ?? 0) >= maxAttempts) {
      state.tasks[task.id] = { ...current, status: "blocked" };
      state.status = "blocked";
      appendEscalation(root, task, `Task exceeded ${maxAttempts} attempts.`, current.lastError ?? "");
      saveState(root, state);
      if (options.commit && config.git?.commit !== false) {
        commitControllerState(root, `${config.git?.commitPrefix ?? "loop"}(${task.id}): blocked`);
      }
      return 2;
    }

    if (options.dryRun) {
      state.status = "idle";
      const prompt = buildPrompt(root, task, state, config);
      console.log(`\n=== Dry run: ${task.id} ${task.title} ===\n`);
      console.log(prompt);
      return 0;
    }

    const attempt = (current.attempts ?? 0) + 1;
    state.currentTaskId = task.id;
    state.tasks[task.id] = {
      ...current,
      status: "running",
      attempts: current.attempts ?? 0,
      lastAttemptAt: nowIso(),
    };
    saveState(root, state);

    const runDir = path.join(root, "loop", "runs", `${timestamp()}-${task.id}`);
    fs.mkdirSync(runDir, { recursive: true });
    const promptPath = path.join(runDir, "prompt.md");
    const prompt = buildPrompt(root, task, state, config);
    fs.writeFileSync(promptPath, prompt, "utf8");

    console.log(`\n=== ${task.id} ${task.title} (attempt ${attempt}/${maxAttempts}) ===`);
    console.log(`Prompt: ${path.relative(root, promptPath)}`);

    const taskStartedAt = Date.now();
    const agentResult = await runAgent(root, config, promptPath, task);
    const verification = verifyTask(root, config, task);
    const durationMs = Date.now() - taskStartedAt;
    const changedFiles = getAgentChangedFiles(root, config);

    console.log(`Agent: ${agentResult.ok ? "ok" : `failed (${agentResult.code ?? "timeout"})`}`);
    printVerification(verification);

    if (agentResult.ok && verification.ok) {
      state.tasks[task.id] = {
        ...state.tasks[task.id],
        status: "completed",
        attempts: attempt,
        completedAt: nowIso(),
        commit: "see git log",
        lastDiffHash: diffHash(root, config),
        lastError: null,
      };
      state.consecutiveFailures = 0;
      state.currentTaskId = null;
      iterations += 1;
      state.lastRun.iterations = iterations;
      appendProgress(root, task, "completed", verification, {
        attempt,
        durationMs,
        files: changedFiles,
        commit: "see git log",
      });
      saveState(root, state);

      let commit = { ok: true, sha: "none" };
      if (options.commit && config.git?.commit !== false) {
        commit = commitAll(root, config, task, verification);
      }

      if (!commit.ok) {
        resetToHead(root);
        const error = `Commit failed: ${commit.message}`;
        state.tasks[task.id] = {
          ...state.tasks[task.id],
          status: "failed",
          attempts: attempt,
          lastError: error,
        };
        state.consecutiveFailures = (state.consecutiveFailures ?? 0) + 1;
        state.currentTaskId = null;
        appendProgress(root, task, "failed", verification, {
          attempt,
          durationMs,
          files: changedFiles,
          note: error,
        });
        saveState(root, state);
        commitControllerState(root, `${config.git?.commitPrefix ?? "loop"}(${task.id}): record commit failure`);
        console.error(error);
        return 2;
      }

      console.log(`Completed ${task.id}${commit.sha && commit.sha !== "none" ? ` (${commit.sha})` : ""}.`);

      if (options.once) {
        state.status = finalStatus(tasks, state, options.includeOptional);
        state.lastRun.reason = "once flag";
        break;
      }
      continue;
    }

    const hash = diffHash(root, config);
    const noProgress = current.lastDiffHash && current.lastDiffHash === hash
      ? (current.noProgress ?? 0) + 1
      : 0;
    const error = summarizeVerification(verification, agentResult);
    const nextConsecutive = (state.consecutiveFailures ?? 0) + 1;
    const exhausted = attempt >= maxAttempts || noProgress >= maxNoProgress;
    const shouldBlock = exhausted || nextConsecutive >= maxConsecutiveFailures;

    if (config.git?.resetOnFailure !== false) {
      resetToHead(root);
    }

    state.tasks[task.id] = {
      ...state.tasks[task.id],
      status: shouldBlock ? "blocked" : "failed",
      attempts: attempt,
      lastError: error,
      lastDiffHash: hash,
      noProgress,
    };
    state.consecutiveFailures = nextConsecutive;
    state.currentTaskId = null;
    iterations += 1;
    state.lastRun.iterations = iterations;
    appendProgress(root, task, shouldBlock ? "blocked" : "failed", verification, {
      attempt,
      durationMs,
      files: changedFiles,
      note: error,
    });

    if (shouldBlock) {
      state.status = "blocked";
      state.lastRun.reason = `task ${task.id} blocked after ${attempt} attempt(s)`;
      appendEscalation(root, task, `Task blocked after ${attempt} attempt(s).`, error);
    }

    saveState(root, state);
    if (options.commit && config.git?.commit !== false) {
      commitControllerState(
        root,
        `${config.git?.commitPrefix ?? "loop"}(${task.id}): record ${shouldBlock ? "blocked" : "failure"}`
      );
    }

    if (shouldBlock) {
      console.error(`Blocked ${task.id}. See loop/ESCALATIONS.md.`);
      return 2;
    }

    if (options.once) {
      state.status = "paused";
      state.lastRun.reason = "once flag after failure";
      break;
    }
  }

  state.lastRun.finishedAt = nowIso();
  state.lastRun.durationMs = Date.now() - startedAt;
  saveState(root, state);
  if (options.commit && config.git?.commit !== false) {
    commitControllerState(root, `${config.git?.commitPrefix ?? "loop"}: ${state.status}`);
  }
  console.log(`\nLoop status: ${state.status}`);
  console.log(`Iterations: ${iterations}`);
  if (state.lastRun.reason) console.log(`Reason: ${state.lastRun.reason}`);
  return lastExitCode;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
