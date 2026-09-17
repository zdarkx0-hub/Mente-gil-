(function startMenteAgil() {
  "use strict";

  const core = window.MenteCore;
  const catalog = window.MenteCatalog;
  const modules = window.MenteModules;
  const store = window.createMenteDataStore(window, catalog, (message) =>
    ui.showToast(message),
  );
  const ui = modules.ui({ store });
  const { $, $$ } = ui;
  const rankingClient = window.createMenteNativeRequest({
    prefix: "rank",
    timeout: 12000,
    timeoutMessage: "O ranking demorou para responder. Verifique sua conexão.",
    invalidMessage: "Resposta inválida do ranking mobile.",
    send(id, method, action, payload) {
      const native = window.MenteAgilRanking;
      if (!native)
        throw new Error(
          "O ranking está disponível somente no aplicativo conectado.",
        );
      if (method === "GET")
        native.list(id, payload.operation, payload.level, payload.duration);
      else native.post(id, action, JSON.stringify(payload));
    },
  });
  window.MenteRankingNative = { resolve: rankingClient.resolve };
  const rankingRequest = rankingClient.request;

  const progress = modules.progress({ store, ui, core, catalog });
  const customization = modules.customization({
    store,
    ui,
    core,
    catalog,
    rankingRequest,
  });
  const training = modules.training({
    store,
    ui,
    core,
    catalog,
    rankingRequest,
    switchScreen,
    renderHome: progress.renderHome,
    onSaved: () => window.MenteAccount?.scheduleSync(),
    onRankedFinish: (completed, finished) =>
      ranking.submitRankedSession(completed, finished),
  });
  const ranking = modules.ranking({
    store,
    ui,
    catalog,
    rankingRequest,
    training,
    switchScreen,
  });
  const settings = modules.settings({
    store,
    ui,
    rankingRequest,
    renderAll,
    renderCustomization: customization.renderCustomization,
    loadRankingMedals: customization.loadRankingMedals,
  });

  function switchScreen(target) {
    if (training.active() && target !== "train") {
      ui.showToast("Encerre o treino antes de sair.");
      return;
    }
    $$(".screen").forEach((screen) =>
      screen.classList.toggle("active", screen.dataset.screen === target),
    );
    $$(".bottom-nav button").forEach((button) =>
      button.classList.toggle(
        "active",
        button.dataset.target === (target === "profile" ? "settings" : target),
      ),
    );
    if (target === "history") progress.renderHistory();
    if (target === "progress") progress.renderProgress();
    if (target === "ranking") ranking.loadRanking();
    if (target === "settings") {
      customization.renderCustomization();
      customization.loadRankingMedals();
    }
    if (target === "profile") window.MenteAccount?.render();
    window.scrollTo(0, 0);
  }

  function renderAll() {
    progress.renderHome();
    progress.renderHistory();
    progress.renderProgress();
    customization.renderCustomization();
  }

  function refreshProfile() {
    const { profile } = store.getData();
    ui.applyTheme(profile.theme);
    $("#player-name").value = profile.name;
    $("#ranking-name").value = profile.name;
    $("#sound-toggle").checked = profile.sound;
    renderAll();
  }

  // Stable API consumed by account.js and the native photo callback.
  window.MenteApp = {
    snapshot: store.snapshot,
    stats: () => core.summarize(store.getData().sessions),
    notice: ui.showToast,
    screen: switchScreen,
    activeSession: training.active,
    setName(name) {
      store.getData().profile.name = name;
      $("#player-name").value = name;
      $("#ranking-name").value = name;
      store.save();
    },
    connect(account) {
      store.connect(account);
      refreshProfile();
    },
    disconnect() {
      store.disconnect();
      refreshProfile();
    },
    mergeHistory(sessions, syncedAt) {
      store.mergeHistory(sessions, syncedAt);
      renderAll();
    },
  };

  ui.applyTheme(store.getData().profile.theme);
  $$(".bottom-nav button").forEach((button) =>
    button.addEventListener("click", () => switchScreen(button.dataset.target)),
  );
  training.bindEvents();
  ranking.bindEvents();
  settings.bindEvents();
  store.save(false);
  renderAll();
})();
