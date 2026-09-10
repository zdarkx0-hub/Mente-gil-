(function startMenteAgil() {
  "use strict";

  const core = window.MenteCore;
  const DEFAULT_DATA = {
    version: 3,
    installId: "",
    profile: { name: "Jogador", sound: true, theme: "neon", publicMedals: [] },
    rankingEligibleMedals: [],
    sessions: []
  };
  const LABELS = {
    operations: { add: "Soma", sub: "Subtração", mul: "Multiplicação" },
    levels: { base: "Base", medium: "Até 100", advanced: "Até 1.000" }
  };
  const ACHIEVEMENTS = [
    { id: "first", icon: "✦", title: "Primeiro passo", description: "Conclua seu primeiro treino.", unlocked: (stats, sessions) => sessions.length >= 1 },
    { id: "streak10", icon: "⚡", title: "Sequência de 10", description: "Acerte 10 contas seguidas.", unlocked: (stats) => stats.longest >= 10 },
    { id: "hundred", icon: "100", title: "Centenário", description: "Some 100 acertos no aplicativo.", unlocked: (stats) => stats.correct >= 100 },
    { id: "perfect", icon: "◎", title: "Treino perfeito", description: "Faça ao menos 10 questões sem errar.", unlocked: (stats, sessions) => sessions.some((item) => item.answers.length >= 10 && item.wrong === 0) },
    { id: "explorer", icon: "◇", title: "Explorador", description: "Treine as três operações.", unlocked: (stats, sessions) => ["add", "sub", "mul"].every((op) => sessions.some((item) => item.operation === op && item.answers.length >= 10)) },
    { id: "flame7", icon: "🔥", title: "Fogo aceso", description: "Pratique por 7 dias seguidos.", unlocked: (stats) => stats.streak.best >= 7 },
    { id: "solid", icon: "◆", title: "Base firme", description: "Alcance 90% em três treinos.", unlocked: (stats, sessions) => sessions.filter((item) => core.accuracy(item.correct, item.wrong) >= 90 && item.answers.length >= 10).length >= 3 },
    { id: "thousand", icon: "1K", title: "Mil na conta", description: "Chegue a 1.000 acertos.", unlocked: (stats) => stats.correct >= 1000 }
  ];
  const THEMES = [
    { id: "neon", name: "Pulso Neon", unlock: "Tema inicial", available: () => true },
    { id: "flames", name: "Chamas", unlock: "Pratique 7 dias seguidos", available: (stats) => stats.streak.best >= 7 },
    { id: "crystal", name: "Cristal", unlock: "Faça 95% em 5 treinos", available: (_stats, sessions) => sessions.filter((item) => item.answers.length >= 10 && core.accuracy(item.correct, item.wrong) >= 95).length >= 5 },
    { id: "eclipse", name: "Eclipse", unlock: "Alcance 1.000 acertos", available: (stats) => stats.correct >= 1000 }
  ];
  const LOCAL_MEDALS = [
    { id: "first", icon: "✦", name: "Primeiro passo", detail: "Conclua 1 treino", available: (_stats, sessions) => sessions.length >= 1 },
    { id: "ten", icon: "10", name: "Ritmo firme", detail: "Conclua 10 treinos", available: (_stats, sessions) => sessions.length >= 10 },
    { id: "perfect", icon: "◎", name: "Precisão absoluta", detail: "Faça 10 questões sem errar", available: (_stats, sessions) => sessions.some((item) => item.answers.length >= 10 && item.wrong === 0) },
    { id: "flame7", icon: "🔥", name: "Fogo aceso", detail: "Pratique 7 dias seguidos", available: (stats) => stats.streak.best >= 7 },
    { id: "hundred", icon: "100", name: "Centenário", detail: "Some 100 acertos", available: (stats) => stats.correct >= 100 },
    { id: "thousand", icon: "1K", name: "Mil na conta", detail: "Some 1.000 acertos", available: (stats) => stats.correct >= 1000 },
    { id: "explorer", icon: "◇", name: "Trindade", detail: "Treine as 3 operações", available: (_stats, sessions) => ["add", "sub", "mul"].every((op) => sessions.some((item) => item.operation === op && item.answers.length >= 10)) },
    { id: "add500", icon: "+", name: "Mestre da soma", detail: "500 acertos em soma", available: (_stats, sessions) => operationCorrect(sessions, "add") >= 500 },
    { id: "sub500", icon: "−", name: "Mestre da subtração", detail: "500 acertos em subtração", available: (_stats, sessions) => operationCorrect(sessions, "sub") >= 500 },
    { id: "mul500", icon: "×", name: "Mestre da tabuada", detail: "500 acertos em multiplicação", available: (_stats, sessions) => operationCorrect(sessions, "mul") >= 500 }
  ];
  const RANKING_MEDALS = [
    { id: "ranked-first", icon: "♢", name: "Competidor", detail: "Conclua uma partida ranqueada" },
    { id: "ranked-perfect", icon: "🎯", name: "Partida perfeita", detail: "10 acertos ou mais sem errar" },
    { id: "ranked-streak", icon: "⚡", name: "Sequência 20", detail: "Acerte 20 contas seguidas" },
    { id: "ranked-add", icon: "+", name: "Soma verificada", detail: "100 acertos ranqueados" },
    { id: "ranked-sub", icon: "−", name: "Subtração verificada", detail: "100 acertos ranqueados" },
    { id: "ranked-mul", icon: "×", name: "Tabuada verificada", detail: "100 acertos ranqueados" },
    { id: "ranked-thousand", icon: "1K", name: "Milhar verificado", detail: "100 acertos no avançado" }
  ];
  const RANKING_MEDAL_ICONS = Object.fromEntries(RANKING_MEDALS.map((item) => [item.id, item.icon]));

  let data = loadData();
  document.body.dataset.theme = data.profile.theme;
  let selection = { operation: "add", level: "base", mode: "count", goal: 10 };
  let rankSelection = { operation: "add", level: "base", duration: 60 };
  let session = null;
  let tickTimer = null;
  let nextTimer = null;
  let nameSaveTimer = null;
  let toastTimer = null;
  let clearArmedUntil = 0;
  let deleteRankArmedUntil = 0;
  let eraseArmedUntil = 0;
  let audioContext = null;
  let rankRequestSequence = 0;
  const rankRequests = new Map();

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  function loadData() {
    try {
      let raw = "";
      if (window.MenteAgilData && typeof window.MenteAgilData.load === "function") {
        raw = window.MenteAgilData.load();
      } else if (window.localStorage) {
        raw = window.localStorage.getItem("mente-agil-offline-v1") || "";
      }
      if (!raw) return freshData();

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.sessions)) {
        return freshData();
      }
      return {
        version: 3,
        installId: validInstallId(parsed.installId) ? parsed.installId : createInstallId(),
        profile: {
          name: typeof parsed.profile?.name === "string" ? parsed.profile.name.slice(0, 24) : "Jogador",
          sound: parsed.profile?.sound !== false,
          theme: THEMES.some((item) => item.id === parsed.profile?.theme) ? parsed.profile.theme : "neon",
          publicMedals: Array.isArray(parsed.profile?.publicMedals)
            ? [...new Set(parsed.profile.publicMedals.map(String))].filter((id) => RANKING_MEDALS.some((item) => item.id === id)).slice(0, 3)
            : []
        },
        rankingEligibleMedals: Array.isArray(parsed.rankingEligibleMedals)
          ? parsed.rankingEligibleMedals.map(String).filter((id) => RANKING_MEDALS.some((item) => item.id === id))
          : [],
        sessions: parsed.sessions.filter(validSession).slice(-100)
      };
    } catch (_) {
      return freshData();
    }
  }

  function freshData() {
    const next = structuredCloneSafe(DEFAULT_DATA);
    next.installId = createInstallId();
    return next;
  }

  function validInstallId(value) {
    return typeof value === "string" && /^[A-Za-z0-9-]{16,80}$/.test(value);
  }

  function createInstallId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    } catch (_) {
      // Continua com um identificador local aleatório em WebViews antigos.
    }
    return "mobile-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }

  function structuredCloneSafe(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function validSession(item) {
    return item
      && typeof item === "object"
      && ["add", "sub", "mul"].includes(item.operation)
      && Array.isArray(item.answers)
      && Number.isFinite(Number(item.startedAt));
  }

  function saveData(showFailure = true) {
    data.sessions = data.sessions.slice(-100);
    const json = JSON.stringify(data);
    let saved = false;
    try {
      if (window.MenteAgilData && typeof window.MenteAgilData.save === "function") {
        saved = window.MenteAgilData.save(json);
      } else if (window.localStorage) {
        window.localStorage.setItem("mente-agil-offline-v1", json);
        saved = true;
      }
    } catch (_) {
      saved = false;
    }
    if (!saved && showFailure) showToast("Não foi possível salvar o histórico.");
    return saved;
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  window.MenteRankingNative = {
    resolve(requestId, raw) {
      const pending = rankRequests.get(requestId);
      if (!pending) return;
      clearTimeout(pending.timer);
      rankRequests.delete(requestId);
      try {
        const response = JSON.parse(raw);
        if (response && response.error) pending.reject(new Error(String(response.error)));
        else pending.resolve(response);
      } catch (_) {
        pending.reject(new Error("Resposta inválida do ranking mobile."));
      }
    }
  };

  function rankingRequest(method, action, payload) {
    return new Promise((resolve, reject) => {
      if (!window.MenteAgilRanking) {
        reject(new Error("O ranking está disponível somente no aplicativo conectado."));
        return;
      }
      const requestId = "rank-" + Date.now().toString(36) + "-" + (++rankRequestSequence).toString(36);
      const timer = setTimeout(() => {
        rankRequests.delete(requestId);
        reject(new Error("O ranking demorou para responder. Verifique sua conexão."));
      }, 12_000);
      rankRequests.set(requestId, { resolve, reject, timer });
      try {
        if (method === "GET") {
          window.MenteAgilRanking.list(requestId, payload.operation, payload.level, payload.duration);
        } else {
          window.MenteAgilRanking.post(requestId, action, JSON.stringify(payload));
        }
      } catch (_) {
        clearTimeout(timer);
        rankRequests.delete(requestId);
        reject(new Error("Não foi possível acessar o ranking mobile."));
      }
    });
  }

  function setSingleActive(containerSelector, button) {
    $$(containerSelector + " button").forEach((item) => item.classList.toggle("active", item === button));
  }

  function switchScreen(target) {
    if (session && target !== "train") {
      showToast("Encerre o treino antes de sair.");
      return;
    }
    $$(".screen").forEach((screen) => screen.classList.toggle("active", screen.dataset.screen === target));
    $$(".bottom-nav button").forEach((button) => button.classList.toggle("active", button.dataset.target === target));
    if (target === "history") renderHistory();
    if (target === "progress") renderProgress();
    if (target === "ranking") loadRanking();
    if (target === "settings") { renderCustomization(); loadRankingMedals(); }
    window.scrollTo(0, 0);
  }

  function startSession(options) {
    const chosen = options && options.operation ? options : selection;
    clearInterval(tickTimer);
    clearTimeout(nextTimer);
    session = {
      operation: chosen.operation,
      level: chosen.level,
      mode: chosen.mode,
      goal: chosen.goal,
      ranked: Boolean(chosen.ranked),
      rankSessionId: chosen.rankSessionId || "",
      pendingRankQuestion: chosen.rankQuestion || null,
      startedAt: Date.now(),
      questionStartedAt: Date.now(),
      question: null,
      answers: [],
      correct: 0,
      wrong: 0,
      locked: false
    };

    $("#setup-view").classList.add("hidden");
    $("#summary-view").classList.add("hidden");
    $("#session-view").classList.remove("hidden");
    $("#session-label").textContent = (session.ranked ? "RANK · " : "") + LABELS.operations[session.operation] + " · " + LABELS.levels[session.level];
    $("#correct-count").textContent = "0";
    $("#wrong-count").textContent = "0";
    $("#feedback").textContent = "";
    $("#feedback").className = "feedback";
    makeNextQuestion();
    updateSessionHeader();
    tickTimer = setInterval(tick, 200);
    tick();
  }

  function makeNextQuestion() {
    if (!session) return;
    let next;
    if (session.ranked) {
      next = session.pendingRankQuestion;
      session.pendingRankQuestion = null;
      if (!next) return;
      next = { ...next, operation: session.operation };
    } else {
      next = core.buildQuestion(session.level, session.operation);
    }
    const previous = session.question;
    let attempts = 0;
    while (previous && next.a === previous.a && next.b === previous.b && attempts < 5) {
      next = session.ranked ? next : core.buildQuestion(session.level, session.operation);
      attempts += 1;
    }
    session.question = next;
    session.questionStartedAt = Date.now();
    session.locked = false;
    $("#equation").textContent = next.a + " " + next.symbol + " " + next.b;
    $("#question-number").textContent = "QUESTÃO " + (session.answers.length + 1);
    $("#answer-input").value = "";
    $("#feedback").textContent = "";
    $("#feedback").className = "feedback";
    requestAnimationFrame(() => $("#answer-input").focus());
  }

  function tick() {
    if (!session) return;
    const elapsed = Math.floor((Date.now() - session.startedAt) / 1000);
    if (session.mode === "time") {
      const remaining = Math.max(0, session.goal - elapsed);
      $("#timer-value").textContent = formatTime(remaining);
      if (remaining <= 0 && !session.locked) finishSession(false);
    } else {
      $("#timer-value").textContent = formatTime(elapsed);
    }
    updateProgress();
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Number(seconds) || 0);
    return String(Math.floor(safe / 60)).padStart(2, "0") + ":" + String(safe % 60).padStart(2, "0");
  }

  async function submitAnswer(event) {
    event.preventDefault();
    if (!session || session.locked) return;
    const input = $("#answer-input");
    if (input.value.trim() === "") return;
    const given = Number(input.value);
    if (!Number.isInteger(given)) {
      showToast("Digite um número inteiro.");
      input.focus();
      return;
    }

    session.locked = true;
    const question = session.question;
    if (session.ranked) {
      try {
        const result = await rankingRequest("POST", "answer", {
          installId: data.installId,
          sessionId: session.rankSessionId,
          questionId: question.id,
          given
        });
        if (!session) return;
        const correct = Boolean(result.correct);
        const answer = {
          a: question.a, b: question.b, symbol: question.symbol,
          expected: Number(result.expectedAnswer), given, correct,
          elapsedMs: Math.max(0, Date.now() - session.questionStartedAt)
        };
        session.answers.push(answer);
        session.correct = Number(result.correctCount) || 0;
        session.wrong = Number(result.wrongCount) || 0;
        session.pendingRankQuestion = result.question || null;
        $("#correct-count").textContent = String(session.correct);
        $("#wrong-count").textContent = String(session.wrong);
        const feedback = $("#feedback");
        feedback.textContent = correct ? "Certo!" : "Resposta: " + answer.expected;
        feedback.className = "feedback " + (correct ? "correct" : "wrong");
        playSound(correct);
        updateSessionHeader();
        const expired = Date.now() - session.startedAt >= session.goal * 1000;
        if (expired) {
          session.locked = false;
          nextTimer = setTimeout(() => finishSession(false), 180);
        } else {
          nextTimer = setTimeout(makeNextQuestion, correct ? 220 : 360);
        }
      } catch (error) {
        if (!session) return;
        session.locked = false;
        showToast(error.message || "Não foi possível validar a resposta.");
        $("#answer-input").value = "";
        requestAnimationFrame(() => $("#answer-input").focus());
      }
      return;
    }
    const correct = given === question.answer;
    const answer = {
      a: question.a,
      b: question.b,
      symbol: question.symbol,
      expected: question.answer,
      given,
      correct,
      elapsedMs: Math.max(0, Date.now() - session.questionStartedAt)
    };
    session.answers.push(answer);
    if (correct) session.correct += 1;
    else session.wrong += 1;

    $("#correct-count").textContent = String(session.correct);
    $("#wrong-count").textContent = String(session.wrong);
    const feedback = $("#feedback");
    feedback.textContent = correct ? "Certo!" : "Resposta: " + question.answer;
    feedback.className = "feedback " + (correct ? "correct" : "wrong");
    playSound(correct);
    updateSessionHeader();

    if (session.mode === "count" && session.answers.length >= session.goal) {
      nextTimer = setTimeout(() => finishSession(false), 260);
    } else {
      nextTimer = setTimeout(makeNextQuestion, 220);
    }
  }

  function updateSessionHeader() {
    if (!session) return;
    const answered = session.answers.length;
    $("#session-progress").textContent = session.mode === "count"
      ? answered + " / " + session.goal
      : answered + (answered === 1 ? " resposta" : " respostas");
    updateProgress();
  }

  function updateProgress() {
    if (!session) return;
    let percent;
    if (session.mode === "count") {
      percent = (session.answers.length / session.goal) * 100;
    } else {
      percent = ((Date.now() - session.startedAt) / (session.goal * 1000)) * 100;
    }
    $("#progress-fill").style.width = Math.max(0, Math.min(100, percent)) + "%";
  }

  function finishSession(cancelled) {
    if (!session) return;
    clearInterval(tickTimer);
    clearTimeout(nextTimer);
    const completed = session;
    session = null;

    if (cancelled && completed.ranked) {
      showSetup();
      switchScreen("ranking");
      showToast("Tentativa de ranking cancelada.");
      return;
    }

    if (cancelled && completed.answers.length === 0) {
      showSetup();
      showToast("Treino encerrado.");
      return;
    }

    const finished = {
      id: String(completed.startedAt) + "-" + String(Math.floor(Math.random() * 100000)),
      operation: completed.operation,
      level: completed.level,
      mode: completed.mode,
      goal: completed.goal,
      startedAt: completed.startedAt,
      finishedAt: Date.now(),
      correct: completed.correct,
      wrong: completed.wrong,
      ranked: completed.ranked,
      answers: completed.answers
    };
    data.sessions.push(finished);
    saveData();
    showSummary(finished);
    if (completed.ranked) submitRankedSession(completed, finished);
  }

  function showSetup() {
    $("#session-view").classList.add("hidden");
    $("#summary-view").classList.add("hidden");
    $("#setup-view").classList.remove("hidden");
    renderHome();
    window.scrollTo(0, 0);
  }

  function showSummary(finished) {
    $("#session-view").classList.add("hidden");
    $("#setup-view").classList.add("hidden");
    $("#summary-view").classList.remove("hidden");
    const accuracy = core.accuracy(finished.correct, finished.wrong);
    const average = finished.answers.length
      ? Math.round(finished.answers.reduce((sum, answer) => sum + answer.elapsedMs, 0) / finished.answers.length / 100) / 10
      : 0;
    $("#summary-title").textContent = accuracy >= 90 ? "Excelente precisão!" : accuracy >= 70 ? "Bom trabalho!" : "Continue praticando";
    $("#summary-accuracy").textContent = accuracy + "%";
    $("#summary-correct").textContent = String(finished.correct);
    $("#summary-time").textContent = average + "s";
    const rankResult = $("#summary-rank-result");
    rankResult.textContent = "";
    rankResult.classList.add("hidden");
    $("#train-again-button").firstChild.textContent = finished.ranked ? "Voltar ao ranking " : "Treinar novamente ";
    $("#train-again-button").dataset.target = finished.ranked ? "ranking" : "train";
    renderSummaryErrors(finished.answers.filter((answer) => !answer.correct));
    renderHome();
    window.scrollTo(0, 0);
  }

  async function submitRankedSession(completed, finished) {
    const rankResult = $("#summary-rank-result");
    rankResult.textContent = "Enviando resultado ao ranking mobile…";
    rankResult.classList.remove("hidden");
    try {
      const result = await rankingRequest("POST", "finish", {
        installId: data.installId,
        sessionId: completed.rankSessionId
      });
      const improved = result.improved ? "Novo recorde! " : "";
      rankResult.textContent = improved + result.attemptScore + " pontos · posição " + result.position + " no ranking mobile.";
      finished.rankScore = Number(result.attemptScore) || 0;
      finished.rankPosition = Number(result.position) || 0;
      if (Array.isArray(result.eligibleMedals)) data.rankingEligibleMedals = result.eligibleMedals;
      saveData(false);
    } catch (error) {
      rankResult.textContent = error.message || "Não foi possível enviar o resultado.";
    }
  }

  function renderSummaryErrors(errors) {
    const host = $("#summary-errors");
    host.replaceChildren();
    if (!errors.length) return;
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Revisar " + errors.length + (errors.length === 1 ? " erro" : " erros");
    const list = document.createElement("ul");
    errors.forEach((answer) => {
      const item = document.createElement("li");
      item.textContent = answer.a + " " + answer.symbol + " " + answer.b + " = " + answer.expected + " · você respondeu " + answer.given;
      list.appendChild(item);
    });
    details.append(summary, list);
    host.appendChild(details);
  }

  function renderHome() {
    const streak = core.practiceStreak(data.sessions);
    $("#streak-value").textContent = String(streak.current);
  }

  function rankCategoryLabel() {
    return LABELS.operations[rankSelection.operation] + " · " + LABELS.levels[rankSelection.level]
      + " · " + (rankSelection.duration === 60 ? "1 min" : "2 min");
  }

  async function loadRanking() {
    const host = $("#ranking-list");
    $("#rank-category-label").textContent = rankCategoryLabel();
    host.replaceChildren();
    const loading = document.createElement("div");
    loading.className = "empty-state";
    loading.textContent = "Carregando ranking mobile…";
    host.appendChild(loading);
    try {
      const result = await rankingRequest("GET", "list", rankSelection);
      renderRanking(Array.isArray(result.entries) ? result.entries : []);
    } catch (error) {
      host.replaceChildren();
      const unavailable = document.createElement("div");
      unavailable.className = "empty-state";
      unavailable.textContent = (error.message || "Ranking indisponível.") + " O treino offline continua funcionando normalmente.";
      host.appendChild(unavailable);
    }
  }

  function renderRanking(entries) {
    const host = $("#ranking-list");
    host.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Ainda não há resultados nesta categoria. Seja o primeiro!";
      host.appendChild(empty);
      return;
    }
    const myName = data.profile.name.trim().toLocaleLowerCase("pt-BR");
    entries.forEach((entry) => {
      const card = document.createElement("article");
      card.className = "rank-item" + (String(entry.nickname).toLocaleLowerCase("pt-BR") === myName ? " is-me" : "");
      const position = document.createElement("span");
      position.className = "rank-position";
      position.textContent = String(entry.position);
      const player = document.createElement("div");
      player.className = "rank-player";
      const nickname = document.createElement("strong");
      nickname.textContent = String(entry.nickname);
      const medals = document.createElement("span");
      medals.className = "rank-medals";
      (Array.isArray(entry.medals) ? entry.medals : []).slice(0, 3).forEach((id) => {
        const icon = document.createElement("span");
        icon.textContent = RANKING_MEDAL_ICONS[id] || "◆";
        icon.title = RANKING_MEDALS.find((item) => item.id === id)?.name || "Medalha verificada";
        medals.appendChild(icon);
      });
      if (medals.childNodes.length) nickname.appendChild(medals);
      const details = document.createElement("small");
      details.textContent = entry.correct + " acertos · sequência " + entry.bestStreak;
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
    const button = $("#rank-start-button");
    const nickname = $("#ranking-name").value.trim().slice(0, 18);
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
        operation: rankSelection.operation,
        level: rankSelection.level,
        duration: rankSelection.duration
      });
      data.profile.name = result.nickname || nickname;
      $("#player-name").value = data.profile.name;
      $("#ranking-name").value = data.profile.name;
      saveData(false);
      switchScreen("train");
      startSession({
        operation: rankSelection.operation,
        level: rankSelection.level,
        mode: "time",
        goal: rankSelection.duration,
        ranked: true,
        rankSessionId: result.sessionId,
        rankQuestion: result.question
      });
    } catch (error) {
      showToast(error.message || "Não foi possível iniciar o ranking.");
    } finally {
      button.disabled = false;
      button.firstChild.textContent = "Jogar esta categoria ";
    }
  }

  function renderHistory() {
    const host = $("#history-list");
    host.replaceChildren();
    if (!data.sessions.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Seu histórico ainda está vazio. Conclua um treino para começar a acompanhar sua evolução.";
      host.appendChild(empty);
      return;
    }

    data.sessions.slice().reverse().forEach((item) => {
      const card = document.createElement("article");
      card.className = "history-item";
      const info = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = LABELS.operations[item.operation] + " · " + LABELS.levels[item.level];
      const meta = document.createElement("small");
      const date = new Date(item.finishedAt || item.startedAt);
      meta.textContent = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
        + " · " + item.answers.length + (item.answers.length === 1 ? " questão" : " questões");
      info.append(title, meta);
      const score = document.createElement("span");
      score.className = "history-score";
      score.textContent = core.accuracy(item.correct, item.wrong) + "%";
      card.append(info, score);

      const errors = item.answers.filter((answer) => !answer.correct);
      if (errors.length) {
        const errorText = document.createElement("div");
        errorText.className = "history-errors";
        errorText.textContent = "Erros: " + errors.slice(0, 3).map((answer) => answer.a + " " + answer.symbol + " " + answer.b + " = " + answer.expected).join(" · ")
          + (errors.length > 3 ? " · +" + (errors.length - 3) : "");
        card.appendChild(errorText);
      }
      host.appendChild(card);
    });
  }

  function renderProgress() {
    const stats = core.summarize(data.sessions);
    $("#total-correct").textContent = String(stats.correct);
    $("#total-accuracy").textContent = stats.accuracy + "%";
    $("#best-streak").textContent = stats.streak.best + (stats.streak.best === 1 ? " dia" : " dias");
    renderChart();
    renderAchievements(stats);
  }

  function renderChart() {
    const chart = $("#accuracy-chart");
    chart.replaceChildren();
    const sessions = data.sessions.slice(-7);
    if (!sessions.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Complete um treino para ver o gráfico.";
      empty.style.gridColumn = "1 / -1";
      chart.appendChild(empty);
      return;
    }
    sessions.forEach((item) => {
      const value = core.accuracy(item.correct, item.wrong);
      const column = document.createElement("div");
      column.className = "bar-column";
      column.title = value + "% de precisão";
      const label = document.createElement("small");
      label.textContent = value + "%";
      const bar = document.createElement("span");
      bar.style.height = Math.max(3, value) + "%";
      column.append(label, bar);
      chart.appendChild(column);
    });
  }

  function renderAchievements(stats) {
    const host = $("#achievement-list");
    host.replaceChildren();
    let unlockedCount = 0;
    ACHIEVEMENTS.forEach((achievement) => {
      const unlocked = achievement.unlocked(stats, data.sessions);
      if (unlocked) unlockedCount += 1;
      const card = document.createElement("article");
      card.className = "achievement" + (unlocked ? "" : " locked");
      const icon = document.createElement("span");
      icon.className = "achievement-icon";
      icon.textContent = achievement.icon;
      const title = document.createElement("strong");
      title.textContent = achievement.title;
      const description = document.createElement("small");
      description.textContent = achievement.description;
      card.append(icon, title, description);
      host.appendChild(card);
    });
    $("#achievement-count").textContent = unlockedCount + " / " + ACHIEVEMENTS.length;
  }

  function operationCorrect(sessions, operation) {
    return sessions.reduce((total, item) => total + (item.operation === operation ? Number(item.correct) || 0 : 0), 0);
  }

  function renderCustomization() {
    const stats = core.summarize(data.sessions);
    const availableThemes = THEMES.filter((item) => item.available(stats, data.sessions));
    if (!availableThemes.some((item) => item.id === data.profile.theme)) {
      data.profile.theme = "neon";
      document.body.dataset.theme = "neon";
      saveData(false);
    }
    $("#theme-progress").textContent = availableThemes.length + " / " + THEMES.length;
    const themes = $("#theme-grid");
    themes.replaceChildren();
    THEMES.forEach((theme) => {
      const unlocked = theme.available(stats, data.sessions);
      const card = document.createElement("button");
      card.type = "button";
      card.className = "theme-card" + (data.profile.theme === theme.id ? " active" : "") + (unlocked ? "" : " locked");
      card.disabled = !unlocked;
      card.setAttribute("aria-pressed", String(data.profile.theme === theme.id));
      const preview = document.createElement("span");
      preview.className = "theme-preview " + theme.id;
      preview.append(document.createElement("i"), document.createElement("i"), document.createElement("i"));
      const name = document.createElement("strong"); name.textContent = theme.name;
      const detail = document.createElement("small"); detail.textContent = unlocked ? (data.profile.theme === theme.id ? "Tema em uso" : "Toque para usar") : "Bloqueado · " + theme.unlock;
      card.append(preview, name, detail);
      card.addEventListener("click", () => {
        if (!unlocked) return;
        data.profile.theme = theme.id;
        document.body.dataset.theme = theme.id;
        saveData();
        renderCustomization();
        showToast("Tema " + theme.name + " ativado.");
      });
      themes.appendChild(card);
    });

    const medals = $("#medal-grid");
    medals.replaceChildren();
    let unlockedCount = 0;
    LOCAL_MEDALS.forEach((medal) => {
      const unlocked = medal.available(stats, data.sessions);
      if (unlocked) unlockedCount += 1;
      medals.appendChild(medalCard(medal, unlocked, false));
    });
    RANKING_MEDALS.forEach((medal) => {
      const unlocked = data.rankingEligibleMedals.includes(medal.id);
      const selected = data.profile.publicMedals.includes(medal.id);
      if (unlocked) unlockedCount += 1;
      const card = medalCard(medal, unlocked, true, selected);
      if (unlocked) card.addEventListener("click", () => togglePublicMedal(medal.id));
      medals.appendChild(card);
    });
    $("#medal-progress").textContent = unlockedCount + " conquistadas";
  }

  function medalCard(medal, unlocked, verified, selected = false) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "medal-card" + (unlocked ? "" : " locked") + (selected ? " selected" : "");
    card.disabled = !unlocked || !verified;
    if (verified) card.setAttribute("aria-pressed", String(selected));
    const icon = document.createElement("span"); icon.className = "medal-icon"; icon.textContent = medal.icon;
    const info = document.createElement("div");
    const name = document.createElement("strong"); name.textContent = medal.name + (verified ? " ◆" : "");
    if (verified) name.classList.add("verified-mark");
    const detail = document.createElement("small");
    detail.textContent = unlocked ? (verified ? (selected ? "Selecionada para o ranking" : "Verificada · toque para selecionar") : "Conquistada neste aparelho") : medal.detail;
    info.append(name, detail); card.append(icon, info);
    return card;
  }

  async function togglePublicMedal(id) {
    const previous = data.profile.publicMedals.slice();
    const selected = previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id];
    if (selected.length > 3) { showToast("Escolha no máximo três medalhas para o ranking."); return; }
    data.profile.publicMedals = selected;
    saveData(false); renderCustomization();
    try {
      const result = await rankingRequest("POST", "medals", { installId: data.installId, selected });
      data.rankingEligibleMedals = Array.isArray(result.eligible) ? result.eligible : data.rankingEligibleMedals;
      data.profile.publicMedals = Array.isArray(result.selected) ? result.selected : selected;
      saveData(false); renderCustomization();
      showToast("Medalhas públicas atualizadas.");
    } catch (error) {
      data.profile.publicMedals = previous;
      saveData(false); renderCustomization();
      showToast(error.message || "Não foi possível atualizar as medalhas.");
    }
  }

  async function loadRankingMedals(showStatus = false) {
    try {
      const result = await rankingRequest("POST", "medals", { installId: data.installId });
      data.rankingEligibleMedals = Array.isArray(result.eligible) ? result.eligible : [];
      data.profile.publicMedals = Array.isArray(result.selected) ? result.selected.slice(0, 3) : [];
      saveData(false); renderCustomization();
      if (showStatus) showToast("Medalhas verificadas sincronizadas.");
    } catch (error) {
      if (showStatus) showToast(error.message || "Sem conexão para sincronizar medalhas.");
    }
  }

  function backupPayload() {
    return JSON.stringify({ backupVersion: 1, exportedAt: Date.now(), profile: data.profile, sessions: data.sessions });
  }

  function backupPassword() {
    return $("#backup-password").value;
  }

  function exportEncryptedBackup(json = backupPayload()) {
    if (backupPassword().length < 8) { showToast("Use uma senha de backup com pelo menos 8 caracteres."); $("#backup-password").focus(); return false; }
    if (!window.MenteAgilData?.exportBackup) { showToast("Backup criptografado indisponível nesta versão."); return false; }
    const payload = window.MenteAgilData.exportBackup(json, backupPassword());
    if (!payload) { showToast("Não foi possível gerar o backup."); return false; }
    $("#backup-payload").value = payload;
    showToast("Backup criptografado gerado. Copie e guarde o código.");
    return true;
  }

  function sanitizeImportedBackup(parsed) {
    if (!parsed || parsed.backupVersion !== 1 || !Array.isArray(parsed.sessions)) return null;
    const theme = THEMES.some((item) => item.id === parsed.profile?.theme) ? parsed.profile.theme : "neon";
    return {
      version: 3,
      installId: data.installId,
      profile: {
        name: typeof parsed.profile?.name === "string" ? parsed.profile.name.slice(0, 24) : data.profile.name,
        sound: parsed.profile?.sound !== false,
        theme,
        publicMedals: data.profile.publicMedals
      },
      rankingEligibleMedals: data.rankingEligibleMedals,
      sessions: parsed.sessions.filter(validSession).slice(-100)
    };
  }

  async function copyBackupCode() {
    const field = $("#backup-payload");
    if (!field.value) { showToast("Gere ou cole um código de backup primeiro."); return; }
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(field.value);
      else { field.focus(); field.select(); document.execCommand("copy"); }
      showToast("Código do backup copiado.");
    } catch (_) { field.focus(); field.select(); showToast("Selecione e copie o código manualmente."); }
  }

  function playSound(correct) {
    if (!data.profile.sound) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      audioContext = audioContext || new AudioContextClass();
      const now = audioContext.currentTime;
      const notes = correct
        ? [{ frequency: 659, delay: 0, duration: .11 }, { frequency: 784, delay: .07, duration: .16 }]
        : [{ frequency: 230, delay: 0, duration: .2 }];
      notes.forEach((note) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const start = now + note.delay;
        const end = start + note.duration;
        oscillator.type = correct ? "sine" : "triangle";
        oscillator.frequency.setValueAtTime(note.frequency, start);
        if (!correct) oscillator.frequency.exponentialRampToValueAtTime(165, end);
        gain.gain.setValueAtTime(.0001, start);
        gain.gain.exponentialRampToValueAtTime(correct ? .1 : .07, start + .012);
        gain.gain.exponentialRampToValueAtTime(.0001, end);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(start);
        oscillator.stop(end);
      });
    } catch (_) {
      // Alguns aparelhos podem bloquear áudio até a primeira interação.
    }
  }

  function bindEvents() {
    $$("#operation-options button").forEach((button) => button.addEventListener("click", () => {
      selection.operation = button.dataset.value;
      setSingleActive("#operation-options", button);
    }));
    $$("#level-options button").forEach((button) => button.addEventListener("click", () => {
      selection.level = button.dataset.value;
      setSingleActive("#level-options", button);
    }));
    $$("#mode-options button").forEach((button) => button.addEventListener("click", () => {
      selection.mode = button.dataset.mode;
      selection.goal = Number(button.dataset.value);
      setSingleActive("#mode-options", button);
    }));
    $$("#rank-operation-options button").forEach((button) => button.addEventListener("click", () => {
      rankSelection.operation = button.dataset.value;
      setSingleActive("#rank-operation-options", button);
      loadRanking();
    }));
    $$("#rank-level-options button").forEach((button) => button.addEventListener("click", () => {
      rankSelection.level = button.dataset.value;
      setSingleActive("#rank-level-options", button);
      loadRanking();
    }));
    $$("#rank-duration-options button").forEach((button) => button.addEventListener("click", () => {
      rankSelection.duration = Number(button.dataset.value);
      setSingleActive("#rank-duration-options", button);
      loadRanking();
    }));
    $$(".bottom-nav button").forEach((button) => button.addEventListener("click", () => switchScreen(button.dataset.target)));
    $("#start-button").addEventListener("click", startSession);
    $("#rank-start-button").addEventListener("click", startRankedSession);
    $("#rank-refresh-button").addEventListener("click", loadRanking);
    $("#stop-button").addEventListener("click", () => finishSession(true));
    $("#answer-form").addEventListener("submit", submitAnswer);
    $("#train-again-button").addEventListener("click", (event) => {
      showSetup();
      if (event.currentTarget.dataset.target === "ranking") switchScreen("ranking");
    });

    const nameInput = $("#player-name");
    nameInput.value = data.profile.name;
    const rankingNameInput = $("#ranking-name");
    rankingNameInput.value = data.profile.name.slice(0, 18);
    nameInput.addEventListener("input", () => {
      clearTimeout(nameSaveTimer);
      nameSaveTimer = setTimeout(() => {
        data.profile.name = nameInput.value.trim().slice(0, 24) || "Jogador";
        rankingNameInput.value = data.profile.name.slice(0, 18);
        saveData();
      }, 350);
    });
    rankingNameInput.addEventListener("input", () => {
      clearTimeout(nameSaveTimer);
      nameSaveTimer = setTimeout(() => {
        data.profile.name = rankingNameInput.value.trim().slice(0, 18) || "Jogador";
        nameInput.value = data.profile.name;
        saveData();
      }, 350);
    });

    const soundToggle = $("#sound-toggle");
    soundToggle.checked = data.profile.sound;
    soundToggle.addEventListener("change", () => {
      data.profile.sound = soundToggle.checked;
      saveData();
      showToast(soundToggle.checked ? "Sons ativados." : "Sons desativados.");
    });

    $("#sync-medals-button").addEventListener("click", () => loadRankingMedals(true));
    $("#export-backup-button").addEventListener("click", () => exportEncryptedBackup());
    $("#copy-backup-button").addEventListener("click", copyBackupCode);
    $("#import-backup-button").addEventListener("click", () => {
      const payload = $("#backup-payload").value.trim();
      if (!payload || backupPassword().length < 8) { showToast("Cole o backup e digite a senha usada nele."); return; }
      if (!window.MenteAgilData?.importBackup) { showToast("Importação indisponível nesta versão."); return; }
      try {
        const raw = window.MenteAgilData.importBackup(payload, backupPassword());
        const restored = raw ? sanitizeImportedBackup(JSON.parse(raw)) : null;
        if (!restored) throw new Error("invalid");
        data = restored;
        document.body.dataset.theme = data.profile.theme;
        saveData();
        nameInput.value = data.profile.name;
        rankingNameInput.value = data.profile.name.slice(0, 18);
        soundToggle.checked = data.profile.sound;
        renderAll();
        showToast("Backup importado com segurança.");
      } catch (_) { showToast("Backup ou senha inválidos."); }
    });
    $("#export-ranking-data-button").addEventListener("click", async () => {
      if (backupPassword().length < 8) { showToast("Crie uma senha para proteger a exportação."); $("#backup-password").focus(); return; }
      try {
        const result = await rankingRequest("POST", "privacy/export", { installId: data.installId });
        exportEncryptedBackup(JSON.stringify({ rankingExportVersion: 1, data: result }));
      } catch (error) { showToast(error.message || "Não foi possível exportar os dados do ranking."); }
    });

    $("#clear-data-button").addEventListener("click", (event) => {
      const button = event.currentTarget;
      if (Date.now() > clearArmedUntil) {
        clearArmedUntil = Date.now() + 4500;
        button.textContent = "Toque novamente para confirmar";
        setTimeout(() => {
          if (Date.now() >= clearArmedUntil) button.textContent = "Apagar somente o histórico local";
        }, 4600);
        return;
      }
      data.sessions = [];
      saveData(false);
      button.textContent = "Apagar somente o histórico local";
      clearArmedUntil = 0;
      nameInput.value = data.profile.name;
      rankingNameInput.value = data.profile.name.slice(0, 18);
      soundToggle.checked = data.profile.sound;
      renderAll();
      showToast("Histórico apagado deste aparelho.");
    });

    $("#delete-ranking-button").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      if (Date.now() > deleteRankArmedUntil) {
        deleteRankArmedUntil = Date.now() + 5000;
        button.textContent = "Toque novamente para excluir do ranking";
        setTimeout(() => { if (Date.now() >= deleteRankArmedUntil) button.textContent = "Excluir perfil e histórico do ranking"; }, 5100);
        return;
      }
      button.disabled = true;
      try {
        await rankingRequest("POST", "privacy/delete", { installId: data.installId, confirmation: data.profile.name.slice(0, 18) });
        data.profile.publicMedals = [];
        data.rankingEligibleMedals = [];
        saveData(false); renderCustomization();
        showToast("Perfil, partidas e recordes do ranking excluídos.");
      } catch (error) { showToast(error.message || "Conecte-se para excluir os dados do ranking."); }
      finally { button.disabled = false; button.textContent = "Excluir perfil e histórico do ranking"; deleteRankArmedUntil = 0; }
    });

    $("#erase-everything-button").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      if (Date.now() > eraseArmedUntil) {
        eraseArmedUntil = Date.now() + 5000;
        button.textContent = "Toque novamente para apagar tudo";
        setTimeout(() => { if (Date.now() >= eraseArmedUntil) button.textContent = "Apagar todos os dados do aplicativo"; }, 5100);
        return;
      }
      button.disabled = true;
      try {
        await rankingRequest("POST", "privacy/delete", { installId: data.installId, confirmation: data.profile.name.slice(0, 18) });
        if (window.MenteAgilData?.clearAll && !window.MenteAgilData.clearAll()) throw new Error("Não foi possível limpar o armazenamento seguro.");
        data = freshData();
        document.body.dataset.theme = "neon";
        saveData(false);
        nameInput.value = data.profile.name;
        rankingNameInput.value = data.profile.name;
        soundToggle.checked = data.profile.sound;
        $("#backup-password").value = "";
        $("#backup-payload").value = "";
        renderAll();
        showToast("Todos os dados locais e do ranking foram apagados.");
      } catch (error) { showToast(error.message || "Conecte-se para concluir a exclusão total."); }
      finally { button.disabled = false; button.textContent = "Apagar todos os dados do aplicativo"; eraseArmedUntil = 0; }
    });
  }

  function renderAll() {
    renderHome();
    renderHistory();
    renderProgress();
    renderCustomization();
  }

  bindEvents();
  saveData(false);
  renderAll();
})();
