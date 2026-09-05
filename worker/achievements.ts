import { loadAchievements } from "./progress";

type TrainingSession = {
  id: string;
  duration: number;
  startedAt: number;
  completedAt: number | null;
};

type NormalizedTrainingAnswer = {
  operation: string;
  a: number;
  b: number;
  given: number;
  expected: number;
  correct: boolean;
  level: number | null;
};

function fallbackLevel(a: number, b: number) {
  const largest = Math.max(a, b);
  return largest <= 10 ? 0 : largest <= 30 ? 1 : largest <= 99 ? 2 : largest <= 250 ? 3 : 4;
}

export function summarizeTrainingAnswers(answers: unknown) {
  if (!Array.isArray(answers) || answers.length < 1 || answers.length > 1000) return null;
  let correct = 0;
  let streak = 0;
  let bestStreak = 0;
  const normalized: NormalizedTrainingAnswer[] = [];
  for (const item of answers) {
    if (!item || typeof item !== "object") return null;
    const { operation, a, b, given } = item as Record<string, unknown>;
    if (!["add", "sub", "mul"].includes(String(operation))
      || ![a, b].every(Number.isSafeInteger) || typeof given !== "number" || !Number.isFinite(given)
      || Number(a) < 0 || Number(a) > 1000 || Number(b) < 0 || Number(b) > 1000) return null;
    const op = String(operation);
    const left = Number(a);
    const right = Number(b);
    const expected = op === "add" ? left + right : op === "sub" ? left - right : left * right;
    const isCorrect = given === expected;
    const suppliedLevel = (item as Record<string, unknown>).level;
    const level = Number.isSafeInteger(suppliedLevel) && Number(suppliedLevel) >= 0 && Number(suppliedLevel) <= 4
      ? Number(suppliedLevel)
      : null;
    normalized.push({ operation: op, a: left, b: right, given, expected, correct: isCorrect, level });
    if (isCorrect) {
      correct += 1;
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
    } else {
      streak = 0;
    }
  }
  const operation = normalized.every((item) => item.operation === normalized[0].operation) ? normalized[0].operation : "mix";
  return { correct, wrong: normalized.length - correct, bestStreak, operation, answers: normalized };
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
  const result = summarizeTrainingAnswers(body.answers);
  if (!result) return json({ error: "As respostas do treino são inválidas." }, 400);

  let session = await db.prepare(`SELECT id, duration, started_at AS startedAt, completed_at AS completedAt
    FROM achievement_training_sessions_v1 WHERE id = ? AND user_id = ?`)
    .bind(sessionId, userId).first<TrainingSession>();

  if (!session) {
    if (body.offline !== true
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
      return json({ error: "Treino não encontrado para esta conta." }, 404);
    }
    const duration = Number(body.duration);
    const startedAt = Number(body.startedAt);
    const now = Date.now();
    if (![60, 120, 300].includes(duration)
      || !Number.isSafeInteger(startedAt)
      || startedAt > now + 5 * 60_000
      || startedAt < now - 90 * 86_400_000) {
      return json({ error: "Dados do treino offline inválidos." }, 400);
    }
    await db.prepare(`INSERT OR IGNORE INTO achievement_training_sessions_v1
      (id, user_id, duration, started_at) VALUES (?, ?, ?, ?)`)
      .bind(sessionId, userId, duration, startedAt).run();
    session = await db.prepare(`SELECT id, duration, started_at AS startedAt, completed_at AS completedAt
      FROM achievement_training_sessions_v1 WHERE id = ? AND user_id = ?`)
      .bind(sessionId, userId).first<TrainingSession>();
    if (!session) return json({ error: "Treino não encontrado para esta conta." }, 404);
  }

  if (session.completedAt !== null) return json({ saved: true });

  const now = Date.now();
  const mistakeStatements = result.answers
    .filter((item) => !item.correct && item.level !== null)
    .map((item) => db.prepare(`
      INSERT INTO practice_errors_v1
        (id, user_id, operation, level, a, b, expected_answer, last_given, wrong_count, last_wrong_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, 1, ?
      WHERE EXISTS (
        SELECT 1 FROM achievement_training_sessions_v1
        WHERE id = ? AND user_id = ? AND completed_at IS NULL
      )
      ON CONFLICT(user_id, operation, a, b, expected_answer) DO UPDATE SET
        level = excluded.level,
        last_given = excluded.last_given,
        wrong_count = practice_errors_v1.wrong_count + 1,
        last_wrong_at = excluded.last_wrong_at
    `).bind(
      crypto.randomUUID(), userId, item.operation, item.level ?? fallbackLevel(item.a, item.b),
      item.a, item.b, item.expected, item.given, now, sessionId, userId
    ));

  await db.batch([
    ...mistakeStatements,
    db.prepare(`UPDATE achievement_training_sessions_v1
      SET completed_at = ?, correct = ?, wrong = ?, best_streak = ?, operation = ?
      WHERE id = ? AND user_id = ? AND completed_at IS NULL`)
      .bind(now, result.correct, result.wrong, result.bestStreak, result.operation, sessionId, userId)
  ]);
  return json({ saved: true });
}
