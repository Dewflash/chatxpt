import { deriveViewerVoterKey, type PrivateViewerIdentityKind } from "../core";

export interface PrivateViewerIdentityInput {
  readonly principalId: string;
  readonly identityKind: PrivateViewerIdentityKind;
}

export function derivePrivateViewerVoterKey(input: PrivateViewerIdentityInput): string {
  return deriveViewerVoterKey(input);
}
