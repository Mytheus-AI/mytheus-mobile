# CLAUDE.md

> `reprise-mobile` is the net-new React Native + Expo iOS/Android client for Reprise AI, a pure edge-tier app that talks to the platform only through the gateways. Read this before editing.

## 🎯 Purpose

`reprise-mobile` is the **net-new native iOS + Android client** for **Reprise AI**, the meeting-orchestration SaaS where every participant gets a personal AI agent.

It is a pure edge-tier client. It:

- Joins LiveKit meetings and renders live captions and the agent sidebar.
- Shows dashboards, My Tasks, and decisions.
- Handles in-app and push notifications.
- Offers lightweight settings.

It owns **no backend data** and talks to the platform **only** through `api-gateway` -> `bff` (REST) and `realtime-gateway` (WSS), plus LiveKit for media, exactly like the web client (`reprise-ui`).

The full design is in `system.md`; the platform architecture lives in `reprise-docs` (codename NEXUS).

## 🧱 Stack & Layout

**Stack**

- **React Native 0.74+** (New Architecture) on **Expo SDK 51+** (managed workflow, dev builds).
- **TypeScript 5.x strict**, **Expo Router 3+** for file-based navigation.
- **@clerk/clerk-expo** (auth), **@livekit/react-native** (media), **socket.io-client 4.x** (realtime).
- **@tanstack/react-query 5.x** (+ persist plugin) for REST/server-state, **zustand 4.x** for ephemeral UI state.
- **expo-notifications** (push), **expo-secure-store** (tokens), **@sentry/react-native** (observability).
- **Jest + @testing-library/react-native** (unit), **Detox** (e2e). Package manager: **pnpm** (Node 20+).

The lockfile is the source of truth for exact versions.

**Layout**

| Location | Holds |
| :-- | :-- |
| `app/` | Expo Router routes. `(auth)/*` = unauthenticated; `(app)/*` = authenticated shell. |
| `src/api/` | REST clients. Base client in `src/api/client.ts`; TanStack Query hooks in `src/api/hooks/`. |
| `src/realtime/` | `SocketProvider` (Socket.io -> `realtime-gateway`) and `LiveKitProvider` (media). |
| `src/components/` | UI composed from design-system primitives. |
| `src/theme/` | Design tokens mirroring the `reprise-ui` token set. |

## 📐 Conventions

- **Navigation:** routes live in `app/` (Expo Router). `(auth)/*` = unauthenticated; `(app)/*` = authenticated shell. Org context is resolved **once** in `app/(app)/_layout.tsx` and exposed via `OrgContext`; never re-derive tenancy in a screen.
- **API clients live in `src/api/`.** All REST goes through one base client (`src/api/client.ts`) that targets only the `api-gateway` origin, injects the Clerk bearer token, and parses the RFC 7807 error model. Expose data as TanStack Query hooks in `src/api/hooks/`. Never `fetch` a service URL directly from a component.
- **Realtime clients live in `src/realtime/`.** `SocketProvider` (Socket.io -> `realtime-gateway`) and `LiveKitProvider` (media) wrap the meeting-room subtree only. Socket event handling and the delta -> draft -> final reconciliation live here, not in screens.
- **State split:** server state = TanStack Query; ephemeral UI state (sidebar collapse, draft streaming cards, toasts) = Zustand. Durable facts are never invented client-side.
- **Components** in `src/components/` compose design-system primitives that mirror the `reprise-ui` token set (`src/theme/`). No ad-hoc styling outside the token system.
- **Naming:** `snake_case` on the wire (matches the API), `camelCase` in TS app code. Files are `kebab-case` except React components (`PascalCase`).

## 🚦 Cross-Cutting Rules (non-negotiable)

| Rule | What it means |
| :-- | :-- |
| **Clerk-only auth** | All authentication is via the Clerk Expo SDK. No other identity path. |
| **`org_id` always, server-derived only** | The client never sets, sends, or guesses `org_id`; `api-gateway` extracts it from the Clerk JWT. Never put `org_id` in a path, query, or body. Org switching re-issues the JWT via Clerk; never mutate a header to change tenants. |
| **Backend access ONLY via `api-gateway`/`bff` (REST) and `realtime-gateway` (WSS)** | Plus LiveKit for media using a token minted by `meeting-service` (`POST /api/v1/meetings/:id/token`). Never call a service directly; never embed LiveKit/Deepgram/LLM credentials. |
| **Secure storage for tokens** | Session/refresh tokens go in **expo-secure-store** (Keychain/Keystore). Never AsyncStorage, never plain storage. |
| **No secrets in the bundle** | Only `EXPO_PUBLIC_*` publishable values (gateway URL, realtime URL, Clerk publishable key, LiveKit URL, Sentry DSN). Nothing else. |
| **WebSocket/push carry no durable truth** | Captions and `agent-stream` deltas are throwaway; every durable fact (final caption, confirmed decision, notification state) is recoverable from REST and is the authority. A missed socket/push loses nothing. |
| **No silent commits** | Decisions/actions are confirmed by an explicit user tap; the client never auto-confirms. |
| **Idempotency on mutations** | Every create/confirm `POST` carries an `Idempotency-Key`; offline retries reuse the same key. |

## 📛 Naming Authority

Service names, topic names (e.g. `agent-stream`, `agent-results`, `notifications`), the `nexus:{org_id}:` namespace prefix, and entity names come from **`reprise-docs` `_canon/`**, the frozen source of truth.

**Never invent or rename** a service, topic, entity, or threshold. If a name you need is not in `_canon/`, stop and ask; do not coin one.

## ✅ Do / ❌ Don't

**✅ Do**

- Mirror `reprise-ui` patterns (route taxonomy, state layering, realtime reconciliation, priority color language, bottom-sheet sidebar).
- Generate API/socket types from the platform OpenAPI/Avro contracts; keep the client contract-compatible with `reprise-ui`.
- Write the failing test first (TDD); test reconciliation and optimistic-rollback behaviorally.
- Request permissions contextually (mic/cam at join, notifications after first value moment).
- Mark any net-new design decision and record it in `system.md` §15.

**❌ Don't**

- Don't add a new backend contract. The one known implied addition (device push-token registration) is already flagged in `system.md` §15 (N7); don't invent others.
- Don't filter data by tenant client-side, or treat the client as a tenancy boundary.
- Don't ship admin/ops consoles or integration-OAuth-install flows (web-only by design).
- Don't store transcript/agent content durably on-device beyond the encrypted query cache.
- Don't bypass the base API client or the realtime providers.
- Don't add an `any`, disable strict mode, or skip the authz/contract review.

> **Contract compatibility:** This client must stay **contract-compatible with `reprise-ui`**: same REST endpoints (`/api/v1/*`, `/bff/*`), same Socket.io `/v1` namespace and event names/payloads, same LiveKit token-mint flow, same error model, pagination, and idempotency semantics. A change here that diverges from the shared backend contract is a bug; fix the client, never fork the contract.

## 🛠️ Commands

```bash
# Install
pnpm install

# Start / run (a dev build, not Expo Go, is required for
# LiveKit, push, and secure-store native modules)
pnpm start                          # Metro / Expo dev server
pnpm ios | pnpm android             # run on simulator/emulator (dev build)

# Quality
pnpm typecheck                      # tsc --noEmit (strict)
pnpm lint                           # ESLint + Prettier check

# Test
pnpm test                           # Jest + RNTL
pnpm e2e:ios | pnpm e2e:android     # Detox

# Build / ship (EAS)
eas build  --profile production --platform all
eas submit --profile production --platform ios|android
eas update --branch production      # OTA JS update
```

## 🔀 Pull Requests

- Trunk-based: short-lived branches off `main`; open a PR; CI (typecheck + lint + Jest + Detox smoke) must be green before merge.
- Keep PRs focused; describe user-visible behavior and any net-new decision (with a `system.md` §15 entry).
- Reviewer checklist includes: Clerk-only auth, `org_id` never client-set, backend access only via gateway/realtime, secure token storage, no bundle secrets, contract-compatibility with `reprise-ui`, naming sourced from `_canon/`.
- **Commit messages must NOT include a `Co-Authored-By` footer** in this project.
