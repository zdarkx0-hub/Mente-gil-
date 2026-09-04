export const DRILL_SKILLS = {
  add: [
    { value: "no-carry", label: "Soma sem vai-um", example: "23 + 14" },
    { value: "carry", label: "Soma com vai-um", example: "27 + 18" }
  ],
  sub: [
    { value: "no-borrow", label: "Subtração sem empréstimo", example: "86 − 42" },
    { value: "borrow", label: "Subtração com empréstimo", example: "74 − 65" }
  ],
  mul: [{ value: "table", label: "Tabuada escolhida", example: "7 × 8" }]
};

export function drillConfig(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Configuração inválida.");
  const { operation, skill, count, min, max } = value;
  if (!Object.hasOwn(DRILL_SKILLS, operation) || !DRILL_SKILLS[operation].some((item) => item.value === skill)) {
    throw new Error("Escolha a operação e a habilidade do treino.");
  }
  if (![10, 15].includes(count)) throw new Error("Escolha 10 ou 15 questões.");
  if (![min, max].every(Number.isSafeInteger) || min < 0 || max > 1000 || min > max) {
    throw new Error("Use um intervalo de 0 a 1.000, com o mínimo menor ou igual ao máximo.");
  }
  const table = operation === "mul" ? value.table : null;
  if (operation === "mul" && (!Number.isSafeInteger(table) || table < 1 || table > 1000)) {
    throw new Error("Escolha uma tabuada de 1 a 1.000.");
  }
  return { operation, skill, count, min, max, table };
}

export function hasCarry(a, b) {
  while (a || b) {
    if (a % 10 + b % 10 >= 10) return true;
    a = Math.floor(a / 10);
    b = Math.floor(b / 10);
  }
  return false;
}

export function hasBorrow(a, b) {
  while (a || b) {
    if (a % 10 < b % 10) return true;
    a = Math.floor(a / 10);
    b = Math.floor(b / 10);
  }
  return false;
}

export const drillAnswer = ({ operation, a, b }) => operation === "add" ? a + b : operation === "sub" ? a - b : a * b;
export const drillSymbol = (operation) => ({ add: "+", sub: "−", mul: "×" })[operation];
export const drillLabel = (config) => config.operation === "mul"
  ? `Tabuada do ${config.table}` : DRILL_SKILLS[config.operation].find((item) => item.value === config.skill).label;

export function matchesDrill(config, question) {
  if (!question || question.operation !== config.operation) return false;
  const { a, b } = question;
  if (![a, b].every(Number.isSafeInteger) || b < config.min || b > config.max) return false;
  if (config.operation === "mul") return a === config.table;
  if (a < config.min || a > config.max) return false;
  if (config.operation === "sub") return a >= b && hasBorrow(a, b) === (config.skill === "borrow");
  return hasCarry(a, b) === (config.skill === "carry");
}

function shuffled(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function generateDrill(value, random = Math.random) {
  const config = drillConfig(value);
  const numbers = Array.from({ length: config.max - config.min + 1 }, (_, i) => config.min + i);
  const pool = [];
  const seen = new Set();
  const add = (a, b) => {
    const question = { operation: config.operation, a, b };
    const key = `${a}:${b}`;
    if (matchesDrill(config, question) && !seen.has(key)) { pool.push(question); seen.add(key); }
  };
  // Broad random sampling first, then a bounded exhaustive fallback for narrow
  // ranges. Impossible settings produce an error, never a different skill.
  if (config.operation === "mul") {
    for (const b of numbers) add(config.table, b);
  } else {
    for (let attempt = 0; attempt < 1024 && pool.length < 64; attempt += 1) {
      add(numbers[Math.floor(random() * numbers.length)], numbers[Math.floor(random() * numbers.length)]);
    }
    if (pool.length < config.count) {
      outer: for (const a of shuffled(numbers, random)) {
        for (const b of shuffled(numbers, random)) {
          add(a, b);
          if (pool.length >= config.count) break outer;
        }
      }
    }
  }
  if (!pool.length) throw new Error("Não existem contas dessa habilidade nesse intervalo. Ajuste os números ou escolha outra habilidade.");
  const questions = [];
  while (questions.length < config.count) {
    const cycle = shuffled(pool, random);
    if (cycle.length > 1 && questions.length && cycle[0] === questions[questions.length - 1]) {
      [cycle[0], cycle[1]] = [cycle[1], cycle[0]];
    }
    questions.push(...cycle.slice(0, config.count - questions.length));
  }
  return { config, questions, repeats: pool.length < config.count };
}

export function summarizeDrill(configValue, answers) {
  const config = drillConfig(configValue);
  if (!Array.isArray(answers) || answers.length !== config.count) throw new Error(`Conclua as ${config.count} questões antes de salvar.`);
  let correct = 0;
  let streak = 0;
  let bestStreak = 0;
  for (const question of answers) {
    if (!matchesDrill(config, question) || !Number.isSafeInteger(question.given)) throw new Error("As respostas não correspondem ao treino escolhido.");
    if (question.given === drillAnswer(question)) {
      correct += 1;
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
    } else { streak = 0; }
  }
  return { config, correct, wrong: config.count - correct, bestStreak, accuracy: Math.round(correct / config.count * 100) };
}
