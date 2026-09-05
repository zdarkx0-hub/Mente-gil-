"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DRILL_SKILLS, drillAnswer, drillLabel, drillSymbol, generateDrill, summarizeDrill } from "../shared/drills.mjs";
import { postJsonOrQueue, rememberDrillSession } from "./offline-client";

export default function SpecificTraining({ viewer, accountState, otherSessionActive, onBusyChange, onFeedback, onSaved }) {
  const [config, setConfig] = useState({ operation: "add", skill: "no-carry", count: 10, min: "10", max: "99", table: "7" });
  const [phase, setPhase] = useState("ready");
  const [session, setSession] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [message, setMessage] = useState("");
  const [saveState, setSaveState] = useState("idle");
  const [confirmExit, setConfirmExit] = useState(false);
  const inputRef = useRef(null);
  const summaryRef = useRef(null);
  const lockRef = useRef(false);
  const savingRef = useRef(false);
  const pendingRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => () => { clearTimeout(timeoutRef.current); }, []);
  useEffect(() => {
    if (phase !== "active" || feedback || confirmExit) return;
    inputRef.current?.focus({ preventScroll: true });
  }, [phase, feedback, answers.length, confirmExit]);
  useEffect(() => {
    if (phase === "finished") summaryRef.current?.focus({ preventScroll: true });
  }, [phase]);
  useEffect(() => {
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    if (phase === "active" || ["saving", "error"].includes(saveState)) window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase, saveState]);

  const save = async (payload = pendingRef.current) => {
    if (!payload || savingRef.current) return;
    pendingRef.current = payload;
    savingRef.current = true;
    setSaveState("saving");
    try {
      const result = await postJsonOrQueue("/api/drills/complete", payload, { queueKey: payload.id });
      const localSummary = summarizeDrill(payload.config, payload.answers);
      await rememberDrillSession({
        id: payload.id,
        config: localSummary.config,
        correct: localSummary.correct,
        wrong: localSummary.wrong,
        bestStreak: localSummary.bestStreak,
        accuracy: localSummary.accuracy,
        completedAt: Date.now()
      });
      pendingRef.current = null;
      setSaveState(result.state === "queued" ? "queued" : "saved");
      onSaved();
      onBusyChange(false);
    } catch { setSaveState("error"); }
    finally { savingRef.current = false; }
  };

  const start = (event) => {
    event.preventDefault();
    if (otherSessionActive || phase !== "ready" || accountState !== "ready") return;
    try {
      if ([config.min, config.max, ...(config.operation === "mul" ? [config.table] : [])].some((value) => value.trim() === "")) {
        throw new Error("Preencha os números do treino.");
      }
      const generated = generateDrill({ ...config, min: Number(config.min), max: Number(config.max), table: Number(config.table) });
      setSession({ ...generated, id: crypto.randomUUID(), saveToAccount: Boolean(viewer.account) });
      setAnswers([]);
      setAnswer("");
      setFeedback(null);
      setMessage("");
      setSaveState("idle");
      setConfirmExit(false);
      lockRef.current = false;
      pendingRef.current = null;
      onBusyChange(true);
      setPhase("active");
    } catch (error) { setMessage(error.message); }
  };

  const submit = (event) => {
    event.preventDefault();
    if (lockRef.current || phase !== "active" || confirmExit) return;
    const given = Number(answer);
    if (answer.trim() === "" || !Number.isSafeInteger(given)) { setMessage("Digite um número inteiro para responder."); inputRef.current?.focus(); return; }
    lockRef.current = true;
    const question = session.questions[answers.length];
    const correct = given === drillAnswer(question);
    const next = [...answers, { ...question, given }];
    setMessage("");
    setFeedback({ correct, expected: drillAnswer(question) });
    onFeedback(correct);
    timeoutRef.current = setTimeout(() => {
      setAnswers(next);
      setAnswer("");
      setFeedback(null);
      lockRef.current = false;
      if (next.length === session.config.count) {
        setPhase("finished");
        if (session.saveToAccount) save({ id: session.id, config: session.config, answers: next });
        else { setSaveState("guest"); onBusyChange(false); }
      } else { inputRef.current?.focus({ preventScroll: true }); }
    }, correct ? 300 : 900);
  };

  const abandon = () => {
    clearTimeout(timeoutRef.current);
    lockRef.current = false;
    setConfirmExit(false);
    setPhase("ready");
    setFeedback(null);
    setMessage("");
    onBusyChange(false);
  };

  const question = phase === "active" ? session.questions[answers.length] : null;
  const summary = phase === "finished" ? summarizeDrill(session.config, answers) : null;
  const wrongAnswers = summary ? answers.filter((item) => item.given !== drillAnswer(item)) : [];
  const changeOperation = (operation) => setConfig((current) => ({
    ...current, operation, skill: DRILL_SKILLS[operation][0].value,
    min: operation === "mul" ? "1" : "10", max: operation === "mul" ? "10" : "99"
  }));

  return <section className="drill-section" id="treinos-especificos" aria-labelledby="drill-title">
    <header className="drill-heading">
      <h2 id="drill-title">Treinos específicos</h2>
      <p>Sem cronômetro. Pratique uma habilidade em 10 ou 15 questões.</p>
    </header>
    <div className="drill-card">
      {phase === "ready" && <form className="drill-setup" onSubmit={start}>
        <div className="drill-options">
          <fieldset><legend>O que você quer praticar?</legend><div className="drill-choices">
            {[["add", "+", "Soma"], ["sub", "−", "Subtração"], ["mul", "×", "Multiplicação"]].map(([value, symbol, label]) => <button type="button" key={value} aria-pressed={config.operation === value} onClick={() => changeOperation(value)}><span aria-hidden="true">{symbol}</span>{label}</button>)}
          </div></fieldset>
          <fieldset><legend>Habilidade</legend><div className="drill-skills">
            {DRILL_SKILLS[config.operation].map((skill) => <label key={skill.value}>
              <input type="radio" name="drill-skill" checked={config.skill === skill.value} onChange={() => setConfig({ ...config, skill: skill.value })} />
              <span>{skill.label}<small>Exemplo: {skill.example}</small></span>
            </label>)}
          </div></fieldset>
          {config.operation === "mul" && <label className="drill-number">Qual tabuada? (1 a 1.000)<input type="number" inputMode="numeric" min="1" max="1000" step="1" required value={config.table} onChange={(event) => setConfig({ ...config, table: event.target.value })} /></label>}
          <fieldset><legend>{config.operation === "mul" ? "Intervalo dos multiplicadores" : "Intervalo dos dois números"}</legend>
            <div className="drill-range">
              <label>Mínimo<input type="number" inputMode="numeric" min="0" max="1000" step="1" required value={config.min} onChange={(event) => setConfig({ ...config, min: event.target.value })} /></label>
              <span aria-hidden="true">até</span>
              <label>Máximo<input type="number" inputMode="numeric" min="0" max="1000" step="1" required value={config.max} onChange={(event) => setConfig({ ...config, max: event.target.value })} /></label>
            </div>
            <p className="drill-note">Números até 1.000; o resultado pode ser maior. Subtrações sem resultados negativos.</p>
          </fieldset>
        </div>
        <div className="drill-start">
          <fieldset><legend>Quantas questões?</legend><div className="drill-count">
            {[10, 15].map((count) => <label key={count}><input type="radio" name="drill-count" checked={config.count === count} onChange={() => setConfig({ ...config, count })} /><span><strong>{count}</strong>questões</span></label>)}
          </div></fieldset>
          <p>A mesma habilidade do começo ao fim.</p>
          <p className="drill-note">Em intervalos pequenos, algumas contas podem se repetir.</p>
          {accountState === "ready" && <p className="drill-note">{viewer.account ? "Ao concluir, o resultado será salvo na sua conta e contará para as conquistas." : <>Você pode praticar como visitante. Para salvar o resultado, <a href={viewer.authenticated ? "/cadastro" : "/entrar"}>{viewer.authenticated ? "conclua seu cadastro" : "entre na sua conta"}</a> antes de começar.</>}</p>}
          {accountState === "loading" && <p role="status">Verificando sua conta…</p>}
          {accountState === "error" && <p className="drill-error">Não foi possível verificar a conta. <button type="button" className="drill-text-button" onClick={() => window.location.reload()}>Tentar novamente</button></p>}
          {otherSessionActive && <p className="drill-note">Conclua o treino em andamento para começar este.</p>}
          {message && <p className="drill-error" role="alert">{message}</p>}
          <button className="primary-button" disabled={otherSessionActive || accountState !== "ready"}>Começar {config.count} questões <span aria-hidden="true">→</span></button>
        </div>
      </form>}

      {question && <div className="drill-active">
        <div className="drill-session-heading"><span>{drillLabel(session.config)}</span><strong>Questão {answers.length + 1} de {session.config.count}</strong><span>Sem cronômetro</span></div>
        <progress aria-label="Questões respondidas" max={session.config.count} value={answers.length} />
        {session.repeats && <p className="drill-note">Algumas contas se repetem para completar seu treino nesse intervalo.</p>}
        <div className="drill-question" aria-label={`${question.a} ${question.operation === "add" ? "mais" : question.operation === "sub" ? "menos" : "vezes"} ${question.b}`}>{question.a} <span>{drillSymbol(question.operation)}</span> {question.b} <span>= ?</span></div>
        <form onSubmit={submit} className="drill-answer-form">
          <label htmlFor="drill-answer">Sua resposta</label>
          <div><input id="drill-answer" ref={inputRef} type="text" inputMode="numeric" autoComplete="off" value={answer} readOnly={Boolean(feedback) || confirmExit} onChange={(event) => setAnswer(event.target.value)} aria-describedby="drill-feedback" />
            <button className="primary-button" disabled={Boolean(feedback) || confirmExit}>Responder</button></div>
        </form>
        <p id="drill-feedback" className={`drill-feedback ${feedback && !feedback.correct ? "drill-error" : ""}`} role="status">{feedback ? feedback.correct ? "Acertou!" : `A resposta correta é ${feedback.expected}. Você poderá revisar esta conta ao terminar.` : message || "Digite a resposta e pressione Enter."}</p>
        {confirmExit ? <div className="drill-exit" role="alert">
          <p>Sair agora? Este treino incompleto não será salvo.</p>
          <button type="button" className="secondary-button" onClick={() => setConfirmExit(false)}>Continuar treino</button>
          <button type="button" className="drill-text-button" onClick={abandon}>Sair sem salvar</button>
        </div> : <button type="button" className="drill-text-button" disabled={Boolean(feedback)} onClick={() => setConfirmExit(true)}>Sair do treino</button>}
      </div>}

      {summary && <div className="drill-summary">
        <span className="eyebrow">NO SEU RITMO, ATÉ O FIM</span>
        <h3 ref={summaryRef} tabIndex={-1}>Você concluiu as {session.config.count} questões!</h3>
        <p>{drillLabel(session.config)} · {session.config.min} a {session.config.max}</p>
        <div className="summary-stats">
          <div><strong>{summary.correct}</strong><span>acertos</span></div><div><strong>{summary.wrong}</strong><span>{summary.wrong === 1 ? "erro" : "erros"}</span></div>
          <div><strong>{summary.accuracy}%</strong><span>precisão</span></div><div><strong>{summary.bestStreak}</strong><span>sequência</span></div>
        </div>
        <div className={saveState === "error" ? "drill-error" : "drill-note"} role="status">
          {saveState === "saving" && "Salvando resultado e erros na sua conta…"}
          {saveState === "saved" && <>Salvo na sua conta. <Link href="/progresso/conquistas">Ver conquistas</Link></>}
          {saveState === "queued" && "Salvo com segurança neste aparelho. Será sincronizado automaticamente quando a internet voltar."}
          {saveState === "error" && <>Não foi possível guardar o resultado. <button type="button" className="drill-text-button" onClick={() => save()}>Tentar novamente</button></>}
          {saveState === "guest" && "Treino de visitante: resultado disponível somente nesta tela. Entre na conta antes do próximo para guardar seu progresso."}
        </div>
        {wrongAnswers.length > 0 && <details className="drill-mistakes"><summary>{wrongAnswers.length === 1 ? "Conferir meu erro" : `Conferir meus ${wrongAnswers.length} erros`}</summary><ul>{wrongAnswers.map((item, index) => <li key={index}><strong>{item.a} {drillSymbol(item.operation)} {item.b} = {drillAnswer(item)}</strong><span>Sua resposta: {item.given}</span></li>)}</ul></details>}
        <div className="drill-summary-actions"><button type="button" className="primary-button" disabled={["saving", "error"].includes(saveState)} onClick={() => { setPhase("ready"); setMessage(""); }}>Escolher próximo treino</button>
          {saveState === "saved" && summary.wrong > 0 && <Link className="secondary-button" href="/revisar">Revisar meus erros</Link>}</div>
      </div>}
    </div>

    <p className="drill-history-link"><Link href="/progresso">Ver meu histórico de treinos</Link></p>
  </section>;
}
