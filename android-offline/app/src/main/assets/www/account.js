(function profileAndAccount() {
  "use strict";
  const app = window.MenteApp;
  const native = window.MenteAgilAccount;
  const $ = (selector) => document.querySelector(selector);
  let syncTimer = null,
    loginTimer = null,
    loginUntil = 0,
    syncing = false,
    polling = false;
  const connected = () => Boolean(native?.connected());
  const notice = (message) => app.notice(message);
  const client = window.createMenteNativeRequest({
    prefix: "account",
    timeout: 30000,
    timeoutMessage: "O serviço demorou para responder. Tente novamente.",
    invalidMessage: "Resposta inválida. Seu progresso local foi mantido.",
    send(id, action, body) {
      if (!native)
        throw new Error("Este recurso está disponível no aplicativo Android.");
      native.post(id, action, JSON.stringify(body));
    },
  });
  window.MenteAccountNative = { resolve: client.resolve };
  const request = (action, body = {}) => client.request(action, body);
  const hidden = (selector, value) =>
    $(selector).classList.toggle("hidden", value);
  function photos() {
    let photo = "";
    try {
      photo = window.MenteAgilData?.profilePhoto() || "";
    } catch {}
    document.querySelectorAll("[data-profile-avatar]").forEach((host) => {
      host.replaceChildren();
      if (/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photo)) {
        const image = document.createElement("img");
        image.src = photo;
        image.alt = "Sua foto de perfil";
        host.append(image);
      } else
        host.textContent =
          app.snapshot().profile.name.trim().slice(0, 1).toUpperCase() || "M";
    });
    $("#remove-photo").disabled = !photo;
  }
  function render() {
    const data = app.snapshot(),
      onlineAccount = connected() && Boolean(data.accountId);
    $("#profile-entry-name").textContent =
      data.profile.name + (data.publicId ? " · " + data.publicId : "");
    $("#public-id").value = data.publicId || "";
    $("#account-status").textContent = onlineAccount
      ? "Sua conta tem um ID permanente. Os treinos continuam disponíveis sem internet."
      : "Você está treinando neste aparelho. Conecte uma conta para ter seu ID permanente e sincronizar o histórico.";
    hidden("#account-identity", !data.publicId);
    hidden("#connect-account", onlineAccount);
    hidden("#account-actions", !onlineAccount);
    hidden("#friends-section", !onlineAccount);
    hidden("#account-delete-section", !onlineAccount);
    if (onlineAccount) hidden("#login-pending", true);
    const stats = app.stats();
    $("#profile-trainings").textContent = data.sessions.length;
    $("#profile-accuracy").textContent =
      window.MenteCore.accuracy(stats.correct, stats.wrong) + "%";
    $("#profile-streak").textContent = stats.streak.current;
    if (!syncing)
      $("#sync-status").textContent = data.syncedAt
        ? "Última sincronização: " +
          new Date(data.syncedAt).toLocaleString("pt-BR")
        : "Seu histórico está salvo neste celular.";
    photos();
  }
  async function sync() {
    if (syncing || !connected() || !app.snapshot().accountId) return;
    const data = app.snapshot();
    syncing = true;
    $("#sync-status").textContent = "Sincronizando histórico…";
    try {
      const result = await request("progress", { sessions: data.sessions });
      if (app.snapshot().accountId === data.accountId) {
        app.mergeHistory(result.sessions || [], result.syncedAt);
        $("#sync-status").textContent =
          "Histórico sincronizado. Treinos offline serão enviados quando houver conexão.";
      }
    } catch (error) {
      $("#sync-status").textContent = error.message;
    } finally {
      syncing = false;
    }
  }
  function scheduleSync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(
      () => (app.snapshot().accountId ? sync() : refreshAccount()),
      1500,
    );
  }
  async function pollLogin() {
    if (polling || app.activeSession()) return;
    polling = true;
    try {
      const result = await request("auth/poll");
      if (result.pending) {
        if (Date.now() < loginUntil) loginTimer = setTimeout(pollLogin, 3000);
        return;
      }
      clearTimeout(loginTimer);
      loginUntil = 0;
      if (app.activeSession()) {
        notice("Conta autorizada. Encerre o treino para concluir a conexão.");
        return;
      }
      app.connect(result.account);
      render();
      notice("Conta conectada. Este é seu ID permanente.");
      await sync();
      await friends();
    } catch (error) {
      clearTimeout(loginTimer);
      notice(error.message);
    } finally {
      polling = false;
    }
  }
  async function runButton(button, task) {
    if (button.disabled) return;
    button.disabled = true;
    try {
      await task();
    } catch (error) {
      notice(error.message);
    } finally {
      button.disabled = false;
    }
  }
  function makeButton(text, task) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.addEventListener("click", () => runButton(button, task));
    return button;
  }
  function card(name, id) {
    const box = document.createElement("div");
    box.className = "friend-card";
    const title = document.createElement("strong");
    title.textContent = name;
    const code = document.createElement("small");
    code.textContent = id;
    box.append(title, code);
    return box;
  }
  async function friends() {
    if (!connected()) return;
    const owner = app.snapshot().accountId;
    const result = await request("friends");
    if (app.snapshot().accountId !== owner) return;
    const host = $("#friends-list");
    host.replaceChildren();
    if (!result.friends.length) {
      const p = document.createElement("p");
      p.className = "settings-copy";
      p.textContent = "Nenhum amigo ou convite por enquanto.";
      host.append(p);
    }
    result.friends.forEach((friend) => {
      const item = card(friend.name, friend.publicId);
      const status = document.createElement("small");
      status.textContent =
        friend.status === "accepted"
          ? "Amigo"
          : friend.direction === "incoming"
            ? "Convite recebido"
            : "Convite enviado";
      item.append(status);
      const buttons = document.createElement("div");
      buttons.className = "friend-buttons";
      if (friend.status === "pending" && friend.direction === "incoming")
        buttons.append(
          makeButton("Aceitar", async () => {
            await request("friend/respond", { key: friend.key, accept: true });
            await friends();
          }),
        );
      buttons.append(
        makeButton(
          friend.status === "accepted"
            ? "Remover amigo"
            : friend.direction === "incoming"
              ? "Recusar"
              : "Cancelar convite",
          async () => {
            await request("friend/respond", { key: friend.key, accept: false });
            await friends();
          },
        ),
      );
      item.append(buttons);
      host.append(item);
    });
  }
  function showProfile() {
    app.screen("profile");
    render();
  }
  $("#open-profile").addEventListener("click", showProfile);
  $("#ranking-profile-link").addEventListener("click", showProfile);
  $("#back-settings").addEventListener("click", () => app.screen("settings"));
  $("#choose-photo").addEventListener("click", () => {
    if (window.MenteAgilPhoto) window.MenteAgilPhoto.choose();
    else notice("A seleção de foto está disponível no Android.");
  });
  $("#remove-photo").addEventListener("click", () => {
    if (window.MenteAgilData?.removeProfilePhoto()) {
      photos();
      notice("Foto removida.");
    }
  });
  $("#save-profile").addEventListener("click", (event) =>
    runButton(event.currentTarget, async () => {
      const name = $("#player-name").value.trim();
      if (name.length < 2)
        throw new Error("Use pelo menos 2 caracteres no nome.");
      if (app.snapshot().accountId && !connected())
        throw new Error("Entre novamente para alterar o nome da sua conta.");
      if (connected()) {
        const result = await request("profile", { name });
        app.setName(result.account.name);
      } else app.setName(name.slice(0, 24));
      render();
      notice("Nome salvo.");
    }),
  );
  $("#connect-account").addEventListener("click", (event) =>
    runButton(event.currentTarget, async () => {
      if (app.activeSession())
        throw new Error("Encerre o treino antes de conectar sua conta.");
      clearTimeout(loginTimer);
      const result = await request("auth/start", {
        name: app.snapshot().profile.name,
      });
      loginUntil = result.expiresAt;
      $("#login-code").textContent = result.userCode;
      hidden("#login-pending", false);
      native.openLogin();
      loginTimer = setTimeout(pollLogin, 3000);
    }),
  );
  $("#open-login-browser").addEventListener("click", () => native?.openLogin());
  $("#check-login").addEventListener("click", pollLogin);
  $("#sync-history").addEventListener("click", sync);
  $("#logout-account").addEventListener("click", (event) =>
    runButton(event.currentTarget, async () => {
      await sync();
      try {
        await request("logout");
      } catch {
        native.logoutLocal();
      }
      app.disconnect();
      render();
      notice(
        "Você saiu. O progresso desta conta permanece guardado neste aparelho.",
      );
    }),
  );
  $("#copy-public-id").addEventListener("click", () => {
    const field = $("#public-id");
    field.focus();
    field.select();
    if (document.execCommand("copy")) notice("ID copiado.");
    else notice("Selecione e copie seu ID.");
  });
  $("#find-friend").addEventListener("click", (event) =>
    runButton(event.currentTarget, async () => {
      hidden("#friend-result", true);
      const result = await request("friend/find", {
        publicId: $("#friend-id").value,
      });
      const host = $("#friend-result");
      host.replaceChildren();
      const player = card(result.player.name, result.player.publicId),
        buttons = document.createElement("div");
      buttons.className = "friend-buttons";
      buttons.append(
        makeButton("Enviar pedido de amizade", async () => {
          await request("friend/request", { publicId: result.player.publicId });
          notice("Pedido enviado ou já existente.");
          hidden("#friend-result", true);
          await friends();
        }),
      );
      player.append(buttons);
      host.append(player);
      hidden("#friend-result", false);
    }),
  );
  $("#refresh-friends").addEventListener("click", (event) =>
    runButton(event.currentTarget, friends),
  );
  $("#delete-account").addEventListener("click", (event) =>
    runButton(event.currentTarget, async () => {
      await request("privacy/delete", {
        confirmation: $("#delete-account-confirmation")
          .value.trim()
          .toUpperCase(),
      });
      app.disconnect();
      $("#delete-account-confirmation").value = "";
      render();
      notice("Conta online excluída.");
    }),
  );
  async function refreshAccount() {
    if (!connected() || app.activeSession()) return;
    try {
      const result = await request("me");
      if (app.activeSession()) return;
      app.connect(result.account);
      render();
      scheduleSync();
    } catch (error) {
      render();
      $("#account-status").textContent = error.message;
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      if (loginUntil > Date.now()) pollLogin();
      else refreshAccount();
    }
  });
  window.addEventListener("online", () => {
    refreshAccount();
  });
  window.addEventListener("mente-connection", (event) => {
    if (event.detail === "online") refreshAccount();
  });
  window.MenteAccount = {
    render,
    notice,
    scheduleSync,
    photoChanged(saved) {
      photos();
      notice(
        saved
          ? "Foto salva neste aparelho."
          : "Não foi possível abrir a imagem. Escolha uma foto de até 12 MB.",
      );
    },
  };
  render();
  refreshAccount();
})();
