"use client";

import { useEffect, useMemo, useState } from "react";
import { goldenScenario, sampleChat } from "@/lib/demo-data";
import type {
  ActiveQuest,
  GenerationRequest,
  GenerationResponse,
  QuestStatus,
  Sidequest,
} from "@/lib/domain";
import { publishActiveQuest, readActiveQuest } from "@/lib/overlay-store";

export function ControlRoom() {
  const [signals, setSignals] = useState<GenerationRequest>(goldenScenario);
  const [quests, setQuests] = useState<Sidequest[]>([]);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [provider, setProvider] = useState<GenerationResponse["provider"] | null>(null);
  const [warning, setWarning] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeQuest, setActiveQuest] = useState<ActiveQuest | null>(null);

  useEffect(() => {
    const initialRead = window.setTimeout(() => setActiveQuest(readActiveQuest()), 0);
    return () => window.clearTimeout(initialRead);
  }, []);

  const totalVotes = useMemo(
    () => Object.values(votes).reduce((total, count) => total + count, 0),
    [votes],
  );

  async function generate() {
    setLoading(true);
    setError("");
    setWarning("");
    try {
      const response = await fetch("/api/sidequests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(signals),
      });
      const data = (await response.json()) as GenerationResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || "Generation failed");
      setQuests(data.quests);
      setProvider(data.provider);
      setWarning(data.warning || "");
      setVotes(Object.fromEntries(data.quests.map((quest) => [quest.id, 0])));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  function addVote(id: string) {
    setVotes((current) => ({ ...current, [id]: (current[id] || 0) + 1 }));
  }

  function activate(quest: Sidequest) {
    const next: ActiveQuest = { quest, startedAt: Date.now(), status: "active" };
    setActiveQuest(next);
    publishActiveQuest(next);
  }

  function updateStatus(status: QuestStatus) {
    if (!activeQuest) return;
    const next = { ...activeQuest, status };
    setActiveQuest(next);
    publishActiveQuest(next);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="ChatXPT home">
          <span className="brand-mark">XP</span>
          <span>ChatXPT</span>
        </a>
        <div className="live-pill"><span /> Demo control room</div>
        <a className="ghost-button" href="/overlay" target="_blank" rel="noreferrer">Open overlay ↗</a>
      </header>

      <section className="hero" id="top">
        <div>
          <p className="eyebrow">Viewer agency, generated live</p>
          <h1>Turn the moment into a <em>sidequest.</em></h1>
          <p className="hero-copy">Gameplay context, chat energy, and streamer style become three vote-ready challenges in seconds.</p>
        </div>
        <div className="signal-orbit" aria-label="Three engine inputs">
          <span>GAME</span><span>CHAT</span><span>CREATOR</span>
          <strong>AI</strong>
        </div>
      </section>

      <section className="workspace">
        <div className="signal-panel panel">
          <div className="section-heading">
            <div><p className="step">01 · Signals</p><h2>Read the room</h2></div>
            <button className="text-button" onClick={() => setSignals(goldenScenario)}>Reset demo</button>
          </div>

          <div className="form-grid">
            <label>Match phase
              <select value={signals.gameplay.phase} onChange={(event) => setSignals((current) => ({ ...current, gameplay: { ...current.gameplay, phase: event.target.value as GenerationRequest["gameplay"]["phase"] } }))}>
                <option value="looting">Looting</option><option value="rotation">Rotation</option><option value="combat">Squad fight</option><option value="final-circle">Final circle</option>
              </select>
            </label>
            <label>Squad status
              <select value={signals.gameplay.squadStatus} onChange={(event) => setSignals((current) => ({ ...current, gameplay: { ...current.gameplay, squadStatus: event.target.value as GenerationRequest["gameplay"]["squadStatus"] } }))}>
                <option value="all-up">All up</option><option value="teammate-knocked">Teammate knocked</option><option value="last-alive">Last alive</option>
              </select>
            </label>
            <label className="range-label">Health <strong>{signals.gameplay.health}%</strong>
              <input type="range" min="0" max="100" value={signals.gameplay.health} onChange={(event) => setSignals((current) => ({ ...current, gameplay: { ...current.gameplay, health: Number(event.target.value) } }))} />
            </label>
            <label>Viewer mood
              <select value={signals.sentiment.mood} onChange={(event) => setSignals((current) => ({ ...current, sentiment: { ...current.sentiment, mood: event.target.value as GenerationRequest["sentiment"]["mood"] } }))}>
                <option value="bored">Bored</option><option value="hyped">Hyped</option><option value="chaotic">Chaotic</option><option value="supportive">Supportive</option><option value="teasing">Teasing</option>
              </select>
            </label>
            <label>Streamer style
              <select value={signals.profile.style} onChange={(event) => setSignals((current) => ({ ...current, profile: { ...current.profile, style: event.target.value as GenerationRequest["profile"]["style"] } }))}>
                <option value="aggressive">Aggressive</option><option value="supportive">Supportive</option><option value="comedic">Comedic</option><option value="beginner">Beginner</option><option value="competitive">Competitive</option>
              </select>
            </label>
            <label>Chat request
              <input value={signals.sentiment.request} onChange={(event) => setSignals((current) => ({ ...current, sentiment: { ...current.sentiment, request: event.target.value } }))} />
            </label>
          </div>

          <div className="chat-strip">
            {sampleChat.slice(0, 3).map((chat) => <p key={chat.name}><b>{chat.name}</b> {chat.message}</p>)}
          </div>

          <button className="primary-button" onClick={generate} disabled={loading}>{loading ? "Reading the moment…" : "Generate sidequests ✦"}</button>
          {error && <p className="notice error">{error}</p>}
          {warning && <p className="notice">{warning}</p>}
        </div>

        <div className="quest-panel panel">
          <div className="section-heading">
            <div><p className="step">02 · Vote</p><h2>Choose the chaos</h2></div>
            {provider && <span className="provider">{provider === "openai" ? "Live AI" : "Safe demo engine"}</span>}
          </div>

          {quests.length === 0 ? (
            <div className="empty-state"><span>✦</span><p>Set the moment, then generate three audience-ready quests.</p></div>
          ) : (
            <div className="quest-list">
              {quests.map((quest, index) => {
                const count = votes[quest.id] || 0;
                const share = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
                return (
                  <article className="quest-card" key={quest.id}>
                    <div className="quest-number">0{index + 1}</div>
                    <div className="quest-copy">
                      <div className="quest-title-row"><h3>{quest.title}</h3><span className={`difficulty ${quest.difficulty}`}>{quest.difficulty}</span></div>
                      <p>{quest.instruction}</p>
                      <small>{quest.durationSeconds}s · {quest.rewardPoints} XP · {quest.rationale}</small>
                      <div className="vote-track"><i style={{ width: `${share}%` }} /></div>
                    </div>
                    <div className="quest-actions">
                      <button onClick={() => addVote(quest.id)}>+ vote <b>{count}</b></button>
                      <button className="activate-button" onClick={() => activate(quest)}>Activate</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {activeQuest && (
        <section className="active-bar">
          <div><span>LIVE QUEST</span><strong>{activeQuest.quest.title}</strong><p>{activeQuest.status} · {activeQuest.quest.rewardPoints} XP</p></div>
          <div className="active-actions">
            <button onClick={() => updateStatus("completed")}>Complete</button>
            <button onClick={() => updateStatus("failed")}>Fail</button>
            <button onClick={() => { setActiveQuest(null); publishActiveQuest(null); }}>Clear</button>
          </div>
        </section>
      )}
    </main>
  );
}
