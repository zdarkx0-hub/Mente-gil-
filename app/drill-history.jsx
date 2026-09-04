"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { drillLabel } from "../shared/drills.mjs";

export default function DrillHistory({ viewer, accountState, revision }) {
  const [history, setHistory] = useState([]);
  const [historyState, setHistoryState] = useState("loading");
  const historyRequest = useRef(0);
  const loadHistory = useCallback(async () => {
    const request = ++historyRequest.current;
    if (accountState === "loading") return;
    if (accountState === "error") { setHistoryState("error"); return; }
    if (!viewer.account) { setHistory([]); setHistoryState("guest"); return; }
    setHistoryState("loading");
    try {
      const response = await fetch("/api/drills", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.sessions)) throw new Error("Histórico indisponível");
      if (request !== historyRequest.current) return;
      setHistory(data.sessions);
      setHistoryState("ready");
    } catch { if (request === historyRequest.current) setHistoryState("error"); }
  }, [accountState, viewer.account]);


  useEffect(() => { loadHistory(); return () => { historyRequest.current += 1; }; }, [loadHistory, revision]);
  return (
    <article className="drill-history">
      <h3>Meu histórico de treinos específicos</h3><p className="drill-note">Seus últimos 10 treinos concluídos. Visível somente para você.</p>
      {historyState === "loading" && <p role="status">Carregando histórico…</p>}
      {historyState === "error" && <p className="drill-error" role="alert">Não foi possível carregar o histórico. <button className="drill-text-button" onClick={loadHistory}>Tentar novamente</button></p>}
      {historyState === "guest" && <p className="drill-note">Entre na sua conta e conclua o cadastro para guardar e consultar seus treinos.</p>}
      {historyState === "ready" && !history.length && <p className="drill-note">Ainda não há treinos específicos concluídos. Seu primeiro resultado aparecerá aqui.</p>}
      {historyState === "ready" && history.length > 0 && <ul>{history.map((item) => <li key={item.id}>
        <div><strong>{drillLabel(item.config)}</strong><span>{item.config.count} questões · {item.config.min} a {item.config.max} · {new Date(item.completedAt).toLocaleDateString("pt-BR")}</span></div>
        <div><strong>{item.accuracy}% de precisão</strong><span>{item.correct} acertos · {item.wrong} erros</span></div>
      </li>)}</ul>}
    </article>
  );
}
