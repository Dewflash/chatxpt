# Private Live Director pop-out and OBS Custom Dock

The private Live Director surface is `/studio/live-director?display=popout`. It shows the same compact, broadcaster-authorised state and controls as Twitch Live Config.

It is not the public `/obs-overlay` Browser Source:

- the private surface can show Session Goal, Current Objective, source-separated Live Context, private cue reasoning, and streamer commands;
- the public overlay remains read-only broadcast output and structurally receives no private Live Director state;
- loading the private URL without the current 12-hour HttpOnly Studio grant yields no session state or controls;
- production use requires HTTPS. Local development may use `localhost`.

## Browser pop-out

1. Open `/studio` and start or reopen the broadcaster session.
2. In Studio or Twitch Live Config, choose **Open private Live Director**.
3. Keep the pop-out on the streamer's private monitor. Do not capture it as a scene source.
4. If the grant expires, reopen Studio and authorise the broadcaster session again.

## OBS Custom Browser Dock

1. In OBS, open **Docks → Custom Browser Docks**.
2. If this OBS browser profile has not been authorised, temporarily point the dock to `/studio`, start or reopen the broadcaster session with the server-only Studio setup key, and wait for Studio to load. The key is sent only to the local/HTTPS server and is not stored in browser storage.
3. Change the dock URL to `/studio/live-director?display=dock` on the same ChatXPT origin.
4. Confirm the dock shows **Private**, the correct streamer/session revision, and the source-separated context.
5. Keep the dock out of the OBS scene and recording crop. A Custom Dock is private control UI; a Browser Source added to a scene is public broadcast output.

Do not paste Studio cookies, setup keys, Twitch JWTs, or private surface contents into screenshots, issue comments, evidence artifacts, or the public overlay URL. The dock is useful while OBS is visible; it is not an always-on-top in-game HUD and is not guaranteed to remain visible over exclusive fullscreen gameplay.

## Verification boundary

Component tests and local fixture screenshots prove layout, state labels, command construction, and the fail-closed unauthorised view. They do not prove Twitch-issued identity, a real OBS dock session, Supabase Cloud realtime, or real gameplay extraction. Record those claims only after the corresponding real run is entered in `docs/evidence/manifest.json`.
