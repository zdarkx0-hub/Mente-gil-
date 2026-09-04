export const ACHIEVEMENTS = [
  { id: "first-session", name: "Primeiros passos", icon: "🏅", metric: "sessions", target: 1,
    description: "Conclua uma partida com pelo menos uma resposta.", unit: "partida concluída" },
  { id: "ten-streak", name: "Em sequência", icon: "🔥", metric: "bestStreak", target: 10,
    description: "Acerte 10 contas seguidas em uma partida.", unit: "acertos seguidos" },
  { id: "hundred-correct", name: "Centenário", icon: "💯", metric: "totalCorrect", target: 100,
    description: "Acumule 100 acertos em suas partidas.", unit: "acertos acumulados" },
  { id: "perfect-session", name: "Precisão total", icon: "🎯", metric: "perfectCorrect", target: 10,
    description: "Conclua uma partida sem erros e com pelo menos 10 respostas.", unit: "acertos em uma partida sem erros" },
  { id: "ten-reviews", name: "Aprendendo com os erros", icon: "🔄", metric: "reviewCorrect", target: 10,
    description: "Resolva 10 contas em Revisar meus erros.", unit: "contas resolvidas na revisão" },
  { id: "seven-practice-days", name: "Uma semana de prática", icon: "🔥", metric: "bestPracticeDays", target: 7,
    description: "Acumule 7 dias de prática na mesma sequência. Descansos protegidos não somam dias.", unit: "dias de prática na sequência" },
  { id: "explorer", name: "Explorador", icon: "🧭", metric: "operationsExplored", target: 3,
    description: "Conclua um treino de soma, um de subtração e um de multiplicação, com pelo menos 10 respostas em cada.", unit: "operações praticadas" },
  { id: "solid-foundation", name: "Base firme", icon: "🎯", metric: "bestSkillRun", target: 3,
    description: "Faça 3 treinos específicos seguidos com pelo menos 90% de acertos na mesma habilidade e intervalo.", unit: "treinos na melhor sequência" },
  { id: "fifty-reviews", name: "Aprendendo com os erros · 50", icon: "🛠️", metric: "reviewCorrect", target: 50,
    description: "Resolva 50 contas em Revisar meus erros.", unit: "contas resolvidas na revisão" },
  { id: "thousand-correct", name: "Mil na conta", icon: "✨", metric: "totalCorrect", target: 1000,
    description: "Acumule 1.000 respostas corretas em suas partidas.", unit: "acertos acumulados" },
  { id: "personal-best", name: "Superação pessoal", icon: "📈", metric: "recordImprovements", target: 1,
    description: "Supere um recorde seu já registrado na mesma operação, faixa e duração do ranking.", unit: "recorde pessoal superado" }
];

export function achievementProgress(metrics) {
  return ACHIEVEMENTS.map(({ id, metric, target }) => {
    const progress = Math.min(target, Math.max(0, Number(metrics[metric]) || 0));
    return { id, progress, target, unlocked: progress >= target };
  });
}
