# ChatXPT Competition Deck

**Format:** 15 slides, 16:9. Slides 2-5 are `OVERVIEW`, slides 6-10 are `USERS`, slides 11-14 are `MECHANISM`, and slide 15 is `FUTURE`.

**Communication job:** By the end, judges should understand that ChatXPT turns livestream reactions into safe, gameplay-aware viewer agency through an AI-ready intelligence layer, deterministic quest authority, and Twitch/OBS surfaces that fit a streamer's existing workflow.

**Evidence language:** Research findings are attributed on-slide. Product claims distinguish implemented source, fixture-rendered evidence, current local/demo behaviour, and future work. The deck does not claim measured retention or revenue uplift.

## Slide 1 - ChatXPT

**Headline:** Viewer agency, generated live.

**Subhead:** An AI stream director that turns gameplay context, audience energy, and streamer style into safe sidequests viewers choose in real time.

**Team:** Yong Chen Jun, Kevin (Team Lead); Joel Yap; Fred; Lim Jia Yin; Phua Jun Kai.

**Repo lens:** `README.md` | `docs/PRODUCT_BRIEF.md`

## Slide 2 - The creator gap is widening

One 2024-2025 audit of the Spanish-speaking Twitch ecosystem reported 75.23% creator attrition, 90% of audience attention concentrated in the top 20%, and a 27.4% average-audience decline among creators active in both periods. This is a regional preprint, not a global Twitch estimate, but it illustrates the discoverability pressure faced by emerging creators.

**Takeaway:** Better gameplay alone is not enough. Smaller streamers need repeatable, participatory moments that make personality visible and give viewers a reason to stay involved.

**Evidence:** Padilla, *The Shrinking Creator Economy*, OSF preprint, 2025.

**Repo lens:** `docs/research/PRODUCT-VALIDATION.md` | `docs/PRODUCT_BRIEF.md`

## Slide 3 - Today's engagement is manual, shallow, and tiring to sustain

**Problem statement:** Livestream chat creates lots of messages but little structured participation. Turning those reactions into engaging content is inconvenient and mentally tiring because the streamer must read, interpret, moderate, invent, and operate controls while still playing.

- Fast chat is noisy; quiet chat offers too little signal.
- Viewers comment, but rarely influence the next playable moment.
- Manual polls and ad hoc challenges interrupt gameplay and demand constant attention.
- Repetitive sessions make personality depend on nonstop improvisation.
- Generic engagement tools ignore game state, audience mood, and streamer boundaries.

**Repo lens:** `docs/PRODUCT_BRIEF.md` | `docs/research/PRODUCT-VALIDATION.md`

## Slide 4 - ChatXPT closes the loop from signal to shared moment

1. **Unstructured reactions become context:** gameplay signals, chat energy, and saved streamer preferences are normalised separately.
2. **Manual invention becomes fast generation:** the intelligence layer proposes exactly three distinct, vote-ready sidequests.
3. **Risk becomes controlled:** deterministic validation applies safety, feasibility, duplication, timing, and streamer-boundary rules.
4. **Participation becomes visible:** viewers vote in Twitch, the winner appears in OBS, and progress and outcomes return to the shared session.

**Core loop:** Observe -> understand -> propose three -> validate -> vote -> activate -> resolve -> learn.

**Repo lens:** `src/core/` | `src/ai/` | `src/quest-engine/` | `src/viewer/`

## Slide 5 - The full product is broad; the MVP proves one complete path

**Full ChatXPT:** Cross-platform AI stream director; persistent streamer and viewer profiles; multi-game intelligence; engagement analytics; adaptive quest timing; platform adapters; account and session history.

**Twitch-first MVP:** ChatXPT Studio; Twitch Extension viewer voting; hosted board and chat fallbacks; OBS Browser Source overlay; real gameplay capture interface; gameplay/chat/profile context; credential-free algorithmic candidate generation; deterministic validation and lifecycle.

**Explicitly deferred:** non-Twitch adapters, public SDK/API, billing, persistent monetary rewards, official game telemetry partnerships, production-scale moderation, and public Extension review.

**Repo lens:** `AGENTS.md` | `docs/PRODUCT_BRIEF.md` | `docs/DECISIONS.md`

## Slide 6 - Twitch gives the MVP an interactive surface without replacing the stream

Twitch supports panel, overlay, and video-component Extensions, so ChatXPT can place voting beside the live video. OBS remains the broadcast tool, and ChatXPT adds a Browser Source rather than hosting video.

**First setup:** Connect Twitch -> select the game/capture source -> add the ChatXPT overlay URL to one OBS scene -> save streamer preferences.

**Future streams:** Open the same OBS scene -> existing sources remain -> ChatXPT observes the session -> automation can open a vote when the chosen trigger is met.

**Evidence:** Twitch Extensions documentation.

**Repo lens:** `src/integrations/twitch/` | `src/integrations/obs/` | `src/streamer/`

## Slide 7 - Streamers choose the level of automation

**Automatic mode:** Choose a trigger or interval, voting duration, and safety boundaries. ChatXPT assesses silently, generates three quests, opens the viewer vote, and sends the winner to the overlay.

**Manual mode:** ChatXPT still analyses and proposes three quests, but the streamer reviews, approves, rejects, or delays them before viewers see a vote.

**Always available:** emergency pause, skip/cancel/result controls, quick intensity changes, connection health, and clear current-context status.

**Repo lens:** `src/streamer/` | `src/core/application/` | `docs/DECISIONS.md`

## Slide 8 - Customise once, keep the streamer's personality in the loop

The streamer sets game category, preferred intervention mode, tone, style, intensity, accessibility needs, forbidden quest types, vote timing, and reward settings. Saved profiles are designed to carry these choices into later streams.

**Benefit:** ChatXPT creates prompts that fit the creator instead of replacing the creator. The streamer retains veto power and can move between automatic and manual control.

**Current MVP:** Studio exposes the control model and local demo settings. Persistent authenticated profile storage remains an integration target until proven in the final deployment.

**Repo lens:** `src/streamer/` | `src/core/contracts/` | `src/quest-engine/`

## Slide 9 - Viewer agency turns watching into a shared decision

**Viewer flow:** See exactly three options -> vote in the Twitch Extension -> receive acknowledgement and live tally -> see the winning quest on the stream -> follow progress and outcome.

**Why it matters:** Research on 2,227 Twitch users found that social interaction and sense of community help explain livestream engagement, with stronger social motivations among viewers who preferred smaller channels. A large-scale Twitch study also found distinct participation styles across stream sizes.

**Benefit hypothesis:** Meaningful influence should increase participation, belonging, anticipation, and reasons to return. The MVP measures accepted-vote participation rather than claiming retention uplift in advance.

**Evidence:** Hilvert-Bruce et al., 2018; Wohn et al., *Audience and Streamer Participation at Scale on Twitch*, 2019/2020.

**Repo lens:** `src/viewer/` | `src/realtime/` | `docs/DECISIONS.md`

## Slide 10 - One interaction creates value for viewers, streamers, and platforms

**Streamer use case:** Turn a quiet or high-energy moment into a structured challenge without stopping to invent one. Measure setup time, control burden, veto rate, and quest completion.

**Viewer use case:** Influence the next moment without leaving Twitch or creating a separate account. Measure participation, vote completion, reconnect success, and reactions.

**Platform use case:** Add differentiated, on-platform interactivity around existing video. Measure watch/follow/support outcomes only through later controlled evaluation.

Research links live viewing with presence, connection, longer continued watching, and willingness to follow or subscribe; a 2026 meta-analysis associates activated engagement with virtual gifting. These support the product hypothesis, not a guaranteed earnings claim.

**Evidence:** Duani, Barasch & Ward, 2026; Chokpaisan et al., 2026.

**Repo lens:** `docs/DECISIONS.md` | `docs/evidence/manifest.json` | `src/viewer/`

## Slide 11 - OBS intelligence creates honest, confidence-scored AI context

**Inputs stay distinct:** real OBS-captured frames, Twitch audience activity, and the saved streamer profile.

**Extraction implementation:** sample bounded frames; detect motion, activity, quiet, and transitions; apply selective OCR only to configured regions; timestamp every observation with confidence and provenance.

**AI intelligence decision:** infer broad moment context and audience state from reliable signals. Unsupported health, kill, score, or phase facts remain `unknown` instead of being invented.

**Game support decision:** universal visual signals first; calibrated adapters for known HUDs; official telemetry later. Raw frames are ephemeral, and the capture path excludes the ChatXPT overlay to avoid recursive analysis.

**Repo lens:** `src/extraction/` | `src/ai/` | `src/integrations/obs/` | `docs/DECISIONS.md`

## Slide 12 - Server AI when available, credential-free intelligence always

**Context assembly:** `GameplaySnapshot + AudienceSignal + StreamerProfile + recent quests + restrictions` becomes one model-ready, game-capability-aware context.

**Permanent path:** a credential-free algorithmic generator uses real context to produce exactly three distinct candidates. Genre-aware templates cover racing, strategy, platformer, tactical, MOBA, battle royale, arena, and unknown categories.

**AI implementation boundary:** D-072 permits server-side OpenAI `gpt-5.6-terra`; it returns strict structured candidates, observes credit, latency, privacy/retention, and source-freshness limits, and falls back cleanly on missing credentials/credit, timeout, refusal, malformed output, or outage.

**Technical decision:** the provider is optional, never authoritative, and never required for the workflow. Every output still passes Role 3 validation and must be backed by recorded real execution before the pitch calls it live.

**Repo lens:** `src/ai/` | `src/lib/mock-engine.ts` | `src/app/api/sidequests/route.ts` | `docs/DECISIONS.md`

## Slide 13 - AI proposes; the deterministic quest engine decides

Every AI or algorithmic candidate is untrusted input until the quest engine accepts it.

**Validation:** schema, safety, legality, humiliation, wagering, privacy, streamer boundaries, game capability, feasibility, clarity, duration, duplication, and diversity.

**Recovery:** invalid or missing candidates are rejected or replaced from the deterministic fallback library until exactly three safe options exist.

**Lifecycle authority:** proposed -> voting -> active -> succeeded, failed, cancelled, skipped, or expired. Server time closes the 30-second vote; deterministic rules resolve majority, ties, zero votes, cooldown, points, and hype.

**Technical decision:** the engine is pure and client-independent. UIs display allowed actions; they do not calculate winners, rewards, or state transitions.

**Repo lens:** `src/quest-engine/` | `src/quest-engine/validation.ts` | `src/core/contracts/`

## Slide 14 - One authoritative architecture keeps five surfaces consistent

**Flow:** Twitch + OBS adapters -> platform-neutral Core -> Role 2 intelligence/candidates -> Role 3 deterministic engine -> Role 1 orchestrator -> persistence/realtime -> Studio, Twitch Extension, hosted board, chat fallback, and read-only OBS overlay.

**Technical rigour:** versioned Zod contracts; typed commands and errors; command IDs and expected revisions; idempotency; server timestamps; atomic persistence before broadcast; reconnect snapshots; role-sanitised view models; server-only secrets; producer/consumer contract tests.

**Evidence posture:** fixture-rendered viewer and overlay states are labelled as fixtures. Real Twitch/OBS activity is required before the team claims a live golden workflow.

**Repo lens:** `docs/ARCHITECTURE.md` | `docs/build-plans/INTEGRATION-CONTRACT.md` | `src/core/` | `tests/integration/`

## Slide 15 - Future work turns one Twitch MVP into a cross-platform stream director

- Persistent streamer accounts, personalities, boundaries, game preferences, and cross-stream memory.
- Streamer engagement analytics: quest timing, vetoes, completions, audience response, and creator growth experiments.
- Viewer profiles and analytics: participation history, preferences, reconnect continuity, and privacy-safe community insights.
- Deeper game support through calibration packs, selective OCR improvements, and official telemetry where available.
- Evaluated server-side AI providers, adaptive quest timing, personalised challenge styles, and automated highlight prompts.
- Platform-neutral adapters for YouTube, Discord, TikTok Live, Kick, and future livestream APIs after the Twitch workflow is proven.

**Closing:** Prove the interaction on Twitch. Carry the intelligence, safety, and participation engine everywhere streams already happen.

**Repo lens:** `src/integrations/` | `src/core/` | `docs/ARCHITECTURE.md` | `docs/DECISIONS.md`

## External Research Sources

- Padilla, A. (2025). *The Shrinking Creator Economy: Inequality and Impoverishment of the Hispanic Twitch Ecosystem*. OSF preprint. <https://doi.org/10.31235/osf.io/gef2q_v1>
- Hilvert-Bruce, Z., Neill, J. T., Sjoblom, M., & Hamari, J. (2018). *Social motivations of live-streaming viewer engagement on Twitch*. Computers in Human Behavior, 84, 58-67. <https://doi.org/10.1016/j.chb.2018.02.013>
- Wohn, D. Y. et al. (2019/2020). *Audience and Streamer Participation at Scale on Twitch*. <https://arxiv.org/abs/2012.00215>
- Duani, N., Barasch, A., & Ward, A. F. (2026). *The Liveness Lift: Viewing Live Streams Creates Connection and Enhances Engagement in Amateur Music Performances*. <https://doi.org/10.1177/00222429261421488>
- Chokpaisan, S. et al. (2026). *Virtual gifting as affective monetization: a meta-analysis of behavioral antecedents in live game streaming platforms*. <https://doi.org/10.1186/s40359-026-04813-x>
- Twitch Developers. *Extensions*. <https://dev.twitch.tv/docs/extensions/>
