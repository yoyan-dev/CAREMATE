# CAREMATE development loop

This directory is the durable memory and control surface for the autonomous
development loop. The full design is in [`../docs/LOOP_PLAN.md`](../docs/LOOP_PLAN.md).

## Quick start

```bash
npm run loop:status      # show backlog and next task
npm run loop:dry         # print the next prompt without calling the agent
npm run loop:once        # run one task
npm run loop             # run a budgeted batch
```

Approve a human gate:

```bash
npm run loop:approve -- P0-09 "Reviewed on device"
```

Verify a task manually:

```bash
npm run verify -- P0-03
```

## Files

| Path | Purpose |
|---|---|
| `config.json` | Budgets, agent command, verification rules, protected paths |
| `state.json` | Machine state: task statuses, attempts, commits, hashes |
| `backlog/*.json` | The 58-task development backlog |
| `prompts/iteration.md` | Prompt template for one task |
| `PROGRESS.md` | Human-readable run log |
| `ESCALATIONS.md` | Human gate and blocker queue |
| `runs/` | Per-iteration prompts and agent logs (gitignored) |

## Rules

- One task per iteration.
- The agent never commits, pushes, deploys, or submits.
- The controller verifies with deterministic checks before committing.
- The agent cannot edit the loop, verifier, backlog, state, or its own config.
- Blocking human gates stop the loop.
- A dirty working tree stops the loop; commit or stash first.

## Adding a task

Add a JSON object to the relevant `backlog/*.json` file:

```json
{
  "id": "P2-12",
  "title": "Short imperative title",
  "priority": "P1",
  "dependsOn": ["P2-03"],
  "humanGate": false,
  "estimatedMinutes": 60,
  "scope": ["path/to/file"],
  "acceptance": ["Observable, testable outcome"],
  "checks": [
    { "type": "fileExists", "path": "path/to/file" },
    { "type": "command", "name": "tests", "cmd": "npm test -- --runInBand pattern" }
  ]
}
```

Prefer small tasks with deterministic checks. If you cannot write a check, the
task is underspecified.
