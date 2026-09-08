(function startMenteAgil() {
  "use strict";

  const core = window.MenteCore;
  const DEFAULT_DATA = {
    version: 1,
    profile: { name: "Jogador", sound: true },
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

  let data = loadData();
  let selection = { operation: "add", level: "base", mode: "count", goal: 10 };
  let session = null;
  let tickTimer = null;
  let nextTimer = null;
  let nameSaveTimer = null;
  let toastTimer = null;
  let clearArmedUntil = 0;
  let audioContext = null;

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
      if (!raw) return structuredCloneSafe(DEFAULT_DATA);

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.sessions)) {
        return structuredCloneSafe(DEFAULT_DATA);
      }
      return {
        version: 1,
        profile: {
          name: typeof parsed.profile?.name === "string" ? parsed.profile.name.slice(0, 24) : "Jogador",
          sound: parsed.profile?.sound !== false
        },
        sessions: parsed.sessions.filter(validSession).slice(-100)
      };
    } catch (_) {
      return structuredCloneSafe(DEFAULT_DATA);
    }
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
    window.scrollTo(0, 0);
  }

  function startSession() {
    clearInterval(tickTimer);
    clearTimeout(nextTimer);
    session = {
      operation: selection.operation,
      level: selection.level,
      mode: selection.mode,
      goal: selection.goal,
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
    $("#session-label").textContent = LABELS.operations[selection.operation] + " · " + LABELS.levels[selection.level];
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
    let next = core.buildQuestion(session.level, session.operation);
    const previous = session.question;
    let attempts = 0;
    while (previous && next.a === previous.a && next.b === previous.b && attempts < 5) {
      next = core.buildQuestion(session.level, session.operation);
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
      if (remaining <= 0) finishSession(false);
    } else {
      $("#timer-value").textContent = formatTime(elapsed);
    }
    updateProgress();
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Number(seconds) || 0);
    return String(Math.floor(safe / 60)).padStart(2, "0") + ":" + String(safe % 60).padStart(2, "0");
  }

  function submitAnswer(event) {
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
      answers: completed.answers
    };
    data.sessions.push(finished);
    saveData();
    showSummary(finished);
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
    renderSummaryErrors(finished.answers.filter((answer) => !answer.correct));
    renderHome();
    window.scrollTo(0, 0);
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
    $$(".bottom-nav button").forEach((button) => button.addEventListener("click", () => switchScreen(button.dataset.target)));
    $("#start-button").addEventListener("click", startSession);
    $("#stop-button").addEventListener("click", () => finishSession(true));
    $("#answer-form").addEventListener("submit", submitAnswer);
    $("#train-again-button").addEventListener("click", showSetup);

    const nameInput = $("#player-name");
    nameInput.value = data.profile.name;
    nameInput.addEventListener("input", () => {
      clearTimeout(nameSaveTimer);
      nameSaveTimer = setTimeout(() => {
        data.profile.name = nameInput.value.trim().slice(0, 24) || "Jogador";
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

    $("#clear-data-button").addEventListener("click", (event) => {
      const button = event.currentTarget;
      if (Date.now() > clearArmedUntil) {
        clearArmedUntil = Date.now() + 4500;
        button.textContent = "Toque novamente para confirmar";
        setTimeout(() => {
          if (Date.now() >= clearArmedUntil) button.textContent = "Apagar todo o histórico";
        }, 4600);
        return;
      }
      data = structuredCloneSafe(DEFAULT_DATA);
      if (window.MenteAgilData && typeof window.MenteAgilData.clear === "function") {
        window.MenteAgilData.clear();
      } else if (window.localStorage) {
        window.localStorage.removeItem("mente-agil-offline-v1");
      }
      button.textContent = "Apagar todo o histórico";
      clearArmedUntil = 0;
      nameInput.value = data.profile.name;
      soundToggle.checked = data.profile.sound;
      renderAll();
      showToast("Histórico apagado deste aparelho.");
    });
  }

  function renderAll() {
    renderHome();
    renderHistory();
    renderProgress();
  }

  bindEvents();
  renderAll();
})();
