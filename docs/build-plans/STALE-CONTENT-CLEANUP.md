# Stale Content Cleanup Register

**Status:** Markdown guidance cleanup started; source-route cleanup still pending.
**Created:** 22 August 2026.
**Owner:** Role 1 deconflicts; any contributor may implement under D-071/D-076.

## Why This Exists

The app now needs one demo story and one state authority:

```text
npm run dev
-> Studio starts
-> Twitch OAuth/session is verified
-> OBS Game Capture / Virtual Camera feeds gameplay
-> Studio starts the ChatXPT session
-> viewer participation uses Twitch Extension, hosted board fallback, or Twitch chat 1/2/3 fallback
-> /obs-overlay renders the broadcast state
-> Studio and overlay read the same authoritative session/cycle revision
```

Anything that still presents the old local prototype, old dates, old route names, or disconnected diagnostic behaviour as the product path must be deleted, rewritten, or clearly labelled diagnostic-only.

## Cleanup Rule

- **Delete** markdown or source files only when they are no longer referenced and are not needed as historical evidence.
- **Rewrite** authoritative markdown when only a section is stale.
- **Relabel and isolate** legacy routes that are still useful for diagnostics, but do not let them look like the product flow.
- **Do not remove** fixture or evidence artifacts just because they are old; remove them only if they are misleading, duplicate, or no longer referenced by the evidence manifest.

## Markdown That Must Be Cleaned

| File | Current stale content | Required cleanup |
| --- | --- | --- |
| `docs/build-plans/README.md` | The five-day delivery calendar listed 3-9 August deadlines as live planning text. | Cleaned: replaced with current cleanup/completion focus. |
| `docs/TEAM_CONTEXT.md` | It said the Drive submission deadline was upcoming and included the old 6 August Twitch Extension fallback trigger as pending. | Cleaned: rewritten as current post-deadline handoff with truthful Extension/hosted/chat fallback status. |
| `docs/build-plans/ROLE-4-5-DELIVERY-MATRIX.md` | OBS browser overlay mount said `/overlay`; the dated delivery table read like active guidance. | Cleaned: `/obs-overlay` is canonical and old dates are replaced with current coordination checkpoints. |
| `docs/build-plans/INTEGRATED-PRODUCT-COMPLETION-PLAN.md` | It said `/` redirects to `/studio` only after canonical parity, but the app already redirects `/` to `/studio`. | Cleaned: updated to current route reality and diagnostic-only legacy wording. |
| `README.md` | The runnable-path table foregrounded `/api/sidequests`, `/api/overlay-state`, `src/lib/openai-engine.ts`, and `src/lib/mock-engine.ts` as current local behaviour. It also said the submitted judged path remained credential-free and algorithmic, which needed to be worded as mandatory fallback rather than the only approved path. | Cleaned: rewritten around canonical orchestration, `/obs-overlay`, Role 3 validation, optional approved provider path, and mandatory algorithmic fallback. |
| `src/streamer/README.md` | It foregrounded the older setup shell and said readiness/commands were not provided by the module, while Studio now has broader product pages and command wiring. | Cleaned: rewritten around current Studio product surfaces and the single source of truth for state/commands. |
| `docs/build-plans/ROLE-4-BUILD-PLAN.md` and `docs/build-plans/ROLE-5-BUILD-PLAN.md` | Old phase dates used `Deadline`, `Functional exit`, `Evidence exit`, and `Cutoff` labels. | Cleaned: converted old labels to historical targets while preserving the plan phases. |
| `docs/PROJECT_TODO.md` | The finalist Drive deadline entry was phrased like an active upcoming gate. | Cleaned: marked as historical context. |

## Source Routes And Components To Clean After Feature Parity

| Target | Current status | Required cleanup |
| --- | --- | --- |
| `src/app/overlay/page.tsx` | Legacy overlay route is still mounted. | Keep only as `/diagnostics/...` or remove after `/obs-overlay` is proven in the demo flow. Do not leave `/overlay` documented as product UI. |
| `src/app/api/sidequests/route.ts` | Legacy local generation API is still mounted. | Remove or move behind diagnostics after canonical Role 2/Role 3 generation is the only product path. |
| `src/app/api/demo-participation/route.ts` | Demo participation API is still mounted. | Remove or relabel diagnostic-only after hosted board, Extension, and chat fallback use canonical participation service. |
| `src/app/api/overlay-state/route.ts` | Legacy same-origin overlay state API is still mounted. | Remove after `/api/obs/overlay/state` and `/obs-overlay` cover the browser-source path. |
| `src/app/streamer-authorized-client.tsx` default branch | Still falls back to `StudioManagementSurface` and setup overlay wiring. | After product page parity, route default surfaces through the canonical Studio shell and demote old management surface to diagnostic-only or remove it. |
| `src/streamer/studio-setup-shell.tsx` and old management copy | Contains wording about not being connected to the full workflow. | Delete, rewrite, or move to diagnostics once canonical Studio is the only demo entry. |

## Things Not To Delete Yet

- `docs/evidence/**` fixture images, hashes, and manifests: old evidence is useful if clearly labelled fixture-only.
- `docs/architecture/LEGACY-MIGRATION-INVENTORY.md`: keep until the legacy routes above are either removed or explicitly moved to diagnostics.
- `docs/DECISIONS.md`: do not delete superseded decisions; they are authority history. Add new decisions instead of erasing history.
- Chat `1`/`2`/`3` fallback code and tests: this is part of the required final fallback, not stale.

## Suggested Cleanup Order

1. Rewrite the stale markdown first so the team stops following old routes and dates.
2. Move or delete legacy mounted routes only after verifying `/studio`, viewer paths, Twitch chat fallback, and `/obs-overlay` still pass focused tests.
3. Remove leftover legacy source files only when no route, README, or test imports them.
4. Run `npm run check:hygiene`, the focused route tests, and `npm run check` before landing the cleanup.

## Acceptance Evidence

- `rg '/overlay|/api/sidequests|/api/overlay-state|demo-participation|src/lib/mock-engine|src/lib/openai-engine|3 Aug|4 Aug|5 Aug|6 Aug|7 Aug|8 Aug|9 Aug' docs README.md src` returns only diagnostic, historical, cleanup-register, or decision-history references.
- `/obs-overlay` remains the only documented product OBS browser-source route.
- The app still preserves Twitch Extension primary voting, hosted Quest Board fallback, and Twitch chat `1`/`2`/`3` fallback.
- Markdown that cannot be made current is deleted rather than archived in-place as active guidance.
