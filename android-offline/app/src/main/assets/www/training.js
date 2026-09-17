"use strict";
// Explicit dependencies keep this feature independent of application startup.
window.MenteModules = window.MenteModules || {};
window.MenteModules.training = function ({
  store,
  ui,
  core,
  catalog,
  rankingRequest,
  switchScreen,
  renderHome,
  onSaved,
  onRankedFinish,
}) {
  const { $, $$, showToast, setSingleActive, playSound } = ui;
  const { LABELS } = catalog;
  const selection = {
    operation: "add",
    level: "base",
    mode: "count",
    goal: 10,
  };
  let session = null;
  let tickTimer = null;
  let nextTimer = null;

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
      locked: false,
    };

    $("#setup-view").classList.add("hidden");
    $("#summary-view").classList.add("hidden");
    $("#session-view").classList.remove("hidden");
    $("#session-label").textContent =
      (session.ranked ? "RANK · " : "") +
      LABELS.operations[session.operation] +
      " · " +
      LABELS.levels[session.level];
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
    while (
      previous &&
      next.a === previous.a &&
      next.b === previous.b &&
      attempts < 5
    ) {
      next = session.ranked
        ? next
        : core.buildQuestion(session.level, session.operation);
      attempts += 1;
    }
    session.question = next;
    session.questionStartedAt = Date.now();
    session.locked = false;
    $("#equation").textContent = next.a + " " + next.symbol + " " + next.b;
    $("#question-number").textContent =
      "QUESTÃO " + (session.answers.length + 1);
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
    return (
      String(Math.floor(safe / 60)).padStart(2, "0") +
      ":" +
      String(safe % 60).padStart(2, "0")
    );
  }

  async function submitAnswer(event) {
    const data = store.getData();
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

    const answeringSession = session;
    session.locked = true;
    const question = session.question;
    if (session.ranked) {
      try {
        const result = await rankingRequest("POST", "answer", {
          installId: data.installId,
          sessionId: session.rankSessionId,
          questionId: question.id,
          given,
        });
        if (session !== answeringSession || store.getData() !== data) return;
        const correct = Boolean(result.correct);
        const answer = {
          a: question.a,
          b: question.b,
          symbol: question.symbol,
          expected: Number(result.expectedAnswer),
          given,
          correct,
          elapsedMs: Math.max(0, Date.now() - session.questionStartedAt),
        };
        session.answers.push(answer);
        session.correct = Number(result.correctCount) || 0;
        session.wrong = Number(result.wrongCount) || 0;
        session.pendingRankQuestion = result.question || null;
        $("#correct-count").textContent = String(session.correct);
        $("#wrong-count").textContent = String(session.wrong);
        const feedback = $("#feedback");
        feedback.textContent = correct
          ? "Certo!"
          : "Resposta: " + answer.expected;
        feedback.className = "feedback " + (correct ? "correct" : "wrong");
        playSound(correct);
        updateSessionHeader();
        const expired = Date.now() - session.startedAt >= session.goal * 1000;
        if (expired) {
          session.locked = false;
          nextTimer = setTimeout(() => {
            if (session === answeringSession) finishSession(false);
          }, 180);
        } else {
          nextTimer = setTimeout(makeNextQuestion, correct ? 220 : 360);
        }
      } catch (error) {
        if (session !== answeringSession || store.getData() !== data) return;
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
      elapsedMs: Math.max(0, Date.now() - session.questionStartedAt),
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
    $("#session-progress").textContent =
      session.mode === "count"
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
      percent =
        ((Date.now() - session.startedAt) / (session.goal * 1000)) * 100;
    }
    $("#progress-fill").style.width = Math.max(0, Math.min(100, percent)) + "%";
  }

  function finishSession(cancelled) {
    const data = store.getData();
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
      id:
        String(completed.startedAt) +
        "-" +
        String(Math.floor(Math.random() * 100000)),
      operation: completed.operation,
      level: completed.level,
      mode: completed.mode,
      goal: completed.goal,
      startedAt: completed.startedAt,
      finishedAt: Date.now(),
      correct: completed.correct,
      wrong: completed.wrong,
      ranked: completed.ranked,
      answers: completed.answers,
    };
    data.sessions.push(finished);
    store.save();
    onSaved();
    showSummary(finished);
    if (completed.ranked) onRankedFinish(completed, finished);
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
      ? Math.round(
          finished.answers.reduce((sum, answer) => sum + answer.elapsedMs, 0) /
            finished.answers.length /
            100,
        ) / 10
      : 0;
    $("#summary-title").textContent =
      accuracy >= 90
        ? "Excelente precisão!"
        : accuracy >= 70
          ? "Bom trabalho!"
          : "Continue praticando";
    $("#summary-accuracy").textContent = accuracy + "%";
    $("#summary-correct").textContent = String(finished.correct);
    $("#summary-time").textContent = average + "s";
    const rankResult = $("#summary-rank-result");
    rankResult.textContent = "";
    rankResult.classList.add("hidden");
    $("#train-again-button").firstChild.textContent = finished.ranked
      ? "Voltar ao ranking "
      : "Treinar novamente ";
    $("#train-again-button").dataset.target = finished.ranked
      ? "ranking"
      : "train";
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
    summary.textContent =
      "Revisar " + errors.length + (errors.length === 1 ? " erro" : " erros");
    const list = document.createElement("ul");
    errors.forEach((answer) => {
      const item = document.createElement("li");
      item.textContent =
        answer.a +
        " " +
        answer.symbol +
        " " +
        answer.b +
        " = " +
        answer.expected +
        " · você respondeu " +
        answer.given;
      list.appendChild(item);
    });
    details.append(summary, list);
    host.appendChild(details);
  }

  function bindEvents() {
    $$("#operation-options button").forEach((button) =>
      button.addEventListener("click", () => {
        selection.operation = button.dataset.value;
        setSingleActive("#operation-options", button);
      }),
    );
    $$("#level-options button").forEach((button) =>
      button.addEventListener("click", () => {
        selection.level = button.dataset.value;
        setSingleActive("#level-options", button);
      }),
    );
    $$("#mode-options button").forEach((button) =>
      button.addEventListener("click", () => {
        selection.mode = button.dataset.mode;
        selection.goal = Number(button.dataset.value);
        setSingleActive("#mode-options", button);
      }),
    );
    $("#start-button").addEventListener("click", startSession);
    $("#stop-button").addEventListener("click", () => finishSession(true));
    $("#answer-form").addEventListener("submit", submitAnswer);
    $("#train-again-button").addEventListener("click", (event) => {
      showSetup();
      if (event.currentTarget.dataset.target === "ranking")
        switchScreen("ranking");
    });
  }

  return { startSession, active: () => Boolean(session), bindEvents };
};
