# Role 2 provider reliability evaluation

Status: **D-072 approves OpenAI `gpt-5.6-terra`; fixture harness implemented; real credited-provider evidence still pending.**

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

D-072 resolves D23-01, D23-03, and D2-17 for the approved path. D23-02 and D2-16 remain open, while D2-18 is resolved by the credential-free algorithmic candidate strategy. Fixture tests establish the evaluation and recovery plumbing only; they do not prove provider availability, model quality, real-input candidate generation, or end-to-end integration.
