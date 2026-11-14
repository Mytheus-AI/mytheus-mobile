# `mytheus-mobile` - System Design

The deep design document for the Mytheus native mobile client. It specifies what the app is responsible for, how it is architected, the exact backend contracts it consumes, and - most importantly - **every design decision it introduces that the existing Mytheus (NEXUS) architecture set does not specify**, since the mobile client is net-new.

Canon references throughout cite the architecture set by filename:

- `03-container-architecture.md` - the C4 L2 container view; the `api-gateway` / `bff` / `realtime-gateway` edge.
- `19-api-architecture.md` - the REST/WSS/event contract surface, error model, pagination, idempotency.
- `20-frontend-architecture.md` - the `mytheus-ui` (`web-app`) UX patterns this client mirrors: meeting room, agent sidebar, captions.
- `10-realtime-and-transcription.md` - `realtime-gateway` fan-out, `agent-stream`/`agent-results`, the caption budget.
- `06-multi-tenancy.md` - `org_id` injection, RLS, the `nexus:{org_id}:` namespace.
- `11-security-architecture.md` - Clerk JWT verification, secrets, encryption.

Service names, topic names, the `nexus:{org_id}:` prefix, and entity names are **frozen canon** and used verbatim; this document introduces no alternative names. Where it makes a choice canon does not cover, that choice is marked **[net-new]** and re-listed in §15.

---

## 1. Purpose & scope

`mytheus-mobile` is the native iOS + Android client for **Mytheus**. Its purpose is to bring the per-participant meeting intelligence that `mytheus-ui` delivers on desktop to the phone, where a large share of participants actually join meetings.

**In scope:** authenticated mobile app shell; join a LiveKit meeting with audio/video; live captions; the agent sidebar (notes, suggestions, decisions, actions, alerts) as a mobile-native surface; in-app + push notifications; dashboard, My Tasks, decisions, transcript, and lightweight settings screens.

**Out of scope (owned by the backend, never by this client):** any durable truth, any tenant filtering, any LLM/agent execution, any direct store access, any new REST or event contract. The client renders truth; it never decides it (`20-frontend-architecture.md` §1).

> **[net-new] The mobile client itself.** `03-container-architecture.md` §2 draws the platform client as `USER([User browser / mobile])` and fully specifies only `web-app`. There is no mobile container, navigation, offline, or push design in the canon. This entire repository is net-new. The constraint that makes it safe: it adds **zero** backend surface - it is a second consumer of the contracts `mytheus-ui` already uses.

### 1.1 Parity goals vs. `mytheus-ui`

The mobile client targets **feature parity on the read/interactive path** and **deliberate non-parity on heavy authoring/admin**:

| Capability | Web (`mytheus-ui`) | Mobile (`mytheus-mobile`) |
|---|---|---|
| Join meeting + media | Yes (LiveKit React) | **Yes** (LiveKit RN) |
| Live captions (< 2 s) | Yes | **Yes** |
| Agent sidebar (9 sections, priority language, streaming) | Right rail / bottom sheet | **Yes** - bottom sheet, the canon mobile variant (`20` §6.3) |
| Confirm/edit/dismiss decisions & actions | Yes | **Yes** |
| Dashboard, My Tasks, decisions, transcript | Yes | **Yes** (read-first) |
| In-app notifications | Yes | **Yes** + native push |
| Settings: profile, account | Yes | **Yes** (lightweight) |
| Billing / plan management | Yes | **View-only**; purchase flows deferred (see §15) |
| Tenant-admin / internal-ops consoles | Yes (RBAC) | **Not shipped** - admin stays on web |
| Integration OAuth install | Yes | **Not shipped** - install on web; mobile reflects state |

> **[net-new] The parity matrix above.** Canon does not partition functionality between form factors. Keeping admin/billing-purchase/integration-install on web is a mobile-product choice to keep the app focused on the meeting/agent loop and to avoid App Store in-app-purchase friction for SaaS seats.

---

## 2. Responsibilities

1. **Authenticate** via Clerk and establish the active org context (read-only; `org_id` comes from the JWT, server-side).
2. **Join meetings**: mint a LiveKit token through `meeting-service`, connect the LiveKit RN room, render the participant grid and controls.
3. **Live captions**: subscribe to `realtime-gateway`, render interim-then-final captions inside the < 2 s budget.
4. **Agent sidebar**: render the frozen nine-section order with the red/yellow/blue priority language, stream `agent-stream` tokens into draft cards, settle on `agent-results`, and offer Confirm / Edit / Dismiss where canon allows.
5. **Notifications**: register an Expo push token with `notification-service`; show native push when backgrounded and the in-app notification center (`GET /api/v1/notifications`) when foregrounded.
6. **Dashboards & read models**: dashboard, meeting list, My Tasks, decisions, transcript view.
7. **Lightweight settings**: profile (role/skills/bio/avatar), account, notification preferences, org display + switch.

Every one of these maps to an existing backend endpoint or socket channel; none requires a new contract.

---

## 3. Architecture

### 3.1 Expo managed workflow

The app runs on the **Expo managed workflow** with **development builds** (native modules - LiveKit, secure-store, push - preclude Expo Go). The React Native **New Architecture** (Fabric + TurboModules) is enabled for LiveKit video performance. Native config (permissions, plugins, scheme) lives in `app.config.ts` driven by env, so the same JS bundle targets `development` / `staging` / `production` via EAS channels.

### 3.2 Navigation

**Expo Router** (file-based, React Navigation underneath) mirrors the `mytheus-ui` route groups (`20` §2.2):

- `(auth)/*` - Clerk sign-in / sign-up / SSO callback, shown when unauthenticated.
- `(app)/*` - the authenticated shell. `(app)/_layout.tsx` is the single place org context is resolved (the mobile analogue of `web-app`'s `(app)/layout.tsx`): it reads the Clerk session, exposes a typed `OrgContext`, and renders the tab/stack navigator. No screen re-derives tenancy.
- The meeting room (`(app)/meetings/[meetingId]/room`) is the only screen holding both long-lived connections (Socket.io + LiveKit), loaded lazily so the rest of the app stays light.

### 3.3 Offline / caching strategy

The client is **online-first, offline-tolerant** for read models and **online-only** for the live meeting path:

- **TanStack Query** is the server-state cache. Its cache is **persisted** (to AsyncStorage / MMKV) so the dashboard, My Tasks, decisions, and recent meetings render instantly on cold start and remain readable offline (stale-while-revalidate).
- **Mutations** (confirm decision, complete action, edit worklog, dismiss notification) use TanStack Query's optimistic update + rollback, and queue with retry when offline; each carries an `Idempotency-Key` so a replay on reconnect is safe (`19` §8).
- **The live plane is not cached as truth.** Captions and `agent-stream` deltas are ephemeral; if offline, the meeting room shows a reconnect state. On reconnect, caption/agent history is re-hydrated from `core-api` REST (finals are durable) - the same rule the web client follows (`10` §4.4, `20` §6.1).
- **No durable truth is ever invented client-side.** Offline reads are clearly marked stale; nothing is written that the server has not acknowledged.

### 3.4 Background audio

Joining a meeting from a phone means the app must keep meeting audio alive when backgrounded or screen-locked:

- **iOS**: the `audio` background mode (`UIBackgroundModes`), configured through the LiveKit RN config plugin, so an active call keeps the mic/audio session when the app is backgrounded.
- **Android**: a **foreground service** (LiveKit RN's call service) with an ongoing notification while in a meeting, so the OS does not kill the audio session.
- Background audio is scoped strictly to an **active meeting**; outside a meeting the app holds no background audio session.

> **[net-new] Offline strategy and background audio.** Canon's `20-frontend-architecture.md` specifies web reconnect/re-hydration but no offline persistence and (being a browser app) no OS background-audio handling. The persisted-query cache, the offline mutation queue, and the iOS/Android background-audio configuration are mobile-specific additions consistent with the canon rule that the live plane carries no durable truth.

### 3.5 The two live transports (mirrors web)

```
[ mytheus-mobile (meeting room) ]
   ├── Socket.io client  ──WSS──▶ realtime-gateway   (captions, agent output, presence, chat)
   └── LiveKit RN room   ──WebRTC──▶ LiveKit SFU       (audio / video / screen share)
```

Both providers wrap the meeting-room subtree only. Socket.io joins the `meeting_id` room and auto-reconnects with backoff; LiveKit connects with the freshly minted token and re-mints on reconnect (`10` §2.3, §4.4).

---

## 4. Tech stack with versions & rationale

Versions are the intended baseline at scaffolding time; the lockfile is the source of truth and is bumped on the project's normal dependency cadence.

| Dependency | Baseline version | Why |
|---|---|---|
| `expo` (SDK) | 51+ | Managed workflow + EAS Build/Submit/OTA; config plugins for native modules without ejecting; over-the-air JS updates without store review. |
| `react-native` | 0.74+ (New Architecture) | Fabric renderer for smooth LiveKit video grids; the Expo SDK pins a compatible RN. |
| `react` | 18.x | Concurrent features; matches RN baseline. |
| `typescript` | 5.x (strict) | Parity with `mytheus-ui`; generated types from OpenAPI/Avro prevent wire drift. |
| `expo-router` | 3+ | File-based navigation mirroring the web route taxonomy; deep links for notification tap routing. |
| `@clerk/clerk-expo` | latest | Same identity provider as web; native secure session storage; SSO support. |
| `@livekit/react-native` (+ `@livekit/react-native-webrtc`) | latest | The locked meeting SDK (`03` §7, ADR-0003); RN binding to the same SFU as web. |
| `socket.io-client` | 4.x | Speaks to `realtime-gateway` Socket.io `/v1` namespace; same event names/payloads as web (`19` §3). |
| `@tanstack/react-query` (+ persist plugin) | 5.x | Server-state cache, optimistic mutations, offline persistence. |
| `zustand` | 4.x | Ephemeral UI state (sidebar collapse, draft streaming cards, toast queue) - same role as in `mytheus-ui`. |
| `expo-notifications` | latest | Push token registration + handling for the notification tier. |
| `expo-secure-store` | latest | Keychain/Keystore-backed token storage. |
| `@sentry/react-native` | latest | Crash/error reporting; matches the platform Sentry stack (ADR-0015). |
| `jest` + `@testing-library/react-native` | latest | Unit/component tests. |
| `detox` | latest | E2E on simulators/emulators. |

### 4.1 Why React Native + Expo (and not native or alternatives)

1. **One codebase, two platforms, web parity.** `mytheus-ui` is React + TypeScript with a TanStack Query / Zustand / Socket.io / LiveKit stack. React Native reuses that mental model and much non-UI logic (API clients, realtime reconciliation, types), so the hardest surface - the agent sidebar's streaming/reconciliation - is implemented once in a familiar paradigm rather than twice in Swift + Kotlin.
2. **First-class SDKs exist.** Clerk, LiveKit, and Sentry all ship maintained React Native SDKs, so every platform dependency the web client uses has a native-mobile equivalent - no contract is reinvented.
3. **Expo removes native-build toil and adds OTA.** EAS Build/Submit handles signing and store submission; OTA updates ship JS-only fixes without a store review cycle, which matters for a fast-moving agent product. Config plugins give native capabilities (background audio, push, secure storage) without leaving the managed workflow.
4. **Performance is sufficient for this app.** The heavy media path is delegated to LiveKit's native WebRTC; React Native handles list/card UI well with virtualization. The app is not a game; RN's ceiling is far above its needs.

Trade-off accepted: a thin layer of native config (permissions, background modes, the LiveKit plugin) is unavoidable, and is isolated in `app.config.ts` + EAS profiles.

> **[net-new] The entire stack selection and its rationale.** Canon locks the *web* frontend stack (`20` §2, Tech Decisions §2.8) but says nothing about mobile. RN + Expo, Expo Router, the persist plugin, Detox, and the version baselines are all net-new choices, made to maximize parity with the locked web stack while staying contract-identical.

---

## 5. Backend contracts

The client speaks exactly the three planes defined in `19-api-architecture.md` §1, through exactly the two doors in `03-container-architecture.md` §6. It introduces nothing new.

### 5.1 REST via `api-gateway` → `bff`

- Base: `https://{API_GATEWAY_URL}/api/v1/...` and `/bff/*`. The client knows **only** the gateway origin and the realtime WSS origin (`20` §2.3) - never a service URL.
- Reads: screen-shaped aggregates from `bff` (`GET /bff/dashboard`, `GET /bff/meeting-room/:id`) and resource reads from owning services (`GET /api/v1/meetings`, `/actions`, `/decisions`, `/worklogs`, `/notifications`, `/usage`).
- Writes: resource mutations to owning services (`POST /api/v1/decisions/:id/confirm`, `POST /api/v1/actions/:id/confirm`, `PATCH /api/v1/worklogs/:id`, `PATCH /api/v1/notifications/:id`).
- Conventions honored verbatim: `snake_case` JSON, ISO-8601 UTC, UUID v4 ids, cursor (keyset) pagination (`19` §6), RFC 7807 `application/problem+json` errors branched on the stable `code` enum (`19` §7), and `Idempotency-Key` on every create/confirm mutation (`19` §8).
- `org_id` is **never** a path/query param and is never sent by the client - `api-gateway` derives it from the JWT (`19` §2.1).

### 5.2 WSS to `realtime-gateway` (Socket.io)

- Connects to the `realtime-gateway` WSS origin through `api-gateway`, on the Socket.io `/v1` namespace, joining the room keyed by `meeting_id` (`10` §4.1, `19` §3).
- Channels consumed: **live captions** (interim + final), **`agent-stream`** token deltas (disposable), **`agent-results`** final cards (durable), **presence**, and in-meeting **chat**. Payloads reuse the Avro-derived schemas (`AgentStreamDelta`, `AgentResult`), so the client inherits BACKWARD compatibility.
- Client rules mirror the web contract (`20` §5.2): deltas are throwaway (a missed delta is never data loss - the final `agent-results` renders the complete card); drafts are correlation-keyed; under backpressure the gateway drops `agent-stream` first, never captions or confirmed output.
- The cross-instance fan-out backbone (`nexus:{org_id}:pubsub:meeting:{meeting_id}` Redis pub/sub) is **server-side**; the client is agnostic to which `realtime-gateway` pod it lands on.

### 5.3 LiveKit for media

- The client calls `POST /api/meetings/{id}/token` (owned by `meeting-service`; the gateway sends `/api/v1/meetings` to core-api, so the documented `/api/v1/meetings/:id/token` never mints) to mint a short-lived, participant-verified room token (`{ token, room, livekit_url, started_at, consent_version, consented_at }`, p95 < 250 ms; `10` §2.3). The optional body `{ consent: { version } }` records the person's agreement to the room notice (ADR-0018); a 428 `CONSENT_REQUIRED` means ask first. It never holds LiveKit API credentials - only the scoped token and the LiveKit URL.
- On reconnect it re-mints. Token TTL is ~600 s; the verification is `meeting_participants`-gated server-side (deny-by-default).

### 5.4 Push via the notification tier

- The client registers its Expo push token against `notification-service` (the durable read side is `GET/PATCH /api/v1/notifications`, `19` §5.7). Delivery rides the platform `notifications` topic → `notification-service` (`03` §4.2) → Expo Push → APNs/FCM.
- Push carries **no durable truth** (consistent with the WebSocket rule, `19` §1): a notification's authoritative state is always recoverable from `GET /api/v1/notifications`, so a missed push loses nothing - the in-app center reconciles on next foreground.

> **Built in wave 3:** `notification-service` `GET|POST /notifications/push-devices` and `DELETE /notifications/push-devices/{id}` (table `push_devices`), delivery behind `PUSH_PROVIDER=expo`; see N7.
>
> **[net-new] Expo push token registration shape.** Canon's `notification-service` owns `notification_log` and per-user channel preferences and emits `notification-delivery-events` (`03` §4.2), but it does not specify a *device push token* registration for a mobile client (the web client has no native push). The registration call (associating an Expo push token with the authenticated `user_id`/`org_id`) is a net-new contract addition the backend must expose; it is modeled as a standard `notification-service` channel-preference write, keeping `notification-service` the single owner of delivery. **This is the one place the mobile client implies a small backend addition; it is flagged here and in §15 so it is not mistaken for an existing contract.**

---

## 6. Auth & multi-tenancy

- **Clerk Expo SDK** owns identity. `<ClerkProvider>` wraps the root layout; the `(app)` group is gated by the Clerk session. The front-channel issues a short-TTL session JWT carrying the `org` claim - identical to web (`11` §2.1).
- **`org_id` is server-derived only.** The client displays the active org but **cannot widen its own scope**; `api-gateway` extracts `org_id` from the Clerk-verified JWT and fails closed if it cannot (`19` §2.1, `06` §4). The browser-is-not-a-tenancy-boundary property (`20` §8) holds identically on mobile: every response is already tenant-scoped and the client never filters by tenant.
- **`org_id` propagation:** the client sends only the bearer JWT; the gateway injects `org_id` downstream into REST headers, gRPC metadata, `app.current_org`, Qdrant filters, AGE `$org_id`, Redis `nexus:{org_id}:` keys, and Avro records - none of which the client sees.
- **Org switching:** a user in multiple orgs switches the **active org via Clerk** (re-issuing a JWT with the new `org` claim); the client never mutates a header to switch tenants (`20` §8). On switch, the client clears tenant-scoped query caches and re-subscribes realtime rooms.
- **RBAC** (`owner`/`admin`/`member`, `11` §3) is enforced server-side. The mobile app hides/disables affordances the role cannot use (e.g. it ships no admin console at all), but the gateway/middleware is the real boundary.

---

## 7. Real-time UX

- **Captions** render within the **< 2 s** budget (`10` §6.2). Interims are mutable and never persisted; finals are durable. The client shows interim-then-final and never treats a dropped interim as loss.
- **Agent token streaming:** `agent-stream` deltas accumulate into a correlation-keyed draft card; on `agent-results` the draft is replaced by the settled card. Reserved card min-height prevents layout thrash as tokens arrive - the mobile expression of the web "calm, not flashy" discipline (`20` §5.4). `prefers-reduced-motion` / Reduce Motion degrades entrances to opacity-only.
- **Priority language** is the frozen red/yellow/blue strip (priority 1/2/3); the **red conflict banner** pre-empts and pins to top (`20` §5.3). The per-user priority queue (`nexus:{org_id}:queue:agent:{user_id}`) is enforced server-side; the client renders the order it receives and pins the conflict banner.
- **Agent sidebar as a bottom sheet:** on phone form factor the sidebar is a drag-up **bottom sheet** over the video grid - exactly the mobile variant canon already specifies for the web client (`20` §6.3). The frozen nine-section order, streaming, and Save-for-later behavior are preserved; only the container changes. A red conflict banner auto-expands the sheet a notch.
- **Confirmation is load-bearing:** decisions/actions are never silently committed. The card surfaces; the user taps **Confirm**; only then does `core-api` emit on `decisions`/`actions` and `knowledge-graph-service` writes the AGE edge (`20` §5.1, `06` §3.3). Edit opens a pre-filled modal.
- **Presence** is rendered from the presence channel; the live set lives server-side in `nexus:{org_id}:presence:{meeting_id}`.

---

## 8. Push notifications

- **Tokens:** on first authenticated launch (and on permission grant) the app obtains an Expo push token and registers it with `notification-service` against the `user_id`/`org_id` (see §5.4 caveat). Tokens are refreshed on rotation and de-registered on sign-out.
- **Delivery mapping:** platform alerts flow `agent-runtime-service`/`core-api` → `notifications` topic → `notification-service` → (channel pref = push) → Expo Push Service → APNs (iOS) / FCM (Android) → device. This reuses the existing `notification-service` delivery fabric (`03` §4.2, `19` §5.7); Expo is just the push transport for the mobile channel.
- **Tap routing:** a push payload carries a deep link (`mytheus://meetings/{id}/room`, `mytheus://tasks`, `mytheus://notifications`) that Expo Router resolves to the right screen.
- **Reconciliation:** because push carries no durable truth, the notification center (`GET /api/v1/notifications`, cursor-paginated) is the authority; opening it marks items read via `PATCH /api/v1/notifications/:id`, persisting the dismissal so it does not re-surface.

---

## 9. Offline & resilience

- **Read models** are served stale-while-revalidate from the persisted TanStack Query cache; offline screens render last-known data with a stale indicator.
- **Mutations offline** are queued with optimistic UI and rollback, retried on reconnect with the **same `Idempotency-Key`**, so a confirm/complete never double-applies (`19` §8) - important on flaky mobile networks where the canon explicitly calls out "mobile reconnects" as a retry source.
- **Live meeting** degrades to a clear reconnect state when offline; Socket.io backoff-reconnects and re-joins the `meeting_id` room, LiveKit re-mints its token, and caption/agent history re-hydrates from durable REST on reconnect (`10` §4.4).
- **App backgrounding** during a meeting keeps audio (§3.4); on foreground the sockets reconcile and missed durable facts are re-fetched.

---

## 10. Performance

| Surface | Budget | Technique |
|---|---|---|
| Cold start to interactive | < ~2.5 s on a mid-tier device | Hermes engine, minimal root providers, persisted-cache instant paint, lazy meeting-room route. |
| JS bundle | Lean; meeting/LiveKit code split out of the initial bundle | Route-level code splitting via Expo Router; the LiveKit + Socket.io stack loads only on the meeting room (mirrors `20` §6.3). |
| List rendering (transcript, tasks, decisions) | Smooth scroll at 60 fps | `FlashList`/virtualized lists; a meeting yields up to ~360 finals - never rendered un-virtualized. |
| Live caption render | within < 2 s caption SLO | No layout shift; append-only caption view. |
| Streamed agent token render | progressive, no thrash | Reserved card heights; throttled delta application. |
| Video grid | smooth with 6–9 tiles | LiveKit adaptive simulcast; pause off-screen tiles. |

Hermes is the JS engine; OTA updates keep the JS bundle current without store delay.

> **[net-new] Mobile performance budgets.** Canon budgets web FCP/route JS (`20` §6.3); cold-start, Hermes, and mobile list-virtualization targets are net-new, set to be consistent with the imported real-time SLOs (which are platform-wide and unchanged).

---

## 11. Security

- **Token storage:** session/refresh tokens via **expo-secure-store** (iOS Keychain / Android Keystore), never AsyncStorage and never in JS-readable storage. Clerk's Expo SDK uses secure storage for its session.
- **No secrets in the bundle:** only `EXPO_PUBLIC_*` publishable values ship (gateway URL, realtime URL, Clerk publishable key, LiveKit URL, Sentry DSN). LiveKit API keys, Deepgram, LLM, and Clerk backend keys remain server-side (`11` §6). The LiveKit room token is minted per join, never embedded.
- **Certificate pinning:** TLS pinning on the `api-gateway` and `realtime-gateway` origins (via the network-security config / an Expo config plugin) to resist MITM on hostile networks; pins are rotated with an overlap window to avoid lockout.
- **Transport:** TLS 1.3 / WSS only; no plaintext ingress (`11` §7). The LiveKit media path is WebRTC (DTLS-SRTP).
- **Defense-in-depth inherited:** the client trusts server tenancy enforcement absolutely (RLS, per-tenant Qdrant, namespaced Redis) and never receives another tenant's data to leak (`20` §8, `06`).
- **Jailbreak/root posture:** secure-store + pinning degrade gracefully; the app does not store durable transcript content locally beyond the encrypted query cache, limiting at-rest exposure on a compromised device.

> **[net-new] Certificate pinning and the secure-storage choice.** Canon mandates TLS/WSS and server-side secrets but, being browser-targeted, specifies no client cert pinning or device-keychain storage. Both are net-new mobile hardening choices consistent with `11`'s fail-closed, no-client-secrets posture.

---

## 12. Platform specifics

**iOS permissions / config:**
- `NSMicrophoneUsageDescription` (meeting audio), `NSCameraUsageDescription` (meeting video).
- `UIBackgroundModes: ["audio"]` for in-call background audio.
- Push: APNs entitlement; user-prompted notification permission via `expo-notifications`.
- App Transport Security: HTTPS/WSS only.

**Android permissions / config:**
- `RECORD_AUDIO`, `CAMERA` (meeting media), `POST_NOTIFICATIONS` (Android 13+), `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_MICROPHONE` for the in-call audio service.
- Network security config carrying the certificate pins.
- Push via FCM (`google-services` config supplied through EAS secrets, not committed).

Permissions are requested **contextually** (mic/camera at join, notifications after first value moment), not all at launch.

---

## 13. Dev practices

- **TypeScript strict**; no `any` in committed code. API and socket payload types are generated from the platform OpenAPI 3.1 specs and Avro schemas (`19` §11) so the client cannot drift from the contract.
- **ESLint + Prettier** enforced in CI; formatting is not debated.
- **TDD with Jest + RNTL**: write the failing test first, then implement; the realtime reconciliation logic and the optimistic-mutation rollback paths are tested behaviorally.
- **Trunk-based + PR**: short-lived branches off `main`, PRs reviewed, CI green (typecheck + lint + unit + a Detox smoke) before merge. Contract-compatibility with `mytheus-ui` is a review checklist item.
- **Naming authority:** every service/topic/entity identifier comes from `mytheus-docs` `_canon/`; the client never invents a name.

---

## 14. CI/CD & observability

**CI/CD (GitHub Actions + EAS):**
- On PR: `pnpm install`, typecheck, lint, Jest, Detox smoke (where a runner is available).
- On merge to `main`: `eas build` for the `staging` profile + internal distribution; `eas update` to the `staging` OTA channel.
- On release tag: `eas build --profile production`, `eas submit` to App Store Connect / Google Play, `eas update --branch production` for OTA JS rollouts (with staged rollout + the ability to roll back a bad OTA).
- OTA respects the native/runtime-version boundary: only JS-compatible changes ship OTA; native changes go through a store build.

**Observability:**
- **Sentry React Native** for crash + error reporting and performance traces, tagged with `org_id`-free user identifiers and the W3C `trace_id` echoed by the API error model (`19` §7) so a client error pivots to the backend trace.
- **Analytics** for screen views, join-success rate, caption-latency-perceived, and notification tap-through - privacy-conscious, no transcript content, tenant-aggregate only.

> **[net-new] The mobile CI/CD pipeline and EAS channel model.** Canon's CI/CD is GitHub Actions for backend/web (ADR-0014/0015); the EAS Build/Submit/OTA flow and channel strategy are net-new mobile additions. Sentry is the platform-standard observability stack (ADR-0015), reused here.

---

## 15. Net-new decisions log

Every decision below is **not specified by the existing Mytheus (NEXUS) architecture set** and is introduced by this repository. Each is consistent with canon and cites the canon it aligns to. None changes a frozen identifier, contract, or tenancy rule.

| # | Net-new decision | Why / consistency with canon |
|---|---|---|
| N1 | **The mobile client exists at all** as a designed container. | Canon draws "User browser / **mobile**" but designs only `web-app` (`03` §2). |
| N2 | **Stack = React Native + Expo (managed), Expo Router, TanStack Query (+persist), Zustand, Socket.io client, Clerk Expo, LiveKit RN, Expo Notifications, expo-secure-store, Sentry RN.** | Maximizes parity with the locked web stack (`20` §2); every web dependency has a maintained RN equivalent. |
| N3 | **Parity matrix** - read/interactive parity; admin consoles, integration-install, and billing-purchase stay on web (mobile shows view-only). | Product focus + App Store IAP friction; canon does not partition by form factor. |
| N4 | **Offline strategy** - persisted query cache (stale-while-revalidate), offline mutation queue with idempotency-keyed retry. | Web has no offline spec; reuses canon idempotency (`19` §8) and "live plane carries no durable truth" (`19` §1). |
| N5 | **Background audio** - iOS `audio` background mode; Android foreground service. | No browser analogue exists in canon; scoped to active meetings only. |
| N6 | **Bottom-sheet agent sidebar** as the primary mobile surface. | This is exactly the mobile variant canon already prescribes for the web client (`20` §6.3). |
| N7 | **Expo push token registration** with `notification-service`: BUILT in wave 3 (`GET|POST /notifications/push-devices`, `DELETE /notifications/push-devices/{id}`, table `push_devices`). Registered after sign-in inside the workspace (permission asked only when not yet answered), the device id kept in expo-secure-store, removed before sign-out and before a workspace switch. Server delivery is `PUSH_PROVIDER=expo`; off = "Push is not connected on this server" in Settings. Taps open `appRoute(data.link)`, else the Inbox. | The backend owns delivery (the consumer mirrors each new in-app row to Expo Push after commit); the push is a pointer and the Inbox stays the authority. |
| N8 | **Deep-link scheme** `mytheus://…` for notification tap routing. | Mobile-only navigation concern; resolves to existing screens. |
| N9 | **Certificate pinning** on gateway + realtime origins. | Mobile hardening; consistent with `11` §7 TLS posture. |
| N10 | **Secure token storage** via expo-secure-store (Keychain/Keystore). | Mobile equivalent of the web's HTTP-only session handling; consistent with `11` no-client-secrets. |
| N11 | **Mobile performance budgets** (cold start, Hermes, list virtualization). | Net-new targets set consistent with the unchanged platform-wide real-time SLOs. |
| N12 | **CI/CD via GitHub Actions + EAS Build/Submit + OTA channels.** | Net-new mobile pipeline; Sentry observability reused from ADR-0015. |
| N13 | **Contextual permission prompts** (mic/cam at join, notifications after first value). | Mobile UX best practice; no canon equivalent. |
| N14 | **The phone's room is a focused companion**: the call, captions, your agent's notes, the shared candidate ledger (confirm; host dismiss for everyone; "Hide for me" for others), the shared agenda (host marks items), hands, reactions and "End for everyone". In-room chat, suggestions, context fills and in-room alerts stay on the web; alerts still reach the phone through the Inbox. Card editing (and so taking an edit lock) stays on the web; the phone shows and honours locks. | Keeps the phone room usable on a small screen; every event used is the gateway's existing `/v1` contract. |
| N15 | **Navigation**: five tabs (Home, Inbox, Meetings, My work, Ask); Decisions and Settings open from Home. | The polish plan's simpler sidebar, folded to a phone tab bar. |
| N16 | **No persisted query cache** (supersedes the persistence half of N4). Server state is in memory only; refetch on foreground. | AsyncStorage is unencrypted and must not hold transcripts or agent notes at rest (§11). |
| N17 | **The theme follows the system appearance** (light/dark) and Dynamic Type; tokens are mytheus-ui's light and dark app tokens. | The web has a manual toggle; phones conventionally follow the OS. |
| N18 | **Types are generated** from mytheus-backend's emitted OpenAPI documents (bff, core-api, identity, meeting-service, notification-service only) with the mytheus-ui generator approach; `src/api/spec.ts` types every call's path, method, params and body. | Drift fails `tsc`; admin, billing and integration documents are deliberately not generated (N3). |
| N19 | **Sign-in is password or emailed code** (plus Clerk's second step), with no sign-up; the workspace is chosen with Clerk `setActive`. SSO on the phone is not built. | Accounts are provisioned on the web; SSO needs a redirect setup per workspace. Requires Clerk's Native API to be enabled. |
| N20 | **Names come from Clerk's organization member list** joined to identity's `GET /users` on `clerk_user_id` (the web joins on the server with Clerk's backend key, which the phone must not hold). | No new backend route. |
| N21 | **Marking a task done is sent at once; Undo reopens it** (`POST /api/v1/actions/{id}/reopen`, wave 3), optimistically with rollback. Done tasks also offer Reopen. Supersedes the 4.5 s client grace window. Promises use Undo by reopening (`PATCH status=open`). | A real write instead of a held one: leaving the screen or losing the app can no longer drop or delay a completion. |
| N22 | **The in-person "Meeting Pod" mock is removed.** It recorded nothing and showed fixed sample data. Superseded by N23 (a real recorder on a real contract). | No invented contract (CLAUDE.md). |
| N23 | **Record in person** (`app/(app)/capture`): core-api `POST /api/v1/capture/sessions` (Clerk bearer, `consent: true`) creates an `in_person` meeting and mints a 15-minute capture token; the phone streams its microphone to transcription-service `/capture/audio` (init frame, `ready`, binary 16 kHz mono s16le, `stop`; 4401 -> refresh then reconnect; 30 s buffer across drops) with header `Origin: mytheus-mobile://capture`; Stop ends the meeting (`.../end`) and opens it. Raw PCM comes from **`@siteed/audio-studio`** (maintained successor of expo-audio-stream; Expo config plugin; streams PCM chunks to JS as base64 every 100 ms; Android foreground-service notification and iOS `audio` background mode keep it alive with the screen off). Expo's own `expo-audio` only records to a file, so a native module is required; it needs a development build like LiveKit already does (not Expo Go). The library sits behind `src/realtime/capture/mic.ts`; framing (`pcm.ts`) and the protocol (`socket.ts`) are pure and unit-tested. `GET /api/v1/capture/status` false (no `CAPTURE_TOKEN_SECRET`/`CAPTURE_INGEST_URL`) shows "not connected". | Same token format and wire contract as the Chrome extension; core-api owns the meeting, transcription-service records the consent again before any audio. |

| N24 | **A briefing from your agent** (`src/components/feature/Briefing.tsx`, `app/(app)/briefings/[briefingId].tsx`): the card on Home and on an ended meeting, the full screen a briefing push opens (`/briefings/{id}` -> `appRoute`). A briefing with a server audio file plays it by **expo-audio** on a 10-minute URL; otherwise it is spoken in the Myte's Kokoro voice (N25). Either way the player is the lock-screen player. (The expo-speech device voice is gone, superseded by N25.) The agent's doodle face is drawn from a verbatim copy of mytheus-ui `lib/doodle.ts` (`src/lib/doodle.ts`). **Background audio only while a briefing plays**: the audio session plays in silent mode and in the background from the first Play and is released when the briefing ends or its screen closes, so a locked phone keeps talking (iOS `audio` background mode, Android media-playback foreground service, both already declared) without holding the session outside a briefing. `expo-audio`'s config plugin carries the same microphone text. | Same REST contract as the web (`/api/v1/briefings*`); a briefing is listened to like a podcast, which is the one case besides a meeting where background audio is the expected behaviour. |
| N25 | **Every Myte speaks with the self-hosted Kokoro voice (ADR-0050); no device voice.** `src/voice/`: `text.ts` strips markdown and citations and splits into sentences (the first chunk one sentence, then groups up to about 240 characters, never over 1500); `engine.ts` POSTs each chunk to core-api `POST /api/v1/voice/speech` through the one REST client (`requestBytes`, same Clerk token and refresh), writes the MP3 to the cache directory (expo-file-system), plays it on one expo-audio player (replaced item by item, so it stays the lock-screen player), prefetches the next chunk, caches chunks for replay, retries a 429 once, and on any other failure stops and shows "Voice is unavailable right now" with the text kept. The voice is not named by the phone for briefings (the server applies the person's choice, else the personality's); the personality sets the voice's pace (0.7..1.4) and the person's speed is the pitch-corrected playback rate. The voice picker (`app/(app)/voice.tsx`, from Settings) lists `GET /api/v1/voice/voices` with description, accent and gender, marks the current voice, previews an in-character line, and saves with `PUT /api/v1/voice/preference` (`null` = match my Myte's personality). `expo-speech` is removed. | Same contract as the web (`/api/v1/voice/*`); one recognisable voice per Myte on every device. |
---

## 16. Summary

`mytheus-mobile` is a net-new, pure client in the Mytheus edge tier. It mirrors `mytheus-ui`'s contracts and UX - REST through `api-gateway`/`bff`, WSS to `realtime-gateway`, LiveKit for media, Clerk for auth with server-derived `org_id` - and adds only what a phone requires: offline-tolerant reads, background meeting audio, native push, secure on-device token storage, and certificate pinning. It owns no backend data, invents no names, and changes no tenancy rule; the single backend implication it carries (device push-token registration) is explicitly flagged. Everything not specified by the canon is enumerated in §15.
