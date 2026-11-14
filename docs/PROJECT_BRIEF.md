# CAREMATE — Project Brief & Improvement Plan

| | |
|---|---|
| **Status** | Draft for review |
| **Date** | 2026-11-14 |
| **Project** | CAREMATE (formerly AIDME) |
| **Platform** | Expo / React Native (iOS, Android, web) |
| **Purpose** | Turn the current prototype into a reliable, safe, production-ready AI first-aid and home-care assistant |

---

## 1. Executive summary

CAREMATE is an Expo/React Native app that gives general first-aid, home-care, and wellness guidance through a text/voice chat with an AI assistant. Today it is a **working prototype**: a home screen, a chat screen, Gemini text responses, text-to-speech, local chat persistence, and a partially implemented microphone button.

The main gaps are not visual — they are **architecture, completeness, and safety**:

- The voice feature starts a recording but never stops or transcribes it.
- The app depends on a client-side API key and has no `.env`.
- Chat state, storage, and AI calls are tightly coupled in one hook.
- There is no first-aid content library, no emergency flow, no onboarding, no settings, no tests, and no CI.
- Legacy/dead code and starter-template files remain.

This brief defines the product scope, target architecture, file structure, engineering standards, and a phased roadmap to move from prototype to a shippable product.

**Recommended direction:** a **local-first mobile app** with an optional thin backend proxy for AI calls. Keep the app usable offline for first-aid content and history; never ship the Gemini key in the client.

---

## 2. Vision, goals, and non-goals

### 2.1 Problem

People facing a minor injury or health question often need fast, calm, plain-language guidance. Search results are noisy, generic chatbots are unsafe for medical topics, and users may not know when a situation is an emergency.

### 2.2 Target users

- **Primary:** everyday users (18–55) handling minor injuries, burns, choking, fever, allergic reactions, or home-care questions.
- **Secondary:** caregivers looking after children or older relatives.
- **Tertiary:** users in low-connectivity environments who need offline first-aid instructions.

### 2.3 Value proposition

> Calm, step-by-step first-aid and home-care guidance in seconds — by text or voice — with clear emergency escalation and no diagnosis or prescription.

### 2.4 Product goals

1. **Safe by default** — never diagnose, never prescribe, always escalate red flags.
2. **Fast to answer** — useful response in under 5 seconds for text; voice loop under 3 seconds after speech ends.
3. **Works offline** — core first-aid guides and chat history available without a network.
4. **Trustworthy** — medically reviewed content, visible disclaimers, transparent sources.
5. **Maintainable** — feature-based architecture, typed boundaries, tests, and CI.
6. **Accessible** — screen-reader labels, dynamic type, contrast, reduced motion, 44pt touch targets.

### 2.5 Non-goals (for v1)

- Diagnosis, triage certification, or replacing emergency services.
- Prescriptions, dosage calculation, or medication interaction checking.
- Insurance, billing, EHR integration, or clinician workflows.
- Social features, leaderboards, or public content sharing.
- HIPAA compliance claims. CAREMATE is a consumer wellness tool, not a covered entity.

---

## 3. Current-state assessment

### 3.1 What exists

| Area | Current state |
|---|---|
| Framework | Expo SDK 54, React Native 0.81, Expo Router 6, TypeScript strict |
| Screens | `app/screens/home-screen.tsx`, `app/screens/chatbot-screen.tsx` |
| Chat | `hooks/use-voice-assistance.ts` — messages, Gemini call, TTS |
| AI | `services/gemini.ts` — single-prompt Gemini REST call via axios |
| Voice | `expo-av` recording started but never stopped/transcribed |
| Storage | AsyncStorage key `chatMessages` |
| UI | Custom theme file, chat bubbles, animated talking avatar, Lottie assets |
| Tooling | ESLint, strict TS, EAS config, no tests, no CI |
| Dependencies | Includes unused 3D (`three`, `@react-three/*`), legacy voice packages, Lottie |

### 3.2 Verified gaps

| # | Gap | Impact |
|---|---|---|
| 1 | Microphone starts recording but `stopListening` never stops or transcribes | Voice feature is non-functional |
| 2 | No `.env`; `EXPO_PUBLIC_GEMINI_API_KEY` is missing | AI always fails at runtime |
| 3 | Gemini key is `EXPO_PUBLIC_*` (shipped to client) | Key can be extracted and abused |
| 4 | `components/chat/chat-app.tsx` is dead code hitting `localhost:5678` | Confusing, potential crash on iOS |
| 5 | No error boundaries, retry, timeout, or cancellation | Fragile UX |
| 6 | No onboarding, consent, settings, or emergency flow | Incomplete product |
| 7 | No first-aid content library | App is only a chatbot |
| 8 | No tests, CI, or E2E | Regressions likely |
| 9 | App identity still says AIDME in `app.json`/`package.json` | Store/legal inconsistency |
| 10 | `unstable_settings.anchor: "(tabs)"` references a non-existent group | Stale config |
| 11 | Contrast issue in `components/featured.tsx` (white text on light blue) | Accessibility |
| 12 | TTS error path leaves `isTalking` stuck | UI can lie about state |

### 3.3 What is worth keeping

- The clean Expo Router foundation and strict TypeScript.
- The calm medical-blue visual language.
- The animated talking avatar (nice differentiator) — refactor, don't discard.
- The chat bubble and local persistence ideas.
- EAS configuration and the existing app icon assets.

---

## 4. Product scope

### 4.1 Feature catalog

Priorities: **P0** = required for v1, **P1** = strong v1.1, **P2** = later.

| Feature | Priority | Description | Acceptance criteria |
|---|---|---|---|
| Onboarding & consent | P0 | 3–4 slides: what the app is, safety limits, emergency notice, data consent | New user sees it once; can revisit in Settings |
| Home dashboard | P0 | Greeting, search, quick actions, recent conversations | Loads < 1s; works offline |
| AI chat (text) | P0 | Streaming responses, markdown, copy, retry, stop | Response starts streaming < 2s; cancel works |
| Voice conversation | P0 | Push-to-talk STT, TTS playback, barge-in, permission handling | Transcript appears; AI speaks; errors recover |
| Chat history | P0 | List of conversations, rename, delete, search | Persists across restarts; delete is confirmed |
| First-aid library | P0 | Offline guides by category with steps, do/don't, when to call emergency | Searchable offline; content versioned |
| Emergency flow | P0 | Prominent red button, emergency numbers by region, CPR/metronome timer, share location | Reachable in ≤ 2 taps from any screen |
| Safety guardrails | P0 | Red-flag keyword detection, disclaimers, refusal rules, source links | Unsafe requests refused; emergency keywords escalate |
| Settings | P0 | Theme, language, voice on/off, units, data export/delete | Changes persist immediately |
| Health profile (local) | P1 | Age band, allergies, conditions, medications — stored locally | Never sent without explicit consent |
| Medication reminders | P1 | Local notifications with schedule | Survive restart; deep-link to reminder |
| Symptom checker (structured) | P1 | Rule-based red-flag questionnaire before AI | Red flags route to emergency |
| Saved guides / favorites | P1 | Bookmark first-aid topics | Syncs with local DB |
| Cloud sync & auth | P2 | Optional account, encrypted sync | Opt-in; conflict resolution defined |
| Multi-language | P2 | i18n for UI and content | English first; RTL-ready layout |
| Wearables / widgets | P2 | Quick emergency access | Platform-specific |

### 4.2 MVP definition (v1)

Ship: onboarding, home, text chat with streaming, working voice loop, history, offline first-aid library, emergency screen, safety guardrails, settings, disclaimer, and a backend AI proxy. Everything else can follow.

### 4.3 Out of scope for v1

Diagnosis, prescriptions, dosage advice, clinician chat, insurance, EHR, social features, ads.

---

## 5. Key UX flows

### 5.1 Onboarding

1. Value proposition and example questions.
2. Safety notice: "CAREMATE gives general guidance, not a diagnosis."
3. Emergency notice: "For chest pain, breathing trouble, severe bleeding — call emergency services."
4. Data consent: local storage, optional analytics, AI processing notice.
5. Optional profile (age band, allergies) with a "Skip" option.

### 5.2 Chat (text)

Home → Chat → type → send → optimistic user bubble → streaming AI bubble → actions (copy, retry, speak, save) → history entry.

### 5.3 Voice loop

Press and hold mic → permission check → live partial transcript → release → final transcript → send → AI response → TTS with stop button → return to idle. Handle silence, no-speech, permission denied, and network failure.

### 5.4 Emergency

Any screen → persistent emergency affordance → confirm → call local emergency number, show CPR timer, share location (with consent), and show "do not do" list. No AI dependency.

### 5.5 First-aid guide

Home → Categories/Search → Guide → steps with illustrations → "Call emergency if…" → related guides. Fully offline.

---

## 6. Target architecture

### 6.1 Principles

1. **Feature-first**, not type-first. Each feature owns its UI, hooks, state, and data access.
2. **Local-first.** SQLite is the source of truth; the network is an enhancement.
3. **Thin screens.** Route files compose features; no business logic in `app/`.
4. **Typed boundaries.** Every external boundary (AI, storage, notifications) has a typed interface and a fake for tests.
5. **Safety is a layer, not a prompt.** Guardrails run before and after the model.
6. **No secrets in the client.** The app talks to our backend, never directly to Gemini with a key.
7. **Progressive enhancement.** Web and low-end devices degrade gracefully; 3D/Lottie are optional.

### 6.2 System diagram

```
┌──────────────────────────────────────────────────────────────┐
│                        Expo App (client)                     │
│                                                              │
│  app/ (routes) ──► features/ (UI + hooks + state)            │
│                         │                                    │
│                         ├──► data/ (repositories)            │
│                         │      ├── expo-sqlite (source)      │
│                         │      ├── secure-store (tokens)     │
│                         │      └── AsyncStorage (settings)   │
│                         │                                    │
│                         └──► services/ (ports)               │
│                                ├── ai-client ───────────┐    │
│                                ├── speech (STT/TTS)     │    │
│                                └── notifications        │    │
└─────────────────────────────────────────────────────────┼────┘
                                                          │ HTTPS
                                                          ▼
┌──────────────────────────────────────────────────────────────┐
│                    AI Gateway (backend)                      │
│  • auth / anonymous device token                             │
│  • rate limiting + quotas                                    │
│  • prompt templates + safety system prompt                   │
│  • red-flag pre-check + post-check                           │
│  • Gemini call + streaming (SSE)                             │
│  • redacted logging + metrics                                │
└──────────────────────────────────────────────────────────────┘
```

### 6.3 Recommended stack decisions

| Concern | Recommendation | Rationale |
|---|---|---|
| Navigation | Expo Router with typed routes | Already in place |
| Language | TypeScript strict | Already in place |
| State | Zustand for client state + TanStack Query for server state | Small, testable, no boilerplate |
| Local DB | `expo-sqlite` with a small repository layer | Structured data, migrations, offline |
| Settings/secrets | `expo-secure-store` + AsyncStorage | Tokens vs. preferences |
| Validation | Zod | Runtime validation at boundaries |
| Forms | React Hook Form + Zod resolver | Consistent validation |
| Styling | Keep a central theme; consider `tailwindcss`/NativeWind only if desired | Avoid a rewrite for its own sake |
| Lists | `@shopify/flash-list` | Chat and guide performance |
| AI transport | Backend proxy with SSE streaming | Key security, quotas, guardrails |
| STT | `expo-speech-recognition` | Already a dependency; native support |
| TTS | `expo-speech` | Already working; add lifecycle handling |
| Notifications | `expo-notifications` | Local reminders |
| i18n | `expo-localization` + `i18next` | Future-proofing |
| Errors | `sentry-expo` | Crash + non-fatal reporting |
| Testing | Jest + React Native Testing Library + Maestro | Unit, integration, E2E |
| CI/CD | GitHub Actions + EAS Build/Update | Standard Expo pipeline |

### 6.4 Layering rules

- `app/**` may import from `features/**`, `components/ui/**`, `lib/**`.
- `features/**` may import from `data/**`, `services/**`, `components/ui/**`, `lib/**`, `theme/**`.
- `data/**` may import from `lib/**` and `types/**` only.
- `services/**` must not import React or feature code.
- No feature imports another feature's internals; share via `components/ui` or `lib`.

Enforce with ESLint `import/no-restricted-paths` or `eslint-plugin-boundaries`.

### 6.5 AI safety pipeline

1. **Input normalization** — trim, length cap, language detect.
2. **Red-flag classifier** — deterministic keyword/phrase rules (chest pain, difficulty breathing, stroke signs, severe bleeding, anaphylaxis, suicidal ideation, pregnancy emergencies, infant emergencies).
3. **Policy pre-check** — block diagnosis/prescription requests; inject refusal template.
4. **Prompt assembly** — versioned system prompt + safety rules + retrieved guide context.
5. **Model call** — Gemini with low temperature; structured output where possible.
6. **Output check** — scan for dosages, diagnoses, unsafe instructions; enforce disclaimer.
7. **Emergency escalation** — if red flags, prepend emergency instructions and surface the emergency screen.
8. **Logging** — store redacted metadata only; never store full health conversations without consent.

### 6.6 Voice pipeline

```
mic permission → start recognition → partial results → endpoint/silence
→ final transcript → send to chat → stream response → TTS queue
→ stop/barge-in → cleanup
```

Requirements:

- Stop and release the recorder in every exit path (`finally`).
- Handle `no-speech`, `aborted`, permission denied, and network errors.
- Cancel TTS when the user starts speaking again.
- Never leave `isTalking`/`listening` stuck.
- Respect reduced-motion and silent-mode settings.

### 6.7 Offline strategy

- Bundle first-aid guides as versioned JSON at build time.
- SQLite for conversations, messages, favorites, reminders, profile.
- Queue outbound chat messages when offline; show a clear banner.
- Cache the last N AI responses for read-only viewing.
- Emergency content is always available offline.

### 6.8 Error and loading model

- Every async action has `idle | loading | success | error` state.
- User-facing errors are short, actionable, and never expose stack traces.
- Retry with exponential backoff for transient AI/network failures.
- Global error boundary + per-feature boundaries.
- Timeouts: AI 30s, STT 10s, TTS best-effort.

### 6.9 Security and privacy

- Remove `EXPO_PUBLIC_GEMINI_API_KEY` from the client; rotate any exposed key.
- Backend enforces auth (anonymous device token or account), rate limits, and quotas.
- Store profile data locally by default; encrypt sensitive fields with SecureStore-backed keys.
- Provide **Export my data** and **Delete my data** in Settings.
- Redact logs; never log message bodies in production.
- Add a privacy policy and terms; keep the medical disclaimer visible.
- Treat AI output as untrusted; never execute or render raw HTML.

---

## 7. Target file structure

```
caremate/
├── app/                              # routes only
│   ├── _layout.tsx                   # providers, fonts, splash, error boundary
│   ├── index.tsx                     # redirects to onboarding or home
│   ├── (onboarding)/
│   │   ├── _layout.tsx
│   │   ├── welcome.tsx
│   │   ├── safety.tsx
│   │   └── consent.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx               # tab bar: Home, Guides, Chat, Settings
│   │   ├── home.tsx
│   │   ├── guides.tsx
│   │   ├── chat.tsx
│   │   └── settings.tsx
│   ├── chat/[id].tsx                 # conversation detail
│   ├── guides/[slug].tsx             # guide detail
│   ├── emergency.tsx                 # emergency flow
│   └── +not-found.tsx
├── src/
│   ├── features/
│   │   ├── chat/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── chat.store.ts
│   │   │   └── chat.types.ts
│   │   ├── voice/
│   │   │   ├── use-speech-to-text.ts
│   │   │   ├── use-text-to-speech.ts
│   │   │   └── voice.types.ts
│   │   ├── guides/
│   │   ├── emergency/
│   │   ├── onboarding/
│   │   ├── profile/
│   │   ├── reminders/
│   │   └── settings/
│   ├── components/
│   │   ├── ui/                       # Button, Card, Input, Sheet, EmptyState...
│   │   └── chat/                     # ChatBubble, TalkingAvatar
│   ├── data/
│   │   ├── db/
│   │   │   ├── client.ts             # expo-sqlite setup
│   │   │   ├── migrations/
│   │   │   └── schema.ts
│   │   ├── repositories/
│   │   │   ├── conversation.repository.ts
│   │   │   ├── message.repository.ts
│   │   │   ├── guide.repository.ts
│   │   │   └── profile.repository.ts
│   │   └── seed/guides/*.json
│   ├── services/
│   │   ├── ai/
│   │   │   ├── ai-client.ts          # interface
│   │   │   ├── ai-http-client.ts     # backend implementation
│   │   │   └── ai-fake.ts            # tests
│   │   ├── speech/
│   │   ├── notifications/
│   │   └── analytics/
│   ├── lib/
│   │   ├── env.ts                    # validated environment
│   │   ├── logger.ts
│   │   ├── result.ts
│   │   ├── dates.ts
│   │   └── red-flags.ts
│   ├── theme/
│   │   ├── colors.ts
│   │   ├── spacing.ts
│   │   ├── typography.ts
│   │   └── index.ts
│   └── types/
├── assets/
├── docs/
│   ├── PROJECT_BRIEF.md
│   ├── AI_SAFETY.md
│   ├── CONTENT_GUIDELINES.md
│   └── ADR/
├── __tests__/
├── e2e/
├── .env.example
├── app.config.ts                     # replaces app.json for typed config
├── eas.json
└── package.json
```

### 7.1 Migration mapping

| Current | Target |
|---|---|
| `app/screens/home-screen.tsx` | `app/(tabs)/home.tsx` + `src/features/home` |
| `app/screens/chatbot-screen.tsx` | `app/(tabs)/chat.tsx` + `src/features/chat` |
| `hooks/use-voice-assistance.ts` | Split into `features/chat`, `features/voice`, `services/ai` |
| `services/gemini.ts` | `src/services/ai/*` + backend proxy |
| `components/chat/*` | `src/components/chat/*` |
| `theme/color.ts` | `src/theme/*` |
| `constants/theme.ts` | Merge or remove |
| `components/chat/chat-app.tsx` | Delete |
| `components/hello-wave.tsx`, `parallax-scroll-view.tsx`, `haptic-tab.tsx`, `collapsible.tsx` | Keep only if used; otherwise delete |
| `scripts/reset-project.js` | Delete after migration |

---

## 8. Engineering standards

### 8.1 Environment

- `.env.example` with `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_SENTRY_DSN`, feature flags.
- Validate env at startup with Zod; fail fast with a readable message.
- Backend secrets live only in the backend environment.

### 8.2 Code quality

- TypeScript strict; no `any` in new code (use `unknown` + narrowing).
- ESLint + Prettier + import boundary rules.
- Conventional commits; PR template with test plan.
- Keep route files under ~80 lines; move logic into features.

### 8.3 Testing

- Unit: pure logic (red flags, prompt assembly, repositories with fake DB).
- Integration: chat hook with fake AI client; voice state machine.
- Component: onboarding, emergency screen, chat bubbles.
- E2E (Maestro): onboarding → chat → voice mock → guide → emergency.
- Target: 70%+ coverage on `src/lib`, `src/data`, `src/features/*/hooks`.

### 8.4 CI/CD

```yaml
# .github/workflows/ci.yml (outline)
- npm ci
- npm run lint
- npm run typecheck
- npm test -- --coverage
- eas build --profile preview --platform all --non-interactive   # on main
```

- EAS Update channels: `development`, `preview`, `production`.
- Versioning via EAS remote app version source.
- Store metadata and screenshots in `docs/store/`.

### 8.5 Observability

- Sentry for crashes and non-fatal errors.
- Structured logger with levels; redact message bodies.
- Key events: chat_sent, chat_failed, voice_permission_denied, emergency_opened, guide_viewed.
- Dashboards: latency, error rate, AI refusal rate, emergency escalation rate.

### 8.6 Accessibility

- Every interactive element has an accessibility label and role.
- Minimum 44×44 touch targets.
- Dynamic type support; no fixed-height text containers.
- Contrast ≥ 4.5:1 for body text.
- Respect `prefers-reduced-motion`; disable avatar/bob animations.
- Screen-reader announcements for new AI messages and listening state.

---

## 9. Roadmap

### Phase 0 — Stabilize the prototype (week 1)

**Goal:** make the current app run reliably.

- Add `.env.example` and a real `.env`; document setup.
- Fix the voice loop: stop recording, transcribe, reset state on all paths.
- Remove dead code (`chat-app.tsx`) and stale config (`anchor: "(tabs)"`).
- Add error handling and timeouts to Gemini calls; fix TTS state.
- Rename AIDME → CAREMATE in `app.json`, `package.json`, assets.
- Add `npm run typecheck`, `npm test`, and a minimal CI workflow.
- Fix contrast in `featured.tsx`.

**Exit criteria:** fresh clone runs with documented env; mic produces a transcript; no dead code; CI green.

### Phase 1 — Architecture refactor (weeks 2–3)

**Goal:** create the skeleton the product can grow into.

- Introduce `src/` feature-first structure and import boundaries.
- Add theme tokens (colors, spacing, typography) and shared UI primitives.
- Add `expo-sqlite` with schema + migrations and repositories.
- Introduce Zustand + TanStack Query; split chat state from AI calls.
- Add Zod env validation and a typed AI client interface.
- Add error boundary, logger, and result helpers.
- Write ADRs for state, storage, and backend.

**Exit criteria:** existing chat works through the new layers; no logic in `app/`; unit tests for repositories and red flags.

### Phase 2 — Core product features (weeks 4–6)

**Goal:** a complete v1 chat experience.

- Onboarding + consent.
- Tab navigation: Home, Guides, Chat, Settings.
- Streaming AI responses with stop/retry/copy.
- Working voice conversation with barge-in and error recovery.
- Conversation history: list, rename, delete, search.
- Offline first-aid library with search, categories, and detail pages.
- Settings: theme, voice, data export/delete.
- FlashList, skeletons, empty states.

**Exit criteria:** user can complete onboarding, ask by voice or text, hear an answer, revisit history, and read a guide offline.

### Phase 3 — Safety and emergency (weeks 7–8)

**Goal:** make the product safe to ship.

- Red-flag rules + emergency escalation UI.
- Emergency screen with local numbers, CPR timer, location share.
- Versioned safety system prompt + output checks.
- Medical disclaimer, privacy policy, terms.
- Content review of first-aid guides by a qualified reviewer.
- AI refusal tests and adversarial prompt tests.

**Exit criteria:** red-flag test suite passes; emergency flow reachable offline in ≤ 2 taps; legal copy approved.

### Phase 4 — Personalization (weeks 9–10)

**Goal:** increase retention and usefulness.

- Local health profile (age band, allergies, conditions, medications).
- Medication reminders with local notifications.
- Saved guides and recent activity.
- Structured symptom checker before AI.
- Optional anonymous analytics with consent.

**Exit criteria:** reminders survive restart; profile data never leaves the device without consent.

### Phase 5 — Launch readiness (weeks 11–12)

**Goal:** ship to stores.

- E2E suite, accessibility audit, performance pass.
- Sentry, analytics dashboards, and alerts.
- Store assets, screenshots, privacy labels, review notes.
- EAS production build + submit.
- Post-launch feedback loop and content update process.

**Exit criteria:** production build approved; crash-free sessions > 99.5%; p95 chat latency < 5s.

### Phase 6 — Post-launch (optional)

- Accounts and encrypted sync.
- Multi-language UI and content.
- Widgets / quick actions / wearable support.
- Clinician-reviewed content expansion.
- A/B testing of onboarding and prompt variants.

---

## 10. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| AI gives unsafe medical advice | Medium | High | Deterministic red flags, strict prompt, output checks, refusals, visible disclaimer, content review |
| API key abuse / cost blowup | High (current) | High | Backend proxy, anonymous auth, rate limits, quotas, key rotation |
| Voice feature fails on device | High | Medium | State machine + tests, permission handling, device matrix, graceful text fallback |
| Medical/legal liability | Medium | High | "General guidance only" copy, no diagnosis/prescription, emergency escalation, legal review |
| Scope creep | High | Medium | MVP definition, phase gates, P0/P1/P2 catalog |
| Content becomes stale | Medium | Medium | Versioned content, review cadence, changelog, source citations |
| Low-end device performance | Medium | Medium | FlashList, lazy 3D/Lottie, bundle analysis, reduced motion |
| Privacy concerns | Medium | High | Local-first, consent, export/delete, redacted logs, no PII to AI by default |
| Store rejection (medical claims) | Medium | High | Conservative copy, disclaimers, no diagnosis claims, review guidelines |

---

## 11. Success metrics

### Product

- Onboarding completion ≥ 80%.
- First useful answer within 30 seconds of first open.
- 7-day retention ≥ 25%.
- Voice session success rate ≥ 95%.
- Emergency flow reachable in ≤ 2 taps.

### Engineering

- Crash-free sessions ≥ 99.5%.
- p95 text response < 5s; voice round-trip < 3s after speech ends.
- CI duration < 10 minutes.
- Test coverage ≥ 70% on core logic.
- Zero high-severity lint/type errors.

### Safety

- 100% of red-flag test cases escalate.
- 0 responses containing dosages or diagnoses in the safety test suite.
- 100% of AI responses include or inherit the disclaimer context.

---

## 12. Open decisions

| Decision | Options | Recommendation |
|---|---|---|
| Backend | Expo API routes / Hono on Workers / Neon Functions / no backend | Thin serverless proxy; keep it small |
| Auth | Anonymous device token / email magic link / none | Anonymous first, optional account later |
| Local DB | AsyncStorage / expo-sqlite / WatermelonDB | `expo-sqlite` + repositories |
| State | Context / Zustand / Redux Toolkit | Zustand + TanStack Query |
| Styling | StyleSheet / NativeWind / Tamagui | Keep StyleSheet + tokens for v1 |
| 3D avatar | Keep GLB / keep 2D animated / remove | Keep 2D animated; lazy-load 3D only if it adds value |
| Monetization | Free / freemium / one-time | Decide before launch; do not block v1 |
| Content source | In-house / licensed / reviewed community | In-house + qualified reviewer |
| Languages | English only / English + Spanish / more | English first, i18n-ready |

---

## 13. Immediate next actions

1. **Approve this brief and the open decisions** (especially backend and auth).
2. **Rotate the exposed Gemini key** and remove it from the client.
3. **Phase 0 ticket set:**
   - Add `.env.example` + env validation.
   - Fix the voice loop end-to-end.
   - Delete `chat-app.tsx` and stale config.
   - Add CI + typecheck/test scripts.
   - Rename the app identity to CAREMATE.
4. **Create ADRs** for state, storage, and the AI proxy.
5. **Start the `src/` migration** behind the existing screens so the app stays runnable.

---

## Appendix A — Data model (draft)

```ts
type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
};

type Message = {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  text: string;
  createdAt: string;
  status: "sending" | "sent" | "failed";
  safety?: {
    escalated: boolean;
    reason?: string;
  };
};

type Guide = {
  slug: string;
  title: string;
  category: string;
  summary: string;
  steps: string[];
  dos: string[];
  donts: string[];
  callEmergencyIf: string[];
  sources: string[];
  version: string;
  reviewedAt: string;
};

type Reminder = {
  id: string;
  label: string;
  schedule: string; // cron-like or structured
  enabled: boolean;
  lastTriggeredAt?: string;
};
```

## Appendix B — API contract (draft)

```http
POST /v1/chat
Authorization: Bearer <device-token>
Content-Type: application/json

{
  "conversationId": "uuid",
  "messages": [{ "role": "user", "content": "..." }],
  "locale": "en-US",
  "stream": true
}
```

Response: `text/event-stream` with `token`, `safety`, and `done` events.

```json
{ "type": "safety", "escalate": true, "reason": "chest_pain" }
{ "type": "token", "value": "Call emergency services" }
{ "type": "done", "messageId": "uuid" }
```

Errors: `401`, `429` (quota), `422` (policy refusal), `503` (provider unavailable) with a stable `code`.
