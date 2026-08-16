(function () {
  "use strict";

  const surface = document.body.dataset.surface;
  const configuredOrigin = window.ChatXptExtensionEnvironment
    ? window.ChatXptExtensionEnvironment.ebsOrigin
    : "";
  const connectionState = document.getElementById("connection-state");
  const message = document.getElementById("control-message");
  const content = document.getElementById("broadcaster-content");
  const studioLink = document.getElementById("studio-link");
  let token = null;
  let view = null;
  let readiness = null;
  let selectedCandidateId = null;
  let pending = false;
  let confirmAction = null;

  function trustedApiBase(value) {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "https:" || parsed.pathname !== "/" || parsed.search || parsed.hash) {
        return null;
      }
      return parsed.origin;
    } catch {
      return null;
    }
  }

  const apiBase = trustedApiBase(configuredOrigin);
  if (studioLink && apiBase) studioLink.href = `${apiBase}/studio`;

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function titleCase(value) {
    return String(value)
      .split(/[-_]/)
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(" ");
  }

  function commandId(prefix) {
    const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);
    return `${prefix}-${id}`;
  }

  function setStatus(text, state, detail) {
    connectionState.textContent = text;
    connectionState.dataset.state = state;
    if (detail) message.textContent = detail;
  }

  async function authorizedFetch(path, options) {
    if (!apiBase || !token) throw new Error("Twitch broadcaster authorization or EBS is unavailable");
    return fetch(`${apiBase}${path}`, {
      ...options,
      cache: "no-store",
      headers: {
        ...(options && options.headers ? options.headers : {}),
        authorization: `Bearer ${token}`,
      },
    });
  }

  function readinessService(id) {
    return readiness && readiness.services
      ? readiness.services.find((service) => service.service === id)
      : null;
  }

  function renderConfig() {
    const twitch = readinessService("twitch");
    const game = view.profile.gameName || "No Game Profile selected";
    content.innerHTML = [
      '<section class="control-card">',
      '<div class="control-row"><span>Twitch Extension</span>',
      `<strong>${escapeHtml(twitch ? titleCase(twitch.health.status) : "Unknown")}</strong></div>`,
      `<p>${escapeHtml(twitch && twitch.health.message ? twitch.health.message : "Twitch setup health is unavailable.")}</p>`,
      "</section>",
      '<section class="control-summary">',
      `<div><span>Streamer</span><strong>${escapeHtml(view.profile.displayName)}</strong></div>`,
      `<div><span>Game Profile</span><strong>${escapeHtml(game)}</strong></div>`,
      `<div><span>Sidequest intensity</span><strong>${Math.round((view.profile.experience.intensity || 0.5) * 100)}%</strong></div>`,
      "</section>",
      '<section class="control-note"><strong>Full management stays in Studio</strong><p>Personality, safety, accessibility, voting, rewards, diagnostics, and session start are managed in ChatXPT Studio.</p></section>',
    ].join("");
  }

  function healthItem(label, serviceId) {
    const service = readinessService(serviceId);
    const status = service ? service.health.status : "unknown";
    return `<div><span>${escapeHtml(label)}</span><strong data-health="${escapeHtml(status)}">${escapeHtml(titleCase(status))}</strong></div>`;
  }

  function questAction(action, label, danger) {
    const needsCandidate = ["approve", "reject", "start"].includes(action);
    const disabled = pending || (needsCandidate && !selectedCandidateId);
    const confirming = confirmAction === action;
    return `<button type="button" class="control-action${danger ? " danger" : ""}" data-action="${action}" ${disabled ? "disabled" : ""}>${confirming ? `Confirm ${escapeHtml(label.toLowerCase())}` : escapeHtml(label)}</button>`;
  }

  function renderLiveConfig() {
    const cycle = view.questCycle;
    if (!selectedCandidateId) {
      selectedCandidateId = cycle.activeCandidateId || (cycle.options[0] && cycle.options[0].candidateId) || null;
    }
    const active = cycle.options.find((option) => option.candidateId === cycle.activeCandidateId);
    const options = cycle.options.length === 3 && !active
      ? `<div class="control-options">${cycle.options.map((option) => [
          `<button type="button" class="control-option${selectedCandidateId === option.candidateId ? " selected" : ""}" data-candidate-id="${escapeHtml(option.candidateId)}" ${pending ? "disabled" : ""}>`,
          `<strong>${escapeHtml(option.title)}</strong>`,
          `<span>${escapeHtml(titleCase(option.difficulty))} · ${option.durationSeconds}s · ${option.rewardPoints} pts</span>`,
          "</button>",
        ].join("")).join("")}</div>`
      : active
        ? `<section class="control-card active"><span>Active sidequest</span><strong>${escapeHtml(active.title)}</strong><p>${escapeHtml(active.instruction)}</p></section>`
        : '<section class="control-note"><strong>No three-option sidequest proposal</strong><p>Waiting for the authoritative runtime.</p></section>';
    const actions = cycle.availableStreamerActions || [];
    const regular = actions.filter((action) => action !== "emergency-pause").map((action) =>
      questAction(
        action,
        ({ approve: "Approve", reject: "Reject", start: "Start", pause: "Pause", cancel: "Cancel", skip: "Skip", succeed: "Succeeded", fail: "Failed" })[action] || titleCase(action),
        ["cancel", "skip", "fail"].includes(action),
      )
    ).join("");
    content.innerHTML = [
      '<section class="control-health">',
      healthItem("Capture Health", "obs-capture"),
      '<div><span>Gameplay Activity</span><strong data-health="unknown">Unknown</strong></div>',
      healthItem("Realtime", "realtime"),
      "</section>",
      `<div class="control-heading"><span>Sidequest</span><strong>${escapeHtml(titleCase(cycle.status))}</strong></div>`,
      options,
      cycle.progress
        ? `<section class="control-progress"><span>Progress</span><strong>${Math.round(cycle.progress.value * 100)}%</strong><progress max="100" value="${Math.round(cycle.progress.value * 100)}"></progress></section>`
        : "",
      cycle.status === "active" && cycle.completionRule && cycle.completionRule.mode === "manual"
        ? `<section class="manual-progress"><label><span>Manual sidequest progress</span><output id="manual-progress-value">${Math.round((cycle.progress ? cycle.progress.value : 0) * 100)}%</output><input id="manual-progress" type="range" min="0" max="1" step="0.05" value="${cycle.progress ? cycle.progress.value : 0}" ${pending ? "disabled" : ""}></label><button id="update-progress" type="button" ${pending ? "disabled" : ""}>Update progress</button></section>`
        : "",
      `<section class="control-actions">${regular}</section>`,
      actions.includes("emergency-pause")
        ? questAction("emergency-pause", "Emergency pause", true)
        : "",
      '<section class="control-note"><strong>This session follows saved defaults</strong><p>Temporary sidequest intensity remains unavailable until the canonical override contract lands.</p></section>',
    ].join("");

    content.querySelectorAll("[data-candidate-id]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedCandidateId = button.dataset.candidateId;
        confirmAction = null;
        renderLiveConfig();
      });
    });
    content.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => void requestAction(button.dataset.action));
    });
    const progressInput = document.getElementById("manual-progress");
    const progressOutput = document.getElementById("manual-progress-value");
    const progressButton = document.getElementById("update-progress");
    if (progressInput && progressOutput && progressButton) {
      progressInput.addEventListener("input", () => {
        progressOutput.textContent = `${Math.round(Number(progressInput.value) * 100)}%`;
      });
      progressButton.addEventListener("click", () => void requestProgress(Number(progressInput.value)));
    }
  }

  function render() {
    if (!view || !readiness) return;
    setStatus(
      view.session.status === "live" ? "Live" : titleCase(view.session.status),
      view.session.status === "live" ? "ready" : "offline",
      message.textContent,
    );
    if (surface === "config") renderConfig();
    else renderLiveConfig();
  }

  async function refresh() {
    if (!token || !apiBase || pending) return;
    try {
      const response = await authorizedFetch("/api/studio/session");
      const payload = await response.json();
      if (!response.ok || !payload.ok || !payload.view || !payload.readiness) {
        throw new Error(payload.error && payload.error.message ? payload.error.message : "Streamer state unavailable");
      }
      view = payload.view;
      readiness = payload.readiness;
      if (
        selectedCandidateId &&
        !view.questCycle.options.some((option) => option.candidateId === selectedCandidateId)
      ) {
        selectedCandidateId = null;
      }
      message.textContent = readiness.label;
      render();
    } catch (error) {
      setStatus("Offline", "offline", error instanceof Error ? error.message : "Reconnecting to ChatXPT");
    }
  }

  function buildQuestCommand(action) {
    const id = commandId(`quest-${action}`);
    return {
      contractVersion: "1.0.0",
      sessionId: view.session.sessionId,
      questCycleId: view.questCycle.envelope.questCycleId,
      commandId: id,
      correlationId: id,
      expectedRevision: view.envelope.revision,
      issuedAt: Date.now(),
      actor: { kind: "broadcaster", actorId: view.profile.streamerId },
      type: "streamer.quest",
      action,
      candidateId: ["approve", "reject", "start"].includes(action) ? selectedCandidateId : null,
    };
  }

  function buildProgressCommand(value) {
    const id = commandId("quest-progress");
    return {
      contractVersion: "1.0.0",
      sessionId: view.session.sessionId,
      questCycleId: view.questCycle.envelope.questCycleId,
      commandId: id,
      correlationId: id,
      expectedRevision: view.envelope.revision,
      issuedAt: Date.now(),
      actor: { kind: "broadcaster", actorId: view.profile.streamerId },
      type: "streamer.quest-progress",
      requestedValue: value,
    };
  }

  async function requestAction(action) {
    if (!view || pending) return;
    if (["cancel", "skip", "fail"].includes(action) && confirmAction !== action) {
      confirmAction = action;
      message.textContent = `Confirm ${titleCase(action).toLowerCase()} to change the authoritative sidequest.`;
      renderLiveConfig();
      return;
    }
    pending = true;
    confirmAction = null;
    message.textContent = "Saving authoritative control…";
    renderLiveConfig();
    try {
      const response = await authorizedFetch("/api/studio/commands", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildQuestCommand(action)),
      });
      const payload = await response.json();
      if (payload.view) view = payload.view;
      if (payload.readiness) readiness = payload.readiness;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error && payload.error.message ? payload.error.message : "Control was rejected");
      }
      message.textContent = payload.message || "Authoritative control saved.";
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : "Control response interrupted";
    } finally {
      pending = false;
      renderLiveConfig();
    }
  }

  async function requestProgress(value) {
    if (!view || pending) return;
    pending = true;
    message.textContent = "Saving manual sidequest progress…";
    renderLiveConfig();
    try {
      const response = await authorizedFetch("/api/studio/commands", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildProgressCommand(value)),
      });
      const payload = await response.json();
      if (payload.view) view = payload.view;
      if (payload.readiness) readiness = payload.readiness;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error && payload.error.message ? payload.error.message : "Progress was rejected");
      }
      message.textContent = payload.message || "Manual sidequest progress saved.";
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : "Progress response interrupted";
    } finally {
      pending = false;
      renderLiveConfig();
    }
  }

  if (!apiBase) {
    setStatus("Offline", "offline", "Set the trusted EBS origin in assets/environment.js before upload.");
    return;
  }
  if (!window.Twitch || !window.Twitch.ext) {
    setStatus("Offline", "offline", "Open this page through Twitch Config or Live Config.");
    return;
  }
  window.Twitch.ext.onAuthorized((authorization) => {
    token = authorization.token;
    setStatus("Connecting", "connecting", "Twitch authorized the broadcaster. Loading ChatXPT…");
    void refresh();
  });
  window.setInterval(() => void refresh(), 2_000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void refresh();
  });
})();
