import type { HostedBoardAccessResult } from "../../realtime";

const statusCopy: Record<
  Exclude<HostedBoardAccessResult["status"], "granted">,
  { readonly title: string; readonly body: string }
> = {
  "invalid-code": {
    title: "Room code is invalid",
    body: "Check the eight-character code from the streamer and try again.",
  },
  "not-found": {
    title: "Quest board not found",
    body: "This room is not active on this ChatXPT server.",
  },
  expired: {
    title: "Access expired",
    body: "Refresh the quest board link from the stream and try again.",
  },
  inactive: {
    title: "Quest board ended",
    body: "The stream session is no longer accepting hosted-board viewers.",
  },
  unavailable: {
    title: "Hosted board unavailable",
    body: "Use the Twitch Extension or chat voting fallback if the streamer has enabled them.",
  },
};

export function HostedBoardAccessShell({
  access,
}: {
  readonly access: HostedBoardAccessResult;
}) {
  if (access.status !== "granted") {
    const copy = statusCopy[access.status];
    return (
      <main className="hosted-board-shell" data-status={access.status}>
        <section className="hosted-board-panel" aria-label="Hosted board access status">
          <p className="eyebrow">ChatXPT Quest Board</p>
          <h1>{copy.title}</h1>
          <p>{copy.body}</p>
          <dl>
            <div>
              <dt>Room</dt>
              <dd>{access.roomCode || "Unknown"}</dd>
            </div>
          <div>
            <dt>Status</dt>
            <dd>{access.status}</dd>
          </div>
        </dl>
        <p className="hosted-board-share">{access.message}</p>
      </section>
    </main>
  );
  }

  return (
    <main className="hosted-board-shell" data-status="ready">
      <section className="hosted-board-panel" aria-label="Hosted board access status">
        <p className="eyebrow">ChatXPT Quest Board</p>
        <h1>Viewer board ready</h1>
        <p>
          This room can load the hosted viewer experience. Voting still goes through ChatXPT&apos;s
          authorised command service.
        </p>
        <dl>
          <div>
            <dt>Room</dt>
            <dd>{access.roomCode}</dd>
          </div>
          <div>
            <dt>Session</dt>
            <dd>{access.sessionId}</dd>
          </div>
          <div>
            <dt>Revision</dt>
            <dd>{access.revision}</dd>
          </div>
        </dl>
        <p className="hosted-board-share">{access.share.viewerPath}</p>
      </section>
    </main>
  );
}
