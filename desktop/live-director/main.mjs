import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  safeStorage,
  session,
  shell,
} from "electron";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  normalizeDirectorUrl,
  normalizePreferences,
  parseDesktopLinkUrl,
  redactDirectorUrl,
} from "./link.mjs";

const runtimeDirectory = path.dirname(fileURLToPath(import.meta.url));
const smokeTest = process.argv.includes("--smoke-test");
const smokeUserDataPath = path.join(tmpdir(), `chatxpt-live-director-smoke-${process.pid}`);
const defaultStudioOrigin = process.env.CHATXPT_STUDIO_ORIGIN ?? "http://localhost:3000";
const SETTINGS_VERSION = 1;
const SETTINGS_FILENAME = "live-director-settings.json";
const SHOW_HIDE_SHORTCUT = "CommandOrControl+Shift+H";
const CLICK_THROUGH_SHORTCUT = "CommandOrControl+Shift+L";

app.setName("ChatXPT Live Director");
if (smokeTest) app.setPath("userData", smokeUserDataPath);

let mainWindow = null;
let directorUrl = null;
let lastLoadError = null;
let preferences = normalizePreferences(null);
let clickThrough = false;
let isQuitting = false;
let saveTimer = null;
let pendingDesktopLink = process.argv.find((argument) => argument.startsWith("chatxpt://")) ?? null;
let shortcutsRegistered = false;
let quitSaveStarted = false;
let quitReady = false;

function isLoopbackUrl(input) {
  try {
    const url = new URL(input);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  } catch {
    return false;
  }
}

function normalizeStudioOrigin(input) {
  const url = new URL(input);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopbackUrl(url))) {
    throw new Error("ChatXPT Studio must use HTTPS outside localhost.");
  }
  return url.origin;
}

function currentStudioOrigin() {
  if (directorUrl !== null) return new URL(directorUrl).origin;
  try {
    return normalizeStudioOrigin(defaultStudioOrigin);
  } catch {
    return "http://localhost:3000";
  }
}

function directorNavigationUrl() {
  if (directorUrl === null) return null;
  const url = new URL(directorUrl);
  url.hash = "";
  return url.toString();
}

function directorAuth() {
  if (directorUrl === null) return null;
  const url = new URL(directorUrl);
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
  return {
    broadcasterId: url.searchParams.get("broadcasterId"),
    accessToken: fragment.get("directorAccessToken"),
  };
}

function settingsPath() {
  return path.join(app.getPath("userData"), SETTINGS_FILENAME);
}

function publicState() {
  return {
    linked: directorUrl !== null,
    linkedUrl: directorUrl === null ? null : redactDirectorUrl(directorUrl),
    secureStorage: safeStorage.isEncryptionAvailable(),
    alwaysOnTop: preferences.alwaysOnTop,
    allWorkspaces: preferences.allWorkspaces,
    autoLaunch: preferences.autoLaunch,
    autoLaunchSupported: app.isPackaged,
    opacity: preferences.opacity,
    clickThrough,
    visible: mainWindow?.isVisible() ?? false,
    lastLoadError,
    studioUrl: new URL("/studio", currentStudioOrigin()).toString(),
    shortcutsRegistered,
    version: app.getVersion(),
  };
}

async function loadSettings() {
  try {
    const parsed = JSON.parse(await readFile(settingsPath(), "utf8"));
    if (parsed.version !== SETTINGS_VERSION) return;
    preferences = normalizePreferences(parsed.preferences);
    if (typeof parsed.encryptedDirectorUrl === "string" && safeStorage.isEncryptionAvailable()) {
      const decrypted = safeStorage.decryptString(Buffer.from(parsed.encryptedDirectorUrl, "base64"));
      directorUrl = normalizeDirectorUrl(decrypted);
    }
  } catch (caught) {
    if (caught && typeof caught === "object" && "code" in caught && caught.code === "ENOENT") return;
    directorUrl = null;
    lastLoadError = "The saved private link could not be unlocked. Link this computer again from Studio.";
  }
}

async function saveSettings() {
  const bounds = mainWindow && !mainWindow.isDestroyed()
    ? mainWindow.getBounds()
    : preferences.bounds;
  preferences = normalizePreferences({ ...preferences, bounds });
  let encryptedDirectorUrl = null;
  if (directorUrl !== null && safeStorage.isEncryptionAvailable()) {
    encryptedDirectorUrl = safeStorage.encryptString(directorUrl).toString("base64");
  }
  const target = settingsPath();
  const temporary = `${target}.tmp`;
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await writeFile(temporary, `${JSON.stringify({
    version: SETTINGS_VERSION,
    preferences,
    encryptedDirectorUrl,
  }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, target);
}

function scheduleSettingsSave() {
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void saveSettings();
  }, 250);
}

function updateWindowTitle() {
  if (mainWindow === null || mainWindow.isDestroyed()) return;
  mainWindow.setTitle(clickThrough
    ? "ChatXPT Live Director — Click-through"
    : "ChatXPT Live Director");
}

function applyWindowPreferences() {
  if (mainWindow === null || mainWindow.isDestroyed()) return;
  const level = process.platform === "darwin" ? "floating" : "normal";
  mainWindow.setAlwaysOnTop(preferences.alwaysOnTop, level);
  if (process.platform === "darwin") {
    mainWindow.setVisibleOnAllWorkspaces(preferences.allWorkspaces, { visibleOnFullScreen: true });
  }
  if (process.platform !== "linux") mainWindow.setOpacity(preferences.opacity);
  mainWindow.setIgnoreMouseEvents(clickThrough, { forward: true });
  updateWindowTitle();
}

function setAlwaysOnTop(enabled) {
  preferences = normalizePreferences({ ...preferences, alwaysOnTop: enabled === true });
  applyWindowPreferences();
  scheduleSettingsSave();
  rebuildMenu();
  return publicState();
}

function setAllWorkspaces(enabled) {
  preferences = normalizePreferences({ ...preferences, allWorkspaces: enabled === true });
  applyWindowPreferences();
  scheduleSettingsSave();
  rebuildMenu();
  return publicState();
}

function setOpacity(value) {
  preferences = normalizePreferences({ ...preferences, opacity: value });
  applyWindowPreferences();
  scheduleSettingsSave();
  rebuildMenu();
  return publicState();
}

function setAutoLaunch(enabled) {
  const autoLaunch = app.isPackaged && enabled === true;
  preferences = normalizePreferences({ ...preferences, autoLaunch });
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: autoLaunch, openAsHidden: false });
  scheduleSettingsSave();
  rebuildMenu();
  return publicState();
}

function toggleClickThrough() {
  clickThrough = !clickThrough;
  applyWindowPreferences();
  rebuildMenu();
  if (!clickThrough && mainWindow !== null) mainWindow.focus();
  return publicState();
}

function toggleVisibility() {
  if (mainWindow === null || mainWindow.isDestroyed()) return publicState();
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else if (clickThrough) {
    mainWindow.showInactive();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
  rebuildMenu();
  return publicState();
}

function allowedNavigation(input) {
  const url = new URL(input);
  if (url.protocol === "file:") {
    return path.resolve(fileURLToPath(url)) === path.resolve(path.join(runtimeDirectory, "setup.html"));
  }
  if (directorUrl === null) return false;
  const expected = new URL(directorUrl);
  return url.origin === expected.origin && url.pathname === expected.pathname && url.search === expected.search;
}

function isSetupRenderer(event) {
  if (event.senderFrame === null) return false;
  try {
    const caller = new URL(event.senderFrame.url);
    return caller.protocol === "file:"
      && path.resolve(fileURLToPath(caller)) === path.resolve(path.join(runtimeDirectory, "setup.html"));
  } catch {
    return false;
  }
}

function requireSetupRenderer(event) {
  if (!isSetupRenderer(event)) {
    throw new Error("This desktop action is available only from the trusted setup screen.");
  }
}

async function loadSetup(error = lastLoadError) {
  if (mainWindow === null || mainWindow.isDestroyed()) return;
  lastLoadError = error;
  await mainWindow.loadFile(path.join(runtimeDirectory, "setup.html"));
  mainWindow.show();
  mainWindow.focus();
}

async function loadDirector() {
  if (mainWindow === null || mainWindow.isDestroyed()) return publicState();
  if (directorUrl === null) {
    await loadSetup(null);
    return publicState();
  }
  try {
    await mainWindow.loadURL(directorNavigationUrl());
    lastLoadError = null;
    if (clickThrough) mainWindow.showInactive();
    else mainWindow.show();
  } catch {
    await loadSetup("ChatXPT is not reachable yet. Start the app, then retry this linked Live Director.");
  }
  return publicState();
}

async function saveAndLoadDirector(input) {
  directorUrl = normalizeDirectorUrl(input);
  lastLoadError = null;
  await saveSettings();
  await loadDirector();
  return publicState();
}

async function handleDesktopLink(input) {
  try {
    return await saveAndLoadDirector(parseDesktopLinkUrl(input));
  } catch {
    await loadSetup("That ChatXPT desktop link is invalid or incomplete. Create a new private link in Studio.");
    return publicState();
  }
}

function rebuildMenu() {
  const windowVisible = mainWindow?.isVisible() ?? false;
  const template = [];
  if (process.platform === "darwin") {
    template.push({
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    });
  }
  template.push({
    label: "Window",
    submenu: [
      {
        label: windowVisible ? "Hide Live Director" : "Show Live Director",
        accelerator: SHOW_HIDE_SHORTCUT,
        click: () => toggleVisibility(),
      },
      {
        label: "Always on Top",
        type: "checkbox",
        checked: preferences.alwaysOnTop,
        click: (item) => setAlwaysOnTop(item.checked),
      },
      {
        label: "Click Through",
        type: "checkbox",
        checked: clickThrough,
        accelerator: CLICK_THROUGH_SHORTCUT,
        click: () => toggleClickThrough(),
      },
      {
        label: "Show on Every Desktop",
        type: "checkbox",
        checked: preferences.allWorkspaces,
        enabled: process.platform === "darwin",
        click: (item) => setAllWorkspaces(item.checked),
      },
      {
        label: "Opacity",
        submenu: [1, 0.9, 0.8, 0.7].map((opacity) => ({
          label: `${Math.round(opacity * 100)}%`,
          type: "radio",
          checked: Math.abs(preferences.opacity - opacity) < 0.01,
          click: () => setOpacity(opacity),
        })),
      },
      { type: "separator" },
      { label: "Open ChatXPT Studio", click: () => void shell.openExternal(new URL("/studio", currentStudioOrigin()).toString()) },
      { label: "Relink Broadcaster…", click: () => void loadSetup(null) },
    ],
  });
  template.push({ label: "Edit", submenu: [{ role: "copy" }, { role: "paste" }, { role: "selectAll" }] });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    ...preferences.bounds,
    minWidth: 320,
    minHeight: 420,
    maxWidth: 1600,
    maxHeight: 1400,
    show: false,
    resizable: true,
    minimizable: true,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: "#09070e",
    title: "ChatXPT Live Director",
    webPreferences: {
      preload: path.join(runtimeDirectory, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged,
    },
  });

  applyWindowPreferences();
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-attach-webview", (event) => event.preventDefault());
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!allowedNavigation(url)) event.preventDefault();
  });
  mainWindow.on("move", scheduleSettingsSave);
  mainWindow.on("resize", scheduleSettingsSave);
  mainWindow.on("show", rebuildMenu);
  mainWindow.on("hide", rebuildMenu);
  mainWindow.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow?.hide();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function registerIpc() {
  ipcMain.handle("desktop:get-state", (event) => {
    requireSetupRenderer(event);
    return publicState();
  });
  ipcMain.handle("desktop:get-director-auth", (event) => {
    const auth = directorAuth();
    const navigationUrl = directorNavigationUrl();
    if (auth === null || navigationUrl === null || event.senderFrame === null) return null;
    try {
      const caller = new URL(event.senderFrame.url);
      const expected = new URL(navigationUrl);
      if (
        caller.origin !== expected.origin
        || caller.pathname !== expected.pathname
        || caller.search !== expected.search
      ) return null;
      return auth;
    } catch {
      return null;
    }
  });
  ipcMain.handle("desktop:link", (event, input) => {
    requireSetupRenderer(event);
    return saveAndLoadDirector(input);
  });
  ipcMain.handle("desktop:retry", (event) => {
    requireSetupRenderer(event);
    return loadDirector();
  });
  ipcMain.handle("desktop:unlink", async (event) => {
    requireSetupRenderer(event);
    directorUrl = null;
    clickThrough = false;
    lastLoadError = null;
    await saveSettings();
    await loadSetup(null);
    return publicState();
  });
  ipcMain.handle("desktop:open-studio", (event) => {
    requireSetupRenderer(event);
    return shell.openExternal(new URL("/studio", currentStudioOrigin()).toString());
  });
  ipcMain.handle("desktop:set-always-on-top", (event, enabled) => {
    requireSetupRenderer(event);
    return setAlwaysOnTop(enabled);
  });
  ipcMain.handle("desktop:set-all-workspaces", (event, enabled) => {
    requireSetupRenderer(event);
    return setAllWorkspaces(enabled);
  });
  ipcMain.handle("desktop:set-auto-launch", (event, enabled) => {
    requireSetupRenderer(event);
    return setAutoLaunch(enabled);
  });
  ipcMain.handle("desktop:set-opacity", (event, opacity) => {
    requireSetupRenderer(event);
    return setOpacity(opacity);
  });
  ipcMain.handle("desktop:toggle-click-through", (event) => {
    requireSetupRenderer(event);
    return toggleClickThrough();
  });
  ipcMain.handle("desktop:hide", (event) => {
    requireSetupRenderer(event);
    return toggleVisibility();
  });
}

function registerShortcuts() {
  const visibilityRegistered = globalShortcut.register(SHOW_HIDE_SHORTCUT, () => toggleVisibility());
  const clickThroughRegistered = globalShortcut.register(CLICK_THROUGH_SHORTCUT, () => toggleClickThrough());
  shortcutsRegistered = visibilityRegistered && clickThroughRegistered;
}

function registerProtocolClient() {
  if (process.defaultApp) {
    return app.setAsDefaultProtocolClient("chatxpt", process.execPath, [fileURLToPath(import.meta.url)]);
  }
  return app.setAsDefaultProtocolClient("chatxpt");
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const link = argv.find((argument) => argument.startsWith("chatxpt://"));
    if (link) void handleDesktopLink(link);
    else if (mainWindow !== null) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  app.on("open-url", (event, url) => {
    event.preventDefault();
    if (mainWindow === null) pendingDesktopLink = url;
    else void handleDesktopLink(url);
  });
  app.on("certificate-error", (event, _webContents, url, _error, _certificate, callback) => {
    if (isLoopbackUrl(url)) {
      event.preventDefault();
      callback(true);
      return;
    }
    callback(false);
  });

  void app.whenReady().then(async () => {
    registerProtocolClient();
    registerIpc();
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    await loadSettings();
    createWindow();
    registerShortcuts();
    rebuildMenu();
    if (pendingDesktopLink !== null) {
      const link = pendingDesktopLink;
      pendingDesktopLink = null;
      await handleDesktopLink(link);
    } else {
      await loadDirector();
    }

    if (smokeTest) {
      const clickThroughToggled = toggleClickThrough().clickThrough;
      toggleClickThrough();
      const hiddenToggled = toggleVisibility().visible === false;
      toggleVisibility();
      process.stdout.write(`${JSON.stringify({
        ok: true,
        windowCreated: mainWindow !== null,
        visible: mainWindow?.isVisible() ?? false,
        alwaysOnTop: mainWindow?.isAlwaysOnTop() ?? false,
        clickThroughToggled,
        hiddenToggled,
        linked: directorUrl !== null,
        secureStorage: safeStorage.isEncryptionAvailable(),
      })}\n`);
      setTimeout(() => app.quit(), 300);
    }
  });

  app.on("activate", () => {
    if (mainWindow === null) {
      createWindow();
      void loadDirector();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  app.on("before-quit", (event) => {
    if (quitReady) return;
    event.preventDefault();
    isQuitting = true;
    if (quitSaveStarted) return;
    quitSaveStarted = true;
    if (saveTimer !== null) clearTimeout(saveTimer);
    globalShortcut.unregisterAll();
    void saveSettings().catch(() => undefined).finally(() => {
      quitReady = true;
      app.quit();
    });
  });
}
