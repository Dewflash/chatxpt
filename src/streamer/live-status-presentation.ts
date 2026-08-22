import type { StreamerViewModel } from "../core";

const CHAT_SIGNAL_FRESHNESS_MILLISECONDS = 30_000;

function knownGameplaySignalValue(
  view: StreamerViewModel | null,
  ...kinds: readonly string[]
): string | number | boolean | null {
  const signal = view?.gameplay?.signals.find((candidate) => kinds.includes(candidate.kind));
  return signal?.observation.status === "known" ? signal.observation.value : null;
}

export function presentGameplayTempo(view: StreamerViewModel | null): string {
  if (view?.gameplay === null || view === null) return "Unknown";
  const activity = knownGameplaySignalValue(
    view,
    "minecraft-activity",
    "game-vision-state",
    "activity-intensity",
  );
  if (typeof activity === "number") {
    return activity >= 0.7 ? "Energetic" : activity >= 0.35 ? "Steady" : "Calm";
  }
  const value = String(activity ?? "").toLowerCase();
  if (/combat|fight|active|high/u.test(value)) return "Energetic";
  if (/explor|mining|building|steady/u.test(value)) return "Steady";
  if (/quiet|stable|sleep|menu|calm/u.test(value)) return "Calm";
  if (/transition/u.test(value)) return "Changing";
  return "Unknown";
}

export function presentGameplayFeedState(view: StreamerViewModel | null): string {
  const raw = view?.publicContext?.gameplayStatus ?? knownGameplaySignalValue(
    view,
    "minecraft-menu-state",
    "minecraft-movement",
    "minecraft-combat",
    "game-vision-state",
  );
  const value = String(raw ?? "").trim().toLowerCase();
  if (value.length === 0) return "Unknown";
  if (/pause|menu/u.test(value)) return "Paused";
  if (/inventory/u.test(value)) return "Inventory";
  if (/sleep/u.test(value)) return "Sleeping";
  if (/combat|fight|attack/u.test(value)) return "Fighting";
  if (/turn/u.test(value)) return "Turning";
  if (/scene-transition|transition/u.test(value)) return "Changing";
  if (/ordinary-motion|coherent-global-motion|rapid-coherent-global-motion|walk|run|moving|explor|mining|building/u.test(value)) {
    return "Moving";
  }
  if (/stable|quiet|calm/u.test(value)) return "Stable";
  return value
    .split(/[-_\s]+/u)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function formatSessionDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function presentSessionPhase(view: StreamerViewModel | null): string {
  if (view === null) return "Waiting";
  switch (view.session.status) {
    case "preparing":
      return "Preparing";
    case "live": {
      const startedAt = view.session.startedAt;
      return startedAt === null
        ? "Live"
        : `Live · ${formatSessionDuration(view.envelope.receivedAt - startedAt)}`;
    }
    case "ended": {
      const startedAt = view.session.startedAt;
      const endedAt = view.session.endedAt;
      return startedAt === null || endedAt === null
        ? "Ended"
        : `Ended · ${formatSessionDuration(endedAt - startedAt)}`;
    }
    case "offline":
      return "Offline";
  }
}

export function presentChatStatus(view: StreamerViewModel | null): string {
  const projectedStatus = view?.publicContext?.chatStatus ?? "unknown";
  switch (projectedStatus) {
    case "hype":
      return "Hype";
    case "steady":
      return "Steady";
    case "quiet":
      return "Peaceful";
    case "unknown": {
      const messageRate = view?.audience?.signals.find(
        (candidate) => candidate.kind === "audience-message-rate",
      );
      if (
        messageRate?.observation.status === "known" &&
        typeof messageRate.observation.value === "number" &&
        view !== null &&
        view.envelope.receivedAt - messageRate.observation.provenance.observedAt <=
          CHAT_SIGNAL_FRESHNESS_MILLISECONDS
      ) {
        if (messageRate.observation.value >= 10) return "Hype";
        if (messageRate.observation.value > 2) return "Steady";
        return "Peaceful";
      }
      return view?.session.status === "live" && view.session.capabilities.twitchChatVoting
        ? "Peaceful"
        : "Unknown";
    }
  }
}

function formatQuestCountdown(endsAt: number, now: number): string {
  const totalSeconds = Math.max(0, Math.ceil((endsAt - now) / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function presentQuestStatus(
  view: StreamerViewModel | null,
  now = view?.envelope.receivedAt,
): string {
  if (view === null) return "None";
  if (view.emergencyPaused) return "Paused";
  switch (view.questCycle.status) {
    case "idle":
      return "None";
    case "evaluating":
      return "Preparing";
    case "proposed":
      return "Selection ready";
    case "voting": {
      const endsAt = view.questCycle.endsAt;
      return endsAt === null || now === undefined
        ? "Selection"
        : `Selection · ${formatQuestCountdown(endsAt, now)}`;
    }
    case "selected":
      return "Selected";
    case "active":
      return "Ongoing";
    case "succeeded":
      return "Completed";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    case "skipped":
      return "Skipped";
    case "expired":
      return "Expired";
    case "cooldown":
      return "Cooldown";
  }
}
