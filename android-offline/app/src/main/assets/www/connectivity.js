(function monitorConnectivity() {
  "use strict";

  const badge = document.querySelector("#connection-status");
  const label = document.querySelector("#connection-label");
  if (!badge || !label) return;
  const native = window.MenteAgilConnectivity;

  function update(state) {
    if (!["online", "offline", "unknown"].includes(state)) state = "unknown";
    if (badge.dataset.state === state && label.textContent) return;
    badge.dataset.state = state;
    if (typeof window.dispatchEvent === "function") window.dispatchEvent(new CustomEvent("mente-connection", { detail: state }));
    label.textContent = { online: "Online", offline: "Offline", unknown: "Verificando…" }[state];
    badge.title = state === "online"
      ? "Conectado à internet. O ranking também depende da disponibilidade do servidor."
      : state === "offline"
        ? "Sem acesso à internet. Seus treinos locais continuam disponíveis."
        : "Verificando a conexão do aparelho.";
  }

  function refresh() {
    try {
      // In the APK, Android is authoritative: WebView's navigator.onLine can
      // report true even for Wi-Fi without working internet access.
      update(native ? native.getStatus() : navigator.onLine ? "online" : "offline");
    } catch (_) {
      update("unknown");
    }
  }

  window.MenteConnectivity = Object.freeze({ update });
  window.addEventListener("online", refresh);
  window.addEventListener("offline", refresh);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });
  refresh();
})();
