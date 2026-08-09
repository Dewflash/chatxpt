import {
  FALLBACK_ROOM_CODE_LENGTH,
  type HostedBoardAccessRequest,
  type HostedBoardAccessResult,
  type HostedBoardSessionDirectory,
  type RealtimeAccessGrantStore,
} from "./types";

const ROOM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;

function normaliseRoomCode(input: string): string | null {
  const code = input.trim().toUpperCase().replace(/\s+/g, "");
  return code.length === FALLBACK_ROOM_CODE_LENGTH && ROOM_CODE_PATTERN.test(code) ? code : null;
}

function viewerPath(prefix: string | undefined, roomCode: string): string {
  const base = prefix?.trim() === "" || prefix === undefined ? "/quest-board" : prefix.trim();
  return `${base.replace(/\/$/, "")}/${roomCode}`;
}

export class HostedBoardAccessService {
  constructor(
    private readonly directory: HostedBoardSessionDirectory,
    private readonly grants: RealtimeAccessGrantStore,
  ) {}

  async resolve(input: HostedBoardAccessRequest): Promise<HostedBoardAccessResult> {
    const roomCode = normaliseRoomCode(input.roomCode);
    if (roomCode === null) {
      return {
        status: "invalid-code",
        roomCode: null,
        retryable: false,
        message: "Enter the eight-character ChatXPT room code.",
      };
    }
    if (input.expiresAt <= input.requestedAt) {
      return {
        status: "expired",
        roomCode,
        retryable: false,
        message: "Viewer access has already expired.",
      };
    }

    let session;
    try {
      session = await this.directory.findHostedBoardSession(roomCode);
    } catch {
      return {
        status: "unavailable",
        roomCode,
        retryable: true,
        message: "Hosted board lookup is temporarily unavailable.",
      };
    }
    if (session === null) {
      return {
        status: "not-found",
        roomCode,
        retryable: false,
        message: "No active ChatXPT session was found for that room code.",
      };
    }
    if (session.status !== "preparing" && session.status !== "live") {
      return {
        status: "inactive",
        roomCode,
        retryable: false,
        message: "That ChatXPT session is no longer accepting hosted-board viewers.",
      };
    }

    try {
      await this.grants.grant({
        principalId: input.principalId,
        sessionId: session.sessionId,
        viewRole: "viewer",
        expiresAt: input.expiresAt,
      });
    } catch {
      return {
        status: "unavailable",
        roomCode,
        retryable: true,
        message: "Viewer access could not be authorised.",
      };
    }

    const path = viewerPath(input.viewerPathPrefix, roomCode);
    return {
      status: "granted",
      sessionId: session.sessionId,
      roomCode,
      revision: session.revision,
      viewRole: "viewer",
      expiresAt: input.expiresAt,
      viewerPath: path,
      share: {
        roomCode,
        viewerPath: path,
        qrPayload: path,
      },
    };
  }
}
