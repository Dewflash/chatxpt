import type { CommandEnvelope } from "../contracts";

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, canonicalValue(nested)]),
  );
}

/** Stable across JSONB/object key reordering. */
export function canonicalJsonStringify(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

export function commandFingerprint(command: CommandEnvelope): string {
  return canonicalJsonStringify(command);
}
