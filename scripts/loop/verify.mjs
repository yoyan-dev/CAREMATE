#!/usr/bin/env node
import { loadBacklog, loadConfig, loadState, taskState, verifyTask } from "./lib.mjs";

function usage() {
  return `CAREMATE task verifier

Usage:
  node scripts/loop/verify.mjs <task-id>
  npm run verify -- <task-id>

Runs the global checks, the task checks, and the anti-gaming guard.
Exits 0 when the task passes, 1 when it fails.
`;
}

const taskId = process.argv[2];

if (!taskId || taskId === "--help" || taskId === "-h") {
  console.log(usage());
  process.exit(taskId ? 0 : 1);
}

const root = process.cwd();
const config = loadConfig(root);
const state = loadState(root);
const tasks = loadBacklog(root);
const task = tasks.find((entry) => entry.id === taskId);

if (!task) {
  console.error(`Unknown task: ${taskId}`);
  process.exit(1);
}

const current = taskState(state, taskId);
if (current.status === "completed") {
  console.log(`Task ${taskId} is already completed.`);
  process.exit(0);
}

console.log(`Verifying ${task.id} — ${task.title}`);
const verification = verifyTask(root, config, task);

for (const result of verification.results) {
  console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name}: ${result.detail}`);
}
for (const failure of verification.guardFailures) {
  console.log(`FAIL guard: ${failure}`);
}

if (verification.ok) {
  console.log("\nAll checks passed.");
  process.exit(0);
}

console.log("\nVerification failed.");
process.exit(1);
