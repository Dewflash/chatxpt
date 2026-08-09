"use client";

import { useEffect, useState } from "react";
import type { ActiveQuest } from "@/lib/domain";
import {
  OVERLAY_CHANNEL,
  OVERLAY_STORAGE_KEY,
  readActiveQuest,
  readSharedActiveQuest,
} from "@/lib/overlay-store";

export function OverlayStage() {
  const [active, setActive] = useState<ActiveQuest | null>(null);
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

  const remaining = active && now
    ? Math.max(0, active.quest.durationSeconds - Math.floor((now - active.startedAt) / 1000))
    : active?.quest.durationSeconds || 0;
  const progress = active ? ((active.quest.durationSeconds - remaining) / active.quest.durationSeconds) * 100 : 0;

  return (
    <main className="overlay-page">
      {active ? (
        <section className={`overlay-card status-${active.status}`}>
          <div className="overlay-kicker"><span>CHAT SIDEQUEST</span><b>+{active.quest.rewardPoints} XP</b></div>
          <h1>{active.quest.title}</h1>
          <p>{active.quest.instruction}</p>
          <div className="overlay-footer">
            <div className="timer">{active.status === "active" ? `${remaining}s` : active.status.toUpperCase()}</div>
            <div className="overlay-track"><i style={{ width: `${active.status === "completed" ? 100 : progress}%` }} /></div>
          </div>
        </section>
      ) : (
        <p className="overlay-waiting">ChatXPT overlay ready</p>
      )}
    </main>
  );
}
