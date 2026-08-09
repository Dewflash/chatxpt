"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { Sidequest } from "@/lib/domain";

type DemoParticipationSnapshot = {
  evidenceClass: "local-demo";
  participationMode: "twitch-extension";
  quests: Sidequest[];
  votes: Record<string, number>;
  totalVotes: number;
  updatedAt: number;
  error?: string;
};

function getVoterKey() {
  const key = "chatxpt:demo-extension-voter";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const next =
    typeof window.crypto?.randomUUID === "function"
      ? `extension:${window.crypto.randomUUID()}`
      : `extension:${Date.now()}:${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(key, next);
  return next;
}

export function DemoExtensionViewer() {
  const [snapshot, setSnapshot] = useState<DemoParticipationSnapshot | null>(null);
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);
  const [acceptedQuestId, setAcceptedQuestId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("Waiting for Studio to publish quests.");

  const selectedQuest = useMemo(
    () => snapshot?.quests.find((quest) => quest.id === selectedQuestId) ?? null,
    [selectedQuestId, snapshot?.quests],
  );

  const refresh = useCallback(async () => {
    const response = await fetch("/api/demo-participation", { cache: "no-store" });
    const data = (await response.json()) as DemoParticipationSnapshot;
    setSnapshot(data);
    if (data.quests.length === 3 && acceptedQuestId === null) {
      setMessage("Pick one quest, then vote.");
    }
  }, [acceptedQuestId]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 1_500);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [refresh]);

  async function submitVote() {
    if (!selectedQuest) return;
    setPending(true);
    setMessage("Sending vote...");
    try {
      const response = await fetch("/api/demo-participation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "vote",
          questId: selectedQuest.id,
          voterKey: getVoterKey(),
        }),
      });
      const data = (await response.json()) as DemoParticipationSnapshot & {
        accepted?: boolean;
        duplicate?: boolean;
        previousChoice?: string;
        error?: string;
      };
      setSnapshot(data);
      if (data.accepted) {
        setAcceptedQuestId(selectedQuest.id);
        setMessage(`Vote accepted for ${selectedQuest.title}.`);
      } else if (data.duplicate) {
        setAcceptedQuestId(data.previousChoice ?? selectedQuest.id);
        setMessage("Vote already counted for this round.");
      } else {
        setMessage(data.error ?? "Vote could not be counted.");
      }
    } catch {
      setMessage("Vote could not be sent. Keep the local server running.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {/* Twitch requires the Extension Helper as the first script in Extension HTML. */}
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script src="https://extension-files.twitch.tv/helper/v1/twitch-ext.min.js"></script>
      <main className="extension-voter-shell">
        <section className="extension-voter-panel" aria-label="ChatXPT Twitch Extension voter">
          <header>
            <p className="diagnostic-kicker">Twitch Extension</p>
            <h1>Vote for the sidequest</h1>
            <span>{snapshot?.participationMode ?? "connecting"}</span>
          </header>

          {snapshot?.quests.length === 3 ? (
            <div className="extension-vote-list">
              {snapshot.quests.map((quest, index) => {
                const votes = snapshot.votes[quest.id] ?? 0;
                const selected = selectedQuestId === quest.id || acceptedQuestId === quest.id;
                return (
                  <button
                    aria-pressed={selected}
                    className={selected ? "selected" : ""}
                    disabled={pending || acceptedQuestId !== null}
                    key={quest.id}
                    onClick={() => {
                      setSelectedQuestId(quest.id);
                      setMessage(`${quest.title} selected.`);
                    }}
                    type="button"
                  >
                    <b>{index + 1}</b>
                    <span>
                      <strong>{quest.title}</strong>
                      <small>{quest.instruction}</small>
                      <em>{quest.difficulty} · {quest.durationSeconds}s · {quest.rewardPoints} XP · {votes} votes</em>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="extension-empty">
              <strong>No vote is open.</strong>
              <span>Generate quests in Studio first.</span>
            </div>
          )}

          <button
            className="extension-submit"
            disabled={!selectedQuest || pending || acceptedQuestId !== null}
            onClick={submitVote}
            type="button"
          >
            {pending ? "Sending..." : acceptedQuestId ? "Vote counted" : "Submit vote"}
          </button>
          <p aria-live="polite">{message}</p>
        </section>
      </main>
    </>
  );
}
