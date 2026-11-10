# CLAUDE.md

`mytheus-mobile` is the net-new React Native + Expo iOS/Android client for Mytheus. The single most important rule: it is a pure edge-tier client that must stay contract-compatible with `mytheus-ui`, reaching the backend only through `api-gateway`/`bff` (REST) and `realtime-gateway` (WSS), plus LiveKit for media. It renders truth; it never decides it.

## Repo at a glance

- What it is: the native iOS + Android client for Mytheus, the meeting-orchestration SaaS where every participant gets a personal AI agent (notes, suggestions, decisions, actions, alerts). It is the phone-form-factor sibling of the web client `mytheus-ui`.
- Net-new: the platform architecture set (codename NEXUS, in `mytheus-docs`) names "User browser / mobile" but designs only `web-app` (`mytheus-ui`). There is no canonical mobile design. This entire repo is net-new and safe precisely because it adds zero backend surface: it is a second consumer of contracts `mytheus-ui` already uses. Every net-new decision is logged in `system.md` §15.
- What it owns: the mobile UI shell, navigation, on-device caching, realtime reconciliation rendering, push handling, and secure on-device token storage. Nothing else.
- What it owns on the backend: nothing. No durable truth, no tenant filtering, no LLM/agent execution, no store access, no new REST or event contract.
- What it must never do: invent a backend contract, filter by tenant client-side, set `org_id`, ship admin/billing-purchase/integration-install flows (web-only by design), or store transcript/agent content durably beyond the encrypted query cache.

## Architecture orientation

The app speaks exactly the planes `mytheus-ui` speaks, through exactly the same doors. The exact routes are pinned in `src/api/endpoints.ts` (typed against the generated OpenAPI route table) and listed in the contract snapshot in `__tests__/api-client.test.ts`.

- REST: one gateway origin (`EXPO_PUBLIC_API_GATEWAY_URL`, prod `https://api.mytheus.cloud`). The gateway routes by prefix, exactly as the web calls it: bff `/bff/*` and `POST /api/v1/ask`; core-api `/api/v1/*`; identity `/users`, `/users/me`; notification-service `/notifications`; meeting-service `/api/meetings/{id}/token` and `/api/meetings/{id}/session` (NOT `/api/v1/meetings/...`, which is core-api; see mytheus-ui `app/api/livekit-token/route.ts`).
- WSS: Socket.io to `realtime-gateway` (`EXPO_PUBLIC_REALTIME_WS_URL`, prod `wss://api.mytheus.cloud`), namespace `/v1`. `auth` is a callback so every (re)connect handshake carries a fresh Clerk token; `reauth` keeps it fresh while connected. Consumed: `caption`, `agent-delta`, `agent-note`, `agent-candidate`, `candidate-resolution`, `candidate-lock`, `agent-agenda`, `agenda-status`, `agent-nudge`, `room-state`, `hand`, `reaction`, `meeting-ended`, `presence`. Emitted: `join`, `reauth`, `candidate-resolved`, `candidate-lock`, `agenda-status`, `hand`, `reaction`, `end-meeting`. (The older `agent-stream`/`agent-results` names in the architecture set are not what the gateway emits; follow mytheus-realtime `services/realtime-gateway/src/server.ts` and `roomEvents.ts`.)
- Media: LiveKit React Native SDK. `POST /api/meetings/{id}/token` (meeting-service) mints `{ token, room, livekit_url, started_at, consent_version, consented_at }`; the body `{ consent: { version } }` records consent; a 428 `CONSENT_REQUIRED` means ask. A fresh token is minted on every connect, including after LiveKit gives up resuming. The phone holds no LiveKit configuration; the server's `livekit_url` is always used.
- Auth: Clerk (`@clerk/expo`, token cache in expo-secure-store). The session JWT carries the active org; `org_id` is derived server-side. The active org is chosen in Clerk (`setActive`), only in `app/(app)/_layout.tsx` and Settings.
- Push: not built. Device push-token registration needs a notification-service route that does not exist (system.md N7). The Inbox (`GET /notifications`) is the authority.

## Where things live

```
mytheus-mobile/
  app/                            Expo Router routes (file-based)
    _layout.tsx                   root: fonts, ClerkProvider, QueryClientProvider, toasts; "not connected" without env
    (auth)/sign-in.tsx            Clerk sign-in (password or emailed code, plus the second step); no sign-up
    (app)/_layout.tsx             auth gate + workspace choice + the REST client; the ONLY place tenancy is touched
    (app)/(tabs)/                 Home, Inbox, Meetings, My work (tasks, promises, updates), Ask
    (app)/meetings/[meetingId]/   index (results, your notes), join (consent), room (the live call)
    (app)/decisions/              the log and one decision (lineage, share link)
    (app)/settings.tsx            account, agent (read-only), workspace switch, sign out
  src/
    api/                          client.ts (the one fetch wrapper), spec.ts (typed route table), endpoints.ts
                                  (every call), types.ts (shapes picked from generated/), hooks/ (TanStack Query)
    api/generated/                GENERATED from mytheus-backend design/openapi (npm run generate:api); never edit
    realtime/                     useMeetingSocket, useLiveKitRoom, hydrators, and reducers ported verbatim from
                                  mytheus-ui src/lib/realtime (captions, notes, candidates, agenda, room-live, connection)
    components/ui/                the kit: T (text), Card/Row, Button/IconButton, Chip, Screen/PageHead, Segmented,
                                  Empty/Error/Skeleton states, Toast with Undo, Avatar
    components/feature, room/     screen parts; Icon.tsx is Phosphor regular (local path data)
    lib/                          pure helpers (inbox merge, notification copy, routes, format, citations, people, ...)
    theme/                        tokens mirroring mytheus-ui light and dark themes; useTheme()/useStyles()
  __tests__/                      Jest + RNTL (unit, hooks with fake socket/room, screens with a fake REST client)
  scripts/generate-api-types.mjs  the same generator approach as mytheus-ui
  app.json                        Expo config: permissions, plugins (Clerk, LiveKit, WebRTC), scheme
```

## Invariants you must not break

| Rule | Why | If you break it |
| :-- | :-- | :-- |
| `org_id` is server-derived only; never set, send, or guess it (not in path, query, body, or header) | `api-gateway` extracts it from the Clerk JWT and fails closed; the browser/device is not a tenancy boundary | Tenancy leak risk or a request the gateway rejects; you also fork the contract away from `mytheus-ui` |
| Clerk-only auth | Same identity provider as web; the JWT `org` claim drives tenancy end to end | A second auth path the backend does not trust; broken sessions and org context |
| Backend access only through `api-gateway`/`bff` (REST) and `realtime-gateway` (WSS), plus LiveKit via a `meeting-service`-minted token | These are the only two doors `03-container-architecture.md` exposes to clients | Direct service calls bypass the gateway's auth/`org_id`/WAF edge and break in every environment |
| Session/refresh tokens in expo-secure-store only (Keychain/Keystore) | At-rest protection on a lost or compromised device | Token theft from AsyncStorage or JS-readable storage |
| No secrets in the bundle; only `EXPO_PUBLIC_*` publishable values ship | The bundle is fully extractable; LiveKit/Deepgram/LLM/Clerk-backend keys are server-side | Credential leak; immediate security incident |
| Stay contract-compatible with `mytheus-ui` | One backend serves both clients: same endpoints, Socket.io `/v1` namespace and event names/payloads, token-mint flow, error model, pagination, idempotency | A divergence is a client bug; fix the client, never fork the contract |
| WebSocket/push carry no durable truth | Deltas and pushes are throwaway; finals/confirmed state are recoverable from REST | Treating a delta or push as authoritative invents or loses data |
| No silent commits: decisions/actions confirmed by explicit user tap | `core-api` emits and `knowledge-graph-service` writes only on confirm | Auto-confirmed facts corrupt the knowledge graph |
| Idempotency-Key on every create/confirm mutation; offline retries reuse the same key | Mobile reconnects replay requests; the key makes replays safe | Double-applied confirms/completes |
| Caption render budget < 2s | The platform caption SLO; the core live-UX promise | Captions feel broken; the app fails its primary realtime contract |

## Naming authority

Service names, topic names (`transcript-chunks`, `notifications`), the `nexus:{org_id}:` namespace prefix, `meeting_id`, and entity names come from `mytheus-docs` `_canon/` and the Glossary, the frozen source of truth.

Never invent or rename a service, topic, entity, key, or threshold. If a name you need is not in `_canon/`, stop and ask; do not coin one.

## Conventions

- TypeScript strict: no `any` in committed code; do not disable strict mode. API and socket payload types are generated from the platform OpenAPI 3.1 specs and Avro schemas so the client cannot drift from the contract.
- Wire vs app casing: `snake_case` on the wire (matches the API), `camelCase` in TS app code. Files are `kebab-case`, React components `PascalCase`.
- Navigation: routes live in `app/` (Expo Router). `(auth)/*` unauthenticated, `(app)/*` authenticated shell. Org context is resolved once in `app/(app)/_layout.tsx` and exposed via `OrgContext`; never re-derive tenancy in a screen.
- Where calls belong: all REST through the single base client in `src/api/client.ts`, exposed as TanStack Query hooks in `src/api/hooks/`; never `fetch` from a component. All Socket.io and LiveKit work in `src/realtime/` providers that wrap the meeting-room subtree only; reconciliation lives in `src/realtime/events.ts`, not in screens.
- State split: server state = TanStack Query, in memory only (no AsyncStorage persistence: it is unencrypted and must not hold meeting content); ephemeral UI state = React state. Durable facts are never invented client-side.
- Secure storage: tokens via the `src/lib/` secure-store wrapper over expo-secure-store; never AsyncStorage for secrets.
- Permissions: request contextually (mic/camera at meeting join, notifications after the first value moment), never all at launch. Native permission strings and modes live in `app.json`.
- Components compose design-system primitives from `src/components/` using tokens in `src/theme/`; no ad-hoc styling outside the token system.

## Common tasks (recipes)

Add a screen + route
1. Create the route file under `app/(app)/` (e.g. `app/(app)/insights.tsx`); Expo Router registers it by path. Nested routes use folders; dynamic segments use `[param]`.
2. Add it to the tab/stack config in `app/(app)/_layout.tsx` if it needs a tab or header.
3. Read data via a hook from `src/api/hooks/`; compose UI from `src/components/` primitives and `src/theme/` tokens. Do not resolve org context here.
4. Add a Jest/RNTL test under `__tests__/` (screens: `helpers/render.tsx` gives a fake REST client).

Call a new bff endpoint
1. Regenerate types (`MYTHEUS_OPENAPI_DIR=<mytheus-backend main>/design/openapi npm run generate:api`). Do not hand-write a shape that is not in the contract.
2. Add the call to `src/api/endpoints.ts` (`c.request(method, path, ...)` only accepts a path and method that exist in the spec) and to the contract snapshot test.
3. Add a query key to `src/api/queryKeys.ts` and a hook in `src/api/hooks/`. Never set `org_id`. Mutations use `useKeyedMutation`, which mints the `Idempotency-Key` once per user action so retries reuse it.
4. Branch UI on the stable error `code` enum, not on HTTP status text.

Subscribe to a realtime event
1. Use the one socket in `src/realtime/useMeetingSocket.ts`; do not open a second. Event names and payloads must match the gateway's `/v1` contract and mytheus-ui.
2. Reduce it with a pure function (port the web reducer when one exists) and test it. Deltas are disposable; finals and the room ledger come with the server's row.
3. Re-hydrate durable state over REST on every (re)connect (`src/realtime/hydrators.ts`); never persist deltas as truth.

Add a push-notification type
1. The notification's durable record and channel preference live on `notification-service`; do not invent a new payload contract. Reuse the existing delivery fabric (`notifications` topic -> `notification-service` -> Expo Push).
2. Handle the push and its deep link in `src/notifications/`; map the deep link (`mytheus://meetings/{id}/room`, `mytheus://tasks`, `mytheus://notifications`) to the target screen via Expo Router.
3. On open, reconcile against `GET /notifications` and mark read with `PATCH /notifications/{id}`. Push is never the source of truth. (Push registration itself is not built; see system.md N7.)

Request a native permission
1. Declare the permission and its usage string in `app.json` (iOS `NS*UsageDescription`, Android `uses-permission` and any required service flags).
2. Request it contextually from the relevant screen/provider (mic/camera in `LiveKitProvider` at join; notifications in `src/notifications/` after first value).
3. Native module changes require a new dev/store build, not just an OTA update.

## Testing

- Unit/component: Jest (`jest-expo`) + React Native Testing Library. Covered: the REST client (auth, idempotency, token refresh, RFC 7807), the contract snapshot of every call, the pure libs, the socket hook against a fake socket (fresh token per handshake, re-join and re-hydrate, ledger, reauth, give-up), the LiveKit hook against a fake room (consent, re-mint after a drop), and the main screens against a fake REST client.
- What to mock: the REST client (`__tests__/helpers/render.tsx`), Socket.io and LiveKit (inject `connect`/`createRoom`), Clerk and the router (`__tests__/helpers/mocks.ts`). Never hit a live gateway.
- Gates (must be green): `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run generate:api:check` (with `MYTHEUS_OPENAPI_DIR` at mytheus-backend main), and `npx expo export --platform android` to prove it bundles.
- Detox e2e is not set up yet (no simulator runner in CI).

## Local development

Prerequisites: Node 20+, npm, Xcode and/or Android Studio, and a development build (LiveKit, WebRTC and secure-store are native modules; Expo Go cannot run this app). Clerk's Native API must be enabled on the Clerk instance for mobile sign-in.

```bash
npm ci
cp .env.example .env                 # fill in the EXPO_PUBLIC_* values
npx expo prebuild                    # native projects for a dev build
npx expo run:ios | npx expo run:android
npm run typecheck && npm run lint && npm test
npx expo export --platform android   # bundle check
```

Required env vars (public, client-readable only; no secret keys): `EXPO_PUBLIC_API_GATEWAY_URL`, `EXPO_PUBLIC_REALTIME_WS_URL`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`. There are no defaults: without them the app shows "not connected to a workspace". The LiveKit URL comes with each minted token.

## Pitfalls

- Secrets in the bundle: the JS bundle is fully extractable. Only `EXPO_PUBLIC_*` publishable values ship; never embed LiveKit/Deepgram/LLM/Clerk-backend keys or a LiveKit room token.
- Insecure token storage: AsyncStorage is JS-readable. Tokens go through the expo-secure-store wrapper only.
- Missing or client-set `org_id`: the client must never send `org_id`. If you find yourself adding it to a request, you are wrong; the gateway derives it from the JWT.
- Platform permission gaps: a permission used at runtime but missing from `app.json` crashes or silently fails on device. iOS needs `NS*UsageDescription`; Android 13+ needs `POST_NOTIFICATIONS`, and in-call audio needs the foreground-service flags.
- Background-audio and lifecycle: meeting audio must survive backgrounding/lock only during an active meeting (iOS `audio` background mode; Android foreground service). Holding a background audio session outside a meeting is a bug and will get the app killed or flagged.
- OTA update caveats: `eas update` ships JS only. Any native change (new permission, new native module, plugin/config change) requires a store/dev build and a runtime-version bump; shipping it as OTA breaks clients.
- Live plane is not cached as truth: on reconnect, re-hydrate caption/agent history from durable REST; do not replay cached deltas as authoritative.

## Working with other repos

The product spans eight `mytheus-*` repos; identifiers always come from `mytheus-docs` `_canon/`.

- `mytheus-ui`: the Next.js web client and the parity reference. Mirror its route taxonomy, state layering, realtime reconciliation, priority color language, and bottom-sheet sidebar. Any divergence from shared behavior is a client bug.
- `mytheus-gateway` (`api-gateway` + `bff`): the only REST ingress and screen aggregator this client may call.
- `mytheus-realtime` (`realtime-gateway` + `transcription-service`): the WSS fan-out and event source; consume its Socket.io `/v1` event contract verbatim.
- `mytheus-core` (`core-api`, `meeting-service`, CRUD services): owns the resources you read/mutate and mints the LiveKit token.
- `mytheus-intelligence` (agents, RAG, knowledge-graph): produces the agent output the gateway relays; the client only renders it.
- `mytheus-events`: the Avro event schemas; payloads inherit BACKWARD compatibility, so generate types rather than hand-rolling them.
- `mytheus-docs`: the NEXUS architecture set and the frozen `_canon/` naming authority.

## Commit and PR conventions

- Trunk-based: short-lived branches off `main`; open a PR; CI (typecheck + lint + Jest + bundle) must be green before merge.
- Conventional commits; keep PRs focused and describe user-visible behavior. Record any net-new design decision in `system.md` §15 and reference it in the PR.
- Reviewer checklist: Clerk-only auth, `org_id` never client-set, backend access only via gateway/realtime, secure token storage, no bundle secrets, contract-compatibility with `mytheus-ui`, naming sourced from `_canon/`.
- Commit messages in this project must NOT include a `Co-Authored-By` footer.

## Progress documentation - single home

Every record of work done - after a session, a feature, a fix, or a band step - lands in ONE place: `mytheus-docs/work-done-till-now/`. Not in this repo.

- One file per plan band, covering every repo that band touches: `work-done-till-now/01-plan-0-scaffold-and-contracts.md`, then `02-plan-1-2-...`, and so on. Add to the current band's file; start a new file only when a new band starts.
- Write it comprehensively enough that another person, or their coding agent, can pick the work up cold: what was built, what was verified and by which exact command, and **why** each decision was taken. Record every deviation from the plan together with its rationale. A deviation with no recorded reason is a bug, not a decision.
- Read `mytheus-docs/work-done-till-now/README.md` first. It holds the required structure and the writing conventions.
- Do NOT start a per-repo progress log here. Net-new design decisions still go in `system.md` section 15 as the reviewer checklist requires; the narrative of what was built goes in the band file.
- That folder **records**; it never **defines**. A new or changed name, number, or decision still goes canon-first (`_canon/`), then an ADR, then the reader docs. Cite them from the band file.
- Do not overcomplicate. Build the optimal, professional, simple working version first, and add complexity only when something concrete requires it.
