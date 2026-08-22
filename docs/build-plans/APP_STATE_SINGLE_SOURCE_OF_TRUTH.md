# App State Single Source of Truth Pass

**Owner:** Role 1 integration, with Roles 2-5 affected.
**Status:** Required final integration-hardening pass after feature branches land.
**Purpose:** Ensure every visible ChatXPT surface tells the same truth about the same authoritative session, quest cycle, gameplay capture, participation, overlay, and intelligence state.

## Why This Exists

Current feature work has improved the product surfaces, but several health and readiness indicators are still derived from nearby proxy state rather than a shared liveness contract. This creates demo risk: Studio can say one layer is ready while the actual viewer, overlay, capture, or AI path is unavailable, stale, or showing a different revision.

This pass should happen after the remaining feature branches are rebased and reconciled, because the goal is not to redesign every screen now. The goal is to make the final integrated app expose one authoritative state story everywhere.

## Non-Negotiable Outcome

For the judged demo and final rehearsal, the same authoritative session and quest-cycle revision must be visible across:

- ChatXPT Studio Home and Test Lab
- Gameplay Engine
- Live Quests and Live Director controls
- Twitch Extension viewer
- Hosted Quest Board fallback
- Twitch-chat voting fallback status
- OBS Browser Source overlay

If a layer is unknown, stale, degraded, unavailable, or running on fallback, every surface that references that layer must say so consistently.

## Current Risks to Fix

### Broadcast Overlay Health

Studio currently treats Broadcast Overlay as ready when the session is live. That does not prove OBS has mounted the Browser Source, that the overlay token is valid, that the overlay is polling, or that it has rendered the latest revision.

Final fix target:

- Add canonical overlay health from overlay grant, last successful overlay read, last rendered/read revision, and staleness.
- Drive Studio Home, Test Lab, and overlay recovery copy from that same object.
- Keep the overlay itself read-only; it must not become the source of authoritative quest state.

### Game Capture Health

Home, Gameplay Engine, and Test Lab can describe capture readiness from different derived values. Capture status should not be split between generic setup readiness and `view.gameplay.captureMetrics` without one shared interpretation.

Final fix target:

- Add canonical capture health from capture grant, latest accepted gameplay snapshot, source type, evidence class, snapshot age, known/unknown facts, permission status, and frame cadence.
- Use the same capture health in Home, Gameplay Engine, Test Lab, Live Director context copy, and readiness blocking.
- Preserve `unknown` rather than fabricating unsupported gameplay facts.

### Gameplay Snapshot Revision Coupling

Current gameplay snapshot lookup is coupled to session and quest-cycle revision. That can make an otherwise fresh capture disappear after unrelated vote, profile, or quest-control changes advance the session revision.

Final fix target:

- Store and read the latest current gameplay snapshot by session/capture stream, not by quest-cycle revision alone.
- Treat snapshot age, evidence class, game compatibility, and known facts as freshness rules.
- Let the orchestrator restamp gameplay into authoritative state when it publishes a new revision.

### Viewer Participation Health

Viewer Voting readiness can be inferred from configured capabilities and realtime status. That does not prove the Twitch Extension is installed/open, hosted board access is active, chat voting is connected, or two viewer clients are observing the same state.

Final fix target:

- Add canonical participation health covering Twitch Extension, hosted board, Twitch chat fallback, realtime availability, and last successful viewer read/command path where available.
- Surface primary/fallback mode honestly.
- Keep vote authority in the private participation/orchestrator path, never inside the viewer UI.

### Realtime and Polling Drift

Studio, viewer surfaces, hosted board, and OBS poll at different intervals, with realtime as an optional fast path. That is acceptable only if stale state is visible and recovery reads converge on the same revision.

Final fix target:

- Expose last authoritative revision and last read age internally for all surfaces.
- After state-changing commands, refresh or publish the same role view-model revision to streamer, viewer, and overlay paths.
- Treat realtime as acceleration, not authority.

### Intelligence and Fallback Status

The app should distinguish Enhanced AI availability, provider timeout/error, algorithmic candidate generation, deterministic fallback, and validated replacements. A generic "intelligence ready" status is not enough for demo clarity.

Final fix target:

- Add generation health with last attempt, active route, fallback route, provider availability, timeout/error, and validation replacement status.
- Keep provider/model choice server-side; streamer-facing UI may show friendly availability/fallback status.

## Required Contract Shape

Prefer a small set of canonical health objects projected from the server:

```text
captureHealth
participationHealth
overlayHealth
generationHealth
realtimeHealth
```

Each health object should include:

```text
status: ready | degraded | stale | unavailable | misconfigured | permission-denied
checkedAt
lastAuthoritativeRevision
lastObservedAt
message
recoveryAction
evidenceClass
source
```

Names may change to match the existing schema style. The important rule is that surfaces consume the same projected object instead of recalculating readiness locally.

## Acceptance Checklist

- Studio Home, Gameplay Engine, Test Lab, Live Director, viewer surfaces, and OBS overlay agree on session status, quest-cycle status, active candidate, vote state, capture state, and fallback state.
- Broadcast Overlay does not show "Ready" unless an actual overlay read/heartbeat for the current broadcaster/session is known.
- Game Capture does not disappear only because a vote or control action advanced the session revision.
- Viewer Voting distinguishes configured capability from actual reachable participation path.
- Provider unavailable, provider timeout, algorithmic generation, deterministic fallback, and mixed validated replacements are shown consistently.
- A real rehearsal can name the same session ID, quest-cycle ID, and revision across Studio, two viewers, and OBS.
- Fixture/demo-only state remains labelled and cannot be mistaken for live Twitch or live capture evidence.

## Timing

Do this after the pending feature branches land or are deliberately dropped. It is a final integration fix, not a prerequisite for every feature branch. New feature work should avoid adding new local health calculations where a shared projected state already exists.
