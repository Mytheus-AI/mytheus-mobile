# Mytheus - Mobile App (`mytheus-mobile`)

The native iOS + Android client for **Mytheus** - join meetings, watch live captions, and read your personal AI agent's notes, suggestions, decisions, and actions from your phone.

## What this is

`mytheus-mobile` is the **native mobile client** (iOS + Android) for Mytheus, the intelligent meeting-orchestration SaaS where every participant gets a personal AI agent that attends meetings, captures role-relevant notes, suggests questions in real time, and detects decisions / actions. It is the phone-form-factor sibling of the web client (`mytheus-ui`).

> **Net-new.** The Mytheus architecture set (internal codename **NEXUS**) names "User browser / mobile" as a client of the platform but specifies **no mobile architecture** - only the `web-app` (`mytheus-ui`) is fully designed. This repository is the net-new mobile client. Every design decision it introduces that the existing architecture docs do not specify is enumerated in [`system.md` → Net-new decisions log](./system.md). It owns **no backend data** and introduces **no new backend contracts**: it talks to the platform through exactly the same two doors the web client uses - `api-gateway` → `bff` (REST) and `realtime-gateway` (WSS) - plus LiveKit for meeting media.

## Where it sits

`mytheus-mobile` lives in the **edge / client tier** alongside `mytheus-ui`. It is a pure client: the server decides what is true, the client decides how it appears.

- **REST** to `api-gateway` → `bff` for screen-shaped reads and resource mutations (TanStack Query).
- **WSS / Socket.io** to `realtime-gateway` for live captions, agent sidebar output, streamed `agent-stream` tokens, presence, and chat.
- **LiveKit (WebRTC)** for meeting audio/video, joined with a short-lived token minted by `meeting-service` via `POST /api/meetings/{id}/token`.
- **Clerk** for authentication; `org_id` is derived server-side from the Clerk JWT and is **never** set by the client.
- **Expo push** for the notification tier, delivered via the platform `notification-service` / `notifications` topic.

```
[ iOS / Android app ]──HTTPS REST──▶ api-gateway ──▶ bff ──▶ CRUD / AI services
        │
        ├──────WSS (Socket.io)─────▶ realtime-gateway  (captions, agent output, presence)
        │
        ├──────WebRTC media────────▶ LiveKit SFU
        │
        └──Clerk JWT (org_id)──▶ api-gateway extracts org_id, fails closed
```

The same tenancy, auth, and contract rules that bind `mytheus-ui` bind this app. See [`03-container-architecture.md`](../../nexus-architecture/03-container-architecture.md), [`19-api-architecture.md`](../../nexus-architecture/19-api-architecture.md), and [`20-frontend-architecture.md`](../../nexus-architecture/20-frontend-architecture.md) in the architecture set.

## Tech stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | **React Native** (New Architecture) via **Expo** (managed workflow) | One TypeScript codebase, two native targets; EAS for builds/OTA. |
| Language | **TypeScript** (strict) | Mirrors `mytheus-ui`; API/WS types generated from the OpenAPI/Avro contracts. |
| Auth | **Clerk Expo SDK** (`@clerk/clerk-expo`) | Same identity provider as web; JWT carries the `org` claim. |
| Meeting media | **LiveKit React Native SDK** (`@livekit/react-native`) | Audio/video, screen share, behind the same token-mint flow as web. |
| Real-time | **Socket.io client** (`socket.io-client`) | Connects to `realtime-gateway`; rooms keyed by `meeting_id`. |
| REST data | **TanStack Query** (`@tanstack/react-query`) | Server-state cache, optimistic updates, offline persistence. |
| Navigation | **Expo Router** (file-based, React Navigation under the hood) | Mirrors the `mytheus-ui` route taxonomy. |
| Push | **Expo Notifications** (`expo-notifications`) | Device push tokens registered with `notification-service`. |
| Secure storage | **expo-secure-store** | Keychain / Keystore for tokens; no secrets in the JS bundle. |
| Observability | **Sentry React Native** | Mirrors the platform Sentry posture. |

Rationale for React Native + Expo is detailed in [`system.md` → Tech stack with versions & rationale](./system.md).

## What is in the app

Home (next meeting, what is waiting, recent decisions), Inbox (your agent's alerts, updates you owe, detections to confirm), Meetings (join from the phone; afterwards the confirmed results and your agent's private notes), My work (tasks including ones with no meeting, private promises, updates owed), Decisions (log, lineage, share link), Ask (answers with numbered sources) and Settings. The live room carries the call, captions, your notes, the shared cards, the shared agenda, hands and reactions, with one honest connection line. The repo layout is in [`CLAUDE.md`](./CLAUDE.md); decisions are in [`system.md` §15](./system.md).

## Quick start

```bash
npm ci
cp .env.example .env              # fill in the EXPO_PUBLIC_* values
npx expo prebuild                 # LiveKit, WebRTC and secure-store need a development build
npx expo run:ios                  # or: npx expo run:android
```

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run generate:api:check` (set `MYTHEUS_OPENAPI_DIR` to mytheus-backend `design/openapi` on main), `npx expo export --platform android`.

## Environment variables

Public (client-readable) values are prefixed `EXPO_PUBLIC_`. **No secret keys live in the bundle** - only publishable / public URLs. Secrets (LiveKit API key, Deepgram key, Clerk backend key, etc.) stay server-side in the backend services.

| Variable | Example | Purpose |
|---|---|---|
| `EXPO_PUBLIC_API_GATEWAY_URL` | `https://api.mytheus.cloud` | Base origin for REST (`/api/v1/*`, `/bff/*`) through `api-gateway`. |
| `EXPO_PUBLIC_REALTIME_WS_URL` | `wss://api.mytheus.cloud` | `realtime-gateway` WSS origin for Socket.io (captions, agent output, presence). |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_…` | Clerk Expo SDK publishable key (safe to ship). |

> The LiveKit **room token** is never an env var - it is minted per join by `meeting-service` via `POST /api/meetings/{id}/token`, exactly as in `mytheus-ui`. The client only ever holds the LiveKit URL and a short-lived, scoped token.

## Testing

Jest + React Native Testing Library (`npm test`): the REST client and the contract table of every call, the pure helpers, the socket and LiveKit hooks against fakes, and the main screens against a fake REST client. Detox end-to-end is not set up yet.

## Related repos

The Mytheus product spans eight `mytheus-*` repositories. This client is contract-compatible with all backend services and mirrors the web client.

| Repo | One-liner |
|---|---|
| **`mytheus-ui`** | The Next.js 14 web client (`web-app`); the parity reference for this mobile app. |
| **`mytheus-mobile`** | **This repo** - the native iOS + Android client. |
| **`mytheus-gateway`** | `api-gateway` + `bff`: the single ingress (WAF, JWT pre-validate, `org_id`) and screen aggregation. |
| **`mytheus-core`** | `core-api`, `meeting-service`, and the CRUD/control-plane services (meetings, worklogs, decisions, actions). |
| **`mytheus-identity`** | `identity-tenant-service`: Clerk user-sync, RBAC, SCIM, tenant provisioning, `get_user_context`. |
| **`mytheus-realtime`** | `realtime-gateway` + `transcription-service`: Socket.io fan-out, LiveKit hook, Deepgram proxy. |
| **`mytheus`** | `agent-runtime-service`, `rag-service`, embedding/reranker, knowledge-graph - the six LangGraph agents and the inference tier. |
| **`mytheus-docs`** | The architecture set (NEXUS) and the frozen `_canon/` naming authority for services, topics, and data. |

> Repo names above are the product-facing `mytheus-*` names; each maps to the canonical service names frozen in `mytheus-docs` `_canon/`. Service, topic, and entity identifiers always come from `_canon/` - never invented here.

## License

Proprietary. © Mytheus. All rights reserved. Not for distribution.
