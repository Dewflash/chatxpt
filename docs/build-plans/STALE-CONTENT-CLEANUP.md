# Stale Content Cleanup Register

**Status:** Pending cleanup pass.
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
| `docs/build-plans/README.md` | The five-day delivery calendar still lists 3-9 August deadlines as live planning text. | Remove the calendar or replace it with current post-finalist integration guidance. Keep the integration-wave principles if still useful. |
| `docs/TEAM_CONTEXT.md` | It still says the Drive submission deadline is 21 August 2026 and includes the old 6 August Twitch Extension fallback trigger as if it were still pending. | Rewrite as current handoff state: deadline passed, implementation/evidence continues, Extension readiness must be reported truthfully, hosted board and Twitch chat fallback remain required. |
| `docs/build-plans/ROLE-4-5-DELIVERY-MATRIX.md` | OBS browser overlay mount says `/overlay`; current canonical broadcast surface is `/obs-overlay`. | Update to `/obs-overlay`, or delete the matrix if the current Role 4/5 plans fully supersede it. |
| `docs/build-plans/INTEGRATED-PRODUCT-COMPLETION-PLAN.md` | It says `/` redirects to `/studio` only after canonical parity, but the current app route already redirects `/` to `/studio`. | Rewrite the fixed decision and any phase notes that describe `/` as still legacy. |
| `README.md` | The runnable-path table still foregrounds `/api/sidequests`, `/api/overlay-state`, `src/lib/openai-engine.ts`, and `src/lib/mock-engine.ts` as current local behaviour. It also says the submitted judged path remains credential-free and algorithmic, which now needs to be worded as mandatory fallback rather than the only approved path. | Rewrite around the canonical orchestrator, `src/ai/server.ts`, Role 3 validation, `/obs-overlay`, and mandatory algorithmic fallback. Move legacy API/file mentions to diagnostic-only or remove them once source cleanup lands. |
| `src/streamer/README.md` | It still foregrounds the older setup shell and says readiness/commands are not provided by the module, while Studio now has broader product pages and command wiring. | Rewrite after the Studio product surface settles, or delete if it duplicates the route/module docs. |

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

- `rg '/overlay|/api/sidequests|/api/overlay-state|demo-participation|src/lib/mock-engine|src/lib/openai-engine|3 Aug|4 Aug|5 Aug|6 Aug|7 Aug|8 Aug|9 Aug' docs README.md src` returns only diagnostic, historical, or decision-history references.
- `/obs-overlay` remains the only documented product OBS browser-source route.
- The app still preserves Twitch Extension primary voting, hosted Quest Board fallback, and Twitch chat `1`/`2`/`3` fallback.
- Markdown that cannot be made current is deleted rather than archived in-place as active guidance.
