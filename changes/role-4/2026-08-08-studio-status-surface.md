# Role 4 Studio status surface

- Added a Role 4-owned `StudioStatusSurface` that consumes the canonical `StreamerViewModel` and shared design system.
- The surface lists integration health per service, summarises gameplay/audience evidence without relabelling fixtures as live, renders authoritative quest options/actions, and highlights emergency pause.
- Added fixture-only server-render tests covering loading, service health, evidence labelling, three-option quest display, and emergency pause.

This does not add route mounting, persistence, Twitch/OBS/Supabase/Vercel integration, screenshots, or real setup-to-live evidence.
