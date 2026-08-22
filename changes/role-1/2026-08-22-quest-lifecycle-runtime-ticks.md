# Advance live quest cooldowns in the server runtime

- **Type:** Fixed
- **Role:** Role 1
- **Issue/PR:** `codex/fix-quest-lifecycle-ticks`
- **Summary:** Studio, Twitch Extension, hosted-board, and OBS reads now issue the canonical `system.quest-tick` command when an active quest deadline or cooldown is due, so a completed live cycle cannot remain permanently terminal.
- **Integration impact:** The shared server runtime owns bounded stale-revision retry, deterministic command identity, neutral public projection context, persistence, and broadcast; Role 3 remains the sole authority for expiry, cooldown, and return to idle.
- **Verification:** A real local-hosted Twitch/OBS/Minecraft run reached calibrated HUD extraction, aggregate Twitch chat, exactly three deterministic fallback quests, one hosted vote, winner activation, Studio success, viewer reward, and the real OBS/Twitch overlay. That run exposed the missing runtime tick after the accepted 120-second cooldown. Focused server/viewer tests pass 5 files / 24 tests, the added delayed-terminal test proves the persisted cycle reaches idle, and `npm run check` passes 108 files / 847 tests plus the production build and client-secret scan.
- **Reality status:** The pre-fix cycle reproduced the terminal-state defect with real inputs. The repair is automated and production-build verified; a second post-fix real Twitch cycle, Twitch-issued Extension vote, OpenAI provider call from this laptop, Supabase Cloud, and Vercel deployment are not claimed.
