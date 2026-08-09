"use client";

import { useEffect, useState } from "react";
import type { ActiveQuest, Sidequest } from "@/lib/domain";
import {
  OVERLAY_CHANNEL,
  OVERLAY_STORAGE_KEY,
  readActiveQuest,
  readSharedActiveQuest,
} from "@/lib/overlay-store";

type VoteSnapshot = {
  quests: Sidequest[];
  votes: Record<string, number>;
  totalVotes: number;
};

export function OverlayStage() {
  const [active, setActive] = useState<ActiveQuest | null>(null);
  const [voteSnapshot, setVoteSnapshot] = useState<VoteSnapshot | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const initialRead = window.setTimeout(() => {
      setActive(readActiveQuest());
      setNow(Date.now());
    }, 0);
    const tick = window.setInterval(() => setNow(Date.now()), 250);
    const pollShared = window.setInterval(() => {
      void readSharedActiveQuest().then((next) => setActive(next));
    }, 750);
    const onStorage = (event: StorageEvent) => {
      if (event.key === OVERLAY_STORAGE_KEY) setActive(readActiveQuest());
    };
    window.addEventListener("storage", onStorage);
    const channel = new BroadcastChannel(OVERLAY_CHANNEL);
    channel.onmessage = (event: MessageEvent<ActiveQuest | null>) => setActive(event.data);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(pollShared);
      window.clearTimeout(initialRead);
      window.removeEventListener("storage", onStorage);
      channel.close();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const readVoteSnapshot = async () => {
      try {
        const response = await fetch("/api/demo-participation", { cache: "no-store" });
        if (!response.ok) return;
        const snapshot = (await response.json()) as VoteSnapshot;
        if (!cancelled) setVoteSnapshot(snapshot);
      } catch {
        if (!cancelled) setVoteSnapshot(null);
      }
    };

    void readVoteSnapshot();
    const poll = window.setInterval(() => void readVoteSnapshot(), 750);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, []);

  const remaining = active && now
    ? Math.max(0, active.quest.durationSeconds - Math.floor((now - active.startedAt) / 1000))
    : active?.quest.durationSeconds || 0;
  const progress = active ? ((active.quest.durationSeconds - remaining) / active.quest.durationSeconds) * 100 : 0;
  const votingQuests = voteSnapshot?.quests.length === 3 ? voteSnapshot.quests : [];
  const hasOpenVote = !active && votingQuests.length === 3;

  return (
    <main className="overlay-page">
      {active ? (
        <section className={`overlay-card status-${active.status}`}>
          <div className="overlay-kicker"><span>LIVE VIEWER QUEST</span><b>+{active.quest.rewardPoints} XP</b></div>
          <h1>{active.quest.title}</h1>
          <p>{active.quest.instruction}</p>
          <div className="overlay-footer">
            <div className="timer">{active.status === "active" ? `${remaining}s` : active.status.toUpperCase()}</div>
            <div className="overlay-track"><i style={{ width: `${active.status === "completed" ? 100 : progress}%` }} /></div>
          </div>
        </section>
      ) : hasOpenVote ? (
        <section className="overlay-card overlay-vote-card">
          <div className="overlay-kicker">
            <span>CHAT VOTE OPEN</span>
            <b>TYPE 1 / 2 / 3</b>
          </div>
          <div className="overlay-vote-options">
            {votingQuests.map((quest, index) => {
              const count = voteSnapshot?.votes[quest.id] ?? 0;
              const share = voteSnapshot?.totalVotes ? Math.round((count / voteSnapshot.totalVotes) * 100) : 0;
              return (
                <article key={quest.id} className="overlay-vote-option">
                  <strong>{index + 1}</strong>
                  <div>
                    <h2>{quest.title}</h2>
                    <p>{quest.instruction}</p>
                    <div className="overlay-vote-track">
                      <i style={{ width: `${share}%` }} />
                    </div>
                  </div>
                  <b>{count}</b>
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <p className="overlay-waiting">ChatXPT overlay ready · waiting for viewer quest</p>
      )}
    </main>
  );
}
