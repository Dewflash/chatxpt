const api = window.chatxptDesktop;
const elements = {
  statusPill: document.querySelector("#status-pill"),
  statusTitle: document.querySelector("#status-title"),
  statusDetail: document.querySelector("#status-detail"),
  form: document.querySelector("#link-form"),
  url: document.querySelector("#director-url"),
  openStudio: document.querySelector("#open-studio"),
  retry: document.querySelector("#retry"),
  unlink: document.querySelector("#unlink"),
  error: document.querySelector("#action-error"),
  alwaysOnTop: document.querySelector("#always-on-top"),
  allWorkspaces: document.querySelector("#all-workspaces"),
  autoLaunch: document.querySelector("#auto-launch"),
  autoLaunchDetail: document.querySelector("#auto-launch-detail"),
  opacity: document.querySelector("#opacity"),
  opacityValue: document.querySelector("#opacity-value"),
};

function showError(message) {
  elements.error.textContent = message;
  elements.error.hidden = message === "";
}

function render(state) {
  elements.alwaysOnTop.checked = state.alwaysOnTop;
  elements.allWorkspaces.checked = state.allWorkspaces;
  elements.autoLaunch.checked = state.autoLaunch;
  elements.autoLaunch.disabled = !state.autoLaunchSupported;
  elements.autoLaunchDetail.textContent = state.autoLaunchSupported
    ? "Open the companion automatically after signing in."
    : "Available after installing the packaged app.";
  elements.opacity.value = String(Math.round(state.opacity * 100));
  elements.opacityValue.textContent = `${Math.round(state.opacity * 100)}%`;
  elements.retry.disabled = !state.linked;
  elements.unlink.disabled = !state.linked;

  if (state.lastLoadError) {
    elements.statusPill.textContent = "Offline";
    elements.statusPill.dataset.tone = "warning";
    elements.statusTitle.textContent = "Linked, waiting for ChatXPT";
    elements.statusDetail.textContent = state.lastLoadError;
  } else if (state.linked) {
    elements.statusPill.textContent = "Linked";
    elements.statusPill.dataset.tone = "ready";
    elements.statusTitle.textContent = "This computer is linked";
    elements.statusDetail.textContent = state.secureStorage
      ? "The broadcaster grant is encrypted. Retry to open the current Live Director."
      : "Secure storage is unavailable, so this link lasts only until the companion closes.";
  } else {
    elements.statusPill.textContent = "Not linked";
    elements.statusPill.dataset.tone = "warning";
    elements.statusTitle.textContent = "Link your broadcaster";
    elements.statusDetail.textContent = "Open Studio or paste the permanent private Live Director link once.";
  }
}

async function refresh() {
  try {
    render(await api.getState());
  } catch {
    showError("The desktop companion could not read its current state.");
  }
}

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError("");
  try {
    await api.link(elements.url.value);
  } catch (caught) {
    showError(caught instanceof Error ? caught.message : "This Live Director link could not be saved.");
  }
});

elements.openStudio.addEventListener("click", () => void api.openStudio());
elements.retry.addEventListener("click", () => void api.retry());
elements.unlink.addEventListener("click", async () => {
  if (!window.confirm("Unlink this computer from the current broadcaster?")) return;
  await api.unlink();
  elements.url.value = "";
  await refresh();
});
elements.alwaysOnTop.addEventListener("change", async () => render(await api.setAlwaysOnTop(elements.alwaysOnTop.checked)));
elements.allWorkspaces.addEventListener("change", async () => render(await api.setAllWorkspaces(elements.allWorkspaces.checked)));
elements.autoLaunch.addEventListener("change", async () => render(await api.setAutoLaunch(elements.autoLaunch.checked)));
elements.opacity.addEventListener("input", () => {
  elements.opacityValue.textContent = `${elements.opacity.value}%`;
});
elements.opacity.addEventListener("change", async () => render(await api.setOpacity(Number(elements.opacity.value) / 100)));

void refresh();
