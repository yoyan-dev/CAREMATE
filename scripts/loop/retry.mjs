#!/usr/bin/env node
import {
  appendProgress,
  commitControllerState,
  currentBranch,
  loadBacklog,
  loadConfig,
  loadState,
  nowIso,
  saveState,
  taskState,
} from "./lib.mjs";

function usage() {
  return `Retry a blocked or failed task

Usage:
  npm run loop:retry -- <task-id> "reason"
  node scripts/loop/retry.mjs <task-id> "reason"

Resets attempts, clears the last error, and sets the task back to pending.
`;
}

const args = process.argv.slice(2);
const taskId = args[0];
const note = args.slice(1).join(" ").trim();

if (!taskId || taskId === "--help" || taskId === "-h") {
  console.log(usage());
  process.exit(taskId ? 0 : 1);
}

const root = process.cwd();
const config = loadConfig(root);
const branch = currentBranch(root);
if (config.git?.branch && branch !== config.git.branch) {
  console.error(`Retries must run on ${config.git.branch}; current branch is ${branch}.`);
  process.exit(1);
}

const state = loadState(root);
const tasks = loadBacklog(root);
const task = tasks.find((entry) => entry.id === taskId);

if (!task) {
  console.error(`Unknown task: ${taskId}`);
  process.exit(1);
}

const current = taskState(state, taskId);
state.tasks[taskId] = {
  ...current,
  status: "pending",
  attempts: 0,
  noProgress: 0,
  lastError: null,
  retriedAt: nowIso(),
  retryNote: note || "Retried without a note.",
};
state.status = "idle";
state.currentTaskId = null;
saveState(root, state);
appendProgress(root, task, "retried", null, {
  note: `Retry requested: ${note || "no note"}`,
});
commitControllerState(root, `loop(${taskId}): retry`);

console.log(`Reset ${taskId} to pending. Run \`npm run loop\` to retry.`);
