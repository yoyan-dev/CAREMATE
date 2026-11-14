import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export function nowIso() {
  return new Date().toISOString();
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function appendText(file, text) {
  ensureDir(path.dirname(file));
  fs.appendFileSync(file, text, "utf8");
}

export function loadConfig(root) {
  return readJson(path.join(root, "loop", "config.json"));
}

export function loadState(root) {
  return readJson(path.join(root, "loop", "state.json"));
}

export function saveState(root, state) {
  state.updatedAt = nowIso();
  writeJson(path.join(root, "loop", "state.json"), state);
}

export function loadBacklog(root) {
  const dir = path.join(root, "loop", "backlog");
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort();

  const tasks = [];
  for (const file of files) {
    const doc = readJson(path.join(dir, file));
    for (const task of doc.tasks) {
      tasks.push({
        ...task,
        phase: doc.phase,
        phaseName: doc.name,
        phaseGoal: doc.goal,
        optional: Boolean(doc.optional || task.optional),
        sourceFile: file,
      });
    }
  }

  tasks.sort((a, b) => a.phase - b.phase || a.id.localeCompare(b.id));
  return tasks;
}

export function taskState(state, id) {
  return state.tasks?.[id] ?? { status: "pending", attempts: 0 };
}

export function isTaskDone(state, id) {
  return taskState(state, id).status === "completed";
}

export function selectNextTask(tasks, state, options = {}) {
  const includeOptional = Boolean(options.includeOptional);

  for (const task of tasks) {
    if (task.optional && !includeOptional) continue;

    const current = taskState(state, task.id);
    if (["completed", "blocked", "awaiting_human", "skipped"].includes(current.status)) {
      continue;
    }

    const depsReady = (task.dependsOn ?? []).every((dep) => isTaskDone(state, dep));
    if (!depsReady) continue;

    return task;
  }

  return null;
}

export function pendingTasks(tasks, state, options = {}) {
  const includeOptional = Boolean(options.includeOptional);
  return tasks.filter((task) => {
    if (task.optional && !includeOptional) return false;
    const current = taskState(state, task.id);
    return !["completed", "blocked", "awaiting_human", "skipped"].includes(current.status);
  });
}

export function runCommand(cmd, { cwd, timeoutMs = 120000 } = {}) {
  const result = spawnSync(cmd, {
    cwd,
    shell: true,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 20 * 1024 * 1024,
  });

  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error ? String(result.error.message ?? result.error) : null,
  };
}

export function git(root, args) {
  return spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
}

export function gitText(root, args) {
  const result = git(root, args);
  return {
    ok: result.status === 0,
    text: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
  };
}

export function currentBranch(root) {
  return gitText(root, ["rev-parse", "--abbrev-ref", "HEAD"]).text;
}

export function branchExists(root, branch) {
  return git(root, ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]).status === 0;
}

export function ensureBranch(root, config) {
  const target = config.git?.branch;
  if (!target) return { ok: true, message: "No branch configured" };

  const current = currentBranch(root);
  if (current === target) return { ok: true, message: `On ${target}` };

  if (!config.git?.autoCreateBranch) {
    return { ok: false, message: `Expected branch ${target}, found ${current}. Switch or enable autoCreateBranch.` };
  }

  const args = branchExists(root, target) ? ["switch", target] : ["switch", "-c", target];
  const result = git(root, args);
  if (result.status !== 0) {
    return { ok: false, message: `Could not switch to ${target}: ${result.stderr || result.stdout}` };
  }

  return { ok: true, message: `Switched to ${target}` };
}

export function ensureClean(root) {
  const result = git(root, ["status", "--porcelain", "--untracked-files=all"]);
  const output = (result.stdout ?? "").trim();
  return { ok: output.length === 0, status: output };
}

export function resetToHead(root) {
  git(root, ["reset", "--hard", "HEAD"]);
  git(root, ["clean", "-fd"]);
}

export function getChangedFiles(root) {
  const tracked = gitText(root, ["diff", "--name-only", "HEAD"]);
  const untracked = gitText(root, ["ls-files", "--others", "--exclude-standard"]);
  const files = new Set();
  for (const line of tracked.text.split("\n")) if (line.trim()) files.add(line.trim());
  for (const line of untracked.text.split("\n")) if (line.trim()) files.add(line.trim());
  return [...files].sort();
}

export function isTrackedInHead(root, file) {
  return git(root, ["cat-file", "-e", `HEAD:${file}`]).status === 0;
}

export function getHeadContent(root, file) {
  const result = git(root, ["show", `HEAD:${file}`]);
  return result.status === 0 ? result.stdout : null;
}

export function getWorkingContent(root, file) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : null;
}

export function countTests(content) {
  if (!content) return 0;
  const matches = content.match(/\b(?:it|test)\s*\(/g);
  return matches ? matches.length : 0;
}

export function globToRegExp(pattern) {
  let out = "^";
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === "*") {
      if (pattern[i + 1] === "*") {
        out += ".*";
        i += 1;
      } else {
        out += "[^/]*";
      }
    } else if (char === "?") {
      out += "[^/]";
    } else if ("\\^$+.()|{}[]".includes(char)) {
      out += `\\${char}`;
    } else {
      out += char;
    }
  }
  out += "$";
  return new RegExp(out, "i");
}

export function matchesAny(file, patterns = []) {
  return patterns.some((pattern) => globToRegExp(pattern).test(file));
}

export function getAddedLines(root) {
  const added = [];
  const diff = gitText(root, ["diff", "--no-color", "-U0", "HEAD"]);
  let currentFile = null;

  if (diff.ok) {
    for (const line of diff.text.split("\n")) {
      if (line.startsWith("+++ b/")) {
        currentFile = line.slice("+++ b/".length);
        continue;
      }
      if (line.startsWith("+++ ")) {
        currentFile = line.slice(4);
        continue;
      }
      if (line.startsWith("+") && !line.startsWith("+++") && currentFile) {
        added.push({ file: currentFile, line, text: line.slice(1) });
      }
    }
  }

  for (const file of getChangedFiles(root)) {
    if (isTrackedInHead(root, file)) continue;
    const content = getWorkingContent(root, file);
    if (!content) continue;
    content.split("\n").forEach((text, index) => {
      added.push({ file, line: index + 1, text });
    });
  }

  return added;
}

export function getAgentChangedFiles(root, config) {
  const owned = config?.verify?.controllerOwnedPaths ?? [];
  return getChangedFiles(root).filter((file) => !matchesAny(file, owned));
}

export function checkGuard(root, config, task) {
  const failures = [];
  const verify = config.verify ?? {};
  const owned = verify.controllerOwnedPaths ?? [];
  const changed = getAgentChangedFiles(root, config);

  if (verify.requireChanges !== false && changed.length === 0 && !task.allowNoChanges) {
    failures.push("No changes were produced for this task.");
  }

  for (const file of changed) {
    if (matchesAny(file, verify.protectedPaths ?? [])) {
      failures.push(`Protected path was modified: ${file}`);
    }
    if (matchesAny(file, verify.protectedModifyOnly ?? []) && isTrackedInHead(root, file)) {
      failures.push(`Protected file was modified: ${file}`);
    }
  }

  const forbidden = (verify.forbiddenAddedPatterns ?? []).map((pattern) => ({
    pattern,
    regex: new RegExp(pattern),
  }));

  for (const entry of getAddedLines(root)) {
    if (matchesAny(entry.file, owned)) continue;
    for (const rule of forbidden) {
      if (rule.regex.test(entry.text)) {
        failures.push(`Forbidden pattern ${rule.pattern} added in ${entry.file}:${entry.line}`);
      }
    }
  }

  const testPatterns = verify.testFilePatterns ?? [];
  for (const file of changed) {
    if (!matchesAny(file, testPatterns)) continue;
    const before = getHeadContent(root, file);
    const after = getWorkingContent(root, file);
    if (before && !after) {
      failures.push(`Test file was deleted: ${file}`);
      continue;
    }
    if (before && after && countTests(after) < countTests(before)) {
      failures.push(`Test count decreased in ${file} (${countTests(before)} -> ${countTests(after)})`);
    }
  }

  const scripts = verify.scriptIntegrity ?? {};
  const beforePkg = getHeadContent(root, "package.json");
  const afterPkg = getWorkingContent(root, "package.json");
  if (beforePkg && afterPkg) {
    let before;
    let after;
    try {
      before = JSON.parse(beforePkg);
      after = JSON.parse(afterPkg);
    } catch {
      failures.push("package.json is not valid JSON.");
    }
    if (before && after) {
      for (const [name, token] of Object.entries(scripts)) {
        const beforeScript = before.scripts?.[name];
        if (!beforeScript) continue;
        const afterScript = after.scripts?.[name];
        if (!afterScript) {
          failures.push(`package.json script "${name}" was removed.`);
        } else if (!afterScript.includes(token)) {
          failures.push(`package.json script "${name}" no longer contains "${token}".`);
        }
      }
    }
  }

  return failures;
}

export function runCheck(spec, root) {
  const name = spec.name || spec.type;
  try {
    switch (spec.type) {
      case "command": {
        const result = runCommand(spec.cmd, { cwd: root, timeoutMs: spec.timeoutMs ?? 120000 });
        return {
          name,
          type: spec.type,
          ok: result.ok,
          detail: result.ok ? "passed" : (result.stderr || result.stdout || result.error || "failed").trim(),
        };
      }
      case "fileExists": {
        const ok = fs.existsSync(path.join(root, spec.path));
        return { name, type: spec.type, ok, detail: ok ? "exists" : `missing ${spec.path}` };
      }
      case "fileNotExists": {
        const ok = !fs.existsSync(path.join(root, spec.path));
        return { name, type: spec.type, ok, detail: ok ? "absent" : `unexpected ${spec.path}` };
      }
      case "dirExists": {
        const full = path.join(root, spec.path);
        const ok = fs.existsSync(full) && fs.statSync(full).isDirectory();
        return { name, type: spec.type, ok, detail: ok ? "exists" : `missing directory ${spec.path}` };
      }
      case "fileContains": {
        const full = path.join(root, spec.path);
        if (!fs.existsSync(full)) {
          return { name, type: spec.type, ok: false, detail: `missing ${spec.path}` };
        }
        const content = fs.readFileSync(full, "utf8");
        const ok = new RegExp(spec.pattern, "m").test(content);
        return { name, type: spec.type, ok, detail: ok ? "matched" : `pattern not found: ${spec.pattern}` };
      }
      case "fileNotContains": {
        const full = path.join(root, spec.path);
        if (!fs.existsSync(full)) {
          return { name, type: spec.type, ok: false, detail: `missing ${spec.path}` };
        }
        const content = fs.readFileSync(full, "utf8");
        const ok = !new RegExp(spec.pattern, "m").test(content);
        return { name, type: spec.type, ok, detail: ok ? "not matched" : `forbidden pattern found: ${spec.pattern}` };
      }
      case "jsonValid": {
        const full = path.join(root, spec.path);
        if (!fs.existsSync(full)) {
          return { name, type: spec.type, ok: false, detail: `missing ${spec.path}` };
        }
        JSON.parse(fs.readFileSync(full, "utf8"));
        return { name, type: spec.type, ok: true, detail: "valid JSON" };
      }
      case "minTestCount": {
        const full = path.join(root, spec.path);
        if (!fs.existsSync(full)) {
          return { name, type: spec.type, ok: false, detail: `missing ${spec.path}` };
        }
        const count = countTests(fs.readFileSync(full, "utf8"));
        return {
          name,
          type: spec.type,
          ok: count >= spec.min,
          detail: `${count} tests (minimum ${spec.min})`,
        };
      }
      default:
        return { name, type: spec.type, ok: false, detail: `unknown check type: ${spec.type}` };
    }
  } catch (error) {
    return { name, type: spec.type, ok: false, detail: String(error.message ?? error) };
  }
}

export function verifyTask(root, config, task) {
  const results = [];
  for (const spec of config.verify?.globalChecks ?? []) {
    results.push(runCheck({ name: `global:${spec.name || spec.type}`, ...spec }, root));
  }
  for (const spec of task.checks ?? []) {
    results.push(runCheck(spec, root));
  }

  const guardFailures = checkGuard(root, config, task);
  return {
    ok: results.every((result) => result.ok) && guardFailures.length === 0,
    results,
    guardFailures,
  };
}

export function describeCheck(spec) {
  switch (spec.type) {
    case "command":
      return `command: ${spec.cmd}`;
    case "fileExists":
      return `file exists: ${spec.path}`;
    case "fileNotExists":
      return `file absent: ${spec.path}`;
    case "dirExists":
      return `directory exists: ${spec.path}`;
    case "fileContains":
      return `file contains /${spec.pattern}/: ${spec.path}`;
    case "fileNotContains":
      return `file does not contain /${spec.pattern}/: ${spec.path}`;
    case "jsonValid":
      return `valid JSON: ${spec.path}`;
    case "minTestCount":
      return `at least ${spec.min} tests: ${spec.path}`;
    default:
      return `${spec.type}: ${spec.path || spec.cmd || ""}`;
  }
}

export function buildPrompt(root, task, state, config) {
  const template = fs.readFileSync(path.join(root, "loop", "prompts", "iteration.md"), "utf8");
  const current = taskState(state, task.id);
  const previous = current.lastError
    ? `## Previous failure\n\n\`\`\`\n${String(current.lastError).slice(0, 4000)}\n\`\`\`\n`
    : "";

  const completed = Object.values(state.tasks ?? {}).filter((entry) => entry.status === "completed").length;
  const blocked = Object.entries(state.tasks ?? {})
    .filter(([, entry]) => entry.status === "blocked")
    .map(([id]) => id);
  const awaitingHuman = Object.entries(state.tasks ?? {})
    .filter(([, entry]) => entry.status === "awaiting_human")
    .map(([id]) => id);

  const stateSummary = JSON.stringify(
    {
      status: state.status,
      iterations: state.iterations,
      completedTasks: completed,
      blockedTasks: blocked,
      awaitingHuman,
      currentTask: task.id,
    },
    null,
    2
  );

  const verifyCommands = [
    ...(config.verify?.globalChecks ?? []).map((check) => `- global ${describeCheck(check)}`),
    ...(task.checks ?? []).map((check) => `- ${describeCheck(check)}`),
  ].join("\n");

  const replacements = {
    "{{TASK_ID}}": task.id,
    "{{TASK_JSON}}": JSON.stringify(task, null, 2),
    "{{STATE_SUMMARY}}": stateSummary,
    "{{ATTEMPT}}": String((current.attempts ?? 0) + 1),
    "{{MAX_ATTEMPTS}}": String(config.budget?.maxAttemptsPerTask ?? 3),
    "{{PREVIOUS_ERROR}}": previous,
    "{{PROTECTED_PATHS}}": (config.verify?.protectedPaths ?? []).join(", "),
    "{{VERIFY_COMMANDS}}": verifyCommands || "- none",
    "{{ROOT}}": root,
  };

  let prompt = template;
  for (const [key, value] of Object.entries(replacements)) {
    prompt = prompt.split(key).join(value);
  }
  return prompt;
}

export function diffHash(root, config) {
  const hash = crypto.createHash("sha256");

  for (const file of getAgentChangedFiles(root, config)) {
    if (isTrackedInHead(root, file)) {
      const diff = git(root, ["diff", "--no-color", "HEAD", "--", file]);
      if (diff.stdout) hash.update(diff.stdout);
    } else {
      const content = getWorkingContent(root, file);
      if (content) {
        hash.update(file);
        hash.update(content);
      }
    }
  }

  return hash.digest("hex");
}

export function commitControllerState(root, message) {
  const files = ["loop/state.json", "loop/PROGRESS.md", "loop/ESCALATIONS.md"].filter((file) =>
    fs.existsSync(path.join(root, file))
  );
  if (files.length === 0) return { ok: true, message: "no controller state" };

  const add = git(root, ["add", "--", ...files]);
  if (add.status !== 0) {
    return { ok: false, message: (add.stderr || add.stdout || "git add failed").trim() };
  }

  const staged = git(root, ["diff", "--cached", "--name-only", "--", ...files]);
  if (!(staged.stdout ?? "").trim()) return { ok: true, message: "no controller changes" };

  const commit = git(root, ["commit", "-m", message]);
  if (commit.status !== 0) {
    return { ok: false, message: (commit.stderr || commit.stdout || "git commit failed").trim() };
  }

  return { ok: true, message: "committed", sha: gitText(root, ["rev-parse", "--short", "HEAD"]).text };
}

export function commitAll(root, config, task, verification) {
  const prefix = config.git?.commitPrefix ?? "loop";
  const add = git(root, ["add", "-A"]);
  if (add.status !== 0) {
    return { ok: false, message: (add.stderr || add.stdout || "git add failed").trim() };
  }

  const body = [
    `Task: ${task.id} — ${task.title}`,
    `Phase: ${task.phase} — ${task.phaseName}`,
    "",
    "Checks:",
    ...verification.results.map((result) => `- ${result.ok ? "PASS" : "FAIL"} ${result.name}: ${result.detail}`),
    ...(verification.guardFailures.length ? ["", "Guard failures:", ...verification.guardFailures.map((line) => `- ${line}`)] : []),
  ].join("\n");

  const result = git(root, ["commit", "-m", `${prefix}(${task.id}): ${task.title}`, "-m", body]);
  if (result.status !== 0) {
    return { ok: false, message: (result.stderr || result.stdout || "git commit failed").trim() };
  }

  const sha = gitText(root, ["rev-parse", "--short", "HEAD"]).text;
  return { ok: true, sha, message: "committed" };
}

export function appendProgress(root, task, status, verification, extra = {}) {
  const lines = [
    `## ${nowIso()} — ${task.id} ${task.title}`,
    "",
    `- phase: ${task.phase} — ${task.phaseName}`,
    `- status: ${status}`,
    `- attempt: ${extra.attempt ?? 1}`,
    `- duration: ${extra.durationMs ?? 0}ms`,
    `- commit: ${extra.commit ?? "none"}`,
    `- files: ${(extra.files ?? []).join(", ") || "none"}`,
    "",
  ];

  if (verification) {
    lines.push("### Checks", "");
    for (const result of verification.results) {
      lines.push(`- ${result.ok ? "PASS" : "FAIL"} **${result.name}**: ${result.detail}`);
    }
    if (verification.guardFailures?.length) {
      lines.push("", "### Guard failures", "");
      for (const failure of verification.guardFailures) lines.push(`- ${failure}`);
    }
  }

  if (extra.note) lines.push("", extra.note);
  lines.push("", "---", "");
  appendText(path.join(root, "loop", "PROGRESS.md"), `${lines.join("\n")}\n`);
}

export function appendEscalation(root, task, reason, details = "") {
  const lines = [
    `## ${nowIso()} — ${task.id} ${task.title}`,
    "",
    `- phase: ${task.phase} — ${task.phaseName}`,
    `- reason: ${reason}`,
    `- action: review the task, then run \`npm run loop:approve -- ${task.id} "your note"\` if it is complete`,
    "",
    details,
    "",
    "---",
    "",
  ];
  appendText(path.join(root, "loop", "ESCALATIONS.md"), `${lines.join("\n")}\n`);
}
