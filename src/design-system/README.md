# Design-system public entrypoint

Role 4 owns this shared visual system. Streamer UI and Role 5 viewer UI import only from `@/design-system`; consumers must not deep-import component, token, or stylesheet files.

## Minimum handoff

- `DesignSystemRoot` supplies inherited dark, light, or Twitch-hosted semantic tokens and comfortable or compact density.
- `Button`, `IconButton`, and `Field` provide keyboard and labelling foundations with 44 px minimum targets.
- `Card`, `Panel`, `CardGrid`, and `ControlRow` provide the approved responsive composition model.
- `StatusBadge`, `Progress`, and `Notice` distinguish status, authoritative completion, and recovery feedback.
- `VisuallyHidden` supplies screen-reader-only context.
- `designSystemTokens` exposes stable CSS variable references for exceptional consumer styling without exposing palette values.

```tsx
import {
  Button,
  Card,
  CardGrid,
  DesignSystemRoot,
  Notice,
  StatusBadge,
} from "@/design-system";

export function ConnectionSetup() {
  return (
    <DesignSystemRoot theme="dark">
      <CardGrid>
        <Card>
          <StatusBadge tone="warning">Twitch disconnected</StatusBadge>
          <Notice tone="warning" title="Reconnect Twitch">
            Reconnect before starting the live session.
          </Notice>
          <Button>Reconnect</Button>
        </Card>
      </CardGrid>
    </DesignSystemRoot>
  );
}
```

## Accessibility and behaviour contract

- Dark, light, and Twitch contexts use the same semantic token names. Never infer meaning from a raw colour.
- Focus uses a visible high-contrast ring. Interactive controls are at least 44 px high and retain native keyboard semantics.
- Status always combines a symbol and text with colour. Diagnostic states use a distinct dashed treatment and must still be labelled as diagnostic in their text.
- Motion is limited to 160–180 ms interaction feedback. `prefers-reduced-motion: reduce` removes movement and reduces transition duration to effectively zero.
- `Notice` is quiet by default. Set `politeness="polite"` or `"assertive"` only when a new runtime event must be announced.
- `Progress` is for authoritative completion only. Do not use it for decorative or estimated activity.
- `Card ribbon="selected"` and `Card ribbon="winner"` are the one reserved ribbon treatment. Use them only for the selected or winning item.

## Change rule

This public entrypoint is additive after the Role 5 handoff. New exports and optional props may be added without coordination. Renames, removals, changed defaults, or changed semantics require Role 5 review before merge; consumers never copy Role 4 source into their area.
