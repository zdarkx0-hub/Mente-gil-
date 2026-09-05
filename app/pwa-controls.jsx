"use client";

import { useEffect, useRef, useState } from "react";
import { getPendingSyncCount, syncPendingMutations } from "./offline-client";

const STUDY_ROUTE = /^\/(?:$|treinar(?:\/especificos)?|revisar|progresso(?:\/conquistas)?|ranking)$/;

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export default function PwaControls() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const guideRef = useRef(null);

  useEffect(() => {
    setInstalled(isStandaloneMode());
    setOnline(window.navigator.onLine);
    setIsAndroid(/Android/i.test(window.navigator.userAgent));
    setReady(true);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js")
        .then((registration) => registration.update())
        .catch(() => {});
    }

    const refreshPending = () => getPendingSyncCount().then(setPending).catch(() => setPending(0));
    const synchronize = async () => {
      setSyncing(true);
      try {
        const result = await syncPendingMutations();
        setPending(result.pending);
      } finally {
        setSyncing(false);
      }
    };

    refreshPending();
    if (window.navigator.onLine) synchronize();

    const handleInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    const handleOnline = () => {
      setOnline(true);
      synchronize();
    };
    const handleOffline = () => setOnline(false);
    const handleOfflineStatus = () => refreshPending();
    const handleOfflineNavigation = (event) => {
      if (window.navigator.onLine || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target.closest?.("a[href]");
      if (!anchor) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || !STUDY_ROUTE.test(url.pathname)) return;
      event.preventDefault();
      window.history.pushState({}, "", url.pathname + url.search + url.hash);
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("mente-agil-offline-status", handleOfflineStatus);
    document.addEventListener("click", handleOfflineNavigation);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("mente-agil-offline-status", handleOfflineStatus);
      document.removeEventListener("click", handleOfflineNavigation);
    };
  }, []);

  useEffect(() => {
    const guide = guideRef.current;
    if (!guide) return;
    if (showGuide && !guide.open) guide.showModal();
    if (!showGuide && guide.open) guide.close();
  }, [showGuide]);

  async function installApp() {
    if (!installPrompt) {
      setShowGuide(true);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice.catch(() => null);
    if (choice?.outcome === "accepted") setInstalled(true);
    setInstallPrompt(null);
  }

  return <>
    {ready && !installed && (
      <button className="install-app-button" type="button" onClick={installApp}>
        <span aria-hidden="true">↓</span>
        Instalar app
      </button>
    )}
    <dialog
      className="install-guide"
      ref={guideRef}
      aria-labelledby="install-guide-title"
      aria-describedby="install-guide-description"
      onCancel={() => setShowGuide(false)}
      onClose={() => setShowGuide(false)}
      onClick={(event) => {
        if (event.target === event.currentTarget) setShowGuide(false);
      }}
    >
      <span className="install-guide-mark" aria-hidden="true">M</span>
      <h2 id="install-guide-title">Instalar no celular</h2>
      <p id="install-guide-description">
        A instalação precisa ser feita pelo Google Chrome, não pelo navegador interno do ChatGPT.
      </p>
      <ol>
        <li>Abra esta página no Chrome.</li>
        <li>Toque no menu <strong>⋮</strong>.</li>
        <li>Escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</li>
      </ol>
      <div className="install-guide-actions">
        {isAndroid && (
          <a
            className="primary-button"
            href="intent://mente-agil-vinicius.zdarkx0.chatgpt.site/#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fmente-agil-vinicius.zdarkx0.chatgpt.site%2F;end"
          >
            Abrir no Chrome <span aria-hidden="true">↗</span>
          </a>
        )}
        <button className="secondary-button" type="button" onClick={() => setShowGuide(false)}>Fechar</button>
      </div>
    </dialog>
    {!online && (
      <div className="network-status" role="status">
        Modo offline. Seus treinos e dados privados continuam neste aparelho e serão sincronizados quando a internet voltar.
      </div>
    )}
    {online && (syncing || pending > 0) && (
      <div className="network-status" role="status">
        {syncing ? "Sincronizando seus resultados…" : `${pending} resultado${pending === 1 ? "" : "s"} aguardando sincronização.`}
      </div>
    )}
  </>;
}
