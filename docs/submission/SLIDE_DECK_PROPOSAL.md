# ChatXPT Slide Deck Proposal

**Package purpose:** Competition proposal deck outline for a maximum 15-slide PDF.

**Communication job:** By the end, judges should understand why ChatXPT is a credible AI livestream engagement product because it turns real gameplay, audience intent, and streamer boundaries into safe viewer-voted sidequests while clearly separating implemented evidence from planned proof.

**Evidence label legend:** `[real]` means proven by a manifest `real` entry. `[fixture]` means deterministic fixture/test or fixture screenshot evidence. `[diagnostic]` means source inspection, local fallback, static checks, or planning evidence only. `[unknown]` means the repo defines the intended behaviour, but no current manifest entry proves it.

**Current evidence boundary:** `docs/evidence/manifest.json` currently records repository/process validation as inspection-only and Role 5 fixture-rendered viewer/overlay screenshots as fixture-only. It records no real Twitch, OBS, Supabase cloud, Vercel deployment, external model-provider, real OCR, real gameplay, or end-to-end golden workflow evidence.

## Slide 1: ChatXPT Turns Livestream Chat Into Playable Sidequests

- AI stream director for game streamers on Twitch.
- Converts gameplay moments, audience behaviour, and streamer preferences into exactly three safe sidequest options.
- Viewers vote; the winning quest becomes an OBS broadcast moment.

**Evidence labels:** product promise `[diagnostic]`; end-to-end live proof `[unknown]`.

**Screenshots/assets needed:** Hero visual from final demo showing Studio, viewer vote, and overlay in one composition; avoid implying live evidence until manifest entry exists.

## Slide 2: Livestream Chat Has Energy, But Little Structured Agency

- Viewers suggest ideas, react, and spam chat, but streamers cannot safely process all of it while playing.
- Static polls and fixed rewards do not adapt to the current match, audience mood, or streamer limits.
- The missed opportunity is not more chat volume; it is safe, contextual participation.

**Evidence labels:** problem framing `[diagnostic]`; participant validation `[unknown]`.

**Screenshots/assets needed:** Optional sanitized observation quote or workflow screenshot after `docs/research/PRODUCT-VALIDATION.md` receives real participant evidence.

## Slide 3: The Primary Users Are Streamers, Viewers, and Moderators

- Streamers need hands-on control, persistent setup, safety limits, and low distraction.
- Viewers want a fast way to influence the stream without leaving Twitch.
- Moderators and stream teams need compact controls, status clarity, and emergency recovery.
- Judges and maintainers need proof labels that distinguish real, fixture, diagnostic, and unknown states.

**Evidence labels:** target users from product brief and role plans `[diagnostic]`; usability observations `[unknown]`.

**Screenshots/assets needed:** Studio setup/status screenshot for streamer; Twitch/hosted viewer screenshot for viewer; compact Live Config screenshot for moderator.

## Slide 4: The Product Promise Is A Closed Participation Loop

- ChatXPT watches real gameplay and audience signals through authorised adapters.
- Role 2 intelligence proposes exactly three structured candidate quests.
- Role 3 validates safety, feasibility, timing, fallback, voting, progress, and outcome rules.
- Role 1 persists one authoritative revision and broadcasts safe views to Studio, viewers, and OBS.

**Evidence labels:** architecture/contracts `[diagnostic]`; Role 5 visual fixture surfaces `[fixture]`; live closed loop `[unknown]`.

**Screenshots/assets needed:** One clean architecture diagram or final golden-workflow sequence with session/cycle revision visible in evidence notes.

## Slide 5: ChatXPT Stays Twitch-First Without Becoming Twitch-Locked

- Twitch is the only implemented MVP platform.
- Twitch Extension is the primary viewer surface; hosted Quest Board and `1`/`2`/`3` Twitch-chat voting are fallbacks.
- OBS Browser Source is visual output only, not the configuration or voting surface.
- YouTube, Discord, TikTok, and other platforms remain disabled `Coming Soon` options.

**Evidence labels:** accepted product scope `[diagnostic]`; Twitch test registration/runtime `[unknown]`.

**Screenshots/assets needed:** Twitch Extension hosted/local test screenshots after allowlisted test evidence; hosted board fallback screenshot already has fixture evidence.

## Slide 6: AI Contributes Context, But Determinism Holds Authority

- AI contribution is scoped to gameplay/audience intelligence and candidate generation.
- The product never requires paid model usage for the MVP.
- Provider output must be structured, validated, and routed through Role 3 before viewers see it.
- D-055 adopts no external model provider for the judged MVP; credential-free algorithms and deterministic fallback continue the workflow.

**Evidence labels:** provider decision and fallback strategy `[diagnostic]`; algorithmic path on real inputs `[unknown]`; external provider trial `[unknown/future]`.

**Screenshots/assets needed:** Studio intelligence status screenshot showing algorithmic and deterministic fallback labels after Role 1 promotes canonical UI-X09 fixtures or live evidence exists.

## Slide 7: Gameplay Understanding Is Honest About Confidence And Unknowns

- OBS Virtual Camera is the accepted MVP capture path for raw game frames.
- Universal visual signals cover broad activity, quiet, and transitions across action games.
- Calibrated HUD facts are claimed only for configured games and evidenced regions.
- Unsupported or low-confidence facts stay `unknown`; they are not guessed from expectations.

**Evidence labels:** extraction boundary and synthetic tests `[diagnostic]`; synthetic visual/OCR tests `[fixture]`; real OBS frame extraction `[unknown]`.

**Screenshots/assets needed:** Privacy-reviewed OBS Virtual Camera frame capture with separated annotation overlays; one selected demo-game calibrated fact if proven.

## Slide 8: The Architecture Uses One Runtime Source Of Truth

- Next.js and TypeScript provide one product shell with role-owned public modules.
- Zod schemas define versioned platform-neutral contracts for signals, profiles, sessions, candidates, votes, quest state, views, commands, and errors.
- Role 1's orchestrator authenticates commands, checks revisions, deduplicates IDs, persists atomically, and broadcasts role-specific views.
- Role modules integrate through public ports; private Twitch, OBS, provider, Supabase, and UI payloads stay outside Core.

**Evidence labels:** source/contracts/tests `[diagnostic]`; live multi-client authority `[unknown]`.

**Screenshots/assets needed:** Compact data-flow diagram plus a later screenshot/log proving the same session and quest-cycle revision across Studio, two viewers, persistence, and OBS.

## Slide 9: The Quest Engine Makes Safety And Flow Deterministic

- It validates unsafe, illegal, humiliating, wagering, privacy-violating, unsupported, repetitive, stale, and impossible quests.
- It opens a 30-second vote using authoritative time and rejects late votes.
- It resolves majority, ties, zero-vote no-activation, cancellation, skip, failure, success, expiry, cooldown, points, and hype through deterministic rules.
- Human-facing surfaces show allowed actions; they do not calculate winners, rewards, or lifecycle transitions.

**Evidence labels:** engine and validation tests `[fixture]`; live quest cycle `[unknown]`.

**Screenshots/assets needed:** Test result summary or demo screenshots for proposed, voting, active, terminal, tie, zero-vote, and emergency states.

## Slide 10: Participation Converges Through One Private Service

- Twitch Extension, hosted Quest Board, and Twitch-chat fallback all submit to the same authoritative vote ledger.
- The first accepted vote per viewer and quest cycle is final.
- Shared broadcasts remove private vote receipts and personal points.
- Reconnecting viewers recover only their own accepted vote and session points through a private recovery seam.

**Evidence labels:** memory/Supabase source and tests `[diagnostic]`; Role 5 viewer fixture screenshots `[fixture]`; real two-viewer vote `[unknown]`.

**Screenshots/assets needed:** Two isolated viewer clients voting in one real or memory-backed run; include duplicate/late vote evidence only when exercised.

## Slide 11: Streamer Studio Keeps Control With Minimal Live Burden

- Studio is the full management surface for Twitch setup, OBS capture, profile preferences, safety, game context, health, diagnostics, history, and advanced controls.
- Twitch Live Config is the compact stream-time control surface inside Twitch.
- Current Role 4 work includes a design-system handoff, setup shell, readiness/status presentation, and render-only status modules.
- Authoritative connection, profile save, session wiring, and Live Config controls still depend on Role 1 gateway handoffs.

**Evidence labels:** Role 4 source/tests `[diagnostic]`; final integrated Studio `[unknown]`.

**Screenshots/assets needed:** Desktop and narrow Studio screenshots for setup, returning readiness, generated quests, recovery, and compact Live Config.

## Slide 12: Viewer And Overlay Surfaces Show The Shared Payoff

- Viewers see exactly three understandable options, vote acknowledgement, tallies, countdown, active quest, progress, results, hype, and recovery states.
- Hosted board fallback supports desktop/mobile participation without a separate account.
- Twitch-chat fallback explains the `1`/`2`/`3` voting path without putting chat parsing or sending inside Role 5.
- OBS overlay stays read-only and low-distraction for the broadcast.

**Evidence labels:** Role 5 fixture-rendered screenshots in manifest `[fixture]`; Twitch Extension identity/hosted access/realtime/OBS proof `[unknown]`.

**Screenshots/assets needed:** Existing fixture assets can illustrate current UI; final deck needs real or memory-backed same-revision evidence before claiming integration.

## Slide 13: Expected Impact Is Measured As Participation, Not Vanity

- Principal metric: viewer participation rate, the share of active viewers who cast an accepted vote.
- Supporting measures: quest completion, setup time, response latency, fallback/reconnect success, and streamer control burden.
- Product hypotheses remain open until recorded streamer/viewer observations and executed runs exist.
- The deck should describe impact as measurable hypotheses unless the manifest records results.

**Evidence labels:** accepted KPI decision `[diagnostic]`; measured impact `[unknown]`.

**Screenshots/assets needed:** A simple metrics snapshot or table after real or memory-backed rehearsal: viewers present, accepted votes, completion, latency, reconnect/fallback outcome.

## Slide 14: Technical Choices Prioritise Trust, Privacy, And Recoverability

- Supabase Free is the accepted authoritative persistence/realtime target; credential-free memory mode remains a development fallback.
- Vercel is the planned deployment host; deployment evidence is not yet recorded.
- Server-only secrets protect Twitch and Supabase credentials; any future provider trial would also remain server-side.
- Raw frames are ephemeral; raw chat is processed in memory unless approved for short-lived debugging; rewards are session-scoped and non-monetary.
- Third-party disclosures cover runtime dependencies, development tooling, Twitch, OBS, Supabase, Vercel, and provider status.

**Evidence labels:** disclosures and source checks `[diagnostic]`; cloud/deployment proof `[unknown]`.

**Screenshots/assets needed:** Deployment health screenshot only after real preview is configured; no secret-bearing screenshots.

## Slide 15: Final Deck Assets Must Prove The Golden Workflow Or Label The Gap

- Required final proof: real Twitch activity, real OBS-captured gameplay, exactly three validated quests, one streamer, two viewers, one authoritative revision, OBS overlay, progress, result, and fallback/failure handling.
- Current manifest does not yet prove the real golden workflow.
- The proposal deck can be submitted honestly as a build-and-evidence plan; the final competition deck should swap unknown labels for manifest-backed real entries only after rehearsal.
- Never upgrade fixture screenshots, static checks, or source inspection into live product claims.

**Evidence labels:** final golden workflow `[unknown]`; available manifest evidence `[fixture]` and `[diagnostic]`.

**Screenshots/assets needed:** Privacy-reviewed demo recording stills, evidence manifest IDs, golden run limitations, and final source commit.

## Source Basis Inspected

- `AGENTS.md`
- `README.md`
- `docs/PRODUCT_BRIEF.md`
- `docs/ARCHITECTURE.md`
- `docs/THIRD_PARTY_DISCLOSURES.md`
- `docs/SUBMISSION_CHECKLIST.md`
- `docs/DECISIONS.md`
- `docs/PROJECT_TODO.md`
- `docs/TEAM_CONTEXT.md`
- `docs/TEAM_PLAYBOOK.md`
- `docs/evidence/README.md`
- `docs/evidence/manifest.json`
- `docs/evidence/GOLDEN_REHEARSAL_RUNBOOK.md`
- `docs/research/PRODUCT-VALIDATION.md`
- `docs/build-plans/README.md`
- `docs/build-plans/INTEGRATION-CONTRACT.md`
- `docs/build-plans/ROLE-1-BUILD-PLAN.md`
- `docs/build-plans/ROLE-2-BUILD-PLAN.md`
- `docs/build-plans/ROLE-3-BUILD-PLAN.md`
- `docs/build-plans/ROLE-4-BUILD-PLAN.md`
- `docs/build-plans/ROLE-5-BUILD-PLAN.md`
- `docs/build-plans/ROLE-4-5-DELIVERY-MATRIX.md`
- `docs/roles/ROLE-1-TODO.md`
- `docs/roles/ROLE-2-TODO.md`
- `docs/roles/ROLE-3-TODO.md`
- `docs/roles/ROLE-4-TODO.md`
- `docs/roles/ROLE-5-TODO.md`
- Role public-entry READMEs under `src/core/`, `src/integrations/`, `src/realtime/`, `src/ai/`, `src/extraction/`, `src/quest-engine/`, `src/design-system/`, `src/streamer/`, and `src/viewer/`.

## PDF Rendering Notes

- Recommended final PDF: 15 slides, landscape, low-density copy, one claim per slide.
- Use fixture screenshots only with visible labels. Use `[real]` labels only after a corresponding manifest entry exists.
- If the final golden workflow remains unproved, keep slide 15 as a transparent evidence-readiness close rather than a success claim.
