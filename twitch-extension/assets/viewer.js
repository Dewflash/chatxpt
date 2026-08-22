(function () {
  "use strict";

  const configuredOrigin = window.ChatXptExtensionEnvironment
    ? window.ChatXptExtensionEnvironment.ebsOrigin
    : "";
  const questList = document.getElementById("quest-list");
  const submitButton = document.getElementById("submit-vote");
  const voteStatus = document.getElementById("vote-status");
  const connectionState = document.getElementById("connection-state");
  const countdown = document.getElementById("countdown");
  const communityHype = document.getElementById("community-hype");
  const sessionPoints = document.getElementById("session-points");
  const sendHypeButton = document.getElementById("send-hype");
  const viewerEngagement = document.getElementById("viewer-engagement");
  const surfaceLabel = document.getElementById("surface-label");
  const surfaceTitle = document.getElementById("surface-title");
  const stateExplanation = document.getElementById("state-explanation");

  let apiBase = null;
  let token = null;
  let view = null;
  let selectedCandidateId = null;
  let pendingCandidateId = null;
  let refreshInFlight = false;
  let reactionPending = false;

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

  apiBase = trustedApiBase(configuredOrigin);

  function setStatus(message, state) {
    voteStatus.textContent = message;
    connectionState.textContent = state;
    connectionState.dataset.state = state.toLowerCase();
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function makeCommandId(prefix) {
    return `twx-${prefix}-${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`;
  }

  function phase() {
    if (!view) return "loading";
    if (view.session.status === "ended") return "ended";
    if (view.session.status === "offline") return "offline";
    if (view.questCycle.status === "voting") return "voting";
    if (view.questCycle.status === "selected") return "selected";
    if (view.questCycle.status === "active") return "active";
    if (["succeeded", "failed", "cancelled", "skipped", "expired"].includes(view.questCycle.status)) {
      return "result";
    }
    if (view.questCycle.status === "cooldown") return "cooldown";
    return "waiting";
  }

  function voteCount(candidateId) {
    if (!view) return null;
    const reveal = view.acceptedCandidateId !== null || ["selected", "active", "result"].includes(phase());
    if (!reveal) return null;
    const tally = view.questCycle.voteTallies.find((item) => item.candidateId === candidateId);
    return tally ? tally.votes : 0;
  }

  function visibleOptions() {
    if (!view) return [];
    const options = Array.isArray(view.questCycle.options) ? view.questCycle.options : [];
    if (["selected", "active", "result"].includes(phase()) && view.questCycle.activeCandidateId) {
      return options.filter((option) => option.candidateId === view.questCycle.activeCandidateId);
    }
    return options;
  }

  function surfacePresentation() {
    const currentPhase = phase();
    const active = view && view.questCycle.activeCandidateId
      ? view.questCycle.options.find(
        (option) => option.candidateId === view.questCycle.activeCandidateId,
      )
      : null;
    const result = view ? view.questCycle.result : null;
    if (currentPhase === "voting") {
      return {
        label: "Audience vote",
        title: "Vote now",
        explanation: view && view.acceptedCandidateId
          ? "Your vote is locked in. The server-supplied tallies are now visible."
          : "Choose one of the three safe sidequests, review its details, then confirm your vote.",
      };
    }
    if (currentPhase === "selected") {
      return {
        label: "Winning sidequest",
        title: active ? active.title : "Winner selected",
        explanation: "The audience winner is confirmed and is waiting to start.",
      };
    }
    if (currentPhase === "active") {
      return {
        label: "Sidequest active",
        title: active ? active.title : "Sidequest active",
        explanation: "This is the same active sidequest now shown on the broadcast.",
      };
    }
    if (currentPhase === "result") {
      const resultTitles = {
        succeeded: "Sidequest completed",
        failed: "Sidequest attempt ended",
        cancelled: "Sidequest cancelled",
        skipped: "Sidequest skipped",
        expired: "Sidequest expired",
      };
      return {
        label: "Sidequest result",
        title: result ? resultTitles[result.outcome] || "Sidequest result" : "Sidequest result",
        explanation: "The official sidequest result and any awarded reward are shown below.",
      };
    }
    if (currentPhase === "cooldown") {
      return {
        label: "ChatXPT viewer",
        title: "Next vote soon",
        explanation: "ChatXPT is waiting for another safe moment before opening the next vote.",
      };
    }
    const titles = {
      loading: "Loading sidequest",
      offline: "Stream offline",
      ended: "Stream ended",
      waiting: "Waiting for sidequests",
    };
    return {
      label: "ChatXPT viewer",
      title: titles[currentPhase] || "Waiting for sidequests",
      explanation: "Keep this panel open for the next audience sidequest.",
    };
  }

  function renderCountdown() {
    if (!view || view.questCycle.endsAt === null || !["voting", "active"].includes(phase())) {
      countdown.textContent = "";
      countdown.hidden = true;
      return;
    }
    const seconds = Math.max(0, Math.ceil((view.questCycle.endsAt - Date.now()) / 1000));
    countdown.textContent = `${seconds}s left`;
    countdown.hidden = false;
  }

  function render() {
    const options = visibleOptions();
    const presentation = surfacePresentation();
    const acceptedCandidateId = view ? view.acceptedCandidateId : null;
    surfaceLabel.textContent = presentation.label;
    surfaceTitle.textContent = presentation.title;
    stateExplanation.textContent = presentation.explanation;
    if (acceptedCandidateId !== null) selectedCandidateId = acceptedCandidateId;
    const canVote = Boolean(
      view &&
        view.canVote &&
        phase() === "voting" &&
        acceptedCandidateId === null &&
        token &&
        apiBase,
    );
    const canReact = Boolean(view && view.canReact && token && apiBase);
    communityHype.textContent = view ? String(view.communityHype) : "0";
    sessionPoints.textContent = view ? String(view.sessionPoints) : "0";
    viewerEngagement.hidden = !view;
    sendHypeButton.disabled = !canReact || reactionPending;
    sendHypeButton.textContent = reactionPending ? "Sending hype…" : "Send hype";
    submitButton.hidden = phase() !== "voting";
    submitButton.disabled =
      !canVote || pendingCandidateId !== null || selectedCandidateId === null;
    submitButton.textContent = acceptedCandidateId
      ? "Vote counted"
      : pendingCandidateId
        ? "Sending..."
        : "Vote";

    if (options.length === 0) {
      questList.innerHTML = [
        '<div class="empty-state">',
        `<strong>${phase() === "loading" ? "Connecting to Twitch…" : "No vote is open."}</strong>`,
        `<span>${phase() === "loading" ? "Viewer identity is being authorized." : "Stay here for the next sidequest."}</span>`,
        "</div>",
      ].join("");
      renderCountdown();
      return;
    }

    questList.innerHTML = options
      .map((candidate) => {
        const originalIndex = view.questCycle.options.findIndex(
          (option) => option.candidateId === candidate.candidateId,
        );
        const selected =
          selectedCandidateId === candidate.candidateId ||
          acceptedCandidateId === candidate.candidateId;
        const active = view.questCycle.activeCandidateId === candidate.candidateId;
        const votes = voteCount(candidate.candidateId);
        const disabled = !canVote || pendingCandidateId !== null ? "disabled" : "";
        const selectedState = selected ? ' aria-pressed="true"' : ' aria-pressed="false"';
        const tally = votes === null ? "" : `<span>${votes} votes</span>`;
        return [
          `<button class="quest-choice${selected ? " selected" : ""}${active ? " active" : ""}" data-candidate-id="${escapeHtml(candidate.candidateId)}"${selectedState} ${disabled} type="button">`,
          `<b>${originalIndex + 1}</b>`,
          '<span class="quest-copy">',
          `<strong>${escapeHtml(candidate.title)}</strong>`,
          `<small>${escapeHtml(candidate.instruction)}</small>`,
          '<em class="quest-meta">',
          `<span>${escapeHtml(candidate.difficulty)}</span>`,
          `<span>${candidate.durationSeconds}s</span>`,
          `<span>${candidate.rewardPoints} pts</span>`,
          tally,
          selected && !active ? "<span>Selected</span>" : "",
          active ? "<span>Winner</span>" : "",
          "</em>",
          "</span>",
          "</button>",
        ].join("");
      })
      .join("");

    if (view.questCycle.progress) {
      const percent = Math.round(view.questCycle.progress.value * 100);
      questList.insertAdjacentHTML(
        "beforeend",
        `<div class="quest-progress"><span>Sidequest progress</span><strong>${percent}%</strong><progress max="100" value="${percent}">${percent}%</progress></div>`,
      );
    }
    if (view.questCycle.result) {
      questList.insertAdjacentHTML(
        "beforeend",
        `<div class="quest-result"><strong>Sidequest ${escapeHtml(view.questCycle.result.outcome)}</strong><span>${escapeHtml(view.questCycle.result.reason)} · ${view.questCycle.result.rewardPointsAwarded} pts awarded</span></div>`,
      );
    }

    questList.querySelectorAll(".quest-choice").forEach((button) => {
      button.addEventListener("click", () => {
        selectedCandidateId = button.dataset.candidateId;
        const candidate = options.find((item) => item.candidateId === selectedCandidateId);
        setStatus(candidate ? `${candidate.title} selected.` : "Sidequest selected.", "Ready");
        render();
      });
    });
    renderCountdown();
  }

  async function authorizedFetch(path, options) {
    if (!apiBase || !token) throw new Error("Twitch authorization or EBS is unavailable");
    return fetch(`${apiBase}${path}`, {
      ...options,
      cache: "no-store",
      headers: {
        ...(options && options.headers ? options.headers : {}),
        authorization: `Bearer ${token}`,
      },
    });
  }

  async function refresh() {
    if (refreshInFlight || !token || !apiBase) return;
    refreshInFlight = true;
    try {
      const response = await authorizedFetch("/api/twitch/extension/viewer");
      const payload = await response.json();
      if (!response.ok || !payload.ok || !payload.view) {
        throw new Error(payload.error && payload.error.message ? payload.error.message : "Viewer state unavailable");
      }
      view = payload.view;
      if (
        selectedCandidateId &&
        !view.questCycle.options.some((candidate) => candidate.candidateId === selectedCandidateId)
      ) {
        selectedCandidateId = null;
      }
      if (view.acceptedCandidateId) {
        selectedCandidateId = view.acceptedCandidateId;
        setStatus("Vote accepted. Live tallies are visible.", "Counted");
      } else if (phase() === "voting") {
        setStatus("Select one sidequest, then vote.", "Ready");
      } else if (phase() === "active") {
        setStatus("Winner confirmed. Sidequest in progress.", "Live");
      } else if (phase() === "result") {
        setStatus("Authoritative sidequest result received.", "Complete");
      } else {
        setStatus("Waiting for the next sidequest.", "Ready");
      }
      render();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Reconnecting to ChatXPT.", "Offline");
      render();
    } finally {
      refreshInFlight = false;
    }
  }

  async function submitVote() {
    if (!selectedCandidateId || pendingCandidateId || !view || !view.canVote) return;
    pendingCandidateId = selectedCandidateId;
    setStatus("Sending vote…", "Sending");
    render();
    try {
      const response = await authorizedFetch("/api/twitch/extension/commands", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          commandId: makeCommandId("vote"),
          candidateId: selectedCandidateId,
        }),
      });
      const payload = await response.json();
      if (payload.view) view = payload.view;
      if (!response.ok || !payload.ok) {
        setStatus(
          payload.error && payload.error.message ? payload.error.message : "Vote could not be accepted.",
          "Ready",
        );
      } else {
        selectedCandidateId = view.acceptedCandidateId || selectedCandidateId;
        setStatus("Vote accepted. Live tallies are visible.", "Counted");
      }
    } catch {
      setStatus("Vote response interrupted. Checking your confirmed vote…", "Offline");
      await refresh();
    } finally {
      pendingCandidateId = null;
      render();
    }
  }

  async function submitReaction() {
    if (!view || !view.canReact || reactionPending) return;
    reactionPending = true;
    render();
    try {
      const response = await authorizedFetch("/api/twitch/extension/commands", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ commandId: makeCommandId("reaction"), reaction: "hype" }),
      });
      const payload = await response.json();
      if (payload.view) view = payload.view;
      if (!response.ok || !payload.ok) {
        setStatus(
          payload.error && payload.error.message ? payload.error.message : "Hype reaction was not accepted.",
          "Ready",
        );
      } else {
        setStatus("Hype added to the community meter.", "Counted");
      }
    } catch {
      setStatus("Reaction response interrupted. Reconnecting…", "Offline");
    } finally {
      reactionPending = false;
      render();
    }
  }

  submitButton.addEventListener("click", submitVote);
  sendHypeButton.addEventListener("click", submitReaction);
  window.setInterval(refresh, 1500);
  window.setInterval(renderCountdown, 250);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void refresh();
  });

  if (!apiBase) {
    setStatus("ChatXPT EBS origin is not safely configured in assets/environment.js.", "Offline");
    render();
    return;
  }
  if (!window.Twitch || !window.Twitch.ext) {
    setStatus("Open this panel through Twitch Local Test or Hosted Test.", "Offline");
    render();
    return;
  }
  window.Twitch.ext.onAuthorized((authorization) => {
    token = authorization.token;
    setStatus("Twitch authorized. Connecting to ChatXPT…", "Connecting");
    void refresh();
  });
})();
