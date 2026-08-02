# Architecture

## Reality status

ChatXPT remains one Next.js/TypeScript application, but the repository distinguishes the working local prototype from the accepted multi-device Twitch MVP target.

| Capability | Current implementation | Accepted MVP target |
| --- | --- | --- |
| Quest generation | Server-side OpenAI adapter with validated structured output and deterministic fallback | Provider remains replaceable; Roles 2 and 3 submit a joint recommendation before changing it |
| Gameplay and audience input | Synthetic controls and demo data | Normalised Twitch/audience and replaceable gameplay-extraction adapters, with simulation clearly disclosed |
| Participation state | `localStorage` plus `BroadcastChannel` | One private, platform-neutral participation service backed by Supabase Free |
| Streamer surface | Local control room | Full ChatXPT Studio plus compact Twitch Live Config |
| Viewer surface | Voting inside the local control room | Twitch Extension primary, hosted Quest Board fallback, Twitch-chat `1`/`2`/`3` final fallback |
| Broadcast output | Separate `/overlay` browser route | OBS browser overlay consuming normalised participation state |
| Deployment | Local Next.js application | One reusable Vercel deployment with server-side secrets |

The current path is valid demo evidence only when it is labelled accurately. Target entries are not considered implemented until their acceptance evidence is executed.

## Target boundaries

```text
Twitch events/chat       gameplay extraction       streamer profile
       \                       |                         /
        -> normalised platform-neutral events and snapshots
                              |
                 behavioural intelligence (Role 2)
                              |
        AI candidates + deterministic fallback candidates
                              |
           quest validation and lifecycle (Role 3)
                              |
          private participation service (Role 1)
             /              |               \
 Twitch Extension   hosted Quest Board   Twitch-chat fallback
             \              |               /
               authoritative vote and quest state
                              |
                Studio / Live Config / OBS overlay
```

- `src/core/` owns platform-neutral contracts and session/capability models.
- `src/integrations/` owns Twitch, OBS, persistence, and other external boundaries.
- `src/realtime/` owns authoritative participation transport and subscriptions.
- `src/ai/` and `src/extraction/` own behavioural intelligence, provider adapters, model-ready context, and extraction implementation.
- `src/quest-engine/` owns deterministic quest rules, validation, lifecycle, safety, scoring, and fallbacks.
- `src/streamer/` and `src/design-system/` own streamer surfaces and shared visual foundations.
- `src/viewer/` owns Twitch viewer, hosted fallback, and viewer-facing overlay UX.

The legacy `src/lib/`, `src/components/`, and `src/app/` files remain the current prototype until Role 1 completes the authorised mechanical migration. That migration must preserve behaviour and must not redesign another role's component.

## Contract and adapter rules

- The core consumes normalised ChatXPT events; Twitch payloads never become core types.
- Viewer clients consume a private participation contract and never own authoritative vote state.
- Supabase records and realtime messages remain persistence/transport adapters rather than domain contracts.
- Provider payloads remain behind server-only adapters and API routes.
- Local storage and deterministic generation remain credential-free fallbacks, not the authoritative multi-device path.
- Every external result is runtime-validated before it affects quest or participation state.

## Safety and lifecycle

- Streamer preferences, accessibility needs, and forbidden quest types are explicit engine inputs.
- Deterministic validation rejects unsafe, illegal, humiliating, monetary, infeasible, or duplicate quests before viewers see them.
- Role 3 owns intervention, approval, automatic/manual activation, veto, interruption, and emergency-control mechanics under D-009.
- The streamer must retain an effective veto/emergency control even when Role 3 permits automatic proposal or activation.
- Quest state covers proposed, voting, active, succeeded, failed, cancelled, skipped, and expired.
- Model latency, refusal, invalid output, outage, and shared-infrastructure failure are expected paths with visible fallback behaviour.

## Integration order

1. Mechanically migrate legacy source into the five role-owned boundaries without changing behaviour.
2. Freeze version 1 core and participation contracts with affected-owner review.
3. Add Supabase persistence/realtime and preserve the local fallback.
4. Connect Vercel, Twitch test surfaces, and the OBS contract with secrets kept server-side.
5. Integrate Roles 2-5 through one golden Twitch workflow and execute both live and fallback evidence.
