"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { goldenScenario } from "@/lib/demo-data";
import type {
  ActiveQuest,
  GenerationRequest,
  GenerationResponse,
  QuestStatus,
  Sidequest,
} from "@/lib/domain";
import { publishActiveQuest } from "@/lib/overlay-store";

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

type StatusItem = {
  label: string;
  value: string;
  ready: boolean;
};

type StatusGroup = {
  title: string;
  items: StatusItem[];
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

type DemoParticipationSnapshot = {
  quests: Sidequest[];
  votes: Record<string, number>;
  totalVotes: number;
  updatedAt: number;
};

type GameCategoryPreset =
  | "arena"
  | "tactical"
  | "battle-royale"
  | "moba"
  | "racing"
  | "strategy"
  | "platformer"
  | "unknown";
type StudioView = "studio" | "analytics" | "game-signals" | "vote-overlay";

const MAX_ANALYSIS_SAMPLES = 24;
const MAX_DEMO_EVENTS = 8;

const gameCategoryLabels: Record<GameCategoryPreset, string> = {
  arena: "Arena action",
  tactical: "Tactical shooter",
  "battle-royale": "Battle royale",
  moba: "MOBA / objective",
  racing: "Racing",
  strategy: "Strategy",
  platformer: "Platformer",
  unknown: "Custom / unknown",
};

const gameCategoryDemoGames: Record<GameCategoryPreset, string> = {
  arena: "Brawl Stars",
  tactical: "Valorant",
  "battle-royale": "Fortnite",
  moba: "League of Legends",
  racing: "Mario Kart",
  strategy: "StarCraft",
  platformer: "Celeste",
  unknown: "Custom game",
};

const gamePhasePresets: Record<GameCategoryPreset, Record<GenerationRequest["gameplay"]["phase"], string>> = {
  arena: {
    looting: "Setup / respawn",
    rotation: "Objective rotate",
    combat: "Active fight",
    "final-circle": "Final push",
  },
  tactical: {
    looting: "Buy / setup",
    rotation: "Site rotate",
    combat: "Duel / execute",
    "final-circle": "Retake / clutch",
  },
  "battle-royale": {
    looting: "Looting",
    rotation: "Zone rotate",
    combat: "Squad fight",
    "final-circle": "Endgame circle",
  },
  moba: {
    looting: "Lane setup",
    rotation: "Objective setup",
    combat: "Team fight",
    "final-circle": "Last objective",
  },
  racing: {
    looting: "Grid / setup",
    rotation: "Corner sequence",
    combat: "Overtake window",
    "final-circle": "Final lap",
  },
  strategy: {
    looting: "Economy setup",
    rotation: "Map control",
    combat: "Engagement",
    "final-circle": "Endgame push",
  },
  platformer: {
    looting: "Route setup",
    rotation: "Checkpoint run",
    combat: "Precision section",
    "final-circle": "Final stretch",
  },
  unknown: {
    looting: "Quiet / setup",
    rotation: "Movement",
    combat: "Action",
    "final-circle": "Endgame",
  },
};

const squadStatusLabels: Record<GenerationRequest["gameplay"]["squadStatus"], string> = {
  "all-up": "Team ready",
  "teammate-knocked": "Teammate down",
  "last-alive": "Solo pressure",
};

const moodLabels: Record<GenerationRequest["sentiment"]["mood"], string> = {
  bored: "Bored",
  hyped: "Hyped",
  chaotic: "Chaotic",
  supportive: "Supportive",
  teasing: "Teasing",
};

const styleLabels: Record<GenerationRequest["profile"]["style"], string> = {
  aggressive: "Aggressive",
  supportive: "Supportive",
  comedic: "Comedic",
  beginner: "Beginner",
  competitive: "Competitive",
};

const studioViews: Array<{ id: StudioView; label: string }> = [
  { id: "studio", label: "Studio" },
  { id: "analytics", label: "Stream analytics" },
  { id: "game-signals", label: "Game signals" },
  { id: "vote-overlay", label: "Vote / overlay" },
];

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

async function publishDemoParticipationQuests(quests: Sidequest[]) {
  const response = await fetch("/api/demo-participation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "publish-quests", quests }),
  });
  if (!response.ok) throw new Error("Local Twitch diagnostic staging failed");
}

async function clearDemoParticipation() {
  await fetch("/api/demo-participation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "clear" }),
  });
}

async function submitDemoParticipationVote(questId: string, voterKey: string) {
  await fetch("/api/demo-participation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "vote", questId, voterKey }),
  });
}

async function submitDemoParticipationResult(outcome: "completed" | "failed") {
  const response = await fetch("/api/demo-participation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "quest-result", outcome }),
  });
  if (!response.ok) throw new Error("Canonical Twitch quest result was not accepted");
}

function transientVoterKey(source: string) {
  const random =
    typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${source}:${random}`;
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
  const [chatMessage, setChatMessage] = useState("Connect Twitch chat to show comments; 1 / 2 / 3 is only the fallback vote path.");
  const [liveChat, setLiveChat] = useState<TwitchChatLine[]>([]);
  const [autoDemoEnabled, setAutoDemoEnabled] = useState(true);
  const [autoOverlayEnabled, setAutoOverlayEnabled] = useState(true);
  const [generationDelaySeconds, setGenerationDelaySeconds] = useState(30);
  const [autoQuestCountdown, setAutoQuestCountdown] = useState<number | null>(null);
  const [autoOverlayCountdown, setAutoOverlayCountdown] = useState<number | null>(null);
  const [analysisSamples, setAnalysisSamples] = useState<AnalysisSample[]>([]);
  const [demoEvents, setDemoEvents] = useState<DemoEvent[]>([]);
  const [gamePhasePreset, setGamePhasePreset] = useState<GameCategoryPreset>("arena");
  const [activeStudioView, setActiveStudioView] = useState<StudioView>("studio");
  const chatSocketRef = useRef<WebSocket | null>(null);
  const questsRef = useRef<Sidequest[]>([]);
  const demoEventIdRef = useRef(0);

  useEffect(() => {
    const initialClear = window.setTimeout(() => {
      publishActiveQuest(null);
      void clearDemoParticipation();
    }, 0);
    return () => window.clearTimeout(initialClear);
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
  const gameStatusRead = useMemo(() => {
    const phaseLabels = gamePhasePresets[gamePhasePreset];
    return [
      {
        label: "Game category",
        value: gameCategoryLabels[gamePhasePreset],
        detail: "Streamer-selected model",
      },
      {
        label: "Game",
        value: signals.gameplay.game,
        detail: "Used for genre-safe quest wording",
      },
      {
        label: "Match phase",
        value: phaseLabels[signals.gameplay.phase],
        detail: analysis.status === "running" ? "Broad visual tempo" : "Saved context",
      },
      {
        label: "Team pressure",
        value: squadStatusLabels[signals.gameplay.squadStatus],
        detail: signals.gameplay.recentEvent === "under-fire" ? "Activity spike" : "Streamer set",
      },
      {
        label: "Health",
        value: `${signals.gameplay.health}%`,
        detail: "Manual HUD read",
      },
    ];
  }, [analysis.status, gamePhasePreset, signals.gameplay]);
  const questDirectionRead = useMemo(() => [
      {
        label: "Viewer mood",
        value: moodLabels[signals.sentiment.mood],
        detail: chatStatus === "connected" ? "Chat-informed" : "Streamer set",
      },
      {
        label: "Streamer style",
        value: styleLabels[signals.profile.style],
        detail: `Intensity ${signals.profile.intensity} / 3`,
      },
      {
        label: "Chat request",
        value: signals.sentiment.request || "No request",
        detail: "Quest flavour",
      },
  ], [chatStatus, signals.profile.intensity, signals.profile.style, signals.sentiment.mood, signals.sentiment.request]);
  const generatorRead = useMemo(() => [
    {
      label: "MVP provider",
      value: "No external model",
      detail: "D-055 keeps the judged path credential-free.",
    },
    {
      label: "Primary generator",
      value: "Algorithmic candidates",
      detail: "Exactly three options from gameplay, chat mood, and profile.",
    },
    {
      label: "Quest authority",
      value: "Deterministic engine",
      detail: "Unsafe, infeasible, or malformed quests are replaced.",
    },
    {
      label: "Fallback order",
      value: "Algorithmic -> safe library",
      detail: "Streamer can still manually review before overlay.",
    },
  ], []);
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

  const statusGroups = useMemo<StatusGroup[]>(() => [
    {
      title: "Game",
      items: [
        readinessItems[0],
        {
          label: "Category",
          value: gameCategoryLabels[gamePhasePreset],
          ready: true,
        },
        {
          label: "Phase",
          value: gamePhasePresets[gamePhasePreset][signals.gameplay.phase],
          ready: analysis.status === "running",
        },
        {
          label: "Health",
          value: `${signals.gameplay.health}%`,
          ready: signals.gameplay.health > 0,
        },
      ],
    },
    {
      title: "Chat",
      items: [
        readinessItems[1],
        {
          label: "Mood",
          value: moodLabels[signals.sentiment.mood],
          ready: chatStatus === "connected" || signals.sentiment.mood !== "bored",
        },
        {
          label: "Hype",
          value: `${signals.sentiment.energy}/5`,
          ready: signals.sentiment.energy >= 3,
        },
      ],
    },
    {
      title: "Quest",
      items: [readinessItems[2], readinessItems[3]],
    },
    {
      title: "Broadcast",
      items: [readinessItems[4], readinessItems[5]],
    },
  ], [analysis.status, chatStatus, gamePhasePreset, readinessItems, signals.gameplay.health, signals.gameplay.phase, signals.sentiment.energy, signals.sentiment.mood]);

  const streamMetricItems = useMemo(() => [
    {
      label: "Mood",
      value: moodLabels[signals.sentiment.mood],
      ready: chatStatus === "connected" || signals.sentiment.mood !== "bored",
    },
    {
      label: "Hype",
      value: `${signals.sentiment.energy}/5`,
      ready: signals.sentiment.energy >= 3,
    },
    {
      label: "Tempo",
      value: rollingAnalysis.dominantTempo,
      ready: analysis.status === "running",
    },
    {
      label: "Votes",
      value: totalVotes > 0 ? `${totalVotes}` : "0",
      ready: totalVotes > 0,
    },
    {
      label: "Winner",
      value: leadingQuest?.title ?? "None",
      ready: !!leadingQuest,
    },
    {
      label: "Quest fit",
      value: rollingAnalysis.questReadiness,
      ready: rollingAnalysis.questReadiness.startsWith("Enough"),
    },
  ], [analysis.status, chatStatus, leadingQuest, rollingAnalysis.dominantTempo, rollingAnalysis.questReadiness, signals.sentiment.energy, signals.sentiment.mood, totalVotes]);

  const streamStatusGroups = useMemo<StatusGroup[]>(() => [
    {
      title: "Analytics",
      items: [streamMetricItems[0], streamMetricItems[1], streamMetricItems[2]],
    },
    {
      title: "Voting",
      items: [streamMetricItems[3], streamMetricItems[4], streamMetricItems[5]],
    },
  ], [streamMetricItems]);

  const generate = useCallback(async () => {
    if (analysis.status !== "running") {
      setError("Start game capture before generating quests.");
      return;
    }

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
      void publishDemoParticipationQuests(data.quests).catch(() => {
        setWarning("Quests generated, but the local Extension voter bridge did not update.");
      });
      logDemoEvent("Generated", `${data.quests.length} quests from current stream context.`);
      logDemoEvent("Extension vote", "Published quests to /viewer.html for viewer voting.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }, [analysis.status, logDemoEvent, signals]);

  function addVote(id: string) {
    setVotes((current) => ({ ...current, [id]: (current[id] || 0) + 1 }));
    void submitDemoParticipationVote(id, transientVoterKey("studio")).catch(() => {
      setWarning("Studio vote counted locally, but the Extension voter bridge did not update.");
    });
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

  useEffect(() => {
    if (quests.length !== 3) return;

    let cancelled = false;
    const questIds = new Set(quests.map((quest) => quest.id));

    const syncVotes = async () => {
      try {
        const response = await fetch("/api/demo-participation", { cache: "no-store" });
        if (!response.ok) return;
        const snapshot = (await response.json()) as DemoParticipationSnapshot;
        if (snapshot.quests.length !== 3) return;
        const sameQuestSet = snapshot.quests.every((quest) => questIds.has(quest.id));
        if (!sameQuestSet || cancelled) return;
        setVotes(Object.fromEntries(quests.map((quest) => [quest.id, snapshot.votes[quest.id] ?? 0])));
      } catch {
        // Best-effort local demo bridge; Studio can still count fallback votes locally.
      }
    };

    void syncVotes();
    const interval = window.setInterval(() => void syncVotes(), 1_500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [quests]);

  function updateStatus(status: QuestStatus) {
    if (!activeQuest) return;
    const next = { ...activeQuest, status };
    setActiveQuest(next);
    publishActiveQuest(next);
    if (status === "completed" || status === "failed") {
      void submitDemoParticipationResult(status).catch(() => {
        setWarning("Overlay result updated, but the canonical Twitch viewer quest is not active yet.");
      });
    }
    logDemoEvent("Result", `${activeQuest.quest.title} marked ${status}.`);
  }

  function applyChatVote(choice: 1 | 2 | 3) {
    const quest = questsRef.current[choice - 1];
    if (!quest) {
      setChatMessage(`Received vote ${choice}, but generate three quests first.`);
      return;
    }
    setVotes((current) => ({ ...current, [quest.id]: (current[quest.id] || 0) + 1 }));
    void submitDemoParticipationVote(quest.id, transientVoterKey("twitch-chat")).catch(() => {
      setWarning("Chat fallback vote counted locally, but the Extension voter bridge did not update.");
    });
    setChatMessage(`Twitch chat vote ${choice} counted for ${quest.title}.`);
    logDemoEvent("Viewer vote", `Vote ${choice} counted for ${quest.title}.`);
  }

  function applyGameCategory(nextCategory: GameCategoryPreset) {
    setGamePhasePreset(nextCategory);
    setSignals((current) => ({
      ...current,
      gameplay: {
        ...current.gameplay,
        game: gameCategoryDemoGames[nextCategory],
      },
    }));
  }

  function resetDemoContext() {
    setGamePhasePreset("arena");
    setSignals(goldenScenario);
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
      setChatMessage(`Listening to #${channel}. Use this to show comments; 1 / 2 / 3 remains fallback voting.`);
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
        <div className="mini-link-row">
          <a className="mini-link" href="/viewer.html" target="_blank" rel="noreferrer">Viewer vote</a>
          <a className="mini-link" href="/overlay" target="_blank" rel="noreferrer">View overlay</a>
        </div>
      </div>
      <div className="readiness-grid">
        {readinessItems.map((item) => (
          <div className={item.ready ? "ready" : ""} key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
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

  const enginePanel = (
    <section className="engine-card" aria-label="Quest generator status">
      <div className="section-heading compact-heading">
        <div><p className="step">Quest generator</p><h3>Engine stack</h3></div>
        <span className="provider">MVP decided</span>
      </div>
      <div className="engine-flow">
        {generatorRead.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );

  const studioPanel = (
    <section className="view-panel">
      <div className="context-columns">
        <section className="context-column" aria-label="Current game status">
          <div className="section-heading compact-heading">
            <div><p className="step">Game status</p><h3>Current read</h3></div>
          </div>
          <div className="context-list">
            {gameStatusRead.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="context-column" aria-label="Quest direction">
          <div className="section-heading compact-heading">
            <div><p className="step">Quest direction</p><h3>Streamer preference</h3></div>
          </div>
          <div className="context-list">
            {questDirectionRead.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.detail}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="studio-view-grid">
        <div className="signal-mode-panel">
          <div className="section-heading compact-heading">
            <div><p className="step">Adjustments</p><h3>Streamer controls</h3></div>
            <button className="text-button" onClick={resetDemoContext}>Reset demo</button>
          </div>
          <div className="form-grid">
            <label>Game category
              <select value={gamePhasePreset} onChange={(event) => applyGameCategory(event.target.value as GameCategoryPreset)}>
                {(Object.keys(gameCategoryLabels) as GameCategoryPreset[]).map((category) => (
                  <option value={category} key={category}>{gameCategoryLabels[category]}</option>
                ))}
              </select>
            </label>
            <label>Demo game
              <input value={signals.gameplay.game} onChange={(event) => setSignals((current) => ({ ...current, gameplay: { ...current.gameplay, game: event.target.value } }))} />
            </label>
            <label>Match phase
              <select value={signals.gameplay.phase} onChange={(event) => setSignals((current) => ({ ...current, gameplay: { ...current.gameplay, phase: event.target.value as GenerationRequest["gameplay"]["phase"] } }))}>
                <option value="looting">{gamePhasePresets[gamePhasePreset].looting}</option>
                <option value="rotation">{gamePhasePresets[gamePhasePreset].rotation}</option>
                <option value="combat">{gamePhasePresets[gamePhasePreset].combat}</option>
                <option value="final-circle">{gamePhasePresets[gamePhasePreset]["final-circle"]}</option>
              </select>
            </label>
            <label>Team pressure
              <select value={signals.gameplay.squadStatus} onChange={(event) => setSignals((current) => ({ ...current, gameplay: { ...current.gameplay, squadStatus: event.target.value as GenerationRequest["gameplay"]["squadStatus"] } }))}>
                <option value="all-up">{squadStatusLabels["all-up"]}</option>
                <option value="teammate-knocked">{squadStatusLabels["teammate-knocked"]}</option>
                <option value="last-alive">{squadStatusLabels["last-alive"]}</option>
              </select>
            </label>
            <label className="range-label">Health <strong>{signals.gameplay.health}%</strong>
              <input type="range" min="0" max="100" value={signals.gameplay.health} onChange={(event) => setSignals((current) => ({ ...current, gameplay: { ...current.gameplay, health: Number(event.target.value) } }))} />
            </label>
            <label>Viewer mood
              <select value={signals.sentiment.mood} onChange={(event) => setSignals((current) => ({ ...current, sentiment: { ...current.sentiment, mood: event.target.value as GenerationRequest["sentiment"]["mood"] } }))}>
                <option value="bored">{moodLabels.bored}</option>
                <option value="hyped">{moodLabels.hyped}</option>
                <option value="chaotic">{moodLabels.chaotic}</option>
                <option value="supportive">{moodLabels.supportive}</option>
                <option value="teasing">{moodLabels.teasing}</option>
              </select>
            </label>
            <label>Streamer style
              <select value={signals.profile.style} onChange={(event) => setSignals((current) => ({ ...current, profile: { ...current.profile, style: event.target.value as GenerationRequest["profile"]["style"] } }))}>
                <option value="aggressive">{styleLabels.aggressive}</option>
                <option value="supportive">{styleLabels.supportive}</option>
                <option value="comedic">{styleLabels.comedic}</option>
                <option value="beginner">{styleLabels.beginner}</option>
                <option value="competitive">{styleLabels.competitive}</option>
              </select>
            </label>
            <label>Chat request
              <input value={signals.sentiment.request} onChange={(event) => setSignals((current) => ({ ...current, sentiment: { ...current.sentiment, request: event.target.value } }))} />
            </label>
          </div>
        </div>
        <div className="studio-side-stack">
          {enginePanel}
          {automationPanel}
        </div>
      </div>
    </section>
  );

  const streamAnalyticsPanel = (
    <section className="view-panel">
      <div className="section-heading">
        <div><p className="step">Stream analytics</p><h2>Chat, hype, and vote pulse</h2></div>
      </div>
      <div className="analytics-layout">
        <div className="analytics-main">
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
              <div><p className="step">Live signal trend</p><h3>{rollingAnalysis.dominantTempo}</h3></div>
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
          </div>
        </div>
        <div className="analytics-side">
          <div className="twitch-chat-card">
            <div className="section-heading compact-heading">
              <div><p className="step">Twitch chat</p><h3>{chatStatus}</h3></div>
            </div>
            <button className="analysis-button compact-action" onClick={connectTwitchChat}>
              {chatStatus === "connected" ? "Reconnect chat" : "Connect chat"}
            </button>
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
        </div>
      </div>
    </section>
  );

  const gameSignalsPanel = (
    <section className="view-panel">
      <div className="section-heading">
        <div><p className="step">Game signals</p><h2>Captured screen read</h2></div>
      </div>
      <div className="game-signals-layout">
        <div className="analysis-card">
          <div>
            <p className="step">Live screen analysis</p>
            <h3>{analysis.label === "unknown" ? "Waiting for visual signal" : analysis.label}</h3>
            <span>{analysis.sourceLabel}</span>
          </div>
          <button
            className="analysis-button compact-action"
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
        </div>
        <div className="game-context-stack">
          <section className="context-column" aria-label="Captured game status">
            <div className="section-heading compact-heading">
              <div><p className="step">Game status</p><h3>Current read</h3></div>
            </div>
            <div className="context-list">
              {gameStatusRead.map((item) => (
                <div key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <p>{item.detail}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="context-column" aria-label="Game phase model">
            <div className="section-heading compact-heading">
              <div><p className="step">Phase model</p><h3>{gameCategoryLabels[gamePhasePreset]}</h3></div>
            </div>
            <div className="context-list">
              {Object.entries(gamePhasePresets[gamePhasePreset]).map(([phase, label]) => (
                <div key={phase}>
                  <span>{phase}</span>
                  <strong>{label}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </section>
  );

  const voteOverlayPanel = (
    <section className="view-panel vote-overlay-grid">
      <div className="quest-panel panel">
        <div className="section-heading">
          <div><p className="step">Vote</p><h2>Viewer choices</h2></div>
          {provider && (
            <span className="provider">
              {provider === "openai" ? "Live AI" : provider === "algorithmic" ? "Algorithmic engine" : "Safe demo engine"}
            </span>
          )}
        </div>

        {quests.length === 0 ? (
          <div className="empty-state"><span>✦</span><p>Generate three audience-ready quests.</p></div>
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
      {readinessPanel}
    </section>
  );

  const activeViewPanel = activeStudioView === "studio"
    ? studioPanel
    : activeStudioView === "analytics"
      ? streamAnalyticsPanel
      : activeStudioView === "game-signals"
        ? gameSignalsPanel
        : voteOverlayPanel;

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

      <section className="recording-cockpit" id="top">
        <div className="status-bars">
          <div className="status-bar grouped" aria-label="System status">
            {statusGroups.map((group) => (
              <section className="status-group" key={group.title}>
                <h2>{group.title}</h2>
                <div>
                  {group.items.map((item) => (
                    <span data-state={item.ready ? "ready" : "idle"} key={`${group.title}-${item.label}`}>
                      <b>{item.label}</b>{item.value}
                    </span>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <div className="status-bar secondary grouped" aria-label="Stream analytics summary">
            {streamStatusGroups.map((group) => (
              <section className="status-group" key={group.title}>
                <h2>{group.title}</h2>
                <div>
                  {group.items.map((item) => (
                    <span data-state={item.ready ? "ready" : "idle"} key={`${group.title}-${item.label}`}>
                      <b>{item.label}</b>{item.value}
                    </span>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="recording-ribbon panel">
          <div className="cockpit-heading">
            <span>Action cockpit</span>
            <b>Run the recording from here</b>
          </div>
          <div className="ribbon-actions">
            <button onClick={startScreenAnalysis} disabled={analysis.status === "starting"}>
              {analysis.status === "running" ? "Restart capture" : "Capture game"}
            </button>
            <button onClick={connectTwitchChat}>
              {chatStatus === "connected" ? "Reconnect chat" : "Connect chat"}
            </button>
            <button
              className="primary-ribbon-action"
              onClick={generate}
              disabled={loading || analysis.status !== "running"}
            >
              {loading ? "Reading..." : analysis.status === "running" ? "Generate now" : "Start capture first"}
            </button>
            <a href="/overlay" target="_blank" rel="noreferrer">Open overlay</a>
          </div>
          {(error || warning) && (
            <div className="cockpit-notice">
              {error && <span className="notice error">{error}</span>}
              {warning && <span className="notice">{warning}</span>}
            </div>
          )}
        </div>

        <nav className="view-ribbon" aria-label="Studio views">
          {studioViews.map((view) => (
            <button
              aria-pressed={activeStudioView === view.id}
              className={activeStudioView === view.id ? "selected" : ""}
              key={view.id}
              onClick={() => setActiveStudioView(view.id)}
              type="button"
            >
              {view.label}
            </button>
          ))}
          <a href="/viewer.html" target="_blank" rel="noreferrer">Viewer</a>
          <a href="/overlay" target="_blank" rel="noreferrer">Overlay</a>
        </nav>
      </section>

      {activeViewPanel}

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
