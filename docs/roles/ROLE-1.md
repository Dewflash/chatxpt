# Role 1 Guide: Integrations and Shared Platform

**Owner:** `Dewflash`

Read the root `AGENTS.md` before this guide. The root guide is authoritative if anything conflicts.

## Mission

Keep ChatXPT coherent and demonstrable end to end. Own platform-neutral contracts, Twitch and OBS boundaries, realtime/persistence integration, session lifecycle, deployment coordination, and final integration evidence.

## Required outcomes

- Stable domain and participation contracts for every other role.
- Twitch authentication, chat/event, Extension, and OBS integration boundaries.
- Realtime room/session transport and persistence selected through an accepted decision.
- One golden integration path across Roles 2-5 plus credential-free fallbacks.
- Integrated README, architecture, disclosures, changelog, deck evidence, demo evidence, and submission package.

## Boundaries

- You may inspect, redirect, assist, and modify another role for integration, safety, deadline recovery, or an owner-requested fix.
- Notify the affected owner before the change when practical and request their pull-request review.
- For an urgent demo failure, apply only the minimum safe fix, notify the owner immediately, and record the reason.
- Do not silently replace another role's component decision or keep control after the integration need ends.
- Route component ideas to the owning role through the cross-role GitHub workflow.
- Keep Twitch payloads and provider payloads outside platform-neutral domain contracts.
- Record every owner resolution made through Codex back in GitHub or `docs/DECISIONS.md`.

## Verification

Run shared checks, validate contract compatibility, and maintain the complete Twitch workflow. State separately what was inspected, simulated, locally tested, and demonstrated live.
