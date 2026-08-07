import type { ViewerViewModel } from "../core";
import { DesignSystemRoot, Notice, Panel, StatusBadge } from "../design-system";
import { createViewerDemoView } from "./demo-fixtures";
import { visibleQuestOptions } from "./surface-model";
import styles from "./viewer-surfaces.module.css";

export interface ChatFallbackInstructionsProps {
  readonly view: ViewerViewModel;
}

export function ChatFallbackInstructions({ view }: ChatFallbackInstructionsProps) {
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
          <p>Role 5 owns this instruction surface only. Role 1 owns Twitch chat reading, identity, duplicate handling, and acknowledgement.</p>
        </section>

        <Panel className={`${styles.panel} ${styles.chatPanel}`} aria-label="Chat fallback instructions">
          {options.map((option, index) => (
            <div className={styles.chatLine} key={option.candidateId}>
              <span><strong>{index + 1}</strong> {option.title}</span>
              <span>{option.rewardPoints} XP</span>
            </div>
          ))}

          <Notice className={styles.notice} title="Stream message" tone="info">
            ChatXPT vote is open. Send 1, 2, or 3 once. Counted, duplicate, rejected, and late status must come from Role 1.
          </Notice>
        </Panel>
      </div>
    </DesignSystemRoot>
  );
}

export function TwitchChatVoteInstructions(props: ChatFallbackInstructionsProps) {
  return <ChatFallbackInstructions {...props} />;
}

export function ChatFallbackInstructionsDemo() {
  return <ChatFallbackInstructions view={createViewerDemoView({ mode: "twitch-chat" })} />;
}
