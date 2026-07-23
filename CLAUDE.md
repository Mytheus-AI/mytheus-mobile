# CLAUDE.md

`mytheus-mobile` is the net-new React Native + Expo iOS/Android client for Mytheus. The single most important rule: it is a pure edge-tier client that must stay contract-compatible with `mytheus-ui`, reaching the backend only through `api-gateway`/`bff` (REST) and `realtime-gateway` (WSS), plus LiveKit for media. It renders truth; it never decides it.

## Repo at a glance

- What it is: the native iOS + Android client for Mytheus, the meeting-orchestration SaaS where every participant gets a personal AI agent (notes, suggestions, decisions, actions, alerts). It is the phone-form-factor sibling of the web client `mytheus-ui`.
- Net-new: the platform architecture set (codename NEXUS, in `mytheus-docs`) names "User browser / mobile" but designs only `web-app` (`mytheus-ui`). There is no canonical mobile design. This entire repo is net-new and safe precisely because it adds zero backend surface: it is a second consumer of contracts `mytheus-ui` already uses. Every net-new decision is logged in `system.md` §15.
- What it owns: the mobile UI shell, navigation, on-device caching, realtime reconciliation rendering, push handling, and secure on-device token storage. Nothing else.
- What it owns on the backend: nothing. No durable truth, no tenant filtering, no LLM/agent execution, no store access, no new REST or event contract.
- What it must never do: invent a backend contract, filter by tenant client-side, set `org_id`, ship admin/billing-purchase/integration-install flows (web-only by design), or store transcript/agent content durably beyond the encrypted query cache.

## Architecture orientation

The app speaks exactly the planes `mytheus-ui` speaks, through exactly the same doors.

- REST: `https://{API_GATEWAY_URL}/api/v1/*` and `/bff/*`. Screen-shaped aggregate reads come from `bff` (`GET /bff/dashboard`, `GET /bff/meeting-room/:id`); resource reads/writes go to owning services (`GET /api/v1/meetings`, `/actions`, `/decisions`, `/worklogs`, `/notifications`, `/usage`; `POST /api/v1/decisions/:id/confirm`, etc.). The client knows only the gateway origin, never a service URL.
- WSS: Socket.io to `realtime-gateway` on the `/v1` namespace, joining the room keyed by `meeting_id`. Channels consumed: live captions (interim + final), `agent-stream` token deltas (disposable), `agent-results` final cards (durable), presence, and in-meeting chat. The Redis fan-out backbone `nexus:{org_id}:pubsub:meeting:{meeting_id}` is server-side; the client is agnostic to which pod it lands on.
- Media: LiveKit React Native SDK over WebRTC. The client calls `POST /api/v1/meetings/:id/token` (owned by `meeting-service`) to mint a short-lived, participant-verified room token (`{ token, room, livekit_url }`), and re-mints on reconnect. It never holds LiveKit API credentials.
- Auth: Clerk Expo SDK. The session JWT carries the `org` claim; `org_id` is derived server-side by `api-gateway` and the client cannot widen its own scope.
- Push: Expo Notifications. Delivery rides the platform `notifications` topic -> `notification-service` -> Expo Push -> APNs/FCM. Push carries no durable truth; `GET /api/v1/notifications` is the authority.
- Net-new backend touchpoint: registering an Expo device push token with `notification-service` is the one place this client implies a small backend addition (modeled as a `notification-service` channel-preference write so that service stays the single delivery owner). It is flagged in `system.md` §15 (N7). Do not treat it as an existing contract, and do not invent any other backend additions.

## Where things live

```
mytheus-mobile/
  app/                          Expo Router routes (file-based)
    _layout.tsx                 root: <ClerkProvider>, <QueryClientProvider>, fonts
    (auth)/                     unauthenticated: Clerk sign-in / sign-up / SSO
      sign-in.tsx
      sign-up.tsx
    (app)/                      authenticated shell
      _layout.tsx               <OrgProvider> + tab/stack nav + auth gate; ONLY place org context is resolved
      dashboard.tsx
      meetings/
        index.tsx               meeting list
        [meetingId]/
          room.tsx              meeting room: LiveKit grid + agent sidebar bottom sheet (only screen with long-lived connections)
          transcript.tsx
      tasks.tsx                 My Tasks (action_items assigned to me)
      decisions.tsx
      notifications.tsx         in-app notification center
      settings/
        profile.tsx
        account.tsx
    +not-found.tsx
  src/
    api/                        REST clients -> api-gateway/bff
      client.ts                 base fetch wrapper: gateway origin only, Clerk bearer injection, RFC 7807 error parsing, Idempotency-Key
      queryKeys.ts              TanStack Query key factory
      hooks/                    useMeetings, useTasks, useUsage, ... (one hook per endpoint)
    realtime/                   live transports, wrap the meeting-room subtree only
      SocketProvider.tsx        Socket.io -> realtime-gateway, joins meeting_id room, backoff reconnect
      LiveKitProvider.tsx       LiveKit RN room, token mint + re-mint
      events.ts                 agent-stream / agent-results / presence handlers, delta -> draft -> final reconciliation
    auth/                       Clerk helpers, org switching, token storage glue
    notifications/              Expo push registration + deep-link tap routing
    components/                 design-system primitives + feature components
    store/                      Zustand ephemeral UI state (sidebar collapse, draft cards, toasts)
    lib/                        config, secure-store wrapper, formatting
    theme/                      design tokens mirroring the mytheus-ui token set
  assets/                       icons, splash, fonts
  __tests__/                    Jest + RNTL unit/component tests
  e2e/                          Detox end-to-end specs
  app.config.ts                 Expo config: reads env, plugins, permissions, scheme
  eas.json                      EAS Build / Submit / OTA channels
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

Service names, topic names (`agent-stream`, `agent-results`, `transcript-chunks`, `notifications`), the `nexus:{org_id}:` namespace prefix, `meeting_id`, and entity names come from `mytheus-docs` `_canon/` and the Glossary, the frozen source of truth.

Never invent or rename a service, topic, entity, key, or threshold. If a name you need is not in `_canon/`, stop and ask; do not coin one.

## Conventions

- TypeScript strict: no `any` in committed code; do not disable strict mode. API and socket payload types are generated from the platform OpenAPI 3.1 specs and Avro schemas so the client cannot drift from the contract.
- Wire vs app casing: `snake_case` on the wire (matches the API), `camelCase` in TS app code. Files are `kebab-case`, React components `PascalCase`.
- Navigation: routes live in `app/` (Expo Router). `(auth)/*` unauthenticated, `(app)/*` authenticated shell. Org context is resolved once in `app/(app)/_layout.tsx` and exposed via `OrgContext`; never re-derive tenancy in a screen.
- Where calls belong: all REST through the single base client in `src/api/client.ts`, exposed as TanStack Query hooks in `src/api/hooks/`; never `fetch` from a component. All Socket.io and LiveKit work in `src/realtime/` providers that wrap the meeting-room subtree only; reconciliation lives in `src/realtime/events.ts`, not in screens.
- State split: server state = TanStack Query (cache persisted to AsyncStorage/MMKV, stale-while-revalidate); ephemeral UI state (sidebar collapse, draft streaming cards, toasts) = Zustand. Durable facts are never invented client-side.
- Secure storage: tokens via the `src/lib/` secure-store wrapper over expo-secure-store; never AsyncStorage for secrets.
- Permissions: request contextually (mic/camera at meeting join, notifications after the first value moment), never all at launch. Native permission strings and modes live in `app.config.ts`.
- Components compose design-system primitives from `src/components/` using tokens in `src/theme/`; no ad-hoc styling outside the token system.

## Common tasks (recipes)

Add a screen + route
1. Create the route file under `app/(app)/` (e.g. `app/(app)/insights.tsx`); Expo Router registers it by path. Nested routes use folders; dynamic segments use `[param]`.
2. Add it to the tab/stack config in `app/(app)/_layout.tsx` if it needs a tab or header.
3. Read data via a hook from `src/api/hooks/`; compose UI from `src/components/` primitives and `src/theme/` tokens. Do not resolve org context here.
4. Add a Jest/RNTL test under `__tests__/`; if it is a primary flow, add a Detox spec under `e2e/`.

Call a new bff endpoint
1. Confirm the endpoint and payload shapes exist in the platform OpenAPI spec; regenerate types if needed. Do not hand-write a shape that is not in the contract.
2. Add a query key to `src/api/queryKeys.ts`.
3. Add a hook in `src/api/hooks/` that calls the base client in `src/api/client.ts` (it injects the Clerk bearer and parses the RFC 7807 error model). Never set `org_id`. For mutations, pass an `Idempotency-Key` and wire optimistic update + rollback.
4. Branch UI on the stable error `code` enum, not on HTTP status text.

Subscribe to a realtime event
1. Use the existing `SocketProvider` connection; do not open a second socket. Event names and payloads must match the Socket.io `/v1` contract used by `mytheus-ui`.
2. Add the handler in `src/realtime/events.ts`. For `agent-stream`, accumulate deltas into a correlation-keyed draft card; on `agent-results`, replace the draft with the settled card. Treat a missed delta as non-fatal.
3. Surface state to screens via Zustand (ephemeral) or by re-fetching durable REST on settle; never persist deltas as truth.

Add a push-notification type
1. The notification's durable record and channel preference live on `notification-service`; do not invent a new payload contract. Reuse the existing delivery fabric (`notifications` topic -> `notification-service` -> Expo Push).
2. Handle the push and its deep link in `src/notifications/`; map the deep link (`mytheus://meetings/{id}/room`, `mytheus://tasks`, `mytheus://notifications`) to the target screen via Expo Router.
3. On open, reconcile against `GET /api/v1/notifications` and mark read with `PATCH /api/v1/notifications/:id`. Push is never the source of truth.

Request a native permission
1. Declare the permission and its usage string in `app.config.ts` (iOS `NS*UsageDescription`, Android `uses-permission` and any required service flags).
2. Request it contextually from the relevant screen/provider (mic/camera in `LiveKitProvider` at join; notifications in `src/notifications/` after first value).
3. Native module changes require a new dev/store build, not just an OTA update.

## Testing

- Unit/component: Jest + React Native Testing Library. Cover hooks, reducers, components, and especially the realtime reconciliation (deltas -> drafts -> final cards) and optimistic-mutation rollback paths, tested behaviorally.
- E2E: Detox on simulators/emulators. Cover sign-in, join-meeting, caption render, agent card confirm, and notification tap routing.
- What to mock: the base API client and the Socket.io/LiveKit providers (do not hit live `api-gateway`/`realtime-gateway`/LiveKit in unit tests); Clerk session; secure-store. Assert on rendered behavior, not implementation details.
- Quality gates (must be green before merge): `pnpm typecheck` (strict), `pnpm lint`, `pnpm test`, and a Detox smoke where a runner is available.
- TDD is the norm: write the failing test first, then implement.

## Local development

Prerequisites: Node 20+ and pnpm (`corepack enable && corepack prepare pnpm@latest --activate`), Expo CLI, EAS CLI (`pnpm add -g eas-cli`) for cloud builds, Xcode (iOS, macOS only) and/or Android Studio, plus access to a running Mytheus backend (or shared dev env) for `api-gateway`, `realtime-gateway`, LiveKit, and a Clerk dev instance.

```bash
pnpm install
cp .env.example .env                 # fill in the EXPO_PUBLIC_* values below

pnpm start                           # Metro / Expo dev server
pnpm ios                             # build & launch iOS simulator (dev build)
pnpm android                         # build & launch Android emulator (dev build)

pnpm typecheck                       # tsc --noEmit (strict)
pnpm lint                            # ESLint + Prettier
pnpm test                            # Jest + RNTL
pnpm e2e:ios | pnpm e2e:android      # Detox

pnpm dlx expo prebuild               # regenerate native projects when native config changes
eas build  --profile production --platform all
eas submit --profile production --platform ios|android
eas update --branch production       # OTA JS update
```

A development build (not Expo Go) is required: LiveKit, push, and secure-store are native modules.

Required env vars (public, client-readable only; no secret keys):

| Variable | Purpose |
| :-- | :-- |
| `EXPO_PUBLIC_API_GATEWAY_URL` | Base origin for REST (`/api/v1/*`, `/bff/*`) through `api-gateway` |
| `EXPO_PUBLIC_REALTIME_WS_URL` | `realtime-gateway` WSS origin for Socket.io |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Expo publishable key (safe to ship) |
| `EXPO_PUBLIC_LIVEKIT_URL` | LiveKit SFU URL (the room token is minted per join, never an env var) |
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry React Native DSN |
| `EXPO_PUBLIC_ENV` | `development` / `staging` / `production`; selects EAS/OTA channel and analytics env |

## Pitfalls

- Secrets in the bundle: the JS bundle is fully extractable. Only `EXPO_PUBLIC_*` publishable values ship; never embed LiveKit/Deepgram/LLM/Clerk-backend keys or a LiveKit room token.
- Insecure token storage: AsyncStorage is JS-readable. Tokens go through the expo-secure-store wrapper only.
- Missing or client-set `org_id`: the client must never send `org_id`. If you find yourself adding it to a request, you are wrong; the gateway derives it from the JWT.
- Platform permission gaps: a permission used at runtime but missing from `app.config.ts` crashes or silently fails on device. iOS needs `NS*UsageDescription`; Android 13+ needs `POST_NOTIFICATIONS`, and in-call audio needs the foreground-service flags.
- Background-audio and lifecycle: meeting audio must survive backgrounding/lock only during an active meeting (iOS `audio` background mode; Android foreground service). Holding a background audio session outside a meeting is a bug and will get the app killed or flagged.
- OTA update caveats: `eas update` ships JS only. Any native change (new permission, new native module, plugin/config change) requires a store/dev build and a runtime-version bump; shipping it as OTA breaks clients.
- Live plane is not cached as truth: on reconnect, re-hydrate caption/agent history from durable REST; do not replay cached deltas as authoritative.

## Working with other repos

The product spans eight `mytheus-*` repos; identifiers always come from `mytheus-docs` `_canon/`.

- `mytheus-ui`: the Next.js web client and the parity reference. Mirror its route taxonomy, state layering, realtime reconciliation, priority color language, and bottom-sheet sidebar. Any divergence from shared behavior is a client bug.
- `mytheus-gateway` (`api-gateway` + `bff`): the only REST ingress and screen aggregator this client may call.
- `mytheus-realtime` (`realtime-gateway` + `transcription-service`): the WSS fan-out and event source; consume its Socket.io `/v1` event contract verbatim.
- `mytheus-core` (`core-api`, `meeting-service`, CRUD services): owns the resources you read/mutate and mints the LiveKit token.
- `mytheus` (agents, RAG, knowledge-graph): produces `agent-stream`/`agent-results`; the client only renders them.
- `mytheus-events`: the Avro event schemas; payloads inherit BACKWARD compatibility, so generate types rather than hand-rolling them.
- `mytheus-docs`: the NEXUS architecture set and the frozen `_canon/` naming authority.

## Commit and PR conventions

- Trunk-based: short-lived branches off `main`; open a PR; CI (typecheck + lint + Jest + Detox smoke) must be green before merge.
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
