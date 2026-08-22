# Private Live Director desktop companion, pop-out, and OBS Dock

The private Live Director uses one permanent broadcaster link across three private delivery choices. Its state projection remains server-authored. D-095 permits quest generation and the same mode-appropriate proposed-cycle action as Studio; D-096 additionally permits cancellation and completion of the currently active quest when authority exposes those actions.

1. **Desktop companion (recommended):** a small always-on-top app above windowed gameplay.
2. **Browser pop-out:** `/studio/live-director?display=popout` in an ordinary browser window.
3. **OBS Custom Browser Dock:** the same private URL inside OBS while OBS is visible.

None of these is the public `/obs-overlay` Browser Source. The private surface may show streamer-only state and the current recommendations; the public overlay remains read-only broadcast output and structurally receives no private state. The private client never selects a winner or owns vote, lifecycle, reward, or persistence logic. Role 3 decides whether an authorised proposed-cycle command opens Automatic viewer voting or directly activates a Manual selection, and whether an active quest may be cancelled or marked complete.

## Desktop companion setup

### Local development

1. Start ChatXPT with `npm run dev:twitch`.
2. In another terminal, run `npm run desktop:live-director`.
3. Open Studio, connect the broadcaster, and create the permanent private Live Director link.
4. Copy the private link and paste it into the source companion once.
5. Position and resize the window above the game. The companion remembers its bounds and reconnects the same broadcaster on later launches.

The source command is for renderer and Electron development only. On macOS it deliberately does not register `chatxpt://`, because LaunchServices cannot relaunch the generic development `Electron.app` with the source entry file. Automatic capture-time opening must be tested with the packaged app below. If an older source build had claimed the scheme, the next source launch removes only that development association so macOS can restore the packaged companion.

After this one-time link, **Profile & Defaults → Desktop Director** controls capture-time launch behaviour. **Automatic setup** is the default: after Gameplay Engine successfully connects the selected screen/window or OBS Virtual Camera feed, Studio asks macOS to open the installed companion. **Manual setup** leaves the companion closed until the streamer opens it directly. The capture page sends only the token-free `chatxpt://open` action; the companion unlocks its previously encrypted broadcaster grant locally. If it has not been linked yet, it opens the trusted setup screen instead.

### Packaged macOS app

1. Run `npm run desktop:package:mac`.
2. Open `dist/live-director/ChatXPT Live Director.app` once so macOS registers the packaged companion for `chatxpt://`; optionally move it to Applications first.
3. Link it once from Studio as above.
4. Enable **Open when I sign in** if desired.

The repository package is ad-hoc signed for local use. A public download still requires a real Apple Developer ID signature, notarisation, release hosting, and corresponding evidence.

## Window controls

- **Always on top** is enabled by default, so windowed Minecraft cannot cover the companion when Minecraft receives focus.
- `Command/Ctrl + Shift + L` toggles click-through. When enabled, mouse input passes through the companion into the game.
- `Command/Ctrl + Shift + H` hides or restores the companion.
- The **Window** application menu provides the same controls, opacity choices, relinking, and Studio access.
- The window position, size, opacity, always-on-top, workspace, and launch-at-login preferences persist. Click-through deliberately starts disabled after a restart so the window cannot become difficult to recover.
- A browser or macOS may show its normal confirmation before opening the `chatxpt://` application protocol. This confirmation is outside ChatXPT and does not expose the private broadcaster grant.

The permanent private link is encrypted through Electron `safeStorage` before it reaches disk. On macOS this uses Keychain-backed operating-system encryption. If secure storage is unavailable, the grant remains memory-only and must be linked again after closing the app. The app never logs the private link.

When no proposal is ready, **Generate quests** emits the canonical deterministic quest-generation command and produces exactly three validated recommendations. When recommendations are ready, the available action follows the effective profile mode:

- `Automatic`: there is no candidate selector. **Push quests now** sends the complete three-option batch to the authoritative viewer vote; viewers choose and the winner activates automatically.
- `Manual`: the streamer selects one current recommendation. **Start selected quest** activates that quest directly; no viewer vote, voting countdown, or tally is created.

While a quest is active, the companion shows only the terminal actions currently supplied by authority:

- **Cancel quest** opens an explicit confirmation before sending the canonical cancellation command.
- **Mark complete** immediately sends the canonical success command, matching Studio's non-destructive success behaviour.

The permanent grant cannot issue fail, skip, pause, progress, winner, viewer-vote, profile, session, or persistence commands.

The server re-resolves the broadcaster's current session and effective profile, validates the current quest cycle, optional candidate, allowed action, and command identity, then lets the canonical quest engine decide the transition. Retries are idempotent. The grant cannot issue other Studio commands and the public OBS token cannot use this endpoint.

## OBS privacy

The desktop companion is independent of OBS. Use OBS Game Capture or a deliberately cropped Window Capture when it must remain private. OBS Display Capture may include any visible desktop window, including the Live Director; ChatXPT does not claim that the operating system can universally hide it from capture.

## Browser pop-out

1. Open `/studio` and start or reopen the broadcaster session.
2. In Studio or Twitch Live Config, choose **Open private Live Director**.
3. Keep the pop-out on the streamer's private monitor and outside captured desktop regions.

## OBS Custom Browser Dock fallback

1. In OBS, open **Docks → Custom Browser Docks**.
2. Paste the permanent private Live Director URL generated by Studio.
3. Confirm the dock shows the correct broadcaster/session state.
4. Keep the dock out of the OBS scene and recording crop. A Custom Dock is private control UI; a Browser Source added to a scene is public broadcast output.

Do not paste private URLs, Studio cookies, setup keys, Twitch JWTs, or private surface contents into screenshots, issue comments, or evidence artifacts. If a permanent private URL is exposed, rotate the server overlay secret and generate a replacement.

## Verification boundary

Automated tests verify URL validation, deep-link parsing, packaged-only protocol registration, redaction, preference bounds, the authorised server projection, scoped quest generation, Automatic batch push, Manual direct activation, active cancellation/completion, disallowed-action rejection, idempotent retry, public-token denial, and the same authoritative revision in Studio. The source and packaged Electron smoke runs verify real macOS window creation, always-on-top, click-through toggling, hide/show, secure-storage availability, and that source Electron cannot retain the packaged protocol association. Native LaunchServices inspection and a real `chatxpt://open` exercise verify that macOS targets `com.chatxpt.live-director`, not generic `com.github.electron`. They do not prove owner broadcaster linking, Twitch-issued identity, Supabase Cloud realtime, real gameplay extraction, Apple notarisation, Windows packaging, or exclusion from OBS Display Capture.
