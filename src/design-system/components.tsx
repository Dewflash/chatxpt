"use client";

import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

import styles from "./design-system.module.css";
import type { DesignSystemDensity, DesignSystemTheme } from "./tokens";

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export interface DesignSystemRootProps extends HTMLAttributes<HTMLDivElement> {
  theme?: DesignSystemTheme;
  density?: DesignSystemDensity;
}

export const DesignSystemRoot = forwardRef<HTMLDivElement, DesignSystemRootProps>(
  function DesignSystemRoot(
    { theme = "dark", density = "comfortable", className, ...props },
    ref,
  ) {
    return (
      <div
        ref={ref}
        className={classNames(styles.root, className)}
        data-theme={theme}
        data-density={density}
        {...props}
      />
    );
  },
);

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    loading = false,
    disabled,
    className,
    children,
    type = "button",
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={classNames(styles.button, styles[variant], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <span className={styles.loadingMark} aria-hidden="true">•••</span> : null}
      <span>{children}</span>
    </button>
  );
});

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  "aria-label": string;
  variant?: ButtonVariant;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { variant = "secondary", className, children, type = "button", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={classNames(styles.button, styles.iconButton, styles[variant], className)}
        {...props}
      >
        {children}
      </button>
    );
  },
);

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  {
    label,
    hint,
    error,
    id,
    required,
    className,
    containerClassName,
    "aria-describedby": describedBy,
    "aria-invalid": invalid,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? `cx-field-${generatedId}`;
  const hasHint = hint !== undefined && hint !== null && hint !== false;
  const hasError = error !== undefined && error !== null && error !== false;
  const hintId = hasHint ? `${inputId}-hint` : undefined;
  const errorId = hasError ? `${inputId}-error` : undefined;
  const descriptions = [describedBy, hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={classNames(styles.field, containerClassName)}>
      <label className={styles.label} htmlFor={inputId}>
        <span>{label}</span>
        {required ? <span className={styles.required} aria-hidden="true">*</span> : null}
      </label>
      <input
        ref={ref}
        id={inputId}
        className={classNames(styles.input, hasError && styles.inputError, className)}
        required={required}
        aria-describedby={descriptions}
        aria-invalid={invalid ?? (hasError ? true : undefined)}
        {...props}
      />
      {hasHint ? <span id={hintId} className={styles.hint}>{hint}</span> : null}
      {hasError ? <span id={errorId} className={styles.error}>{error}</span> : null}
    </div>
  );
});

export type CardRibbon = "selected" | "winner";

export interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  ribbon?: CardRibbon;
}

export function Card({ ribbon, className, children, ...props }: SurfaceProps) {
  const ribbonLabel = ribbon === "winner" ? "Winner" : "Selected";

  return (
    <section
      className={classNames(styles.card, Boolean(ribbon) && styles.selected, className)}
      data-ribbon={ribbon}
      {...props}
    >
      {ribbon ? <span className={styles.visuallyHidden}>{ribbonLabel}. </span> : null}
      {children}
    </section>
  );
}

export function Panel({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={classNames(styles.panel, className)} {...props} />;
}

export function CardGrid({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={classNames(styles.cardGrid, className)} {...props} />;
}

export function ControlRow({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={classNames(styles.controlRow, className)} {...props} />;
}

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger" | "diagnostic";

const statusSymbols: Record<StatusTone, string> = {
  neutral: "•",
  info: "i",
  success: "✓",
  warning: "!",
  danger: "×",
  diagnostic: "◇",
};

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: string;
  tone?: StatusTone;
}

export function StatusBadge({ tone = "neutral", className, children, ...props }: StatusBadgeProps) {
  return (
    <span
      className={classNames(styles.statusBadge, styles[`status${tone}`], className)}
      data-tone={tone}
      {...props}
    >
      <span className={styles.statusSymbol} aria-hidden="true">{statusSymbols[tone]}</span>
      <span>{children}</span>
    </span>
  );
}

export interface ProgressProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  label: ReactNode;
  value: number;
  max?: number;
  valueLabel?: ReactNode;
}

export function Progress({
  label,
  value,
  max = 100,
  valueLabel,
  className,
  ...props
}: ProgressProps) {
  const generatedId = useId();
  const labelId = `cx-progress-${generatedId}`;
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  const safeValue = Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), safeMax);
  const computedLabel = valueLabel ?? `${Math.round((safeValue / safeMax) * 100)}%`;

  return (
    <div className={classNames(styles.progressGroup, className)} {...props}>
      <div className={styles.progressLabels}>
        <span id={labelId}>{label}</span>
        <span>{computedLabel}</span>
      </div>
      <progress
        className={styles.progress}
        value={safeValue}
        max={safeMax}
        aria-labelledby={labelId}
        aria-valuetext={typeof computedLabel === "string" ? computedLabel : undefined}
      />
    </div>
  );
}

export type NoticeTone = "info" | "success" | "warning" | "danger";
export type NoticePoliteness = "off" | "polite" | "assertive";

const noticeSymbols: Record<NoticeTone, string> = {
  info: "i",
  success: "✓",
  warning: "!",
  danger: "×",
};

export interface NoticeProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  tone?: NoticeTone;
  title: ReactNode;
  politeness?: NoticePoliteness;
}

export function Notice({
  tone = "info",
  title,
  politeness = "off",
  className,
  children,
  ...props
}: NoticeProps) {
  const liveProps = politeness === "off"
    ? {}
    : {
        role: politeness === "assertive" ? "alert" : "status",
        "aria-live": politeness,
      } as const;

  return (
    <div
      className={classNames(styles.notice, styles[`notice${tone}`], className)}
      data-tone={tone}
      {...liveProps}
      {...props}
    >
      <span className={styles.noticeSymbol} aria-hidden="true">{noticeSymbols[tone]}</span>
      <div>
        <div className={styles.noticeTitle}>{title}</div>
        <div className={styles.noticeBody}>{children}</div>
      </div>
    </div>
  );
}

export function VisuallyHidden({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={classNames(styles.visuallyHidden, className)} {...props} />;
}
