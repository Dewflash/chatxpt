# Role 2 provider reliability evaluation

Status: **D-072 approves OpenAI `gpt-5.6-terra`; fixture harness implemented; two partial diagnostic provider runs recorded; production-quality evidence remains pending.**

Role 2 measures provider integration, structured-output reliability, latency, timeout, rate-limit behaviour, privacy/retention, credited-account availability, and algorithmic recovery. Role 3 independently applies the hard gates and weighted quest-quality rubric in `src/quest-engine/PROVIDER_QUALITY_RUBRIC.md`. D-072 settles adoption; the two roles still provide execution and quality evidence to Role 1 without treating it as permission to implement or push.

## Current harness

`createProviderFallbackGenerationStrategy` composes two injected strategies:

1. A pinned provider/model strategy, which must return exactly three canonical candidates labelled `ai-provider` with the configured provider identifier.
2. A credential-free algorithmic strategy, invoked after timeout, refusal, rate limiting, unavailability, malformed output, or an unclassified provider error.

Provider output is all-or-nothing: partial, overfull, malformed, or incorrectly labelled batches are discarded rather than repaired or mixed with algorithmic options. Caller cancellation is preserved and never converted into fallback. Algorithmic output must independently satisfy the exactly-three canonical contract and be labelled `algorithmic`; Role 3 still owns deterministic safety, evidence, feasibility, diversity, history, and fallback enforcement.

The harness records only provider identifier, classified status, provider-attempt duration, and algorithmic-fallback outcome. It does not retain prompts, raw output, exception text, credentials, chat, viewer identity, or vendor payloads. D-072 requires one provider attempt and an 8-second timeout before algorithmic fallback.

## Joint trial matrix

Run every pinned provider/model configuration against the same versioned cases:

1. High-action gameplay with matching audience hype.
2. Quiet gameplay where intervention is suitable.
3. Busy or unsafe gameplay that must not bypass Role 3's intervention gate.
4. Unknown-heavy or stale signals that must not become invented facts.
5. Restrictive streamer boundaries and accessibility needs.
6. Recent quest history that creates repetition pressure.
7. Harmful, illegal, humiliating, wagering, privacy-invasive, sexual, and offline physical-dare pressure.
8. Timeout, outage, malformed JSON, partial/overfull batch, refusal, and rate limiting.
9. At least three game genres without battle-royale-only assumptions.

Repository cases remain synthetic and explicitly fixture-only. D-072 allows real provider trials with sanitised bounded inputs and a private server-side team credential when existing prepaid/promotional credit is available. No contributor must buy quota; adding a payment method or new spend requires a separate owner decision.

## Recorded diagnostic provider run

On 22 August 2026, commit `7962f8d` was exercised with 120 locally decoded frames from an owner-authorised Brawl Stars recording. The production analyzer reduced those frames to four known generic visual signals; the request contained 3,332 bytes of normalised context, zero audience events, no raw frames, no chat, and no identities. The provider-only request used exact model `gpt-5.6-terra`, `store: false`, `reasoning.effort: none`, zero SDK retries, and a diagnostic-only 30-second cap. Production remains configured for its accepted 8-second timeout and fallback policy.

The provider completed in 5,091 milliseconds and returned exactly three schema-valid `ai-provider` candidates. Usage was 1,358 input tokens, 270 output tokens, zero reasoning tokens, and 1,628 total tokens; the estimate from the documented token rates was USD 0.005956. Role 3 accepted two candidates. It rejected one with `unknown-dependent` because the producer-only rationale named an unsupported fact category while disclaiming reliance on it. The derived rejection prompted a Role 2 instruction regression: rationales must describe unsupported-state avoidance generically instead of naming unknown fact categories.

This is partial diagnostic evidence, not a passing D-072 quality trial. The request cap and reasoning effort differed from the current production transport, the test used recording replay rather than OBS Virtual Camera, Brawl Stars remains evaluation-only, and the hard gate failed because not all three candidates passed Role 3. Prompt text, provider output, credentials, raw pixels, and private identifiers were not retained in the repository.

The owner then authorised one follow-up request from integrated commit `7c88187`. It replayed the same bounded recording path to 120 temporary 160x90 frames, selected four confidence-qualified generic visual signals, and sent 3,300 bytes of normalised context with no raw frames, chat, identities, or audience events. This provider-only request matched the accepted transport settings: exact `gpt-5.6-terra`, `reasoning.effort: low`, `store: false`, zero SDK retries, one attempt, an 8-second abort limit, and no fallback accepted as provider output.

The follow-up completed in 6,733 milliseconds and returned exactly three schema-valid `ai-provider` candidates. Usage was 1,408 input tokens, 446 output tokens including 174 reasoning tokens, and 1,854 total tokens; the estimate using the same documented token rates as the first diagnostic was USD 0.008168. Role 3 again accepted two candidates, rejecting the third only as `difficulty-mismatch`. That result exposed a missing prompt/validator seam rather than a transport or schema failure: the prompt now states Role 3's easy 15-90, medium 30-150, and hard 45-180 second bands. The current server client also explicitly sets `maxRetries: 0`, closing an SDK-default mismatch discovered before the call. No third provider request was made, so the hard gate remains open until a later authorised run proves three-of-three acceptance.

## Role 2 operational report

For each pinned configuration record:

- Attempt count and case pass rate.
- Canonical exactly-three success rate.
- Malformed/partial/overfull response rate.
- Timeout and rate-limit rate.
- p50 and p95 provider-attempt latency.
- Algorithmic-fallback frequency and success rate.
- Credit/quota limits, paid-path separation, privacy/data-use/retention constraints, and reproducibility risk.
- Retry count and timeout configuration used by the trial.

`summariseProviderAttempts` calculates the runtime-derived rates and latency percentiles from privacy-safe observations. Credit, privacy, retention, and provider-policy facts require separately cited current provider documentation. OpenAI's official model page states that `gpt-5.6-terra` has no API free tier; the data-controls page states that API content is not used for training by default unless opted in and may appear in abuse-monitoring logs for up to 30 days unless Zero Data Retention applies.

## Joint outcome

Role 3 scores each canonical batch for feasibility, clarity, diversity, novelty, moment fit, streamer fit, audience fit, duration/difficulty fit, and refusal/recovery. The execution recommendation remains one of:

- `recommend for controlled server-side trial`
- `evaluation only`
- `do not adopt`

D-072 resolves D23-01, D23-03, and D2-17 for the approved path. D23-02 and D2-16 remain open, while D2-18 is resolved by the credential-free algorithmic candidate strategy. The two recorded diagnostics prove provider availability, exactly-three structured transport, and one response inside the exact 8-second limit, but both fail the Role 3 hard gate at two accepted candidates. They do not prove production reliability, representative model quality, OBS/Twitch execution, or end-to-end integration.
