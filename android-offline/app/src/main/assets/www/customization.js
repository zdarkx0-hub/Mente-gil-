"use strict";
// Explicit dependencies keep this feature independent of application startup.
window.MenteModules = window.MenteModules || {};
window.MenteModules.customization = function ({
  store,
  ui,
  core,
  catalog,
  rankingRequest,
}) {
  const { $, showToast, applyTheme } = ui;
  const { THEMES, LOCAL_MEDALS, RANKING_MEDALS } = catalog;

  function renderCustomization() {
    const data = store.getData();
    const stats = core.summarize(data.sessions);
    const availableThemes = THEMES.filter((item) =>
      item.available(stats, data.sessions),
    );
    if (!availableThemes.some((item) => item.id === data.profile.theme)) {
      data.profile.theme = "neon";
      applyTheme("neon");
      store.save(false);
    }
    $("#theme-progress").textContent =
      availableThemes.length + " / " + THEMES.length;
    const themes = $("#theme-grid");
    themes.replaceChildren();
    THEMES.forEach((theme) => {
      const unlocked = theme.available(stats, data.sessions);
      const card = document.createElement("button");
      card.type = "button";
      card.className =
        "theme-card" +
        (data.profile.theme === theme.id ? " active" : "") +
        (unlocked ? "" : " locked");
      card.disabled = !unlocked;
      card.setAttribute(
        "aria-pressed",
        String(data.profile.theme === theme.id),
      );
      const preview = document.createElement("span");
      preview.className = "theme-preview " + theme.id;
      preview.append(
        document.createElement("i"),
        document.createElement("i"),
        document.createElement("i"),
      );
      const name = document.createElement("strong");
      name.textContent = theme.name;
      const detail = document.createElement("small");
      detail.textContent = unlocked
        ? data.profile.theme === theme.id
          ? "Tema em uso"
          : "Toque para usar"
        : "Bloqueado · " + theme.unlock;
      card.append(preview, name, detail);
      card.addEventListener("click", () => {
        if (!unlocked) return;
        data.profile.theme = theme.id;
        applyTheme(theme.id);
        store.save();
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
      if (unlocked)
        card.addEventListener("click", () => togglePublicMedal(medal.id));
      medals.appendChild(card);
    });
    $("#medal-progress").textContent =
      unlockedCount + (unlockedCount === 1 ? " conquistada" : " conquistadas");
  }

  function medalCard(medal, unlocked, verified, selected = false) {
    const card = document.createElement("button");
    card.type = "button";
    card.className =
      "medal-card" +
      (unlocked ? "" : " locked") +
      (selected ? " selected" : "");
    card.disabled = !unlocked || !verified;
    if (verified) card.setAttribute("aria-pressed", String(selected));
    const icon = document.createElement("span");
    icon.className = "medal-icon";
    icon.textContent = medal.icon;
    const info = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = medal.name + (verified ? " ◆" : "");
    if (verified) name.classList.add("verified-mark");
    const detail = document.createElement("small");
    detail.textContent = unlocked
      ? verified
        ? selected
          ? "Selecionada para o ranking"
          : "Verificada · toque para selecionar"
        : "Conquistada neste aparelho"
      : "Bloqueada · " + medal.detail;
    info.append(name, detail);
    card.append(icon, info);
    return card;
  }

  async function togglePublicMedal(id) {
    const data = store.getData();
    const previous = data.profile.publicMedals.slice();
    const selected = previous.includes(id)
      ? previous.filter((item) => item !== id)
      : [...previous, id];
    if (selected.length > 3) {
      showToast("Escolha no máximo três medalhas para o ranking.");
      return;
    }
    data.profile.publicMedals = selected;
    store.save(false);
    renderCustomization();
    try {
      const result = await rankingRequest("POST", "medals", {
        installId: data.installId,
        selected,
      });
      if (store.getData() !== data) return;
      data.rankingEligibleMedals = Array.isArray(result.eligible)
        ? result.eligible
        : data.rankingEligibleMedals;
      data.profile.publicMedals = Array.isArray(result.selected)
        ? result.selected
        : selected;
      store.save(false);
      renderCustomization();
      showToast("Medalhas públicas atualizadas.");
    } catch (error) {
      if (store.getData() !== data) return;
      data.profile.publicMedals = previous;
      store.save(false);
      renderCustomization();
      showToast(error.message || "Não foi possível atualizar as medalhas.");
    }
  }

  async function loadRankingMedals(showStatus = false) {
    const data = store.getData();
    try {
      const result = await rankingRequest("POST", "medals", {
        installId: data.installId,
      });
      if (store.getData() !== data) return;
      data.rankingEligibleMedals = Array.isArray(result.eligible)
        ? result.eligible
        : [];
      data.profile.publicMedals = Array.isArray(result.selected)
        ? result.selected.slice(0, 3)
        : [];
      store.save(false);
      renderCustomization();
      if (showStatus) showToast("Medalhas verificadas sincronizadas.");
    } catch (error) {
      if (showStatus)
        showToast(error.message || "Sem conexão para sincronizar medalhas.");
    }
  }

  return { renderCustomization, loadRankingMedals };
};
