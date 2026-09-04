"use client";

import Link from "next/link";
import { MIN_DAILY_ANSWERS, PRACTICE_TIME_LABEL } from "../shared/practice-streak.mjs";

const DAY_STATES = { practiced: "Treino concluído", protected: "Descanso protegido", today: "Ainda dá tempo de treinar", missed: "Sem treino registrado", future: "Dia futuro" };

export default function PracticeFlame({ progress, compact = false }) {
  const { data, state, load } = progress;
  const streak = data?.streak;
  if (compact && (state === "guest" || (!streak && state === "loading"))) return null;
  if (!streak) return state === "error" ? <p className="flame-error" role="alert">Não foi possível carregar sua constância. <button onClick={load}>Tentar novamente</button></p> : null;
  const message = streak.practicedToday ? "Treino de hoje concluído!"
    : streak.current > 0 ? "Seu próximo treino mantém a sequência."
      : streak.best > 0 ? "Você pode recomeçar hoje. Seu recorde continua guardado."
        : "Seu primeiro treino acende o foguinho.";

  if (compact) return <Link className="flame-compact" href="/progresso/conquistas">
    <span aria-hidden="true">🔥</span><span><strong>{streak.current} {streak.current === 1 ? "dia de prática" : "dias de prática"}</strong><small>{state === "error" ? "Não foi possível atualizar agora." : message}</small></span>
    <span className="flame-compact-record">Recorde: {streak.best}</span>
  </Link>;

  return <section className={`practice-flame ${streak.practicedToday ? "completed" : ""}`} aria-labelledby="flame-title">
    <div className="flame-heading"><div><span className="flame-icon" aria-hidden="true">🔥</span><h3 id="flame-title">Minha constância</h3></div><span>Recorde: <strong>{streak.best} dias</strong></span></div>
    <div className="flame-count"><strong>{streak.current}</strong><span>{streak.current === 1 ? "dia de prática na sequência" : "dias de prática na sequência"}</span></div>
    <p className="flame-message">{message}</p>
    <ol className="flame-week" aria-label="Seus treinos nesta semana">
      {streak.week.map((day) => <li key={day.date} className={`flame-day ${day.state}`} aria-current={day.isToday ? "date" : undefined}>
        <span>{day.label}</span><span className="flame-day-mark" aria-hidden="true">{day.state === "practiced" ? "✓" : day.state === "protected" ? "☾" : "—"}</span>
        <span className="sr-only">{day.date}: {DAY_STATES[day.state]}{day.isToday ? ", hoje" : ""}</span>
      </li>)}
    </ol>
    <div className="flame-rest"><span aria-hidden="true">☾</span><p>{streak.restAvailable ? "Descanso protegido disponível nesta semana." : "Descanso protegido já utilizado nesta semana."}<small>Semana de segunda a domingo. Descansar protege, mas não soma um dia.</small></p></div>
    <details className="achievement-rules"><summary>Como manter o foguinho?</summary>
      <p>Conclua um treino livre, específico ou de ranking com pelo menos {MIN_DAILY_ANSWERS} respostas. Basta um por dia; só fazer login ou revisar erros não aumenta a sequência. Não é necessário acertar tudo.</p>
      <p>O primeiro dia sem treino de cada semana é protegido automaticamente, se você já tiver uma sequência ativa. A proteção só é aplicada quando o dia termina. Um segundo dia sem treino na mesma semana reinicia a sequência, mas preserva seu recorde, medalhas e histórico.</p>
      <p>{PRACTICE_TIME_LABEL}. Conta o dia em que o resultado é salvo. Treinos antigos registrados na conta também contam; não há recuperação de sessões de visitante.</p>
    </details>
  </section>;
}
