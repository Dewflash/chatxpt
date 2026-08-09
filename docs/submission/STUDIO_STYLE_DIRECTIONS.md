# ChatXPT Studio style directions

Status: working options for the final visual pass. Product scope stays Twitch-first with local OBS overlay, viewer Extension, credential-free generation, and deterministic quest validation.

## Recommended: Broadcast control room

Best fit for the current demo. It makes ChatXPT feel like OBS plus producer tools, not a generic AI dashboard.

- Palette: near-black graphite, cool grey panels, white text, signal green for ready, amber for waiting, red for fault, small Twitch purple accents.
- Layout: dense status strips, clear action cockpit, compact cards, table-like analytics, fewer glowing gradients.
- Components: grouped system status, generator stack, automation controls, overlay preview, live chat, and game signals as operational modules.
- Motion: subtle hover and status changes only.
- Why: easiest to explain in the 5-minute video because every visual element reads as live production infrastructure.

## Alternative: Esports tactical HUD

Sharper and more game-native, but easier to overdo.

- Palette: charcoal, off-white, signal green, cyan, warning orange.
- Layout: segmented panels with crisp dividers, phase/map-style labels, high-contrast vote states.
- Components: game signals and quest choices get stronger emphasis than setup/settings.
- Why: works if the team wants the app to feel closer to a competitive match overlay.

## Alternative: Creator studio

Friendlier and less intense, but slightly less demo-dramatic.

- Palette: ink, warm white, restrained Twitch purple, mint ready states, red/orange alerts.
- Layout: calmer panels, bigger labels, softer surfaces, clearer setup guidance.
- Components: streamer preferences and automation settings become the hero; analytics are secondary.
- Why: better for streamers who want setup confidence more than a command-center feel.

## Current implementation bias

The app is now moving toward Broadcast control room:

- Status is grouped by Game, Chat, Quest, Broadcast, Analytics, and Voting.
- The four large recording controls are labelled as the Action cockpit.
- Studio separates Current read, Streamer preference, Engine stack, and Automation.
- Game support is shown through a streamer-selected game category plus a current game field.
- The engine story is visible: no external provider for judged MVP, algorithmic candidates, deterministic validation/replacement, safe library fallback.

## Final CSS pass checklist

- Reduce purple gradients and background glow.
- Make ready/waiting/error colours semantic, not decorative.
- Keep cards at small radii and avoid nested-card visuals.
- Use compact columns for analytics and game signals.
- Make the primary action cockpit visually different from passive status.
- Keep overlay and viewer surfaces readable on top of gameplay.

## Research notes used

- [Vercel v0 prompting documentation](https://v0.dev/docs) frames good UI generation around concrete product context, target surface, constraints, and iteration rather than vague restyling; that supports writing a specific Broadcast control room style spec before the final CSS pass.
- [Vercel v0](https://v0.dev/) is strongest when prompts describe the exact app type and expected components; that supports naming operational modules like status, action cockpit, engine stack, automation, analytics, and overlay preview instead of asking for a generic AI dashboard.
- [Apple Human Interface Guidelines: Layout](https://developer.apple.com/design/human-interface-guidelines/layout) emphasise visual hierarchy, alignment, and distinguishing controls from content; that supports the grouped status bars plus separate Action cockpit.
- [Apple Human Interface Guidelines: Color](https://developer.apple.com/design/human-interface-guidelines/color) warns against using the same colour for different meanings and recommends reserving colour for status and primary actions; that supports signal green/amber/red plus fewer decorative purple glows.
- [Refactoring UI: Building your color palette](https://www.refactoringui.com/previews/building-your-color-palette) recommends building mostly from greys, one or two primary colours, and sparse semantic accents; that supports the Broadcast control room direction.
