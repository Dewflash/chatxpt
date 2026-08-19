# Quest-engine and Live Director evaluation evidence

This is deterministic component evidence from explicitly labelled fixtures. It is not live
extraction, OpenAI-provider, Twitch, OBS, Supabase, reconnect-network, UI, or end-to-end workflow
proof. Role 1 must independently exercise the public seams in the authenticated application
orchestrator and record any real runtime evidence.

## Failure-oriented matrix

| Area | Scenarios | Deterministic result | Evidence |
| --- | --- | --- | --- |
| Cue suitability | quiet opportunity; busy/high-focus play; transition; sparse, conflicting, ambiguous, sarcastic, stale, unknown, permission-denied, unsupported, or unsafe evidence; emergency; repetition; cooldown; attention budget | Hard lifecycle/safety/evidence gates return `stay-silent` or `wait` before scoring; only a fresh supported opportunity returns `offer-cue` | `intervention.test.ts` Director Cue matrix |
| Cue actions | acknowledge, turn into vote, Later, dismiss; illegal, late, cross-session/cycle/revision actions | Each accepted action produces one canonical state/event; invalid authority or timing fails closed | `evaluation.test.ts` action catalogue; `director-cue.test.ts` lifecycle matrix |
| Later timing | early resurface, one accepted resurface, second Later, context expiry during delay | Early/second attempts are rejected; one resurface is allowed only while the same context remains fresh | `director-cue.test.ts` postpone/resurface cases |
| Provider/candidate failure | provider unavailable, malformed/unsafe output, zero/one/two usable candidates, oversized output, restriction/accessibility/history conflicts, fallback exhaustion | The same validator handles every provenance; success is exactly three private options, otherwise typed `no-publication` | `evaluation.test.ts` provider cases; `director-cue-conversion.test.ts` candidate matrix |
| Exactly-three conversion | current converted cue with valid, partial, or absent input | Exactly three validated options enter only the private `proposed` state with approve/reject; no direct viewer publication or voting | `evaluation.test.ts` integrated conversion; `director-cue-conversion.test.ts` |
| Invalidation | intent update, audience expiry, supporting-context change, impossibility, safety change, ordinary gameplay change | Supporting evidence becomes stale, safety cancels, impossibility stales, and ordinary gameplay change remains non-terminal | `director-cue.test.ts` reconciliation matrix |
| Conversion-time authority | emergency pause, ended session, impossible opportunity, expired cue/intent/audience, stale proposal revision | Conversion returns typed `no-publication`; no candidate or viewer state is published | `evaluation.test.ts` authority matrix; `director-cue-conversion.test.ts` |
| Recovery/history | reconstructed terminal cue, repeated history merge, stale quest revision | Terminal state is stable; identical cue replay is deduplicated; stale quest commands are rejected | `evaluation.test.ts` reconnect/history cases; `director-cue.test.ts`; `intervention.test.ts` |
| Cooldown/repetition | resolved cue cooldown, recent cue attention budget, recent quest similarity, terminal quest cooldown | The accepted resolution time starts cue cooldown; recent equivalent work is suppressed; quest cooldown remains 120 seconds | `intervention.test.ts`; `engine.test.ts` |
| Quest cancellation/results | ordinary cancel, emergency cancel, skip, success, failure, expiry | Terminal reasons/events remain distinct and reward policy remains server-authoritative | `evaluation.test.ts`; `engine.test.ts`; `outcomes.test.ts` |
| Deterministic replay | candidate assembly, cue action, cue conversion, reconstructed vote, tie resolution | Identical canonical input, authoritative time, and seed produce identical output | `evaluation.test.ts` replay assertions and focused component suites |
| Game neutrality | tactical shooter, racing, strategy, platformer, unknown game | Three distinct game-neutral fallbacks are available without invented gameplay evidence | `evaluation.test.ts` genre matrix |

## Stable Role 1 handoff

Role 1 composes these pure Role 3 seams:

1. `DefaultDirectorCueSuitabilityPolicy.decide` evaluates a canonical private opportunity.
2. `DefaultDirectorCueLifecycle.offer`, `applyAction`, `resurface`, and `reconcile` return the next
   canonical cue plus event drafts.
3. `DefaultDirectorCueConverter.convert` accepts only a current `converted` cue and returns either
   exactly three private approval-ready quest options or typed `no-publication`.
4. `createDirectorCueHistorySummary` and `mergeDirectorCueHistory` produce privacy-safe,
   reconnect-deduplicated resolved history for later suitability decisions.
5. `DefaultQuestEngine.decide` remains the sole quest-cycle lifecycle authority after approval.

Role 1 retains command authentication and deduplication, server time, revision stamping, scheduling,
atomic persistence, emergency/session latches, provider invocation, candidate transport, broadcast,
and public/private view projection. A cue conversion event explicitly carries
`candidatePublication: false`; viewer publication begins only after the existing streamer approval
and vote lifecycle accepts it.

## Known limitations and open evidence

- The fixtures prove code behaviour, not a real Twitch/OBS/OpenAI/Supabase run.
- The lexical/contract safety validator is an MVP deterministic layer, not complete natural-language
  moderation; streamer approval remains the final human boundary.
- R3-004 still awaits Role 2's real provider latency, reliability, privacy, and structured-output
  trials for the D-072 OpenAI path.
- Issue #50 still tracks the predicate-bearing automatic-completion rule. Until it lands, automatic
  terminal success and rewards remain disabled and manual completion remains authoritative.
- Role 1 must provide golden-workflow evidence for authenticated ingress, persistence/reconnect,
  realtime projection, Twitch participation, OBS output, and every terminal result.
