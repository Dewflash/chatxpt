import type { ViewerViewModel } from "../core";
import { DesignSystemRoot, Notice, Panel, StatusBadge } from "../design-system";
import { visibleQuestOptions, type ChatVoteAcknowledgement } from "./surface-model";
import styles from "./viewer-surfaces.module.css";

export interface ChatFallbackInstructionsProps {
  readonly view: ViewerViewModel;
  readonly acknowledgements?: readonly ChatVoteAcknowledgement[];
}

export function ChatFallbackInstructions({ acknowledgements = [], view }: ChatFallbackInstructionsProps) {
  const options = visibleQuestOptions(view.questCycle);

  return (
    <DesignSystemRoot className={styles.viewerSurface} density="compact" theme="twitch">
      <div className={styles.viewerShell}>
        <header className={styles.viewerTopbar}>
          <div className={styles.brand}><span className={styles.mark}>XP</span><span>ChatXPT</span></div>
          <StatusBadge tone="info">Chat fallback</StatusBadge>
        </header>

        <section className={styles.hero}>
          <p className={styles.eyebrow}>Twitch chat fallback</p>
          <h1>Vote with 1, 2, or 3</h1>
          <p>When the extension is unavailable, send the number shown beside your choice in Twitch chat. Status updates appear only after ChatXPT confirms them.</p>
        </section>

        <Panel className={`${styles.panel} ${styles.chatPanel}`} aria-label="Chat fallback instructions">
          {options.map((option, index) => (
            <div className={styles.chatLine} key={option.candidateId}>
              <span><strong>{index + 1}</strong> {option.title}</span>
              <span>{option.rewardPoints} XP</span>
            </div>
          ))}

          <Notice className={styles.notice} title="Stream message" tone="info">
            ChatXPT vote is open. Send 1, 2, or 3 once. Counted, duplicate, rejected, and late status appear only after confirmation.
          </Notice>

          {acknowledgements.length > 0 ? (
            <section className={styles.ackList} aria-label="Chat vote acknowledgement status">
              {acknowledgements.map((acknowledgement, index) => (
                <div className={styles.chatLine} key={`${acknowledgement.status}-${index}`}>
                  <span>
                    <StatusBadge tone={chatAcknowledgementTone(acknowledgement.status)}>
                      {chatAcknowledgementLabel(acknowledgement.status)}
                    </StatusBadge>
                  </span>
                  <span>
                    {acknowledgement.optionNumber ? `Option ${acknowledgement.optionNumber}: ` : ""}
                    {acknowledgement.message}
                  </span>
                </div>
              ))}
            </section>
          ) : null}
        </Panel>
      </div>
    </DesignSystemRoot>
  );
}

function chatAcknowledgementTone(status: ChatVoteAcknowledgement["status"]) {
  switch (status) {
    case "counted":
      return "success";
    case "duplicate":
      return "warning";
    case "rejected":
    case "late":
      return "danger";
    case "unavailable":
      return "info";
  }
}

function chatAcknowledgementLabel(status: ChatVoteAcknowledgement["status"]): string {
  switch (status) {
    case "counted":
      return "Counted";
    case "duplicate":
      return "Duplicate";
    case "rejected":
      return "Rejected";
    case "late":
      return "Late";
    case "unavailable":
      return "Unavailable";
  }
}

export function TwitchChatVoteInstructions(props: ChatFallbackInstructionsProps) {
  return <ChatFallbackInstructions {...props} />;
}
