"use strict";
// Explicit dependencies keep this feature independent of application startup.
window.MenteModules = window.MenteModules || {};
window.MenteModules.settings = function ({
  store,
  ui,
  rankingRequest,
  renderAll,
  renderCustomization,
  loadRankingMedals,
}) {
  const { $, showToast, applyTheme } = ui;
  let clearArmedUntil = 0;
  let deleteRankArmedUntil = 0;
  let eraseArmedUntil = 0;

  function backupPayload() {
    const data = store.getData();
    return JSON.stringify({
      backupVersion: 1,
      exportedAt: Date.now(),
      profile: data.profile,
      sessions: data.sessions,
    });
  }

  function backupPassword() {
    return $("#backup-password").value;
  }

  function exportEncryptedBackup(json = backupPayload()) {
    if (backupPassword().length < 8) {
      showToast("Use uma senha de backup com pelo menos 8 caracteres.");
      $("#backup-password").focus();
      return false;
    }
    if (!window.MenteAgilData?.exportBackup) {
      showToast("Backup criptografado indisponível nesta versão.");
      return false;
    }
    const payload = window.MenteAgilData.exportBackup(json, backupPassword());
    if (!payload) {
      showToast("Não foi possível gerar o backup.");
      return false;
    }
    $("#backup-payload").value = payload;
    showToast("Backup criptografado gerado. Copie e guarde o código.");
    return true;
  }

  async function copyBackupCode() {
    const field = $("#backup-payload");
    if (!field.value) {
      showToast("Gere ou cole um código de backup primeiro.");
      return;
    }
    try {
      if (navigator.clipboard?.writeText)
        await navigator.clipboard.writeText(field.value);
      else {
        field.focus();
        field.select();
        document.execCommand("copy");
      }
      showToast("Código do backup copiado.");
    } catch (_) {
      field.focus();
      field.select();
      showToast("Selecione e copie o código manualmente.");
    }
  }

  function bindEvents() {
    const nameInput = $("#player-name");
    nameInput.value = store.getData().profile.name;
    const rankingNameInput = $("#ranking-name");
    rankingNameInput.value = store.getData().profile.name;

    const soundToggle = $("#sound-toggle");
    soundToggle.checked = store.getData().profile.sound;
    soundToggle.addEventListener("change", () => {
      store.getData().profile.sound = soundToggle.checked;
      store.save();
      showToast(soundToggle.checked ? "Sons ativados." : "Sons desativados.");
    });

    $("#sync-medals-button").addEventListener("click", () =>
      loadRankingMedals(true),
    );
    $("#export-backup-button").addEventListener("click", () =>
      exportEncryptedBackup(),
    );
    $("#copy-backup-button").addEventListener("click", copyBackupCode);
    $("#import-backup-button").addEventListener("click", () => {
      const payload = $("#backup-payload").value.trim();
      if (!payload || backupPassword().length < 8) {
        showToast("Cole o backup e digite a senha usada nele.");
        return;
      }
      if (!window.MenteAgilData?.importBackup) {
        showToast("Importação indisponível nesta versão.");
        return;
      }
      try {
        const raw = window.MenteAgilData.importBackup(
          payload,
          backupPassword(),
        );
        const restored = raw
          ? store.sanitizeImportedBackup(JSON.parse(raw))
          : null;
        if (!restored) throw new Error("invalid");
        store.replace(restored);
        applyTheme(store.getData().profile.theme);
        store.save();
        nameInput.value = store.getData().profile.name;
        rankingNameInput.value = store.getData().profile.name;
        soundToggle.checked = store.getData().profile.sound;
        renderAll();
        showToast("Backup importado com segurança.");
        window.MenteAccount?.render();
        window.MenteAccount?.scheduleSync();
      } catch (_) {
        showToast("Backup ou senha inválidos.");
      }
    });
    $("#export-ranking-data-button").addEventListener("click", async () => {
      if (backupPassword().length < 8) {
        showToast("Crie uma senha para proteger a exportação.");
        $("#backup-password").focus();
        return;
      }
      const owner = store.getData();
      try {
        const result = await rankingRequest("POST", "privacy/export", {
          installId: owner.installId,
        });
        if (store.getData() !== owner) return;
        exportEncryptedBackup(
          JSON.stringify({ rankingExportVersion: 1, data: result }),
        );
      } catch (error) {
        showToast(
          error.message || "Não foi possível exportar os dados do ranking.",
        );
      }
    });

    $("#clear-data-button").addEventListener("click", (event) => {
      const button = event.currentTarget;
      if (Date.now() > clearArmedUntil) {
        clearArmedUntil = Date.now() + 4500;
        button.textContent = "Toque novamente para confirmar";
        setTimeout(() => {
          if (Date.now() >= clearArmedUntil)
            button.textContent = "Apagar somente o histórico local";
        }, 4600);
        return;
      }
      store.getData().sessions = [];
      store.save(false);
      button.textContent = "Apagar somente o histórico local";
      clearArmedUntil = 0;
      nameInput.value = store.getData().profile.name;
      rankingNameInput.value = store.getData().profile.name;
      soundToggle.checked = store.getData().profile.sound;
      renderAll();
      showToast("Histórico apagado deste aparelho.");
    });

    $("#delete-ranking-button").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      if (Date.now() > deleteRankArmedUntil) {
        deleteRankArmedUntil = Date.now() + 5000;
        button.textContent = "Toque novamente para excluir do ranking";
        setTimeout(() => {
          if (Date.now() >= deleteRankArmedUntil)
            button.textContent = "Excluir perfil e histórico do ranking";
        }, 5100);
        return;
      }
      button.disabled = true;
      const owner = store.getData();
      try {
        await rankingRequest("POST", "privacy/delete", {
          installId: owner.installId,
          confirmation: owner.profile.name,
        });
        if (store.getData() !== owner) return;
        store.getData().profile.publicMedals = [];
        store.getData().rankingEligibleMedals = [];
        store.save(false);
        renderCustomization();
        showToast("Perfil, partidas e recordes do ranking excluídos.");
      } catch (error) {
        showToast(
          error.message || "Conecte-se para excluir os dados do ranking.",
        );
      } finally {
        button.disabled = false;
        button.textContent = "Excluir perfil e histórico do ranking";
        deleteRankArmedUntil = 0;
      }
    });

    $("#erase-everything-button").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      if (Date.now() > eraseArmedUntil) {
        eraseArmedUntil = Date.now() + 5000;
        button.textContent = "Toque novamente para apagar tudo";
        setTimeout(() => {
          if (Date.now() >= eraseArmedUntil)
            button.textContent = "Apagar todos os dados do aplicativo";
        }, 5100);
        return;
      }
      button.disabled = true;
      const owner = store.getData();
      try {
        if (window.MenteAgilAccount?.connected())
          await rankingRequest("POST", "privacy/delete", {
            installId: owner.installId,
            confirmation: owner.profile.name,
          });
        if (store.getData() !== owner) return;
        if (window.MenteAgilData?.clearAll && !window.MenteAgilData.clearAll())
          throw new Error("Não foi possível limpar o armazenamento seguro.");
        store.replace(store.freshData());
        applyTheme("neon");
        store.save(false);
        nameInput.value = store.getData().profile.name;
        rankingNameInput.value = store.getData().profile.name;
        soundToggle.checked = store.getData().profile.sound;
        $("#backup-password").value = "";
        $("#backup-payload").value = "";
        renderAll();
        window.MenteAccount?.render();
        showToast("Todos os dados locais e do ranking foram apagados.");
      } catch (error) {
        showToast(
          error.message || "Conecte-se para concluir a exclusão total.",
        );
      } finally {
        button.disabled = false;
        button.textContent = "Apagar todos os dados do aplicativo";
        eraseArmedUntil = 0;
      }
    });
  }

  return { bindEvents };
};
