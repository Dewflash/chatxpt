"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { goldenScenario, sampleChat } from "@/lib/demo-data";
import type {
  ActiveQuest,
  GenerationRequest,
  GenerationResponse,
  QuestStatus,
  Sidequest,
} from "@/lib/domain";
import { publishActiveQuest, readActiveQuest } from "@/lib/overlay-store";

type CaptureStatus = "idle" | "starting" | "running" | "stopped" | "error";

type LiveAnalysis = {
  status: CaptureStatus;
  label: "quiet" | "action" | "transition" | "unknown";
  confidence: number;
  changedPixelRatio: number | null;
  meanLumaDelta: number | null;
  visualChecksum: number | null;
  previewDataUrl: string;
  frameCount: number;
  sourceLabel: string;
  message: string;
};

type TwitchChatStatus = "idle" | "connecting" | "connected" | "error";

type TwitchChatLine = {
  user: string;
  text: string;
  vote: 1 | 2 | 3 | null;
};

type AnalysisSample = {
  timestamp: number;
  label: LiveAnalysis["label"];
  confidence: number;
  motion: number | null;
  visualChange: number | null;
  checksum: number;
};

type DemoEvent = {
  id: number;
  label: string;
  detail: string;
  timestamp: number;
};

const MAX_ANALYSIS_SAMPLES = 24;
const MAX_DEMO_EVENTS = 8;

const initialAnalysis: LiveAnalysis = {
  status: "idle",
  label: "unknown",
  confidence: 0,
  changedPixelRatio: null,
  meanLumaDelta: null,
  visualChecksum: null,
  previewDataUrl: "",
  frameCount: 0,
  sourceLabel: "No capture selected",
  message: "Pick a game, phone mirror, or OBS preview window to analyse real pixels.",
};

function classifyScreenMotion(changedPixelRatio: number | null, meanLumaDelta: number | null) {
  if (changedPixelRatio === null || meanLumaDelta === null) {
    return { label: "unknown" as const, confidence: 0, recentEvent: "quiet" as const };
  }
  if (meanLumaDelta >= 0.2 || changedPixelRatio >= 0.55) {
    return {
      label: "transition" as const,
      confidence: Math.min(1, Math.max(meanLumaDelta / 0.35, changedPixelRatio / 0.75)),
      recentEvent: "under-fire" as const,
    };
  }
  if (changedPixelRatio >= 0.1) {
    return {
      label: "action" as const,
      confidence: Math.min(1, changedPixelRatio / 0.35),
      recentEvent: "under-fire" as const,
    };
  }
  if (changedPixelRatio <= 0.035) {
    return {
      label: "quiet" as const,
      confidence: Math.min(1, (0.035 - changedPixelRatio) / 0.035 + 0.55),
      recentEvent: "quiet" as const,
    };
  }
  return {
    label: "unknown" as const,
    confidence: Math.max(0.25, Math.min(0.65, changedPixelRatio / 0.1)),
    recentEvent: "missed-shots" as const,
  };
}

function lumaAt(pixels: Uint8ClampedArray, offset: number) {
  return (pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722) / 255;
}

function visualChecksum(pixels: Uint8ClampedArray) {
  let checksum = 0;
  const step = Math.max(4, Math.floor(pixels.length / 512 / 4) * 4);
  for (let offset = 0; offset < pixels.length; offset += step) {
    checksum = (checksum + pixels[offset] * 3 + pixels[offset + 1] * 5 + pixels[offset + 2] * 7) % 100_000;
  }
  return checksum;
}

function parseChatVote(text: string): 1 | 2 | 3 | null {
  const trimmed = text.trim();
  if (trimmed === "1" || trimmed === "2" || trimmed === "3") return Number(trimmed) as 1 | 2 | 3;
  return null;
}

function displayNameFromIrcLine(line: string) {
  const taggedName = line.match(/display-name=([^;]*)/)?.[1];
  if (taggedName) return taggedName;
  return line.match(/:([^!]+)!/)?.[1] ?? "viewer";
}

function messageFromIrcLine(line: string) {
  return line.match(/PRIVMSG #[^ ]+ :(.+)$/)?.[1] ?? null;
}

export function ControlRoom() {
  const [signals, setSignals] = useState<GenerationRequest>(goldenScenario);
  const [quests, setQuests] = useState<Sidequest[]>([]);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [provider, setProvider] = useState<GenerationResponse["provider"] | null>(null);
  const [warning, setWarning] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeQuest, setActiveQuest] = useState<ActiveQuest | null>(null);
  const [analysis, setAnalysis] = useState<LiveAnalysis>(initialAnalysis);
  const [twitchChannel, setTwitchChannel] = useState("dewflash");
  const [chatStatus, setChatStatus] = useState<TwitchChatStatus>("idle");
  const [chatMessage, setChatMessage] = useState("Connect Twitch chat so 1 / 2 / 3 messages become votes.");
  const [liveChat, setLiveChat] = useState<TwitchChatLine[]>([]);
  const [autoDemoEnabled, setAutoDemoEnabled] = useState(true);
  const [autoOverlayEnabled, setAutoOverlayEnabled] = useState(true);
  const [generationDelaySeconds, setGenerationDelaySeconds] = useState(30);
  const [autoQuestCountdown, setAutoQuestCountdown] = useState<number | null>(null);
  const [autoOverlayCountdown, setAutoOverlayCountdown] = useState<number | null>(null);
  const [analysisSamples, setAnalysisSamples] = useState<AnalysisSample[]>([]);
  const [demoEvents, setDemoEvents] = useState<DemoEvent[]>([]);
  const chatSocketRef = useRef<WebSocket | null>(null);
  const questsRef = useRef<Sidequest[]>([]);
  const demoEventIdRef = useRef(0);

  useEffect(() => {
    const initialRead = window.setTimeout(() => setActiveQuest(readActiveQuest()), 0);
    return () => window.clearTimeout(initialRead);
  }, []);

  useEffect(() => {
    questsRef.current = quests;
  }, [quests]);

  useEffect(() => () => chatSocketRef.current?.close(), []);

  const totalVotes = useMemo(
    () => Object.values(votes).reduce((total, count) => total + count, 0),
    [votes],
  );
  const logDemoEvent = useCallback((label: string, detail: string) => {
    demoEventIdRef.current += 1;
    const event = {
      id: demoEventIdRef.current,
      label,
      detail,
      timestamp: Date.now(),
    };
    setDemoEvents((current) => [event, ...current].slice(0, MAX_DEMO_EVENTS));
  }, []);

  const leadingQuest = useMemo(() => {
    const ranked = quests
      .map((quest, index) => ({ quest, index, count: votes[quest.id] || 0 }))
      .sort((left, right) => right.count - left.count || left.index - right.index);
    return ranked[0]?.count > 0 ? ranked[0].quest : null;
  }, [quests, votes]);
  const analysisSummary = useMemo(() => {
    const motion = analysis.changedPixelRatio === null ? null : Math.round(analysis.changedPixelRatio * 100);
    const visualChange = analysis.meanLumaDelta === null ? null : Math.round(analysis.meanLumaDelta * 100);
    const confidence = Math.round(analysis.confidence * 100);
    const readiness = analysis.status === "running"
      ? "Live pixels are feeding quest context"
      : "Start capture to feed live context";
    const tempo = analysis.label === "action"
      ? "Active fight"
      : analysis.label === "transition"
        ? "Big screen change"
        : analysis.label === "quiet"
          ? "Quiet moment"
          : "Unknown tempo";

    return [
      {
        label: "Motion",
        value: motion === null ? "n/a" : `${motion}%`,
        detail: motion === null ? "No comparison frame yet" : "Changed-pixel share from live frames",
      },
      {
        label: "Visual change",
        value: visualChange === null ? "n/a" : `${visualChange}%`,
        detail: visualChange === null ? "Waiting for luma delta" : "Brightness shift between samples",
      },
      {
        label: "Tempo",
        value: tempo,
        detail: readiness,
      },
      {
        label: "Confidence",
        value: `${confidence}%`,
        detail: analysis.label === "unknown" ? "Unsupported facts stay unknown" : "Broad activity signal only",
      },
    ];
  }, [analysis]);
  const rollingAnalysis = useMemo(() => {
    if (analysisSamples.length === 0) {
      return {
        sampleCount: 0,
        averageMotion: null as number | null,
        peakMotion: null as number | null,
        averageConfidence: null as number | null,
        dominantTempo: "No live samples",
        questReadiness: "Waiting for capture",
      };
    }

    const motionValues = analysisSamples
      .map((sample) => sample.motion)
      .filter((value): value is number => value !== null);
    const confidenceValues = analysisSamples.map((sample) => sample.confidence);
    const averageMotion = motionValues.length
      ? motionValues.reduce((sum, value) => sum + value, 0) / motionValues.length
      : null;
    const peakMotion = motionValues.length ? Math.max(...motionValues) : null;
    const averageConfidence = confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length;
    const labelCounts = analysisSamples.reduce<Record<LiveAnalysis["label"], number>>((counts, sample) => {
      counts[sample.label] += 1;
      return counts;
    }, { quiet: 0, action: 0, transition: 0, unknown: 0 });
    const dominantLabel = (Object.entries(labelCounts) as Array<[LiveAnalysis["label"], number]>)
      .sort((left, right) => right[1] - left[1])[0][0];
    const dominantTempo = dominantLabel === "action"
      ? "Mostly active"
      : dominantLabel === "transition"
        ? "Frequent transitions"
        : dominantLabel === "quiet"
          ? "Mostly quiet"
          : "Mixed / unknown";
    const questReadiness = averageConfidence >= 0.45 && motionValues.length >= 3
      ? "Enough broad signal for demo quests"
      : "Collecting more live context";

    return {
      sampleCount: analysisSamples.length,
      averageMotion,
      peakMotion,
      averageConfidence,
      dominantTempo,
      questReadiness,
    };
  }, [analysisSamples]);
  const questAutoArmed = autoDemoEnabled
    && analysis.status === "running"
    && quests.length === 0
    && !loading
    && !activeQuest;
  const overlayAutoArmed = autoOverlayEnabled && !!leadingQuest && !activeQuest;
  const readinessItems = useMemo(() => [
    {
      label: "Capture",
      value: analysis.status === "running" ? "Running" : analysis.status,
      ready: analysis.status === "running",
    },
    {
      label: "Chat",
      value: chatStatus === "connected" ? "Connected" : chatStatus,
      ready: chatStatus === "connected",
    },
    {
      label: "Quest mode",
      value: autoDemoEnabled ? `Auto ${generationDelaySeconds}s` : "Manual",
      ready: true,
    },
    {
      label: "Quests",
      value: quests.length === 3 ? "3 ready" : `${quests.length}/3`,
      ready: quests.length === 3,
    },
    {
      label: "Viewer vote",
      value: totalVotes > 0 ? `${totalVotes} counted` : "Waiting",
      ready: totalVotes > 0,
    },
    {
      label: "Overlay",
      value: activeQuest ? "Published" : "Ready",
      ready: !!activeQuest,
    },
  ], [activeQuest, analysis.status, autoDemoEnabled, chatStatus, generationDelaySeconds, quests.length, totalVotes]);

  const generate = useCallback(async () => {
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
      logDemoEvent("Generated", `${data.quests.length} quests from current stream context.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }, [logDemoEvent, signals]);

  function addVote(id: string) {
    setVotes((current) => ({ ...current, [id]: (current[id] || 0) + 1 }));
  }

  const activate = useCallback((quest: Sidequest) => {
    const next: ActiveQuest = { quest, startedAt: Date.now(), status: "active" };
    setActiveQuest(next);
    publishActiveQuest(next);
    logDemoEvent("Overlay", `${quest.title} published to viewers.`);
  }, [logDemoEvent]);

  useEffect(() => {
    if (!questAutoArmed) return;

    let remaining = generationDelaySeconds;
    const initial = window.setTimeout(() => setAutoQuestCountdown(remaining), 0);
    const countdown = window.setInterval(() => {
      remaining -= 1;
      setAutoQuestCountdown(Math.max(remaining, 0));
    }, 1000);
    const trigger = window.setTimeout(() => {
      void generate();
    }, generationDelaySeconds * 1000);

    return () => {
      window.clearTimeout(initial);
      window.clearInterval(countdown);
      window.clearTimeout(trigger);
    };
  }, [generate, generationDelaySeconds, questAutoArmed]);

  useEffect(() => {
    if (!overlayAutoArmed || !leadingQuest) return;

    let remaining = 5;
    const initial = window.setTimeout(() => setAutoOverlayCountdown(remaining), 0);
    const countdown = window.setInterval(() => {
      remaining -= 1;
      setAutoOverlayCountdown(Math.max(remaining, 0));
    }, 1000);
    const trigger = window.setTimeout(() => activate(leadingQuest), 5_000);

    return () => {
      window.clearTimeout(initial);
      window.clearInterval(countdown);
      window.clearTimeout(trigger);
    };
  }, [activate, leadingQuest, overlayAutoArmed]);

  function updateStatus(status: QuestStatus) {
    if (!activeQuest) return;
    const next = { ...activeQuest, status };
    setActiveQuest(next);
    publishActiveQuest(next);
    logDemoEvent("Result", `${activeQuest.quest.title} marked ${status}.`);
  }

  function applyChatVote(choice: 1 | 2 | 3) {
    const quest = questsRef.current[choice - 1];
    if (!quest) {
      setChatMessage(`Received vote ${choice}, but generate three quests first.`);
      return;
    }
    setVotes((current) => ({ ...current, [quest.id]: (current[quest.id] || 0) + 1 }));
    setChatMessage(`Twitch chat vote ${choice} counted for ${quest.title}.`);
    logDemoEvent("Viewer vote", `Vote ${choice} counted for ${quest.title}.`);
  }

  function connectTwitchChat() {
    const channel = twitchChannel.trim().replace(/^#/, "").toLowerCase();
    if (!channel) {
      setChatStatus("error");
      setChatMessage("Enter your Twitch channel name first.");
      return;
    }

    chatSocketRef.current?.close();
    setChatStatus("connecting");
    setChatMessage(`Connecting to twitch.tv/${channel} chat...`);

    const socket = new WebSocket("wss://irc-ws.chat.twitch.tv:443");
    chatSocketRef.current = socket;

    socket.addEventListener("open", () => {
      const nick = `justinfan${Math.floor(Math.random() * 90_000 + 10_000)}`;
      socket.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
      socket.send("PASS SCHMOOPIIE");
      socket.send(`NICK ${nick}`);
      socket.send(`JOIN #${channel}`);
      setChatStatus("connected");
      setChatMessage(`Listening to #${channel}. Ask viewers to type 1, 2, or 3.`);
      logDemoEvent("Chat connected", `Listening to #${channel}.`);
    });

    socket.addEventListener("message", (event) => {
      const payload = String(event.data);
      for (const line of payload.split("\r\n")) {
        if (!line) continue;
        if (line.startsWith("PING")) {
          socket.send(line.replace("PING", "PONG"));
          continue;
        }
        const text = messageFromIrcLine(line);
        if (text === null) continue;
        const vote = parseChatVote(text);
        const chatLine = { user: displayNameFromIrcLine(line), text, vote };
        setLiveChat((current) => [chatLine, ...current].slice(0, 4));
        if (vote !== null) applyChatVote(vote);
      }
    });

    socket.addEventListener("error", () => {
      setChatStatus("error");
      setChatMessage("Twitch chat connection failed. Check the channel name and try again.");
    });

    socket.addEventListener("close", () => {
      setChatStatus((current) => (current === "error" ? current : "idle"));
    });
  }

  async function startScreenAnalysis() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setAnalysis({
        ...initialAnalysis,
        status: "error",
        message: "This browser cannot capture a screen or window.",
      });
      return;
    }

    setAnalysis((current) => ({
      ...current,
      status: "starting",
      message: "Choose the Brawl Stars, phone mirror, or OBS preview window.",
    }));
    setAnalysisSamples([]);

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 8, max: 12 } },
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      const sourceLabel = track?.label || "Selected screen/window";
      logDemoEvent("Capture", `Sampling ${sourceLabel}.`);
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement("canvas");
      canvas.width = 96;
      canvas.height = 54;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Canvas analysis is unavailable.");

      let previous: Uint8ClampedArray | null = null;
      let frameCount = 0;
      let stopped = false;

      track?.addEventListener("ended", () => {
        stopped = true;
        setAnalysis((current) => ({
          ...current,
          status: "stopped",
          message: "Capture stopped. Start capture again to resume live analysis.",
        }));
      });

      const sample = () => {
        if (stopped) return;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const pixels = new Uint8ClampedArray(
          context.getImageData(0, 0, canvas.width, canvas.height).data,
        );
        const checksum = visualChecksum(pixels);
        const previewDataUrl = canvas.toDataURL("image/jpeg", 0.62);
        frameCount += 1;

        let changedPixelRatio: number | null = null;
        let meanLumaDelta: number | null = null;
        if (previous) {
          let changed = 0;
          let totalDelta = 0;
          const pixelCount = canvas.width * canvas.height;
          for (let offset = 0; offset < pixels.length; offset += 4) {
            const delta = Math.abs(lumaAt(pixels, offset) - lumaAt(previous, offset));
            totalDelta += delta;
            if (delta >= 0.08) changed += 1;
          }
          changedPixelRatio = changed / pixelCount;
          meanLumaDelta = totalDelta / pixelCount;
        }
        previous = pixels;

        const classification = classifyScreenMotion(changedPixelRatio, meanLumaDelta);
        setAnalysis({
          status: "running",
          label: classification.label,
          confidence: classification.confidence,
          changedPixelRatio,
          meanLumaDelta,
          visualChecksum: checksum,
          previewDataUrl,
          frameCount,
          sourceLabel,
          message: "Analysing real pixels from the selected screen/window.",
        });
        setAnalysisSamples((current) => [
          {
            timestamp: Date.now(),
            label: classification.label,
            confidence: classification.confidence,
            motion: changedPixelRatio,
            visualChange: meanLumaDelta,
            checksum,
          },
          ...current,
        ].slice(0, MAX_ANALYSIS_SAMPLES));

        setSignals((current) => ({
          ...current,
          gameplay: {
            ...current.gameplay,
            phase:
              classification.label === "action"
                ? "combat"
                : classification.label === "transition"
                  ? "rotation"
                  : current.gameplay.phase,
            recentEvent: classification.recentEvent,
          },
        }));

        window.setTimeout(sample, 500);
      };

      sample();
    } catch (caught) {
      setAnalysis({
        ...initialAnalysis,
        status: "error",
        message: caught instanceof Error ? caught.message : "Screen capture was cancelled.",
      });
    }
  }

  const readinessPanel = (
    <div className="readiness-card">
      <div className="section-heading compact-heading">
        <div><p className="step">Demo readiness</p><h3>{activeQuest ? "Overlay live" : "Preflight"}</h3></div>
        <a className="mini-link" href="/overlay" target="_blank" rel="noreferrer">View overlay</a>
      </div>
      <div className="readiness-grid">
        {readinessItems.map((item) => (
          <div className={item.ready ? "ready" : ""} key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
      <p>
        {activeQuest
          ? `${activeQuest.quest.title} is published to the stream overlay.`
          : leadingQuest
            ? `${leadingQuest.title} is leading; auto overlay will publish it, or publish now for recording.`
            : "Start capture, generate quests, then ask Joel to vote 1/2/3."}
      </p>
      {leadingQuest && !activeQuest && (
        <button className="publish-button" onClick={() => activate(leadingQuest)}>
          Publish leading quest now
        </button>
      )}
      <div className="obs-preview">
        <div><span>OBS output mirror</span><b>{activeQuest ? activeQuest.quest.title : "Waiting for active quest"}</b></div>
        <iframe src="/overlay" title="OBS overlay preview" />
      </div>
      <div className="event-timeline">
        <span>Recent flow</span>
        {demoEvents.length === 0 ? (
          <p>No demo events yet.</p>
        ) : demoEvents.map((event) => (
          <p key={event.id}>
            <b>{event.label}</b>
            {event.detail}
          </p>
        ))}
      </div>
    </div>
  );

  const automationPanel = (
    <div className="automation-card">
      <div>
        <p className="step">Stream automation settings</p>
        <h3>{autoDemoEnabled ? "Automatic quest flow" : "Manual producer review"}</h3>
        <p>
          Choose whether ChatXPT prepares quests while you play or waits for the streamer to stop
          and review. Overlay publishing can also be automatic or manual.
        </p>
      </div>
      <div className="mode-grid">
        <button
          type="button"
          className={autoDemoEnabled ? "selected" : ""}
          onClick={() => setAutoDemoEnabled(true)}
        >
          <b>Auto generate</b>
          <span>{generationDelaySeconds}s after live capture starts</span>
        </button>
        <button
          type="button"
          className={!autoDemoEnabled ? "selected" : ""}
          onClick={() => setAutoDemoEnabled(false)}
        >
          <b>Manual review</b>
          <span>Streamer clicks Generate now</span>
        </button>
      </div>
      <label>Quest timing
        <select
          value={generationDelaySeconds}
          onChange={(event) => setGenerationDelaySeconds(Number(event.target.value))}
          disabled={!autoDemoEnabled}
        >
          <option value={15}>15 seconds</option>
          <option value={30}>30 seconds</option>
          <option value={45}>45 seconds</option>
        </select>
      </label>
      <div className="mode-grid">
        <button
          type="button"
          className={autoOverlayEnabled ? "selected" : ""}
          onClick={() => setAutoOverlayEnabled(true)}
        >
          <b>Auto overlay</b>
          <span>Winner appears for viewers after vote</span>
        </button>
        <button
          type="button"
          className={!autoOverlayEnabled ? "selected" : ""}
          onClick={() => setAutoOverlayEnabled(false)}
        >
          <b>Streamer approves</b>
          <span>Click Activate before overlay shows</span>
        </button>
      </div>
      <div className="automation-status">
        <span>
          {!questAutoArmed
            ? "Quest timer waits for live capture"
            : `Generating in ${autoQuestCountdown}s`}
        </span>
        <span>
          {!overlayAutoArmed
            ? "Overlay waits for a viewer vote"
            : `Overlay in ${autoOverlayCountdown}s`}
        </span>
      </div>
    </div>
  );

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

      <section className="recording-cockpit">
        <div className="recording-ribbon panel">
          <div>
            <p className="step">Recording cockpit</p>
            <h2>Run the demo from here.</h2>
            <p>Start capture, connect chat, generate quests, then confirm the overlay mirror before going live on camera.</p>
          </div>
          <div className="ribbon-actions">
            <button onClick={startScreenAnalysis} disabled={analysis.status === "starting"}>
              {analysis.status === "running" ? "Restart capture" : "Capture game"}
            </button>
            <button onClick={connectTwitchChat}>
              {chatStatus === "connected" ? "Reconnect chat" : "Connect chat"}
            </button>
            <button onClick={generate} disabled={loading}>
              {loading ? "Reading..." : "Generate now"}
            </button>
            <a href="/overlay" target="_blank" rel="noreferrer">Open overlay</a>
          </div>
        </div>
        <div className="cockpit-grid">
          {readinessPanel}
          {automationPanel}
        </div>
      </section>

      <section className="workspace">
        <div className="signal-panel panel">
          <div className="section-heading">
            <div><p className="step">01 · Signals</p><h2>Read the room</h2></div>
            <button className="text-button" onClick={() => setSignals(goldenScenario)}>Reset demo</button>
          </div>

          <div className="analysis-card">
            <div>
              <p className="step">Live screen analysis</p>
              <h3>{analysis.label === "unknown" ? "Waiting for visual signal" : analysis.label}</h3>
              <span>{analysis.sourceLabel}</span>
            </div>
            <button
              className="analysis-button"
              onClick={startScreenAnalysis}
              disabled={analysis.status === "starting"}
            >
              {analysis.status === "running" ? "Restart capture" : analysis.status === "starting" ? "Opening picker..." : "Capture game window"}
            </button>
            <dl>
              <div><dt>Frames</dt><dd>{analysis.frameCount}</dd></div>
              <div><dt>Motion</dt><dd>{analysis.changedPixelRatio === null ? "n/a" : `${Math.round(analysis.changedPixelRatio * 100)}%`}</dd></div>
              <div><dt>Visual change</dt><dd>{analysis.meanLumaDelta === null ? "n/a" : `${Math.round(analysis.meanLumaDelta * 100)}%`}</dd></div>
              <div><dt>Confidence</dt><dd>{Math.round(analysis.confidence * 100)}%</dd></div>
            </dl>
            <div className="analysis-preview">
              {analysis.previewDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={analysis.previewDataUrl} alt="Live sampled game window preview" />
              ) : (
                <span>No sampled preview yet</span>
              )}
              <b>checksum {analysis.visualChecksum ?? "n/a"}</b>
            </div>
            <p>{analysis.message}</p>
          </div>

          <div className="analysis-insights">
            {analysisSummary.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.detail}</p>
              </div>
            ))}
          </div>

          <div className="analysis-history">
            <div className="section-heading compact-heading">
              <div><p className="step">Rolling live analysis</p><h3>{rollingAnalysis.dominantTempo}</h3></div>
              <span>{rollingAnalysis.sampleCount} samples</span>
            </div>
            <div className="history-stats">
              <div><span>Avg motion</span><strong>{rollingAnalysis.averageMotion === null ? "n/a" : `${Math.round(rollingAnalysis.averageMotion * 100)}%`}</strong></div>
              <div><span>Peak motion</span><strong>{rollingAnalysis.peakMotion === null ? "n/a" : `${Math.round(rollingAnalysis.peakMotion * 100)}%`}</strong></div>
              <div><span>Avg confidence</span><strong>{rollingAnalysis.averageConfidence === null ? "n/a" : `${Math.round(rollingAnalysis.averageConfidence * 100)}%`}</strong></div>
            </div>
            <div className="history-bars" aria-label="Recent motion samples">
              {analysisSamples.length === 0 ? (
                <p>No live samples yet.</p>
              ) : analysisSamples.slice().reverse().map((sample) => (
                <i
                  key={`${sample.timestamp}-${sample.checksum}`}
                  className={`bar-${sample.label}`}
                  title={`${sample.label}: ${sample.motion === null ? "n/a" : `${Math.round(sample.motion * 100)}%`} motion`}
                  style={{ height: `${Math.max(8, Math.round((sample.motion ?? 0.03) * 80))}px` }}
                />
              ))}
            </div>
            <p>{rollingAnalysis.questReadiness}</p>
          </div>

          <div className="form-grid">
            <label>Match phase
              <select value={signals.gameplay.phase} onChange={(event) => setSignals((current) => ({ ...current, gameplay: { ...current.gameplay, phase: event.target.value as GenerationRequest["gameplay"]["phase"] } }))}>
                <option value="looting">Pre-fight / setup</option><option value="rotation">Rotating objective</option><option value="combat">Active fight</option><option value="final-circle">Final push</option>
              </select>
            </label>
            <label>Team pressure
              <select value={signals.gameplay.squadStatus} onChange={(event) => setSignals((current) => ({ ...current, gameplay: { ...current.gameplay, squadStatus: event.target.value as GenerationRequest["gameplay"]["squadStatus"] } }))}>
                <option value="all-up">Team ready</option><option value="last-alive">Solo pressure</option>
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

          <div className="twitch-chat-card">
            <div className="section-heading compact-heading">
              <div><p className="step">Twitch chat votes</p><h3>{chatStatus}</h3></div>
              <button className="analysis-button" onClick={connectTwitchChat}>
                {chatStatus === "connected" ? "Reconnect chat" : "Connect chat"}
              </button>
            </div>
            <p className="viewer-instruction">Viewer instruction: type exactly 1, 2, or 3 in Twitch chat.</p>
            <label>Channel name
              <input value={twitchChannel} onChange={(event) => setTwitchChannel(event.target.value)} />
            </label>
            <p>{chatMessage}</p>
            <div className="live-chat-lines">
              {liveChat.length === 0 ? (
                <span>No live chat messages received yet.</span>
              ) : liveChat.map((line, index) => (
                <span key={`${line.user}-${line.text}-${index}`}>
                  <b>{line.user}</b> {line.text}{line.vote ? ` -> vote ${line.vote}` : ""}
                </span>
              ))}
            </div>
          </div>

          <button className="primary-button" onClick={generate} disabled={loading}>{loading ? "Reading the moment…" : "Generate now"}</button>
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
                      <div className="quest-title-row">
                        <h3>{quest.title}</h3>
                        <span className={`difficulty ${quest.difficulty}`}>{quest.difficulty}</span>
                        {leadingQuest?.id === quest.id && <span className="leading-badge">Leading</span>}
                      </div>
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
