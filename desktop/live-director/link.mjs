const DIRECTOR_PATH = "/live-director-overlay";
const TOKEN_MIN_LENGTH = 16;
const TOKEN_MAX_LENGTH = 4096;
const DEFAULT_BOUNDS = Object.freeze({ width: 420, height: 760 });

function isLoopbackHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function boundedInteger(value, minimum, maximum, fallback) {
  return Number.isInteger(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback;
}

export function normalizeDirectorUrl(input) {
  const value = typeof input === "string" ? input.trim() : "";
  const url = new URL(value);
  if (url.username !== "" || url.password !== "") {
    throw new Error("The Live Director link cannot contain embedded credentials.");
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopbackHostname(url.hostname))) {
    throw new Error("Use an HTTPS Live Director link, or localhost during development.");
  }
  if (url.pathname !== DIRECTOR_PATH) {
    throw new Error("This is not a private Live Director link.");
  }

  const broadcasterId = url.searchParams.get("broadcasterId")?.trim() ?? "";
  if (!/^[A-Za-z0-9._:-]{1,160}$/u.test(broadcasterId)) {
    throw new Error("The Live Director link has no valid broadcaster.");
  }
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
  const token = fragment.get("directorAccessToken")?.trim() ?? "";
  if (token.length < TOKEN_MIN_LENGTH || token.length > TOKEN_MAX_LENGTH) {
    throw new Error("The Live Director link has no valid private access grant.");
  }

  url.search = new URLSearchParams({ broadcasterId }).toString();
  url.hash = new URLSearchParams({ directorAccessToken: token }).toString();
  return url.toString();
}

export function createDesktopLinkUrl(input) {
  const directorUrl = normalizeDirectorUrl(input);
  const link = new URL("chatxpt://link");
  link.searchParams.set("url", directorUrl);
  return link.toString();
}

export function parseDesktopLinkUrl(input) {
  const link = new URL(input);
  if (link.protocol !== "chatxpt:" || link.hostname !== "link") {
    throw new Error("This ChatXPT desktop link is not supported.");
  }
  return normalizeDirectorUrl(link.searchParams.get("url") ?? "");
}

export function redactDirectorUrl(input) {
  const url = new URL(normalizeDirectorUrl(input));
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
  fragment.set("directorAccessToken", "redacted");
  url.hash = fragment.toString();
  return url.toString();
}

export function normalizeWindowBounds(input) {
  const record = input && typeof input === "object" ? input : {};
  const bounds = {
    width: boundedInteger(record.width, 320, 1600, DEFAULT_BOUNDS.width),
    height: boundedInteger(record.height, 420, 1400, DEFAULT_BOUNDS.height),
  };
  if (Number.isInteger(record.x)) bounds.x = record.x;
  if (Number.isInteger(record.y)) bounds.y = record.y;
  return bounds;
}

export function normalizePreferences(input) {
  const record = input && typeof input === "object" ? input : {};
  const opacity = typeof record.opacity === "number" && Number.isFinite(record.opacity)
    ? Math.min(1, Math.max(0.7, record.opacity))
    : 0.96;
  return {
    alwaysOnTop: record.alwaysOnTop !== false,
    allWorkspaces: record.allWorkspaces !== false,
    autoLaunch: record.autoLaunch === true,
    opacity,
    bounds: normalizeWindowBounds(record.bounds),
  };
}
