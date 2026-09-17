(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./core.js"));
  else root.MenteCatalog = factory(root.MenteCore);
})(typeof window === "object" ? window : globalThis, function (core) {
  "use strict";
  const LABELS = {
    operations: { add: "Soma", sub: "Subtração", mul: "Multiplicação" },
    levels: { base: "Base", medium: "Até 100", advanced: "Até 1.000" },
  };
  // Shared rules prevent achievements and local medals from drifting apart.
  const earned = {
    first: (_stats, sessions) => sessions.length >= 1,
    hundred: (stats) => stats.correct >= 100,
    thousand: (stats) => stats.correct >= 1000,
    flame7: (stats) => stats.streak.best >= 7,
    perfect: (_stats, sessions) =>
      sessions.some((item) => item.answers.length >= 10 && item.wrong === 0),
    explorer: (_stats, sessions) =>
      ["add", "sub", "mul"].every((op) =>
        sessions.some(
          (item) => item.operation === op && item.answers.length >= 10,
        ),
      ),
  };
  const ACHIEVEMENTS = [
    {
      id: "first",
      icon: "✦",
      title: "Primeiro passo",
      description: "Conclua seu primeiro treino.",
      unlocked: earned.first,
    },
    {
      id: "streak10",
      icon: "⚡",
      title: "Sequência de 10",
      description: "Acerte 10 contas seguidas.",
      unlocked: (stats) => stats.longest >= 10,
    },
    {
      id: "hundred",
      icon: "100",
      title: "Centenário",
      description: "Some 100 acertos no aplicativo.",
      unlocked: earned.hundred,
    },
    {
      id: "perfect",
      icon: "◎",
      title: "Treino perfeito",
      description: "Faça ao menos 10 questões sem errar.",
      unlocked: earned.perfect,
    },
    {
      id: "explorer",
      icon: "◇",
      title: "Explorador",
      description: "Treine as três operações.",
      unlocked: earned.explorer,
    },
    {
      id: "flame7",
      icon: "🔥",
      title: "Fogo aceso",
      description: "Pratique por 7 dias seguidos.",
      unlocked: earned.flame7,
    },
    {
      id: "solid",
      icon: "◆",
      title: "Base firme",
      description: "Alcance 90% em três treinos.",
      unlocked: (stats, sessions) =>
        sessions.filter(
          (item) =>
            core.accuracy(item.correct, item.wrong) >= 90 &&
            item.answers.length >= 10,
        ).length >= 3,
    },
    {
      id: "thousand",
      icon: "1K",
      title: "Mil na conta",
      description: "Chegue a 1.000 acertos.",
      unlocked: earned.thousand,
    },
  ];
  const THEMES = [
    {
      id: "neon",
      name: "Pulso Neon",
      unlock: "Tema inicial",
      available: () => true,
    },
    {
      id: "flames",
      name: "Chamas",
      unlock: "Liberado nesta demonstração",
      available: () => true,
    },
    {
      id: "crystal",
      name: "Cristal",
      unlock: "Liberado nesta demonstração",
      available: () => true,
    },
    {
      id: "eclipse",
      name: "Eclipse",
      unlock: "Liberado nesta demonstração",
      available: () => true,
    },
    {
      id: "rose",
      name: "Rosa Aurora",
      unlock: "Liberado nesta demonstração",
      available: () => true,
    },
  ];
  const LOCAL_MEDALS = [
    {
      id: "first",
      icon: "✦",
      name: "Primeiro passo",
      detail: "Conclua 1 treino",
      available: earned.first,
    },
    {
      id: "ten",
      icon: "10",
      name: "Ritmo firme",
      detail: "Conclua 10 treinos",
      available: (_stats, sessions) => sessions.length >= 10,
    },
    {
      id: "perfect",
      icon: "◎",
      name: "Precisão absoluta",
      detail: "Faça 10 questões sem errar",
      available: earned.perfect,
    },
    {
      id: "flame7",
      icon: "🔥",
      name: "Fogo aceso",
      detail: "Pratique 7 dias seguidos",
      available: earned.flame7,
    },
    {
      id: "hundred",
      icon: "100",
      name: "Centenário",
      detail: "Some 100 acertos",
      available: earned.hundred,
    },
    {
      id: "thousand",
      icon: "1K",
      name: "Mil na conta",
      detail: "Some 1.000 acertos",
      available: earned.thousand,
    },
    {
      id: "explorer",
      icon: "◇",
      name: "Trindade",
      detail: "Treine as 3 operações",
      available: earned.explorer,
    },
    {
      id: "add500",
      icon: "+",
      name: "Mestre da soma",
      detail: "500 acertos em soma",
      available: (_stats, sessions) => operationCorrect(sessions, "add") >= 500,
    },
    {
      id: "sub500",
      icon: "−",
      name: "Mestre da subtração",
      detail: "500 acertos em subtração",
      available: (_stats, sessions) => operationCorrect(sessions, "sub") >= 500,
    },
    {
      id: "mul500",
      icon: "×",
      name: "Mestre da tabuada",
      detail: "500 acertos em multiplicação",
      available: (_stats, sessions) => operationCorrect(sessions, "mul") >= 500,
    },
  ];
  const RANKING_MEDALS = [
    {
      id: "ranked-first",
      icon: "♢",
      name: "Competidor",
      detail: "Conclua uma partida ranqueada",
    },
    {
      id: "ranked-perfect",
      icon: "🎯",
      name: "Partida perfeita",
      detail: "10 acertos ou mais sem errar",
    },
    {
      id: "ranked-streak",
      icon: "⚡",
      name: "Sequência 20",
      detail: "Acerte 20 contas seguidas",
    },
    {
      id: "ranked-add",
      icon: "+",
      name: "Soma verificada",
      detail: "100 acertos ranqueados",
    },
    {
      id: "ranked-sub",
      icon: "−",
      name: "Subtração verificada",
      detail: "100 acertos ranqueados",
    },
    {
      id: "ranked-mul",
      icon: "×",
      name: "Tabuada verificada",
      detail: "100 acertos ranqueados",
    },
    {
      id: "ranked-thousand",
      icon: "1K",
      name: "Milhar verificado",
      detail: "100 acertos no avançado",
    },
  ];
  const RANKING_MEDAL_ICONS = Object.fromEntries(
    RANKING_MEDALS.map((item) => [item.id, item.icon]),
  );

  function operationCorrect(sessions, operation) {
    return sessions.reduce(
      (total, item) =>
        total + (item.operation === operation ? Number(item.correct) || 0 : 0),
      0,
    );
  }

  return {
    LABELS,
    ACHIEVEMENTS,
    THEMES,
    LOCAL_MEDALS,
    RANKING_MEDALS,
    RANKING_MEDAL_ICONS,
  };
});
