"use strict";
// Explicit dependencies keep this feature independent of application startup.
window.MenteModules = window.MenteModules || {};
window.MenteModules.progress = function ({ store, ui, core, catalog }) {
  const { $, $$ } = ui;
  const { LABELS, ACHIEVEMENTS } = catalog;

  function renderHome() {
    const data = store.getData();
    const streak = core.practiceStreak(data.sessions);
    $("#streak-value").textContent = String(streak.current);
  }

  function renderHistory() {
    const data = store.getData();
    const host = $("#history-list");
    host.replaceChildren();
    if (!data.sessions.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent =
        "Seu histórico ainda está vazio. Conclua um treino para começar a acompanhar sua evolução.";
      host.appendChild(empty);
      return;
    }

    data.sessions
      .slice()
      .reverse()
      .forEach((item) => {
        const card = document.createElement("article");
        card.className = "history-item";
        const info = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent =
          LABELS.operations[item.operation] + " · " + LABELS.levels[item.level];
        const meta = document.createElement("small");
        const date = new Date(item.finishedAt || item.startedAt);
        meta.textContent =
          date.toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }) +
          " · " +
          item.answers.length +
          (item.answers.length === 1 ? " questão" : " questões");
        info.append(title, meta);
        const score = document.createElement("span");
        score.className = "history-score";
        score.textContent = core.accuracy(item.correct, item.wrong) + "%";
        card.append(info, score);

        const errors = item.answers.filter((answer) => !answer.correct);
        if (errors.length) {
          const errorText = document.createElement("div");
          errorText.className = "history-errors";
          errorText.textContent =
            "Erros: " +
            errors
              .slice(0, 3)
              .map(
                (answer) =>
                  answer.a +
                  " " +
                  answer.symbol +
                  " " +
                  answer.b +
                  " = " +
                  answer.expected,
              )
              .join(" · ") +
            (errors.length > 3 ? " · +" + (errors.length - 3) : "");
          card.appendChild(errorText);
        }
        host.appendChild(card);
      });
  }

  function renderProgress() {
    const data = store.getData();
    const stats = core.summarize(data.sessions);
    $("#total-correct").textContent = String(stats.correct);
    $("#total-accuracy").textContent = stats.accuracy + "%";
    $("#best-streak").textContent =
      stats.streak.best + (stats.streak.best === 1 ? " dia" : " dias");
    renderChart();
    renderAchievements(stats);
  }

  function renderChart() {
    const data = store.getData();
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
    const data = store.getData();
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
      description.textContent =
        (unlocked ? "Conquistada · " : "Bloqueada · ") +
        achievement.description;
      card.append(icon, title, description);
      host.appendChild(card);
    });
    $("#achievement-count").textContent =
      unlockedCount + " / " + ACHIEVEMENTS.length;
  }

  return { renderHome, renderHistory, renderProgress };
};
