#!/usr/bin/env node
import {
  appendProgress,
  loadBacklog,
  loadState,
  nowIso,
  saveState,
  selectNextTask,
  taskState,
} from "./lib.mjs";

function usage() {
  return `Approve a human gate

Usage:
  npm run loop:approve -- <task-id> "review note"
  node scripts/loop/approve.mjs <task-id> "review note"

Only tasks marked humanGate can be approved.
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
const state = loadState(root);
const tasks = loadBacklog(root);
const task = tasks.find((entry) => entry.id === taskId);

if (!task) {
  console.error(`Unknown task: ${taskId}`);
  process.exit(1);
}

if (!task.humanGate) {
  console.error(`${taskId} is not a human gate. Use the verifier and the normal loop instead.`);
  process.exit(1);
}

const current = taskState(state, taskId);
state.tasks[taskId] = {
  ...current,
  status: "completed",
  attempts: current.attempts ?? 0,
  completedAt: nowIso(),
  approvedBy: "human",
  approvalNote: note || "Approved without a note.",
  lastError: null,
};

state.status = "idle";
state.currentTaskId = null;
saveState(root, state);
appendProgress(root, task, "approved", null, {
  note: `Human approval: ${note || "no note"}`,
});

const next = selectNextTask(tasks, state, { includeOptional: false });
console.log(`Approved ${taskId}.`);
console.log(`Next runnable task: ${next ? `${next.id} — ${next.title}` : "none"}`);
console.log("Run `npm run loop` to continue.");
