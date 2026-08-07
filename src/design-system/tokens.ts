/**
 * Stable semantic token references for Role 4 and Role 5 UI.
 *
 * Values resolve from the nearest DesignSystemRoot so consumers never need to
 * copy palette values or know which host theme is active.
 */
export const designSystemTokens = {
  color: {
    canvas: "var(--cx-color-canvas)",
    surface: "var(--cx-color-surface)",
    surfaceRaised: "var(--cx-color-surface-raised)",
    text: "var(--cx-color-text)",
    textMuted: "var(--cx-color-text-muted)",
    border: "var(--cx-color-border)",
    primary: "var(--cx-color-primary)",
    onPrimary: "var(--cx-color-on-primary)",
    accent: "var(--cx-color-accent)",
    onAccent: "var(--cx-color-on-accent)",
    focus: "var(--cx-color-focus)",
    success: "var(--cx-color-success)",
    warning: "var(--cx-color-warning)",
    danger: "var(--cx-color-danger)",
    info: "var(--cx-color-info)",
  },
  typography: {
    family: "var(--cx-font-family)",
    sizeSm: "var(--cx-font-size-sm)",
    sizeMd: "var(--cx-font-size-md)",
    sizeLg: "var(--cx-font-size-lg)",
    sizeXl: "var(--cx-font-size-xl)",
    weightRegular: "var(--cx-font-weight-regular)",
    weightMedium: "var(--cx-font-weight-medium)",
    weightBold: "var(--cx-font-weight-bold)",
    lineHeight: "var(--cx-line-height)",
  },
  space: {
    xs: "var(--cx-space-xs)",
    sm: "var(--cx-space-sm)",
    md: "var(--cx-space-md)",
    lg: "var(--cx-space-lg)",
    xl: "var(--cx-space-xl)",
    xxl: "var(--cx-space-xxl)",
  },
  radius: {
    sm: "var(--cx-radius-sm)",
    md: "var(--cx-radius-md)",
    lg: "var(--cx-radius-lg)",
    pill: "var(--cx-radius-pill)",
  },
  elevation: {
    low: "var(--cx-shadow-low)",
    high: "var(--cx-shadow-high)",
  },
  focus: {
    ring: "var(--cx-focus-ring)",
    offset: "var(--cx-focus-offset)",
  },
  motion: {
    fast: "var(--cx-motion-fast)",
    standard: "var(--cx-motion-standard)",
    easing: "var(--cx-motion-easing)",
  },
} as const;

export type DesignSystemTheme = "dark" | "light" | "twitch";
export type DesignSystemDensity = "comfortable" | "compact";
