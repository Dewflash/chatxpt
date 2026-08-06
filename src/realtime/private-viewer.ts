import type { PrivateViewerIdentityKind } from "../core";

export interface PrivateViewerIdentityInput {
  readonly principalId: string;
  readonly identityKind: PrivateViewerIdentityKind;
}

export function derivePrivateViewerVoterKey(input: PrivateViewerIdentityInput): string {
  const prefix = input.identityKind === "authenticated" ? "viewer" : "anonymous";
  return `${prefix}:${input.principalId}`;
}
