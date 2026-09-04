import { loadAchievements } from "./progress";

type TrainingSession = {
  id: string;
  duration: number;
  startedAt: number;
  completedAt: number | null;
};

export function summarizeTrainingAnswers(answers: unknown) {
  if (!Array.isArray(answers) || answers.length < 1 || answers.length > 1000) return null;
  let correct = 0;
  let streak = 0;
  let bestStreak = 0;
  for (const item of answers) {
    if (!item || typeof item !== "object") return null;
    const { operation, a, b, given } = item;
    if (!["add", "sub", "mul"].includes(operation)
      || ![a, b].every(Number.isSafeInteger) || typeof given !== "number" || !Number.isFinite(given)
      || a < 0 || a > 1000 || b < 0 || b > 1000) return null;
    const expected = operation === "add" ? a + b : operation === "sub" ? a - b : a * b;
    if (given === expected) {
      correct += 1;
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
    } else {
      streak = 0;
    }
  }
  const operation = answers.every((item) => item.operation === answers[0].operation) ? answers[0].operation : "mix";
  return { correct, wrong: answers.length - correct, bestStreak, operation };
}

export async function handleAchievements(
  request: Request, db: D1Database, userId: string,
  json: (data: unknown, status?: number) => Response
) {
  const path = new URL(request.url).pathname;
  if (path === "/api/achievements" && request.method === "GET") {
    return json(await loadAchievements(db, userId));
  }
  if (!["/api/achievements/session", "/api/achievements/complete"].includes(path)) {
    return json({ error: "Rota não encontrada." }, 404);
  }
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return json({ error: "Origem da solicitação inválida." }, 403);
  }

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 100_000) return json({ error: "Resultado muito grande." }, 413);
    body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid body");
  } catch {
    return json({ error: "Dados inválidos." }, 400);
  }

  if (path === "/api/achievements/session") {
    const duration = body.duration;
    if (typeof duration !== "number" || ![60, 120, 300].includes(duration)) {
      return json({ error: "Duração inválida." }, 400);
    }
    const id = crypto.randomUUID();
    const now = Date.now();
    await db.batch([
      db.prepare(`DELETE FROM achievement_training_sessions_v1
        WHERE user_id = ? AND completed_at IS NULL AND started_at < ?`).bind(userId, now - 86_400_000),
      db.prepare(`INSERT INTO achievement_training_sessions_v1 (id, user_id, duration, started_at)
        VALUES (?, ?, ?, ?)`).bind(id, userId, duration, now)
    ]);
    return json({ sessionId: id }, 201);
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const session = await db.prepare(`SELECT id, duration, started_at AS startedAt, completed_at AS completedAt
    FROM achievement_training_sessions_v1 WHERE id = ? AND user_id = ?`)
    .bind(sessionId, userId).first<TrainingSession>();
  if (!session) return json({ error: "Treino não encontrado para esta conta." }, 404);
  // Repeating a save after a connection failure never increases the counters twice.
  if (session.completedAt !== null) return json({ saved: true });
  const result = summarizeTrainingAnswers(body.answers);
  if (!result) return json({ error: "As respostas do treino são inválidas." }, 400);
  await db.prepare(`UPDATE achievement_training_sessions_v1
    SET completed_at = ?, correct = ?, wrong = ?, best_streak = ?, operation = ?
    WHERE id = ? AND user_id = ? AND completed_at IS NULL`)
    .bind(Date.now(), result.correct, result.wrong, result.bestStreak, result.operation, sessionId, userId).run();
  return json({ saved: true });
}
