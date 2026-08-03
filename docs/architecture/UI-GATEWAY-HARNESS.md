# Browser-safe UI gateway and diagnostic harness

**Owner:** Role 1 (`Dewflash`)

**Decision:** D-054

## Purpose

R1-015 gives Roles 4 and 5 one browser-safe seam for reading authorised view
models and emitting typed commands. Role-owned modules render data and call an
injected dispatcher; they do not own Next routes, authentication, Supabase,
realtime composition, secrets, command authority, or shared test configuration.

The local harness is integration infrastructure, not ChatXPT product UI. It
does not implement Streamer Studio, the Twitch viewer, the hosted board, or the
OBS overlay presentation.

## Public contracts

- Core exports gateway surface, authentication, readiness, setup/session/profile
  command, snapshot, health, and safe command-result schemas from `@/core`.
- Browser app composition imports `FetchUiGatewayClient` from
  `@/realtime/browser` and injects it or bounded callbacks into role-owned UI.
- Server routes import only `@/realtime/server`.
- Command responses expose the command ID, outcome, current revision, delivery
  state, or typed safe error. They never expose the orchestrator's private
  authoritative receipt or another role's view.
- Callers retain a command ID when retrying the same logical command. A stale
  result supplies the current revision so the client can reload and require a
  fresh deliberate action.

## Authentication boundary

- Studio and the hosted board use secure HTTP-only same-origin sessions when
  their live authentication is connected.
- Twitch and OBS receive short-lived, session- and role-scoped bearer
  capabilities issued by Role 1 server composition.
- Cookie-authenticated mutations must pass the same-origin and anti-CSRF marker
  checks. Bearer capabilities are still verified and authorised server-side.
- The checked-in diagnostic token names are fixtures, not credentials. They
  cannot access production or Supabase.

## Local diagnostic use

Set the server-only flag locally:

```bash
CHATXPT_ENABLE_DIAGNOSTIC_HARNESS=true npm run dev
```

Open one of:

```text
/diagnostics/ui-harness/studio
/diagnostics/ui-harness/config
/diagnostics/ui-harness/live-config
/diagnostics/ui-harness/viewer
/diagnostics/ui-harness/hosted-board
/diagnostics/ui-harness/overlay
```

Every host permanently displays `FIXTURE / DIAGNOSTIC HARNESS` and
`NOT LIVE EVIDENCE`. Available scenarios reproduce ready, capture-permission
denied, Twitch-misconfigured, realtime-disconnected, stale-revision,
dependency-failure, wrong-role, missing-token, anonymous, and expired-token
states. Live Config also exposes the moderator-only quest-control capability;
the same moderator grant is forbidden from Studio and Config. The overlay host
supplies a transparency-check background but no Role 5
overlay visuals.

The server returns 404 unless the flag is exactly `true` and `NODE_ENV` is not
`production`. Never configure the flag in Vercel preview or production.

## Shared verification

```bash
npm run test:ui
npm run test:e2e
```

The component path uses Vitest, jsdom, React Testing Library, User Event, and
Jest DOM. The browser path uses Playwright Chromium and writes ignored evidence
under `test-results/`. These runs prove only the fixture-labelled gateway and
browser interaction boundary. They do not prove Twitch, OBS, Supabase cloud,
live authentication, real extraction, or final Role 4/5 UI.

## Deferred to R1-016

D-055 personal viewer recovery and D-056 hosted/chat delivery are settled but
not implemented here. R1-015 does not claim reconnect restoration of private
viewer points/choice, hosted-room exchange, QR generation, or Twitch chat
delivery.
