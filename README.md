# Reprise AI - Mobile App (`reprise-mobile`)

The native iOS + Android client for **Reprise AI** - join meetings, watch live captions, and read your personal AI agent's notes, suggestions, decisions, and actions from your phone.

## What this is

`reprise-mobile` is the **native mobile client** (iOS + Android) for Reprise AI, the intelligent meeting-orchestration SaaS where every participant gets a personal AI agent that attends meetings, captures role-relevant notes, suggests questions in real time, and detects decisions / actions. It is the phone-form-factor sibling of the web client (`reprise-ui`).

> **Net-new.** The Reprise AI architecture set (internal codename **NEXUS**) names "User browser / mobile" as a client of the platform but specifies **no mobile architecture** - only the `web-app` (`reprise-ui`) is fully designed. This repository is the net-new mobile client. Every design decision it introduces that the existing architecture docs do not specify is enumerated in [`system.md` → Net-new decisions log](./system.md). It owns **no backend data** and introduces **no new backend contracts**: it talks to the platform through exactly the same two doors the web client uses - `api-gateway` → `bff` (REST) and `realtime-gateway` (WSS) - plus LiveKit for meeting media.

## Where it sits

`reprise-mobile` lives in the **edge / client tier** alongside `reprise-ui`. It is a pure client: the server decides what is true, the client decides how it appears.

- **REST** to `api-gateway` → `bff` for screen-shaped reads and resource mutations (TanStack Query).
- **WSS / Socket.io** to `realtime-gateway` for live captions, agent sidebar output, streamed `agent-stream` tokens, presence, and chat.
- **LiveKit (WebRTC)** for meeting audio/video, joined with a short-lived token minted by `meeting-service` via `POST /api/v1/meetings/:id/token`.
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

The same tenancy, auth, and contract rules that bind `reprise-ui` bind this app. See [`03-container-architecture.md`](../../nexus-architecture/03-container-architecture.md), [`19-api-architecture.md`](../../nexus-architecture/19-api-architecture.md), and [`20-frontend-architecture.md`](../../nexus-architecture/20-frontend-architecture.md) in the architecture set.

## Tech stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | **React Native** (New Architecture) via **Expo** (managed workflow) | One TypeScript codebase, two native targets; EAS for builds/OTA. |
| Language | **TypeScript** (strict) | Mirrors `reprise-ui`; API/WS types generated from the OpenAPI/Avro contracts. |
| Auth | **Clerk Expo SDK** (`@clerk/clerk-expo`) | Same identity provider as web; JWT carries the `org` claim. |
| Meeting media | **LiveKit React Native SDK** (`@livekit/react-native`) | Audio/video, screen share, behind the same token-mint flow as web. |
| Real-time | **Socket.io client** (`socket.io-client`) | Connects to `realtime-gateway`; rooms keyed by `meeting_id`. |
| REST data | **TanStack Query** (`@tanstack/react-query`) | Server-state cache, optimistic updates, offline persistence. |
| Navigation | **Expo Router** (file-based, React Navigation under the hood) | Mirrors the `reprise-ui` route taxonomy. |
| Push | **Expo Notifications** (`expo-notifications`) | Device push tokens registered with `notification-service`. |
| Secure storage | **expo-secure-store** | Keychain / Keystore for tokens; no secrets in the JS bundle. |
| Observability | **Sentry React Native** | Mirrors the platform Sentry posture. |

Rationale for React Native + Expo is detailed in [`system.md` → Tech stack with versions & rationale](./system.md).

## Repo structure

A realistic Expo Router + TypeScript layout:

```
reprise-mobile/
├── app/                          # Expo Router routes (file-based)
│   ├── _layout.tsx               # root: <ClerkProvider>, <QueryClientProvider>, fonts
│   ├── (auth)/                   # unauthenticated: Clerk sign-in / sign-up / SSO
│   │   ├── sign-in.tsx
│   │   └── sign-up.tsx
│   ├── (app)/                    # authenticated shell; org context resolved in layout
│   │   ├── _layout.tsx           # <OrgProvider> + tab/stack nav + auth gate
│   │   ├── dashboard.tsx
│   │   ├── meetings/
│   │   │   ├── index.tsx         # meeting list
│   │   │   └── [meetingId]/
│   │   │       ├── room.tsx      # meeting room: LiveKit grid + agent sidebar sheet
│   │   │       └── transcript.tsx
│   │   ├── tasks.tsx             # My Tasks (action_items assigned to me)
│   │   ├── decisions.tsx
│   │   ├── notifications.tsx     # in-app notification center
│   │   └── settings/
│   │       ├── profile.tsx
│   │       └── account.tsx
│   └── +not-found.tsx
├── src/
│   ├── api/                      # REST clients (TanStack Query hooks) → api-gateway/bff
│   │   ├── client.ts             # base fetch wrapper, auth header injection, error model
│   │   ├── queryKeys.ts
│   │   └── hooks/                # useMeetings, useTasks, useUsage, …
│   ├── realtime/                 # Socket.io provider + LiveKit room provider
│   │   ├── SocketProvider.tsx
│   │   ├── LiveKitProvider.tsx
│   │   └── events.ts             # agent-stream / agent-results / presence handlers
│   ├── auth/                     # Clerk helpers, org switching, token storage
│   ├── notifications/            # Expo push registration + tap routing
│   ├── components/               # design-system primitives + feature components
│   ├── store/                    # Zustand ephemeral UI state (sidebar, toasts, drafts)
│   ├── lib/                      # config, secure-store wrapper, formatting
│   └── theme/                    # tokens mirroring the reprise-ui design tokens
├── assets/                       # icons, splash, fonts
├── __tests__/                    # Jest + RNTL unit/component tests
├── e2e/                          # Detox end-to-end specs
├── app.config.ts                # Expo config (reads env, plugins, permissions)
├── eas.json                      # EAS Build / Submit / OTA channels
├── babel.config.js
├── metro.config.js
├── tsconfig.json
├── .env.example
├── .gitignore
├── CLAUDE.md
├── system.md
└── README.md
```

## Quick start

**Prerequisites**

- **Node 20+** and **pnpm** (`corepack enable && corepack prepare pnpm@latest --activate`)
- **Expo CLI** (`pnpm dlx expo` or the bundled `expo` binary; install **EAS CLI** with `pnpm add -g eas-cli` for cloud builds)
- **Xcode** (iOS simulator, macOS only) and/or **Android Studio** (Android emulator)
- Access to a running Reprise AI backend (or the shared dev environment) for `api-gateway`, `realtime-gateway`, LiveKit, and a Clerk dev instance

**Install**

```bash
pnpm install
```

**Configure environment**

```bash
cp .env.example .env
# fill in the values below
```

**Run (development)**

```bash
pnpm start            # start the Metro bundler / Expo dev server
pnpm ios              # build & launch on the iOS simulator
pnpm android          # build & launch on the Android emulator
```

Push notifications, LiveKit media, and secure storage require a **development build** (not Expo Go), since they use native modules:

```bash
pnpm dlx expo prebuild         # generate native projects when needed
eas build --profile development --platform ios      # or android
```

**Build & submit (release, via EAS)**

```bash
eas build   --profile production --platform all
eas submit  --profile production --platform ios     # App Store Connect
eas submit  --profile production --platform android # Google Play
eas update  --branch production                     # OTA JS update
```

## Environment variables

Public (client-readable) values are prefixed `EXPO_PUBLIC_`. **No secret keys live in the bundle** - only publishable / public URLs. Secrets (LiveKit API key, Deepgram key, Clerk backend key, etc.) stay server-side in the backend services.

| Variable | Example | Purpose |
|---|---|---|
| `EXPO_PUBLIC_API_GATEWAY_URL` | `https://api.reprise.app` | Base origin for REST (`/api/v1/*`, `/bff/*`) through `api-gateway`. |
| `EXPO_PUBLIC_REALTIME_WS_URL` | `wss://rt.reprise.app` | `realtime-gateway` WSS origin for Socket.io (captions, agent output, presence). |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_…` | Clerk Expo SDK publishable key (safe to ship). |
| `EXPO_PUBLIC_LIVEKIT_URL` | `wss://livekit.reprise.app` | LiveKit SFU URL (the room token itself is minted server-side per join). |
| `EXPO_PUBLIC_SENTRY_DSN` | `https://…@sentry.io/…` | Sentry React Native DSN. |
| `EXPO_PUBLIC_ENV` | `development` \| `staging` \| `production` | Selects EAS/OTA channel and analytics environment. |

> The LiveKit **room token** is never an env var - it is minted per join by `meeting-service` via `POST /api/v1/meetings/:id/token`, exactly as in `reprise-ui`. The client only ever holds the LiveKit URL and a short-lived, scoped token.

## Testing

| Layer | Tooling | What it covers |
|---|---|---|
| Unit / component | **Jest** + **React Native Testing Library** | Hooks, reducers, components, the realtime reconciliation logic (deltas → drafts → final cards). |
| End-to-end | **Detox** | Sign-in, join-meeting, caption render, agent card confirm, notification tap routing, on real simulators/emulators. |
| Static | **TypeScript (strict)**, **ESLint**, **Prettier** | Enforced in CI; type-check gates every PR. |

```bash
pnpm test             # Jest unit/component suite
pnpm test:watch
pnpm lint
pnpm typecheck
pnpm e2e:ios          # Detox e2e on iOS
pnpm e2e:android
```

TDD is the norm (see `CLAUDE.md`): write the failing test first, then the implementation.

## Related repos

The Reprise AI product spans eight `reprise-*` repositories. This client is contract-compatible with all backend services and mirrors the web client.

| Repo | One-liner |
|---|---|
| **`reprise-ui`** | The Next.js 14 web client (`web-app`); the parity reference for this mobile app. |
| **`reprise-mobile`** | **This repo** - the native iOS + Android client. |
| **`reprise-gateway`** | `api-gateway` + `bff`: the single ingress (WAF, JWT pre-validate, `org_id`) and screen aggregation. |
| **`reprise-core`** | `core-api`, `meeting-service`, and the CRUD/control-plane services (meetings, worklogs, decisions, actions). |
| **`reprise-identity`** | `identity-tenant-service`: Clerk user-sync, RBAC, SCIM, tenant provisioning, `get_user_context`. |
| **`reprise-realtime`** | `realtime-gateway` + `transcription-service`: Socket.io fan-out, LiveKit hook, Deepgram proxy. |
| **`reprise-ai`** | `agent-runtime-service`, `rag-service`, embedding/reranker, knowledge-graph - the six LangGraph agents and the inference tier. |
| **`reprise-docs`** | The architecture set (NEXUS) and the frozen `_canon/` naming authority for services, topics, and data. |

> Repo names above are the product-facing `reprise-*` names; each maps to the canonical service names frozen in `reprise-docs` `_canon/`. Service, topic, and entity identifiers always come from `_canon/` - never invented here.

## License

Proprietary. © Reprise AI. All rights reserved. Not for distribution.
