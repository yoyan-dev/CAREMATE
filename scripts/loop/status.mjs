#!/usr/bin/env node
import {
  loadBacklog,
  loadConfig,
  loadState,
  pendingTasks,
  selectNextTask,
  taskState,
} from "./lib.mjs";

const root = process.cwd();
const config = loadConfig(root);
const state = loadState(root);
const tasks = loadBacklog(root);
const includeOptional = process.argv.includes("--include-optional");

console.log(`CAREMATE loop — ${state.status}`);
console.log(`Iterations: ${state.iterations ?? 0}`);
console.log(`Budget: ${config.budget?.maxIterationsPerRun ?? 20} iterations, ${config.budget?.maxMinutesPerRun ?? 480} minutes per run`);
console.log("");

const rows = tasks
  .filter((task) => includeOptional || !task.optional)
  .map((task) => {
    const current = taskState(state, task.id);
    return {
      id: task.id,
      phase: task.phase,
      status: current.status ?? "pending",
      attempts: current.attempts ?? 0,
      gate: task.humanGate ? (task.blocking === false ? "human" : "GATE") : "",
      title: task.title,
    };
  });

for (const row of rows) {
  const status = row.status.padEnd(14);
  const gate = row.gate.padEnd(5);
  console.log(`${row.id}  P${row.phase}  ${status} ${gate} ${row.title}`);
}

const next = selectNextTask(tasks, state, { includeOptional });
console.log("");
console.log(`Next runnable task: ${next ? `${next.id} — ${next.title}` : "none"}`);
console.log(`Pending: ${pendingTasks(tasks, state, { includeOptional }).length}`);
