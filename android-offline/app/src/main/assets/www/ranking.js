"use strict";
// Explicit dependencies keep this feature independent of application startup.
window.MenteModules = window.MenteModules || {};
window.MenteModules.ranking = function ({
  store,
  ui,
  catalog,
  rankingRequest,
  training,
  switchScreen,
}) {
  const { $, $$, showToast, setSingleActive } = ui;
  const { LABELS, RANKING_MEDALS, RANKING_MEDAL_ICONS } = catalog;
  const rankSelection = { operation: "add", level: "base", duration: 60 };
  let listVersion = 0;

  async function submitRankedSession(completed, finished) {
    const data = store.getData();
    const rankResult = $("#summary-rank-result");
    rankResult.textContent = "Enviando resultado ao ranking mobile…";
    rankResult.classList.remove("hidden");
    try {
      const result = await rankingRequest("POST", "finish", {
        installId: data.installId,
        sessionId: completed.rankSessionId,
      });
      if (store.getData() !== data) return;
      const improved = result.improved ? "Novo recorde! " : "";
      rankResult.textContent =
        improved +
        result.attemptScore +
        " pontos · posição " +
        result.position +
        " no ranking mobile.";
      finished.rankScore = Number(result.attemptScore) || 0;
      finished.rankPosition = Number(result.position) || 0;
      if (Array.isArray(result.eligibleMedals))
        data.rankingEligibleMedals = result.eligibleMedals;
      store.save(false);
    } catch (error) {
      rankResult.textContent =
        error.message || "Não foi possível enviar o resultado.";
    }
  }

  function rankCategoryLabel() {
    return (
      LABELS.operations[rankSelection.operation] +
      " · " +
      LABELS.levels[rankSelection.level] +
      " · " +
      (rankSelection.duration === 60 ? "1 min" : "2 min")
    );
  }

  async function loadRanking() {
    const requestVersion = ++listVersion;
    const host = $("#ranking-list");
    $("#rank-category-label").textContent = rankCategoryLabel();
    host.replaceChildren();
    const loading = document.createElement("div");
    loading.className = "empty-state";
    loading.textContent = "Carregando ranking mobile…";
    host.appendChild(loading);
    try {
      const result = await rankingRequest("GET", "list", { ...rankSelection });
      if (requestVersion !== listVersion) return;
      renderRanking(Array.isArray(result.entries) ? result.entries : []);
    } catch (error) {
      if (requestVersion !== listVersion) return;
      host.replaceChildren();
      const unavailable = document.createElement("div");
      unavailable.className = "empty-state";
      unavailable.textContent =
        (error.message || "Ranking indisponível.") +
        " O treino offline continua funcionando normalmente.";
      host.appendChild(unavailable);
    }
  }

  function renderRanking(entries) {
    const data = store.getData();
    const host = $("#ranking-list");
    host.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent =
        "Ainda não há resultados nesta categoria. Seja o primeiro!";
      host.appendChild(empty);
      return;
    }
    entries.forEach((entry) => {
      const card = document.createElement("article");
      card.className =
        "rank-item" +
        (data.publicId && entry.publicId === data.publicId ? " is-me" : "");
      const position = document.createElement("span");
      position.className = "rank-position";
      position.textContent = String(entry.position);
      const player = document.createElement("div");
      player.className = "rank-player";
      const nickname = document.createElement("strong");
      nickname.textContent = String(entry.nickname);
      const medals = document.createElement("span");
      medals.className = "rank-medals";
      (Array.isArray(entry.medals) ? entry.medals : [])
        .slice(0, 3)
        .forEach((id) => {
          const icon = document.createElement("span");
          icon.textContent = RANKING_MEDAL_ICONS[id] || "◆";
          icon.title =
            RANKING_MEDALS.find((item) => item.id === id)?.name ||
            "Medalha verificada";
          medals.appendChild(icon);
        });
      if (medals.childNodes.length) nickname.appendChild(medals);
      const details = document.createElement("small");
      details.textContent =
        (entry.publicId ? entry.publicId + " · " : "") +
        entry.correct +
        " acertos · sequência " +
        entry.bestStreak;
      player.append(nickname, details);
      const score = document.createElement("span");
      score.className = "rank-score";
      score.append(document.createTextNode(String(entry.score)));
      const points = document.createElement("small");
      points.textContent = "pontos";
      score.appendChild(points);
      card.append(position, player, score);
      host.appendChild(card);
    });
  }

  async function startRankedSession() {
    const data = store.getData();
    if (!window.MenteAgilAccount?.connected() || !data.accountId) {
      switchScreen("profile");
      showToast("Conecte sua conta para participar do ranking.");
      return;
    }
    const button = $("#rank-start-button");
    if (button.disabled || training.active()) return;
    const chosen = { ...rankSelection };
    const nickname = data.profile.name;
    if (nickname.length < 2) {
      showToast("Escolha um nome com pelo menos 2 caracteres.");
      $("#ranking-name").focus();
      return;
    }
    button.disabled = true;
    button.firstChild.textContent = "Preparando partida… ";
    try {
      const result = await rankingRequest("POST", "session", {
        installId: data.installId,
        nickname,
        operation: chosen.operation,
        level: chosen.level,
        duration: chosen.duration,
      });
      if (store.getData() !== data || training.active()) return;
      data.profile.name = result.nickname || nickname;
      $("#player-name").value = data.profile.name;
      $("#ranking-name").value = data.profile.name;
      store.save(false);
      switchScreen("train");
      training.startSession({
        operation: chosen.operation,
        level: chosen.level,
        mode: "time",
        goal: chosen.duration,
        ranked: true,
        rankSessionId: result.sessionId,
        rankQuestion: result.question,
      });
    } catch (error) {
      showToast(error.message || "Não foi possível iniciar o ranking.");
    } finally {
      button.disabled = false;
      button.firstChild.textContent = "Jogar esta categoria ";
    }
  }

  function bindEvents() {
    $$("#rank-operation-options button").forEach((button) =>
      button.addEventListener("click", () => {
        rankSelection.operation = button.dataset.value;
        setSingleActive("#rank-operation-options", button);
        loadRanking();
      }),
    );
    $$("#rank-level-options button").forEach((button) =>
      button.addEventListener("click", () => {
        rankSelection.level = button.dataset.value;
        setSingleActive("#rank-level-options", button);
        loadRanking();
      }),
    );
    $$("#rank-duration-options button").forEach((button) =>
      button.addEventListener("click", () => {
        rankSelection.duration = Number(button.dataset.value);
        setSingleActive("#rank-duration-options", button);
        loadRanking();
      }),
    );
    $("#rank-start-button").addEventListener("click", startRankedSession);
    $("#rank-refresh-button").addEventListener("click", loadRanking);
  }

  return { loadRanking, submitRankedSession, bindEvents };
};
