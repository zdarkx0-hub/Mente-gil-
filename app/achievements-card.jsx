"use client";

import { ACHIEVEMENTS } from "../shared/achievements.mjs";
import PracticeFlame from "./practice-flame";

export default function AchievementsCard({ viewer, accountState, progress }) {
  const { data, state, announcement, load } = progress;
  const showCards = state === "guest" || Boolean(data);
  return (
    <section className="achievements-card" id="conquistas" aria-labelledby="achievements-title">
      <header className="achievements-header">
        <div>
          <span className="achievements-kicker">Seu progresso, suas medalhas</span>
          <h2 id="achievements-title">Minhas conquistas</h2>
          <p>Constância, precisão e superação, cada uma no seu ritmo. Seu progresso é privado.</p>
        </div>
        <div className="achievements-overview">
          {data && <strong>{data.unlockedCount}<span> / {ACHIEVEMENTS.length} desbloqueadas</span></strong>}
          {viewer.account && <button type="button" onClick={load} disabled={state === "loading"}>Atualizar conquistas</button>}
        </div>
      </header>
      <div className="achievement-announcement" role="status">{announcement}</div>
      {data && <PracticeFlame progress={progress} />}
      {state === "loading" && <p className="achievement-state" role="status">Carregando suas conquistas…</p>}
      {state === "error" && <div className="achievement-state error" role="alert">
        <p>Não foi possível atualizar suas conquistas. Seu progresso salvo continua guardado.</p>
        <button type="button" className="secondary-button" onClick={() => accountState === "error" ? window.location.reload() : load()}>Tentar novamente</button>
      </div>}
      {state === "guest" && <div className="achievements-guest">
        <p>{viewer.authenticated ? "Escolha seu apelido para começar a colecionar medalhas." : "Entre na sua conta para guardar e acompanhar suas conquistas."}</p>
        <a className="primary-button" href={viewer.authenticated ? "/cadastro" : "/entrar"}>{viewer.authenticated ? "Concluir cadastro" : "Entrar na conta"}</a>
      </div>}
      {showCards && <ul className="achievement-grid">
        {ACHIEVEMENTS.map((item) => {
          const saved = data?.achievements.find((entry) => entry.id === item.id);
          const unlocked = Boolean(saved?.unlocked);
          const progress = saved?.progress ?? 0;
          return <li key={item.id} className={`achievement-medal ${unlocked ? "unlocked" : "locked"}`}>
            <div className="achievement-medal-top">
              <span className="achievement-icon" aria-hidden="true">{item.icon}</span>
              <span className="achievement-status">{state === "guest" ? "Entre para desbloquear" : unlocked ? "✓ Desbloqueada" : "Em progresso"}</span>
            </div>
            <h3>{item.name}</h3>
            <p>{item.description}</p>
            {saved && <div className="achievement-progress">
              <label htmlFor={`progress-${item.id}`}>{progress} / {item.target} {item.unit}</label>
              <progress id={`progress-${item.id}`} value={progress} max={item.target} />
              <span>{unlocked ? "Medalha conquistada" : `Falta${item.target - progress === 1 ? "" : "m"} ${item.target - progress} para desbloquear`}</span>
            </div>}
          </li>;
        })}
      </ul>}
      <details className="achievement-rules"><summary>Como as conquistas são contabilizadas?</summary>
        <p className="achievement-note">Treinos livres, específicos, ranking e revisões contam quando você está conectado. As cinco medalhas originais continuam com as mesmas regras. Partidas antigas só contam se foram registradas na conta.</p>
        <p className="achievement-note">Explorador exige treinos de uma operação por vez, com pelo menos 10 respostas. Treinos mistos e treinos livres antigos sem a operação registrada não contam para essa medalha.</p>
        <p className="achievement-note">Base firme mostra sua melhor tentativa em cada habilidade e intervalo; na multiplicação, considera também a tabuada. Trocar entre 10 e 15 questões não interrompe a sequência. Um treino abaixo de 90% reinicia aquela tentativa, mas não remove a medalha já conquistada.</p>
        <p className="achievement-note">Superação pessoal exige melhorar um recorde existente; a primeira participação e os empates não contam. O descanso ou uma sessão ruim não apagam medalhas anteriores.</p>
      </details>
    </section>
  );
}
