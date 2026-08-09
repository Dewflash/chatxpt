(function () {
  const DEFAULT_API_BASE = "http://localhost:3000";
  const params = new URLSearchParams(window.location.search);
  const configuredApiBase =
    params.get("api") ||
    window.localStorage.getItem("chatxpt-api-base") ||
    DEFAULT_API_BASE;
  const apiBase = configuredApiBase.replace(/\/+$/, "");
  const endpoint = `${apiBase}/api/demo-participation`;

  const questList = document.getElementById("quest-list");
  const submitButton = document.getElementById("submit-vote");
  const voteStatus = document.getElementById("vote-status");
  const connectionState = document.getElementById("connection-state");
  const apiBaseLabel = document.getElementById("api-base-label");

  let snapshot = null;
  let selectedQuestId = null;
  let acceptedQuestId = null;
  let pending = false;

  apiBaseLabel.textContent = apiBase;

  function voterKey() {
    const key = "chatxpt-extension-voter-key";
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const value = `extension:${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;
    window.localStorage.setItem(key, value);
    return value;
  }

  function setStatus(message, state) {
    voteStatus.textContent = message;
    connectionState.textContent = state;
    connectionState.dataset.state = state.toLowerCase();
  }

  function questVoteCount(quest) {
    return snapshot && snapshot.votes ? snapshot.votes[quest.id] || 0 : 0;
  }

  function render() {
    const quests = snapshot && Array.isArray(snapshot.quests) ? snapshot.quests : [];
    submitButton.disabled = pending || acceptedQuestId !== null || selectedQuestId === null;

    if (quests.length !== 3) {
      questList.innerHTML = [
        '<div class="empty-state">',
        "<strong>No vote is open.</strong>",
        "<span>Generate quests in ChatXPT Studio first.</span>",
        "</div>",
      ].join("");
      return;
    }

    questList.innerHTML = quests
      .map((quest, index) => {
        const selected = selectedQuestId === quest.id || acceptedQuestId === quest.id;
        const disabled = pending || acceptedQuestId !== null ? "disabled" : "";
        return [
          `<button class="quest-choice${selected ? " selected" : ""}" data-quest-id="${quest.id}" ${disabled} type="button">`,
          `<b>${index + 1}</b>`,
          "<span>",
          `<strong>${escapeHtml(quest.title)}</strong>`,
          `<small>${escapeHtml(quest.instruction)}</small>`,
          `<em>${escapeHtml(quest.difficulty)} · ${quest.durationSeconds}s · ${quest.rewardPoints} XP · ${questVoteCount(quest)} votes</em>`,
          "</span>",
          "</button>",
        ].join("");
      })
      .join("");

    questList.querySelectorAll(".quest-choice").forEach((button) => {
      button.addEventListener("click", () => {
        selectedQuestId = button.dataset.questId;
        const quest = quests.find((item) => item.id === selectedQuestId);
        setStatus(quest ? `${quest.title} selected.` : "Quest selected.", "Ready");
        render();
      });
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function refresh() {
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      snapshot = await response.json();
      if (snapshot.quests && snapshot.quests.length === 3 && acceptedQuestId === null) {
        setStatus("Pick one quest, then submit your vote.", "Ready");
      } else if (acceptedQuestId === null) {
        setStatus("Waiting for Studio to publish quests.", "Ready");
      }
      render();
    } catch {
      setStatus(`Cannot reach ChatXPT backend at ${apiBase}.`, "Offline");
      render();
    }
  }

  async function submitVote() {
    if (!selectedQuestId || pending) return;
    pending = true;
    submitButton.textContent = "Sending...";
    setStatus("Sending vote...", "Sending");
    render();

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "vote",
          questId: selectedQuestId,
          voterKey: voterKey(),
        }),
      });
      const data = await response.json();
      snapshot = data;
      if (data.accepted) {
        acceptedQuestId = selectedQuestId;
        setStatus("Vote accepted.", "Counted");
      } else if (data.duplicate) {
        acceptedQuestId = data.previousChoice || selectedQuestId;
        setStatus("Your vote is already counted.", "Counted");
      } else {
        setStatus(data.error || "Vote could not be counted.", "Ready");
      }
    } catch {
      setStatus(`Vote failed. Check ${apiBase}.`, "Offline");
    } finally {
      pending = false;
      submitButton.textContent = acceptedQuestId ? "Vote counted" : "Submit vote";
      render();
    }
  }

  submitButton.addEventListener("click", submitVote);

  refresh();
  window.setInterval(refresh, 1500);
})();
