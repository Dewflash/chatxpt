import { contextBridge, ipcRenderer } from "electron";

const invoke = (channel, value) => ipcRenderer.invoke(channel, value);

contextBridge.exposeInMainWorld("chatxptDesktop", Object.freeze({
  getState: () => invoke("desktop:get-state"),
  getDirectorAuth: () => invoke("desktop:get-director-auth"),
  link: (url) => invoke("desktop:link", url),
  retry: () => invoke("desktop:retry"),
  unlink: () => invoke("desktop:unlink"),
  openStudio: () => invoke("desktop:open-studio"),
  setAlwaysOnTop: (enabled) => invoke("desktop:set-always-on-top", enabled),
  setAllWorkspaces: (enabled) => invoke("desktop:set-all-workspaces", enabled),
  setAutoLaunch: (enabled) => invoke("desktop:set-auto-launch", enabled),
  setOpacity: (opacity) => invoke("desktop:set-opacity", opacity),
  toggleClickThrough: () => invoke("desktop:toggle-click-through"),
  hide: () => invoke("desktop:hide"),
}));
