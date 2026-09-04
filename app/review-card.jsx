"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const OPERATION_LABELS = {
  add: "Soma",
  sub: "Subtração",
  mul: "Multiplicação"
};

const OPERATION_SYMBOLS = {
  add: "+",
  sub: "−",
  mul: "×"
};

const EMPTY_SUMMARY = { total: 0, add: 0, sub: 0, mul: 0 };

export default function ReviewCard({ viewer, accountState, revision, onResolved }) {
  const [errors, setErrors] = useState([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [state, setState] = useState("loading");
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [resolved, setResolved] = useState(0);
  const inputRef = useRef(null);
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const requestVersion = useRef(0);
  const feedbackTimer = useRef(null);
  const previousAccount = useRef(null);
  const accountKey = viewer.account ? `${viewer.account.nickname}:${viewer.account.createdAt}` : null;

  const loadErrors = useCallback(async ({ start = false } = {}) => {
    const version = ++requestVersion.current;
    clearTimeout(feedbackTimer.current);
    submittingRef.current = false;
    setSubmitting(false);
    setErrors([]);
    setFeedback(null);
    if (accountState === "error") { setState("error"); return; }
    if (!viewer.account) {
      setState(accountState === "loading" ? "loading" : "guest");
      setErrors([]);
      setSummary(EMPTY_SUMMARY);
      return;
    }
    setState("loading");
    try {
      const response = await fetch("/api/review/errors", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar seus erros.");
      if (version !== requestVersion.current) return;
      const nextErrors = Array.isArray(data.errors) ? data.errors : [];
      setErrors(nextErrors);
      setSummary(data.summary ?? EMPTY_SUMMARY);
      setAnswer("");
      setFeedback(null);
      setResolved(0);
      setState(start && nextErrors.length ? "active" : nextErrors.length ? "ready" : "empty");
    } catch (error) {
      if (version !== requestVersion.current) return;
      setState("error");
      setFeedback({ correct: false, message: error.message || "Não foi possível carregar seus erros." });
    }
  }, [accountState, viewer.account]);

  useEffect(() => {
    const accountChanged = previousAccount.current !== accountKey;
    previousAccount.current = accountKey;
    if (accountChanged || state !== "active") loadErrors();
    // A revisão não deve ser reiniciada quando um novo erro é salvo durante outra sessão.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountKey, accountState, revision, loadErrors]);

  useEffect(() => () => {
    requestVersion.current += 1;
    clearTimeout(feedbackTimer.current);
  }, []);

  const current = errors[0] ?? null;

  useEffect(() => {
    if (state !== "active" || feedback) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [current?.id, feedback, state]);

  const submit = async (event) => {
    event.preventDefault();
    if (!current || feedback || submittingRef.current || answer.trim() === "") return;
    const given = Number(answer.replace(",", "."));
    if (!Number.isSafeInteger(given)) return;
    submittingRef.current = true;
    setSubmitting(true);
    const version = requestVersion.current;
    try {
      const response = await fetch("/api/review/errors/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: current.id, given })
      });
      const data = await response.json();
      if (version !== requestVersion.current) return;
      if (!response.ok) throw new Error(data.error || "Não foi possível conferir a resposta.");
      if (data.correct) onResolved?.();
      setFeedback(data.correct
        ? { correct: true, message: "Correto — este erro foi resolvido." }
        : { correct: false, message: `Ainda não. A resposta é ${data.expectedAnswer}.` });
      feedbackTimer.current = window.setTimeout(() => {
        if (version !== requestVersion.current) return;
        if (data.correct) {
          const remaining = errors.slice(1);
          setErrors(remaining);
          if (!remaining.length) setState("complete");
          setSummary((currentSummary) => ({
            ...currentSummary,
            total: Math.max(0, currentSummary.total - 1),
            [current.operation]: Math.max(0, currentSummary[current.operation] - 1)
          }));
          setResolved((value) => value + 1);
        }
        setAnswer("");
        setFeedback(null);
        submittingRef.current = false;
      }, data.correct ? 550 : 1000);
    } catch (error) {
      if (version !== requestVersion.current) return;
      setFeedback({ correct: false, message: error.message || "Não foi possível conferir a resposta." });
      feedbackTimer.current = window.setTimeout(() => {
        if (version !== requestVersion.current) return;
        setFeedback(null);
        submittingRef.current = false;
      }, 1400);
    } finally {
      if (version === requestVersion.current) setSubmitting(false);
    }
  };

  return (
    <article className="review-card" id="revisar-erros">
      <header className="review-header">
        <div>
          <span>Treino direcionado</span>
          <strong>Revisar meus erros</strong>
          <small>As contas erradas ficam ligadas à sua conta e desaparecem quando você acerta.</small>
        </div>
        {viewer.account && state !== "active" && (
          <button className="review-refresh" onClick={() => loadErrors()} aria-label="Atualizar lista de erros">↻ Atualizar</button>
        )}
      </header>

      {state === "loading" && <div className="review-placeholder">Carregando sua lista de revisão…</div>}

      {state === "guest" && (
        <div className="review-guest">
          <div><strong>Entre para criar sua lista pessoal.</strong><span>Sua lista acompanha os erros salvos nos seus treinos.</span></div>
          <a className="primary-button" href="/entrar">Entrar na conta <span>→</span></a>
        </div>
      )}

      {state === "error" && (
        <div className="review-placeholder review-error">{feedback?.message || "Não foi possível carregar seus erros."}</div>
      )}

      {(state === "ready" || state === "empty") && (
        <div className="review-ready">
          <div className="review-total">
            <strong>{summary.total}</strong>
            <span>{summary.total === 1 ? "conta para revisar" : "contas para revisar"}</span>
          </div>
          <div className="review-breakdown">
            <div><span>Soma</span><strong>{summary.add}</strong></div>
            <div><span>Subtração</span><strong>{summary.sub}</strong></div>
            <div><span>Multiplicação</span><strong>{summary.mul}</strong></div>
          </div>
          {summary.total ? (
            <button className="primary-button" onClick={() => loadErrors({ start: true })}>Começar revisão <span>→</span></button>
          ) : (
            <p>Você não possui erros pendentes. Novas contas erradas aparecerão aqui automaticamente.</p>
          )}
        </div>
      )}

      {state === "active" && current && (
        <div className="review-active">
          <div className="review-progress">
            <span>{errors.length} pendente{errors.length === 1 ? "" : "s"}</span>
            <strong>{OPERATION_LABELS[current.operation]} • nível {current.level + 1}</strong>
            <small>Você errou esta conta {current.wrongCount} vez{current.wrongCount === 1 ? "" : "es"}.</small>
          </div>
          <div className="review-question">
            <div className="review-equation" aria-live="polite">
              <span>{current.a}</span><b>{OPERATION_SYMBOLS[current.operation]}</b><span>{current.b}</span><b>=</b><span className="answer-slot">?</span>
            </div>
            <form onSubmit={submit}>
              <input
                ref={inputRef}
                inputMode="numeric"
                autoComplete="off"
                aria-label="Resposta da revisão"
                placeholder="Digite o resultado"
                value={answer}
                disabled={Boolean(feedback) || submitting}
                onChange={(event) => setAnswer(event.target.value)}
              />
              <button className="primary-button" type="submit" disabled={Boolean(feedback) || submitting}>{submitting ? "Conferindo…" : "Responder"} <span>↵</span></button>
            </form>
            <div className={`review-feedback ${feedback ? (feedback.correct ? "correct" : "wrong") : ""}`} aria-live="assertive">
              {feedback?.message}
            </div>
          </div>
          <button className="review-stop" disabled={submitting || Boolean(feedback)} onClick={() => setState("ready")}>Pausar revisão</button>
        </div>
      )}

      {state === "complete" && (
        <div className="review-complete">
          <span>✓</span>
          <div><strong>Revisão concluída.</strong><p>Você resolveu {resolved} {resolved === 1 ? "erro pendente" : "erros pendentes"}.</p></div>
          <button className="secondary-button" onClick={() => loadErrors()}>Voltar</button>
        </div>
      )}
    </article>
  );
}
