import type { ActiveQuest } from "./domain";

export const OVERLAY_STORAGE_KEY = "chatxpt:active-quest";
export const OVERLAY_CHANNEL = "chatxpt-overlay";

export function readActiveQuest(): ActiveQuest | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(OVERLAY_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ActiveQuest;
  } catch {
    return null;
  }
}

export function publishActiveQuest(activeQuest: ActiveQuest | null) {
  if (typeof window === "undefined") return;
  if (activeQuest) {
    window.localStorage.setItem(OVERLAY_STORAGE_KEY, JSON.stringify(activeQuest));
  } else {
    window.localStorage.removeItem(OVERLAY_STORAGE_KEY);
  }

  const channel = new BroadcastChannel(OVERLAY_CHANNEL);
  channel.postMessage(activeQuest);
  channel.close();

  void fetch("/api/overlay-state", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(activeQuest),
  }).catch(() => {
    // Local OBS Browser Source fallback is best-effort; browser storage still updates.
  });
}

export async function readSharedActiveQuest(): Promise<ActiveQuest | null> {
  const response = await fetch("/api/overlay-state", { cache: "no-store" });
  if (!response.ok) return null;
  const data = (await response.json()) as { activeQuest?: ActiveQuest | null };
  return data.activeQuest ?? null;
}
