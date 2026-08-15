(function () {
  "use strict";

  const configuredOrigin = window.ChatXptExtensionEnvironment
    ? window.ChatXptExtensionEnvironment.ebsOrigin
    : "";
  const questList = document.getElementById("quest-list");
  const submitButton = document.getElementById("submit-vote");
  const voteStatus = document.getElementById("vote-status");
  const connectionState = document.getElementById("connection-state");
  const apiBaseLabel = document.getElementById("api-base-label");
  const countdown = document.getElementById("countdown");

  let apiBase = null;
  let token = null;
  let view = null;
  let selectedCandidateId = null;
  let pendingCandidateId = null;
  let refreshInFlight = false;

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
  apiBaseLabel.textContent = apiBase || "not configured";

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

  function makeCommandId() {
    return `twx-vote-${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`;
  }

  function phase() {
    if (!view) return "loading";
    if (view.session.status === "ended") return "ended";
    if (view.session.status === "offline") return "offline";
    if (view.questCycle.status === "voting") return "voting";
    if (view.questCycle.status === "active") return "active";
    if (["succeeded", "failed", "cancelled", "skipped", "expired"].includes(view.questCycle.status)) {
      return "result";
    }
    return "waiting";
  }

  function voteCount(candidateId) {
    if (!view) return null;
    const reveal = view.acceptedCandidateId !== null || ["active", "result"].includes(phase());
    if (!reveal) return null;
    const tally = view.questCycle.voteTallies.find((item) => item.candidateId === candidateId);
    return tally ? tally.votes : 0;
  }

  function visibleOptions() {
    if (!view) return [];
    const options = Array.isArray(view.questCycle.options) ? view.questCycle.options : [];
    if (["active", "result"].includes(phase()) && view.questCycle.activeCandidateId) {
      return options.filter((option) => option.candidateId === view.questCycle.activeCandidateId);
    }
    return options;
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
    const acceptedCandidateId = view ? view.acceptedCandidateId : null;
    if (acceptedCandidateId !== null) selectedCandidateId = acceptedCandidateId;
    const canVote = Boolean(
      view &&
        view.canVote &&
        phase() === "voting" &&
        acceptedCandidateId === null &&
        token &&
        apiBase,
    );
    submitButton.disabled =
      !canVote || pendingCandidateId !== null || selectedCandidateId === null;
    submitButton.textContent = acceptedCandidateId
      ? "Vote counted"
      : pendingCandidateId
        ? "Sending..."
        : "Submit vote";

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
        const tally = votes === null ? "" : ` · ${votes} votes`;
        return [
          `<button class="quest-choice${selected ? " selected" : ""}${active ? " active" : ""}" data-candidate-id="${escapeHtml(candidate.candidateId)}" ${disabled} type="button">`,
          `<b>${originalIndex + 1}</b>`,
          "<span>",
          `<strong>${escapeHtml(candidate.title)}</strong>`,
          `<small>${escapeHtml(candidate.instruction)}</small>`,
          `<em>${escapeHtml(candidate.difficulty)} · ${candidate.durationSeconds}s · ${candidate.rewardPoints} pts${tally}</em>`,
          active ? "<mark>Winning quest</mark>" : "",
          "</span>",
          "</button>",
        ].join("");
      })
      .join("");

    if (view.questCycle.progress) {
      const percent = Math.round(view.questCycle.progress.value * 100);
      questList.insertAdjacentHTML(
        "beforeend",
        `<div class="quest-progress"><span>Quest progress</span><strong>${percent}%</strong><progress max="100" value="${percent}">${percent}%</progress></div>`,
      );
    }
    if (view.questCycle.result) {
      questList.insertAdjacentHTML(
        "beforeend",
        `<div class="quest-result"><strong>Quest ${escapeHtml(view.questCycle.result.outcome)}</strong><span>${escapeHtml(view.questCycle.result.reason)} · ${view.questCycle.result.rewardPointsAwarded} pts awarded</span></div>`,
      );
    }

    questList.querySelectorAll(".quest-choice").forEach((button) => {
      button.addEventListener("click", () => {
        selectedCandidateId = button.dataset.candidateId;
        const candidate = options.find((item) => item.candidateId === selectedCandidateId);
        setStatus(candidate ? `${candidate.title} selected.` : "Quest selected.", "Ready");
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
        setStatus("Pick one quest, then submit your vote.", "Ready");
      } else if (phase() === "active") {
        setStatus("Winner confirmed. Quest in progress.", "Live");
      } else if (phase() === "result") {
        setStatus("Authoritative quest result received.", "Complete");
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
          commandId: makeCommandId(),
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

  submitButton.addEventListener("click", submitVote);
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
