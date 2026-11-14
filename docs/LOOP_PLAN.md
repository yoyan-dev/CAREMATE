# CAREMATE Development Loop — Plan & Setup

| | |
|---|---|
| **Status** | Ready to run |
| **Loop type** | Goal-driven, phase-gated development loop |
| **Scope** | Entire CAREMATE development: prototype stabilization → architecture → core features → safety → personalization → launch → optional post-launch |
| **Trigger** | Manual `npm run loop` (one run = one budgeted batch) |
| **Agent** | OpenCode `caremate-dev` worker |
| **Verifier** | Deterministic checks + anti-gaming guard |
| **Memory** | `loop/state.json`, `loop/PROGRESS.md`, `loop/ESCALATIONS.md`, git history |
| **Human boundary** | Phase reviews, medical/legal sign-off, backend decision, deployment, store submission |

---

## 1. Whiteboard five

| Question | Answer |
|---|---|
| **What triggers it?** | A human runs `npm run loop`. This is a goal-driven batch loop, not an unattended cron. It runs until the phase gate, budget, or blocker. |
| **What does it check each cycle?** | Read `loop/state.json`, select the first pending task whose dependencies are complete, and confirm the repo is clean. |
| **What action does it take?** | Invoke the `caremate-dev` agent for exactly one task; the agent edits code/tests/docs. The controller then verifies and commits locally. |
| **When does it stop?** | Task checks pass and a local commit is created; or a blocking human gate is reached; or the iteration/time budget is exhausted; or a task fails its retry/no-progress limit. |
| **When does it escalate?** | Phase reviews, medical/legal review, backend/auth choice, production build, store submission, and any task that fails repeatedly or cannot be verified. |

---

## 2. The seven principles in this setup

### 1. Leverage is in the loop, not the prompt

The loop owns selection, verification, retries, state, commits, and gates. The
prompt only describes one task. This is why `scripts/loop/run.mjs` and
`loop/backlog/**` matter more than any single prompt.

### 2. "Done" is machine-checkable

Every task has `checks` in `loop/backlog/**`. Examples:

- `fileExists`, `fileNotExists`, `dirExists`
- `fileContains`, `fileNotContains`
- `jsonValid`
- `minTestCount`
- `command` (typecheck, lint, tests, custom checks)

The loop does not accept the agent's self-report. A task is complete only when
`scripts/loop/verify.mjs` exits 0.

### 3. Verify with deterministic tools, never self-report

Verification layers:

1. **Global checks** — TypeScript, ESLint, `git diff --check`.
2. **Task checks** — the declarative checks above.
3. **Anti-gaming guard** — protected paths, forbidden added patterns, test-count
   integrity, and package-script integrity.
4. **Human review** — phase gates and medical/legal sign-off.

The agent is denied commit/push and cannot edit the verifier, backlog, state, or
agent config. The controller commits only after verification.

### 4. All exits and guardrails are defined

| Exit | Condition | Behavior |
|---|---|---|
| **Success** | All non-optional tasks completed and gates approved | `status: complete`, exit 0 |
| **Human gate** | A task has `humanGate: true` and `blocking: true` | `status: awaiting_human`, exit 0, escalation written |
| **Failure** | Agent error, verification failure, commit failure | Retry up to 3 attempts |
| **Budget** | 20 iterations or 480 minutes per run | `status: paused`, exit 0; resume later |
| **No progress** | Same diff hash twice, or 3 attempts on one task | Mark `blocked`, escalate, exit 2 |
| **Consecutive failures** | 2 failed tasks in a row | Mark `blocked`, escalate, exit 2 |

Concrete budgets live in `loop/config.json` and can be overridden per run with
`--max-iterations` and `--max-minutes`.

### 5. Context is finite

Each iteration starts a fresh agent session. The prompt contains only:

- the current task JSON,
- a small state summary,
- the previous error (if any),
- guardrails,
- the exact checks.

It does not replay the whole development history. Durable context lives on disk.

### 6. Filesystem is memory

| File | Purpose |
|---|---|
| `loop/state.json` | Machine state: statuses, attempts, hashes, commits |
| `loop/backlog/**` | Immutable task definitions and acceptance criteria |
| `loop/PROGRESS.md` | Human-readable run log |
| `loop/ESCALATIONS.md` | Human gate and blocker queue |
| `loop/runs/**` | Per-iteration prompt and agent logs (gitignored) |
| git history | Every verified task is a local commit |

Every cycle re-reads state and backlog from disk. Nothing important lives only in
the conversation.

### 7. Semi-autonomous, not fully autonomous

Automated: reading, editing, running checks, local commits, updating state.

Gated behind a human:

- phase reviews,
- medical content review,
- legal/privacy review,
- backend/auth choice,
- production builds,
- store submission,
- any push, merge, or deployment.

This is the correct boundary: reversible internal work is automated; irreversible
or outward-facing work stops for a human.

---

## 3. Control flow

```
load config, state, backlog
ensure branch loop/dev
ensure clean working tree
while within budget:
  task = first pending task with completed dependencies
  if no task: exit complete / awaiting_human / paused
  if task is blocking human gate:
    mark awaiting_human, escalate, exit
  if attempts >= max: block, escalate, exit
  write prompt for one task
  run caremate-dev agent
  run global + task checks + guard
  if pass:
    commit locally
    mark completed
  else:
    record failure, reset working tree
    retry until attempt/no-progress limit
```

---

## 4. Anti-gaming guard

The controller checks every diff before committing:

- **Protected paths**: `loop/**`, `scripts/loop/**`, `.opencode/**`, `.git/**`.
- **Modify-only protected**: `jest.config.*`, `.github/**`.
- **Forbidden added patterns**: `.skip(`, `xit(`, `xdescribe(`, `describe.skip`,
  `it.skip`, `test.skip`, `continue-on-error`, `--no-verify`,
  `process.exit(0)`, `coverageThreshold`, `@ts-ignore`, `@ts-expect-error`,
  `eslint-disable`.
- **Test integrity**: test files cannot be deleted and test counts cannot drop.
- **Script integrity**: `typecheck`, `test`, `verify`, and `loop` scripts cannot
  be removed or replaced with a no-op.
- **No empty success**: a task must produce changes unless it explicitly allows
  none.

If the guard fails, the task is not committed and counts as a failure.

---

## 5. Full development coverage

The backlog contains **58 tasks** across seven phases:

| Phase | Tasks | Covers | Exit |
|---|---|---|---|
| **0 — Stabilize** | 9 | Env, test harness, voice fix, dead code, AI hardening, rename, CI, a11y | Human review gate |
| **1 — Architecture** | 11 | `src/` structure, theme, SQLite, state, AI client, error handling, screen migration, ADRs, proxy contract | Human review + backend decision |
| **2 — Core product** | 11 | Onboarding, tabs, streaming chat, voice UI, history, guides, settings, offline, performance | Human review |
| **3 — Safety** | 7 | Red flags, emergency screen, safety output checks, legal copy, medical review, adversarial tests | Human review |
| **4 — Personalization** | 6 | Profile, reminders, favorites, triage, analytics consent | Human review |
| **5 — Launch** | 9 | E2E, a11y audit, performance, Sentry, store assets, legal review, build, submission | Launch approval |
| **6 — Post-launch** | 5 | Auth/sync, i18n, widgets, content expansion | Optional |

### Feature coverage matrix

| Brief feature | Covered by |
|---|---|
| Onboarding & consent | P2-01 |
| Home dashboard | P2-02, P4-03 |
| AI chat (text, streaming) | P2-03 |
| Voice conversation | P0-03, P2-04 |
| Chat history | P1-03, P2-05 |
| First-aid library | P2-06, P2-07 |
| Emergency flow | P3-02 |
| Safety guardrails | P3-01, P3-03, P3-06 |
| Settings | P2-08 |
| Health profile | P4-01 |
| Medication reminders | P4-02 |
| Symptom checker | P4-04 |
| Offline support | P2-09 |
| Analytics consent | P4-05 |
| Launch readiness | P5-01 → P5-09 |
| Auth / cloud sync | P6-01 |
| i18n | P6-02 |
| Widgets | P6-03 |

---

## 6. Runbook

### First-time setup

```bash
npm install
npm run loop:status
npm run loop:dry          # inspect the first prompt without spending tokens
```

### Run one task

```bash
npm run loop:once
```

### Run a batch

```bash
npm run loop
```

### Check status

```bash
npm run loop:status
```

### Approve a human gate

Run this on the `loop/dev` branch (the branch the loop creates):

```bash
npm run loop:approve -- P0-09 "Reviewed on device; mic and chat work."
```

Then continue:

```bash
npm run loop
```

### Include optional post-launch tasks

```bash
npm run loop -- --include-optional
```

### Verify a task manually

```bash
npm run verify -- P0-03
```

### Resume after a stop

State is durable. Just run `npm run loop` again. If the tree is dirty, commit or
stash first; the loop refuses to start on a dirty tree.

### Retry a blocked task

```bash
npm run loop:retry -- P0-03 "Fixed the fixture manually"
```

This resets attempts and clears the last error. Use it only after understanding
why the task blocked; otherwise the loop will hit the same wall.

---

## 7. Human gate policy

| Gate | Why it is human |
|---|---|
| Phase reviews | Test quality, UX, and architecture judgment |
| P1-10 backend/auth | Cost, vendor, and security decision |
| P3-05 medical content | Clinical accuracy and liability |
| P5-06 legal/privacy | Legal exposure and store policy |
| P5-07 production build | Cost and release timing |
| P5-08 store submission | Irreversible external action |
| P6-01 auth/sync | Privacy and infrastructure decision |

A blocking gate stops the loop. A non-blocking gate is recorded and the loop
continues with independent tasks.

---

## 8. What the loop will not do

- Push, merge, or open a PR automatically.
- Deploy a backend.
- Run `eas build` or `eas submit`.
- Publish a package.
- Rotate or create API keys.
- Approve medical or legal content.
- Weaken or delete tests to make checks pass.
- Edit its own verifier, backlog, state, or permissions.

---

## 9. Success metrics for the loop itself

| Metric | Target |
|---|---|
| Verified task commit rate | ≥ 80% of attempts |
| Rework rate | ≤ 20% of tasks need a second attempt |
| Guard violations | 0 committed |
| Blocked tasks | ≤ 1 per phase |
| Human review time per phase | ≤ 45 minutes |
| Budget per phase | ≤ 8 hours wall-clock |

If rework or blocked tasks exceed these, tighten the task scope or add a
phase-specific check before continuing.

---

## 10. Setup checklist

- [x] Loop config and budgets
- [x] Durable state
- [x] 58-task backlog across all phases
- [x] Iteration prompt
- [x] Controller, verifier, status, and approval scripts
- [x] OpenCode worker and reviewer agents
- [x] Anti-gaming guard
- [x] Human gates and escalation queue
- [x] This plan
- [ ] Commit the setup to git
- [ ] Run `npm run loop:dry` and review the first prompt
- [ ] Run `npm run loop:once` for P0-01
