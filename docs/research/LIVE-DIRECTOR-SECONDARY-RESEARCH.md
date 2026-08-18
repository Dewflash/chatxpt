# Live Director Secondary Research and Scope Recommendation

**Owner:** Role 1 (`Dewflash`)

**Date:** 18 August 2026

**Method:** Secondary research only

**Decision status:** Research complete; keep/defer/reject recommendations await project-owner acceptance

## Executive conclusion

ChatXPT should not be positioned as a generic cure for low streamer engagement. Engagement and channel growth are multi-causal, Twitch already supplies chat, polls, rewards, events, and broad analytics, and current third-party tools already market AI cohosts, chat summaries, gameplay-reactive overlays, direct game effects, and automated production.

The evidence supports a narrower problem:

> During live gameplay, a solo or lightly supported creator must trade attention between playing and audience management. Existing tools expose feeds and controls, but the creator still has to notice a useful audience signal, decide whether the current game moment can tolerate an interruption, turn the signal into a safe interaction, operate that interaction, and carry its result back into the broadcast.

The best initial target is not every “small streamer” by follower count. It is a **bursty/rising operating mode**: a solo or lightly moderated game stream whose chat is sometimes sparse and sometimes faster than the streamer can safely interpret while playing. Very sparse communities can often use direct conversation, while busy streams already rely heavily on moderators and established production systems.

The defensible product wedge is therefore:

> ChatXPT is a Twitch-native sidequest director that waits for a suitable game moment, compresses audience intent into one private and source-labelled cue, lets the streamer convert that cue into exactly three safe sidequests, and carries one authoritative winner through viewer voting, broadcast progress, outcome, and intervention-specific review.

This is an experience-level differentiation, not a durable technical moat. A competitor can copy it. ChatXPT must prove that the complete loop requires less streamer attention and produces more meaningful participation than a manual Twitch poll, reward, or chat prompt.

The research recommends:

- Keep the streamer-declared Session Goal, source-separated private Live Context, a narrowly bounded Chat Pointer, one Director Cue, exactly-three sidequest conversion, Extension Vote/Active/Result states, and the existing public OBS quest projection as the P0 loop.
- Treat a late-join Catch-up Card and intervention-specific Session Brief as P1 experiments with explicit kill criteria.
- Use Twitch Live Config pop-out or an OBS Custom Dock as the first private cue delivery options. Defer private audio/hotkeys. Reject an always-on-top desktop companion from the MVP.
- Reject generic gameplay coaching, a generic AI cohost, a full chat summary window, a broad growth analytics suite, a full stream-summary timeline, and viewer-paid direct game control from this product expansion.

No source reviewed establishes product-market fit, a retention lift, or a universal small-streamer playbook. Those remain unproven.

## 1. Research questions and evidence standard

This pass addresses `LD-V01` through `LD-V09` in `docs/research/PRODUCT-VALIDATION.md`:

1. Is divided attention a documented problem for under-resourced game streamers?
2. Is there evidence that viewers, especially late joiners, lack useful stream context?
3. Do missed or repeated chat suggestions create a problem distinct from ordinary chat display?
4. Which relevant capabilities already exist in Twitch and third-party tools?
5. Which streamer operating modes and game-attention phases should ChatXPT serve or avoid?
6. Which context claims can the current product source truthfully?
7. How should a private streamer cue be delivered?
8. What, if anything, belongs in an intervention-specific Session Brief?
9. Which proposed additions should be kept, deferred, or rejected?

Evidence is classified as follows:

| Grade | Meaning | Permitted use |
| --- | --- | --- |
| Strong | Directly relevant study or current first-party capability documentation with a clear method or observable product behaviour | Supports a bounded problem or capability claim |
| Moderate | Relevant evidence with age, sample, game, platform, or ecological-validity limits | Supports a hypothesis with the limitation stated |
| Weak | Vendor-reported metric without a disclosed method, indirect analogy, or team inference | Generates an evaluation question; does not prove value |

Current first-party documentation is authoritative for present product capability, not for independent evidence of impact. Academic studies establish observed behaviours in their samples; they do not establish that every streamer behaves the same way in 2026.

## 2. Problem statement and solution fit

### Problem that the evidence supports

Streamers perform gameplay and audience-facing production simultaneously. Wohn and Freeman's 25-interview study describes audience management as cognitively and temporally costly. Participants discussed difficulty scanning chat during focused work, pausing gameplay to catch up, relying on moderators to flag missed messages, and sometimes preferring post-stream statistics to distracting live counts. The authors explicitly describe a trade-off between content and interaction. The sample ranged from 119 to 187,664 followers and is not representative of all creators, but the attention mechanism is directly relevant. [Wohn and Freeman, 2020](https://guof.people.clemson.edu/papers/imx20.pdf)

Flores-Saviaga and colleagues analysed 226,658 Twitch streams and 12.15 million chat messages collected in 2017, together with 45 hours of video. They observed different audience-management patterns by channel scale, reliance on bots and moderators, simple chat-based numbered choices, and a phase distinction: slower or reflective game moments are better suited to audience interaction, while tense moments demand gameplay attention. Their scale labels are too old and broad to reuse as modern market segments, but the behavioural distinction is useful. [Flores-Saviaga et al., 2019](https://arxiv.org/pdf/2012.00215)

Hamilton and colleagues' long-running ethnography similarly found that streamers split focus between play and viewers, that regulars and moderators help manage this work, and that meaningful participation is a strong property of smaller communities. The study predates current Twitch tooling, so it supports the social pattern rather than a present capability gap. [Hamilton et al., 2014](https://ecologylab.net/research/publications/streamingOnTwitch.pdf)

### Problem that the evidence does not support

The research does not justify any of these claims:

- “Small streamers do not get engagement because they lack the correct playbook.”
- “ChatXPT will improve retention, average concurrent viewers, subscriptions, or revenue.”
- “Streamers generally do not narrate gameplay.”
- “A dashboard, coach, or AI cohost is what streamers need.”
- “Every repeated chat request should become an intervention.”

For very small chats, personally reading and responding to individual viewers can be feasible and is part of the channel's social value. For busy chats, human moderators remain important because they understand community norms and context. Automation can therefore destroy intimacy at one end and create false confidence at the other.

### Why the proposed solution fits the narrower problem

The solution fit is not “more engagement features.” It is the reduction of a specific coordination sequence:

```text
notice audience signal
-> interpret whether it is meaningful
-> relate it to current gameplay and declared intent
-> wait for a tolerable moment
-> formulate safe options
-> operate a viewer interaction
-> publish the outcome consistently
```

ChatXPT can compress that sequence only if it remains source-labelled, streamer-controlled, phase-aware, and lifecycle-complete. If it merely adds another feed, summary, poll, or metric, Twitch and existing tools already satisfy the need more directly.

## 3. Target segment: operating reality, not follower count

No reviewed source provides a stable, universal 2026 definition of a small or medium Twitch streamer. Followers also do not describe live workload: two channels with the same follower count can have very different chat velocity, moderation, game intensity, and production support.

ChatXPT should segment sessions by operating mode:

| Operating mode | Observable conditions | Existing strength | Remaining difficulty | ChatXPT posture |
| --- | --- | --- | --- | --- |
| Sparse/solo | Few messages; long quiet windows; no moderator; direct responses are possible | Personal conversation and intimacy | There may be too little collective intent to aggregate | Remain mostly silent. Use declared goal and observed game phase only for an optional prompt; never call one message consensus |
| Bursty/rising | Chat alternates between quiet and short bursts; solo or lightly moderated; gameplay sometimes consumes attention | Creator can still act personally when timing permits | A useful request can be missed or acted on too late; manual poll setup competes with play | Primary target. Aggregate only repeated intent, suppress during high focus, and surface one expiring Director Cue |
| Busy/mod-assisted | Sustained message volume; established moderators/bots; structured production workflow | Human moderators understand norms and can triage nuance | Streamer still needs a concise handoff, but a new tool can duplicate or disrupt the team | Assist the moderator/streamer with aggregates; do not replace moderation or expose user-level classifications |

The runtime should determine posture from bounded signals such as recent message velocity, unique participant count, confidence, signal freshness, moderator availability where legitimately known, and game-attention phase. It must not persist a label such as “small streamer” or profile individual viewers.

## 4. Evidence-informed streamer playbook

This is a product operating playbook derived from the observed attention trade-off. It is not a claim that successful creators universally follow these steps.

| Stream moment | What the creator normally needs to do | Evidence-informed ChatXPT action | What ChatXPT must not do |
| --- | --- | --- | --- |
| Before going live | Set expectations, title/goal, boundaries, and interaction readiness | Ask for one Session Goal/Current Objective, desired involvement, and existing safety preferences | Infer the creator's motive from video or expose raw provider controls |
| Sparse chat | Respond personally when useful; keep playing when no interaction exists | Stay silent unless the creator asks for an optional prompt; preserve `unknown` audience intent | Manufacture consensus, fill silence continuously, or replace direct conversation |
| Chat burst during high-focus play | Prioritise gameplay and avoid unsafe distraction | Buffer short-lived aggregates, suppress the cue, and expire the signal if no longer relevant | Flash a dashboard, read raw chat aloud, or start a vote automatically |
| Downtime or transition | Catch up with viewers and choose an appropriate interaction | Surface one cue with the topic, unique participants, qualifying messages, time window, and source/freshness | Show a full chat mirror, a list of competing recommendations, or “optimal” game advice |
| Streamer accepts cue | Formulate an understandable, safe participation moment | Send the accepted context through Role 2 candidate production and Role 3 deterministic validation for exactly three sidequests | Bypass permissions, deterministic safety, veto rules, or the authoritative participation service |
| Voting | Explain options and preserve gameplay readability | Give individual viewers selection/receipt in the Extension and show only shared essentials in OBS | Calculate winners locally or put private cue evidence into the broadcast |
| Quest active/result | Carry the community choice back into play and close the loop | Show authoritative objective/progress/result across surfaces; permit streamer lifecycle control | Leave the Extension empty between votes or let overlay state drift from server authority |
| After stream | Reflect on useful interventions without inventing causality | If retained, show only cue, action, participation, quest outcome, evidence limits, and system reliability | Rebuild Twitch Analytics, attribute retention to a quest, or provide a generic growth score |

The key orchestration rule is:

```text
high-focus action -> wait
downtime/transition -> consider cue or sidequest
post-event -> close or recap the interaction
sparse/ambiguous/old evidence -> remain silent or say unknown
```

## 5. Viewer context and late joining

There is evidence that live-stream viewers benefit from rapid context, but it does not prove that ChatXPT's proposed Catch-up Card will work.

CatchLive combined stream content and interaction signals into real-time summaries. In a deployment across three streams with 67 viewers, participants reported that summaries helped them grasp overview and important moments. In the game stream, the CatchLive group was more engaged than the baseline group, but the study did not find a significant difference in game-stream understanding. Fast summaries could also distract. This is direct evidence for testing a narrow catch-up aid and equally direct counterevidence against treating it as proven. [CatchLive, CHI 2022](https://catchlive.kixlab.org/)

A questionnaire of 1,097 game-stream viewers found that information seeking, tension release, social integration, and affective motivations were associated with viewing patterns; social integration was the main subscription predictor in that model. This supports the broad importance of understanding and social participation, not the specific design of a Catch-up Card or a causal retention claim. [Sjöblom and Hamari, 2017](https://www.utupub.fi/server/api/core/bitstreams/e4a966b0-1fc6-44a8-8924-4dedf232babe/content)

Recommendation: keep Vote, Active, and Result as the P0 Extension lifecycle. Treat Catch-up as a small P1 experiment containing only the current public-safe goal, phase, recent material event, audience decision, and active quest. Do not build a timeline, highlight reel, narrative recap, or gameplay explainer.

## 6. Current capability and substitute audit

### Twitch already provides the primitives

| Current capability | What it already solves | What remains for ChatXPT to prove |
| --- | --- | --- |
| [Chat & Events](https://help.twitch.tv/s/article/creator-chat-and-events?language=en_US) | A combined portable chat and channel-events window in Stream Manager, OBS, or pop-out, including active polls/predictions and upcoming events | ChatXPT must not clone chat. It must reduce interpretation and operation work by linking a bounded aggregate to game phase and an actionable sidequest cue |
| [Stream Manager](https://www.twitch.tv/creatorcamp/en/level1/going-live/stream-manager/) | Chat, activity feed, important-interaction filtering, quick actions, and native poll access | ChatXPT must justify why its cue is more timely and lower effort than using these controls manually |
| [Polls](https://dev.twitch.tv/docs/api/polls/) | One native poll at a time with two to five choices for eligible channels | Exactly three is not unique. The difference must be contextual generation, deterministic validation, streamer boundaries, authoritative quest lifecycle, and broadcast payoff |
| [Predictions](https://help.twitch.tv/s/article/channel-points-predictions?language=en_US), [Channel Points](https://help.twitch.tv/s/article/channel-points-guide), and [Custom Power-ups](https://blog.twitch.tv/en/2026/05/19/new-ways-to-turn-your-community-s-participation-into-earnings/) | Native predictions, fixed rewards, and creator-defined paid interactive effects | ChatXPT should remain non-wagering and demonstrate a safer contextual sidequest loop, not compete on monetised effects |
| [Channel Analytics](https://help.twitch.tv/s/article/channel-analytics?language=en_US) and [Stream Summary](https://help.twitch.tv/s/article/stream-summary) | Broad channel, engagement, discovery, earnings, and per-stream metrics | ChatXPT may show intervention records and reliability only; a generic analytics suite is duplicate scope |
| [Extension framework](https://dev.twitch.tv/docs/extensions/) and [Live Config](https://dev.twitch.tv/docs/extensions/life-cycle/) | Embedded viewer surfaces and a streamer live-control surface | These are delivery surfaces, not product differentiation |
| [EventSub and chat APIs](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/) | Current chat, poll, reward, and related events can be received server-side with appropriate authority | Raw events still need privacy-safe aggregation and authoritative orchestration; deleted/cleared messages must invalidate evidence |

Twitch Creator Camp reports that first-visit chatters are 50% more likely to return, Channel Points can increase time spent by up to 18% and chat participation by up to 13%, and visible polls can increase viewer engagement by 10%. The page does not disclose the study design, confound controls, or sample. These numbers are vendor-reported motivation for testing participation, not causal targets for ChatXPT. [Twitch Creator Camp: Engaging Viewers](https://www.twitch.tv/creatorcamp/en/level1/establish-your-brand/engaging-viewers/)

### Third-party products overlap substantially

| Product | Verified overlap | Remaining distinction to test | Consequence for scope |
| --- | --- | --- | --- |
| [Streamlabs Intelligent Stream Agent](https://support.streamlabs.com/hc/en-us/articles/41120496794011-How-to-Set-Up-Streamlabs-Intelligent-Stream-Agent) | Gameplay-reactive AI cohost, producer actions, chat summaries, polls, reminders, and alert responses; official setup documentation also states launch limits, interaction quotas, game support, and significant NVIDIA hardware requirements | ChatXPT's possible wedge is lightweight, cross-surface, streamer-approved audience sidequest orchestration rather than an autonomous cohost/producer | Reject generic AI cohost, chat summary, scene switching, and gameplay-coaching positioning |
| [Streamlabs Game Pulse](https://streamlabs.com/content-hub/post/how-to-setup-game-pulse-widget) and [Reactive Overlays](https://streamlabs.com/content-hub/post/how-to-set-up-reactive-overlays-streamlabs) | Gameplay-reactive broadcast visuals across supported games, including current Minecraft examples | ChatXPT must connect audience intent to a deterministic quest and viewer choice, not merely react visually to gameplay | OBS gameplay reactions are not differentiation |
| [StreamElements Chatbot](https://streamelements.com/features/chatbot) | Commands, timers, games, contests, loyalty, queues, filters, and fixed engagement mechanics | ChatXPT can reduce manual formulation/timing for contextual quests if the cue is accurate | Do not build another general chatbot or loyalty suite |
| [Crowd Control](https://crowdcontrol.live/faqs/) | Twitch Extension and web participation that can trigger in-game effects in supported games, including Minecraft interactions | ChatXPT is non-invasive and asks the streamer to accept a safe, game-neutral challenge rather than letting a paid viewer effect mutate game state | Reject direct game control, coins, and per-game effect libraries from the MVP |
| [Tangia](https://www.tangia.co/) | Viewer-triggered TTS, AI personas, memes, generated media, alerts, Extension/web participation, and browser-source output | ChatXPT can be more bounded and context-led, but not broader | Reject a general interactive-effects marketplace |

The closest strategic threat is Streamlabs Intelligent Stream Agent. “AI that watches gameplay, summarises chat, runs polls, and assists the streamer” is already an occupied position. ChatXPT needs executed evidence for the narrower exactly-three, streamer-approved, audience-to-sidequest loop.

## 7. Source-truth matrix

Every visible fact must preserve its source and uncertainty. A single combined “AI confidence” would hide materially different evidence classes.

| Fact or signal | Classification | Permitted source | Required handling | Not permitted |
| --- | --- | --- | --- | --- |
| Session Goal / Current Objective | Declared | Streamer or authorised moderator input | Show author class, update time, and staleness; allow rapid refresh | Treat as permanently true or infer it from chat/video |
| Game phase, health, fight/transition, supported HUD fact | Observed | Current Role 2 extraction capability with confidence and freshness | Show only supported facts; degrade to `unknown`; expire stale observations | Invent unsupported game semantics or motivation |
| Repeated request/topic, energy, ambiguity | Derived | Privacy-safe aggregate of current authorised chat events | Minimum unique participants and qualifying messages; deduplicate spam; preserve time window; invalidate deleted/cleared evidence | Call one message consensus, retain usernames, or build individual viewer histories |
| Current poll, vote, quest, progress, result | Authoritative | Role 1/Role 3 canonical revision and participation service | Use server state and deadlines on every surface | Recalculate winner, reward, timer, or lifecycle in a client |
| Why a viewer left or stayed | Unavailable | None in the present product | State that it is unknown | Attribute churn or retention to a quest |
| Silent viewer intent | Unavailable | None | Do not infer it from lack of chat | Claim audience consensus from chat participants alone |
| Optimal gameplay strategy | Outside product scope | None for the Live Director MVP | Omit | Coach the streamer or present model guesses as game truth |
| Voice narration/transcript | Future-only | Separate, explicitly authorised microphone/transcription capability | Requires privacy, retention, latency, and consent review | Assume it exists or capture microphone content silently |
| Broad game telemetry | Future-only | Game-specific authorised adapter | Keep contracts game-neutral and capability-labelled | Claim universal telemetry from OBS frames |

Gameplay telemetry research shows that gameplay events can correlate with chat-frequency proxies in bounded settings. For example, Melhart and colleagues reported 75–80% average engagement-prediction accuracy from several hundred PUBG matches involving five popular streamers. The study used game telemetry, one title, popular creators, and chat frequency as a proxy; it does not establish game-neutral computer-vision accuracy or true viewer engagement. It supports testing phase-aware timing, not claiming that ChatXPT knows audience experience. [Melhart et al., 2020](https://arxiv.org/abs/2008.07207)

## 8. Private cue delivery decision recommendation

The public OBS Browser Source cannot be treated as a private in-game HUD. OBS documents Browser Source as a web page rendered into a scene, which means viewers see it when the source is present in the program output. [OBS Browser Source](https://obsproject.com/kb/browser-source)

| Option | Visibility while playing | Scope/risk | Recommendation |
| --- | --- | --- | --- |
| Twitch Live Config pop-out on second screen | Good when a second screen or adjacent device is available | Lowest; reuses the accepted Twitch surface | **Keep P0 as the default private cue surface** |
| OBS Custom Dock | Good while OBS is visible; poor for exclusive fullscreen | Low; reuses a web surface and established creator workflow | **Keep P0 as an alternate presentation path**, subject to current integration feasibility |
| Private audio/earcon plus hotkeys | Does not require looking away | Medium; accessibility, accidental activation, broadcast leakage, and sensitive-content risks | **Defer** until visual cue relevance is proven |
| Always-on-top transparent desktop companion | Potentially visible over borderless/windowed games | High; new native runtime, packaging, permissions, capture exclusion, accessibility, OS differences, and game/anti-cheat compatibility | **Reject from MVP**; create a new plan only after evidence shows second-screen/dock delivery fails materially |

This is a recommendation, not an accepted owner decision. It favours the smallest delivery boundary that can test cue value before building a new desktop product.

## 9. Feature-level keep/defer/reject recommendation

| Proposed capability | Recommendation | Evidence-to-value rationale | Kill or reconsider condition |
| --- | --- | --- | --- |
| Session Goal / Current Objective | **Keep P0** | Provides a truthful intent source and stops the system inventing what the streamer is trying to do | Streamers do not maintain it and stale intent causes more errors than it prevents |
| Private source-separated Live Context | **Keep P0, compact** | Makes declared, observed, derived, authoritative, and unknown facts inspectable without a certainty mash-up | It becomes a passive dashboard or materially increases glances/interruptions |
| Narrow Chat Pointer | **Keep P0 as cue evidence only** | Studies document missed chat and moderator flagging; Twitch already solves raw chat display | It acts like a chat summary/window, surfaces mostly single-user/noisy requests, or encourages user profiling |
| One Director Cue | **Keep P0; core new wedge** | Directly compresses audience interpretation, phase timing, and interaction formulation into one decision | Less than 80% of cues are judged timely/safe in the initial annotated evaluation, or handling them costs as much as manual operation |
| Exactly-three sidequest conversion | **Keep P0; existing flagship** | Creates a bounded, understandable interaction and reuses the deterministic safety/lifecycle pipeline | Never bypass streamer control or Role 3 authority; exact-three validation remains mandatory |
| Extension Vote / Active / Result | **Keep P0** | Gives a viewer a complete participation arc and private receipt/recovery that OBS cannot provide | Personal states drift from authority or non-vote states provide no usable information |
| Extension Catch-up | **Defer to P1 experiment** | Direct research supports testing rapid context, but game understanding did not significantly improve in CatchLive's small deployment | It fails the comprehension uplift gate, distracts, or duplicates OBS/current narration |
| OBS vote/winner/active/progress/result | **Keep P0; already aligned** | Supplies universal shared awareness and payoff without requiring Extension use | It blocks gameplay, leaks private data, or grows into a second full interface |
| Additional OBS “material context” summary | **Defer** | Public context may help, but OBS has a strict distraction budget and Catch-up evidence is mixed | Only add one short field if a task test shows it improves understanding without obstruction |
| Intervention-specific Session Brief | **Defer to P1 experiment** | Twitch already has broad analytics; the only distinct value is explaining ChatXPT's own intervention and evidence limits | It repeats native metrics, implies causality, or produces no actionable/reliability insight |
| Carry-forward coaching suggestion | **Reject from current plan** | No reviewed source shows that a generated next-stream recommendation is necessary to close the core interaction loop | Reconsider only after Session Brief evidence identifies a repeated, bounded action users request |
| Live Config pop-out / OBS Dock private cue | **Keep P0 delivery** | Reuses current surfaces and tests cue value at low implementation risk | If target users demonstrably cannot see either path, revisit audio before native overlay |
| Private audio/earcon/hotkeys | **Defer** | May reduce visual attention but creates safety/accessibility/leakage work | Test only after cue precision and visual delivery value pass |
| Always-on-top desktop overlay | **Reject from MVP** | The attention need is plausible, but a new native runtime is disproportionate before cue value is known | Requires separate owner decision and technical plan |
| Generic gameplay explanator/coach | **Reject** | Broad, error-prone, weakly tied to audience orchestration, and already occupied by AI-assistant products | None inside this expansion |
| Full chat summary or ordinary chat panel | **Reject** | Twitch Chat & Events and Streamlabs already provide it | Chat Pointer remains a bounded, expiring aggregate only |
| Generic AI cohost/producer/reactive overlay | **Reject** | Existing tools already offer the position more broadly | None inside this expansion |
| Generic growth/retention analytics | **Reject** | Twitch already provides extensive analytics and causal retention is unavailable | Session Brief may report only intervention records and limitations |
| Full catch-up timeline/highlights | **Reject** | It duplicates established research/product territory and broadens extraction/storage substantially | None inside this expansion |
| Viewer-paid direct game control | **Reject** | Crowd Control and similar tools already specialise here; it adds game integrations, monetisation, and safety risk | None inside the game-neutral, non-wagering MVP |

The retained P0 is one coherent product loop. The deferred features are experiments around that loop, not additional pillars.

## 10. Quantitative success and falsification matrix

The thresholds below are **initial internal product gates**, not effects reported by the literature. They exist to make the team capable of rejecting weak features. They must be measured against the same scripted scenarios and source revision, with failure cases retained.

| Claim under test | Measure and initial gate | Baseline | Failure interpretation |
| --- | --- | --- | --- |
| The system stays truthful | 100% of unsupported or stale facts render as `unknown`; 0 raw usernames/private receipts/provider payloads in public projections | Current source-classification fixtures and manual field audit | Any critical fabrication or privacy leak blocks the pass |
| Chat Pointer represents more than one loud viewer | 100% of pointers disclose unique participants, qualifying messages, and time window; spam/deleted-message cases never appear as durable consensus | Raw chat feed or naive message count | Missing evidence or single-user “consensus” rejects the pointer design |
| Director Cues are usable | On a predeclared annotated scenario set, at least 80% of surfaced cues are rated timely, source-supported, safe, and actionable; no unsafe cue reaches viewers | Manual chat monitoring and no-cue baseline | Below the gate, narrow triggers or reject automatic cue surfacing |
| The system respects attention phase | At least 90% of annotated high-focus intervals produce no visible cue interruption; every exception is reviewed as a failure | Phase-unaware cue rule | Repeated high-focus interruptions reject phase-aware value |
| Cue-to-vote reduces operation burden | Median streamer actions and elapsed active-attention time from eligible moment to opened vote are at least 30% lower than a manual Twitch poll/contest workflow in the same scenarios | Current manual native/tool workflow | If there is no reduction, ChatXPT is rearranging primitives rather than adding value |
| Exactly-three authority remains intact | 100% of viewer-visible vote openings contain exactly three Role 3-validated candidates under normal, provider-failure, ambiguity, and reconnect cases | Existing contract suite | Any bypass is a release blocker |
| Catch-up adds comprehension | In a controlled task, Catch-up improves correct identification of current goal/phase/quest by at least 15 percentage points over OBS-only, reaches at least 80% absolute correctness, and does not slow vote completion by more than 10% | OBS plus Vote without Catch-up | Missed uplift, distraction, or slower participation rejects Catch-up from P1 |
| Extension adds value beyond voting | At least 80% task completion for receipt/reconnect and active/result comprehension; telemetry shows use outside the Vote state in the evaluation | Basic vote-only Extension | If only voting is used or understood, collapse the extra states |
| OBS remains glanceable | At least 90% correct identification of vote/winner/active/result within five seconds across target resolutions; 0 critical HUD collision or private-field leak | Extension-only and current overlay | Obstruction or dense duplication rejects added context |
| Session Brief is distinct from Twitch Analytics | 100% of retained records link source class, cue/action, participation, quest outcome, and limitation to one authoritative intervention; 0 causal retention claims | Twitch Stream Summary and no ChatXPT brief | If more than half of visible information is unlinked generic native metrics, reject the brief |
| Reliability is product value | Same session/cycle revision across Studio/Live Config, two viewers, persistence, and OBS in 100% of evaluation runs; explicit recovery or unavailable state on failure | Existing integration ladder | State drift invalidates the claimed closed loop |

These gates do not estimate business lift. Average concurrent viewers, followers, subscriptions, revenue, and retention must remain observational until a suitably designed longitudinal evaluation exists.

## 11. Qualitative evaluation matrix

Secondary research can justify what to test, but it cannot establish that the prototype feels valuable. The following review questions should accompany executed scenario evidence and any later usability access without requiring interview-derived market claims.

| Dimension | Evaluation question | Evidence to retain | Reject/narrow signal |
| --- | --- | --- | --- |
| Attention cost | Did the cue remove interpretation work, or did it create another item to monitor? | Screen recording, action count, cue timing against game phase, evaluator rationale | Repeated unnecessary glances or missed gameplay |
| Agency | Was it always clear that the streamer could acknowledge, postpone, dismiss, or convert without automatic public action? | Action-path walkthrough and command audit | Any feeling or behaviour of forced activation |
| Relevance | Could the evaluator explain why the cue appeared using the displayed source evidence? | Cue/evidence pairs including sparse, conflicting, sarcastic, and stale cases | Rationale depends on hidden model reasoning |
| Community fit | Did aggregation preserve personal conversation in sparse chat and moderator judgement in busy chat? | Operating-mode scenario review | Tool talks over small communities or claims to replace moderators |
| Viewer meaning | Did the viewer understand what they were choosing and what happened afterward? | Catch-up/Vote/Active/Result task answers | Vote is understandable but the rest feels like decoration |
| Trust | Were declared, observed, derived, authoritative, and unknown states distinguishable? | Field-level comprehension and failure-state review | Users cannot tell fact from inference |
| Broadcast restraint | Did OBS add a shared headline without becoming a dashboard or blocking the game? | Resolution/safe-area captures and five-second identification task | Details belong in Extension or Studio instead |
| Reflection value | Did the brief explain a ChatXPT intervention that Twitch's native summary does not? | Side-by-side information audit | Generic advice or causal growth language |

## 12. Product language

### Recommended problem statement

Solo and lightly supported game streamers must decide when and how to turn live audience activity into meaningful participation while their attention is already committed to gameplay. Existing tools show chat and offer polls, rewards, analytics, and reactive effects, but leave the creator to connect the current game moment, audience intent, safety boundaries, interaction setup, and broadcast follow-through.

### Recommended solution statement

ChatXPT turns a suitable gameplay moment and privacy-safe audience signal into one private streamer cue. With streamer approval, it creates exactly three validated sidequests, lets viewers choose inside Twitch, shows the authoritative quest publicly through OBS, and records what the intervention actually did without claiming unsupported retention effects.

### One-line positioning

**ChatXPT is the streamer-controlled sidequest loop between live audience intent and gameplay—not another chat window, AI cohost, or analytics dashboard.**

### Claims to avoid

- “Proven to increase engagement or retention.”
- “Understands every game.”
- “Knows what viewers want.”
- “Replaces moderators.”
- “Automatically coaches streamers to grow.”
- “The first AI gameplay-aware streaming assistant.”

## 13. Limitations and unresolved proof

- The strongest audience-management studies are qualitative or use older Twitch data. Platform norms and tools have changed.
- The reviewed samples do not isolate the exact solo, bursty/rising segment proposed here.
- Vendor engagement statistics do not disclose enough method to become ChatXPT performance targets.
- CatchLive is a small deployment and found mixed results for game-stream understanding.
- Gameplay-engagement prediction evidence is title-specific, telemetry-based, and often involves popular streamers.
- Current competitor capability is documented, but comparative usability and total operation effort have not been executed side by side.
- Secondary research cannot prove willingness to install, setup tolerance, perceived cue quality, or sustained use.
- No retention, revenue, growth, or causal engagement result exists for ChatXPT.
- The private cue recommendation assumes a second screen, pop-out, or visible OBS workflow for the first test. Exclusive-fullscreen visibility remains limited without a new channel.
- The differentiator is a workflow composition and can be copied. Reliability, trust, restraint, and execution are therefore part of product value rather than implementation details.

## 14. Source ledger

| Source | Method/capability | Supports | Does not support | Evidence grade |
| --- | --- | --- | --- | --- |
| [Wohn & Freeman, Audience Management Practices, 2020](https://guof.people.clemson.edu/papers/imx20.pdf) | 25 semi-structured streamer interviews over four months | Attention trade-offs, missed chat, moderator assistance, audience-management cost | Prevalence across all streamers or 2026 tool fit | Strong for mechanism; moderate for market prevalence |
| [Flores-Saviaga et al., Participation at Scale, 2019](https://arxiv.org/pdf/2012.00215) | 2017 dataset of 226,658 streams, 12.15M messages, 651,664 chatters, plus 45 hours of video | Different operating modes, bots/moderators, numbered choices, game-phase interaction timing | Modern size taxonomy or causality | Moderate |
| [Hamilton et al., Streaming on Twitch, 2014](https://ecologylab.net/research/publications/streamingOnTwitch.pdf) | Multi-year ethnography plus 11 streamer and four viewer interviews | Split attention, community participation, moderator role | Current platform capability | Moderate |
| [CatchLive, CHI 2022](https://catchlive.kixlab.org/) | Real-time summarisation deployment across three streams and 67 viewers | Testable late-join/context need and distraction risk | Proven game understanding or ChatXPT feature fit | Moderate |
| [Sjöblom & Hamari, 2017](https://www.utupub.fi/server/api/core/bitstreams/e4a966b0-1fc6-44a8-8924-4dedf232babe/content) | Questionnaire of 1,097 game-stream viewers | Information and social motivations | Feature-level causality | Moderate |
| [Melhart et al., 2020](https://arxiv.org/abs/2008.07207) | PUBG telemetry and chat-frequency engagement proxy across several hundred matches/five popular streamers | Bounded feasibility of phase-aware signals | Game-neutral vision accuracy or true engagement understanding | Moderate-to-weak for ChatXPT generalisation |
| [Twitch Creator Camp: Engaging Viewers](https://www.twitch.tv/creatorcamp/en/level1/establish-your-brand/engaging-viewers/) | Current first-party guidance and vendor metrics | Twitch's emphasis on participation primitives | Independent causal lift or ChatXPT targets | Weak for impact; strong for current guidance |
| [Twitch Chat & Events](https://help.twitch.tv/s/article/creator-chat-and-events?language=en_US) | Current first-party product documentation | Native combined chat/events capability | Remaining gap's value | Strong for capability |
| [Twitch Analytics](https://help.twitch.tv/s/article/channel-analytics?language=en_US) | Current first-party product documentation | Native analytics breadth | Need for ChatXPT-specific reflection | Strong for capability |
| [Twitch Extensions](https://dev.twitch.tv/docs/extensions/) | Current developer documentation | Delivery surfaces and identity/capability constraints | Product differentiation | Strong for capability |
| [Streamlabs Intelligent Stream Agent](https://support.streamlabs.com/hc/en-us/articles/41120496794011-How-to-Set-Up-Streamlabs-Intelligent-Stream-Agent) | Current official setup/capability documentation | Direct strategic overlap and current constraints | Comparative user preference | Strong for capability |
| [StreamElements Chatbot](https://streamelements.com/features/chatbot) | Current official product page | Existing general engagement toolkit | Comparative operation effort | Strong for capability |
| [Crowd Control](https://crowdcontrol.live/faqs/) | Current official FAQ | Existing viewer-to-game interaction category | Relative safety/value | Strong for capability |
| [Tangia](https://www.tangia.co/) | Current official product page | Existing interactive effects and participation breadth | Comparative value | Strong for capability |
| [OBS Browser Source](https://obsproject.com/kb/browser-source) | Current official capability documentation | Browser Source is a broadcast-scene input, not a private in-game HUD | Exact user setup/preference | Strong for capability |

## 15. Owner decision required before implementation activation

The research recommends the following activation package:

```text
P0 keep
- Session Goal / Current Objective
- compact source-separated private Live Context
- narrow, expiring Chat Pointer as cue evidence
- one phase-aware Director Cue
- existing exactly-three validated sidequest conversion
- Extension Vote / Active / Result with private receipt and recovery
- existing compressed OBS vote / winner / active / progress / result projection
- Live Config pop-out or OBS Dock private delivery

P1 evidence experiments
- minimal Extension Catch-up Card
- intervention-specific Session Brief

defer
- private audio / earcon / hotkeys
- extra public OBS context

reject from this expansion
- carry-forward AI coaching
- always-on-top desktop companion
- gameplay explanator / strategy coach
- full chat summary or ordinary chat panel
- generic AI cohost / producer / reactive overlay
- generic growth analytics
- full catch-up timeline / highlights
- viewer-paid direct game control
```

No implementation pass becomes active until the project owner accepts or modifies this package. After acceptance, `LD-P00` must copy the settled scope and the internal evaluation gates into `docs/build-plans/LIVE-DIRECTOR-IMPLEMENTATION-PLAN.md`, remove rejected passes, and update the affected role queues before source work starts.
