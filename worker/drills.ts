import { drillAnswer, summarizeDrill } from "../shared/drills.mjs";

type DrillRow = { id: string; config: string; correct: number; wrong: number; bestStreak: number; completedAt: number };
const present = (row: DrillRow) => ({
  ...row, config: JSON.parse(row.config), accuracy: Math.round(row.correct / (row.correct + row.wrong) * 100)
});

export async function handleDrills(
  request: Request, db: D1Database, userId: string,
  json: (data: unknown, status?: number) => Response
) {
  const path = new URL(request.url).pathname;
  if (path === "/api/drills" && request.method === "GET") {
    const rows = await db.prepare(`SELECT id, config_json AS config, correct, wrong,
      best_streak AS bestStreak, completed_at AS completedAt FROM specific_drill_sessions_v1
      WHERE user_id = ? ORDER BY completed_at DESC, id DESC LIMIT 10`).bind(userId).all<DrillRow>();
    return json({ sessions: rows.results.map(present) });
  }
  if (path !== "/api/drills/complete") return json({ error: "Rota não encontrada." }, 404);
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Origem da solicitação inválida." }, 403);

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 30_000) return json({ error: "Resultado muito grande." }, 413);
    body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid body");
  } catch { return json({ error: "Dados inválidos." }, 400); }
  const id = typeof body.id === "string" ? body.id : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return json({ error: "Identificador de treino inválido." }, 400);
  }
  const existing = await db.prepare("SELECT user_id FROM specific_drill_sessions_v1 WHERE id = ?").bind(id).first<{ user_id: string }>();
  if (existing) return existing.user_id === userId ? json({ saved: true }) : json({ error: "Treino não encontrado para esta conta." }, 404);
  let summary: ReturnType<typeof summarizeDrill>;
  try { summary = summarizeDrill(body.config, body.answers); }
  catch (error) { return json({ error: error instanceof Error ? error.message : "Treino inválido." }, 400); }

  const now = Date.now();
  const config = summary.config;
  const answers = body.answers as { operation: string; a: number; b: number; given: number }[];
  const largest = Math.max(config.max, config.table ?? 0);
  const level = largest <= 10 ? 0 : largest <= 30 ? 1 : largest <= 99 ? 2 : largest <= 250 ? 3 : 4;
  // A single transaction saves the history and its mistakes. Every insert checks
  // the receipt; retries (including concurrent retries) cannot count errors twice.
  const statements = answers.filter((item) => item.given !== drillAnswer(item)).map((item) => db.prepare(`
    INSERT INTO practice_errors_v1
      (id, user_id, operation, level, a, b, expected_answer, last_given, wrong_count, last_wrong_at)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, 1, ?
      WHERE NOT EXISTS (SELECT 1 FROM specific_drill_sessions_v1 WHERE id = ?)
    ON CONFLICT(user_id, operation, a, b, expected_answer) DO UPDATE SET
      level = excluded.level, last_given = excluded.last_given,
      wrong_count = practice_errors_v1.wrong_count + 1, last_wrong_at = excluded.last_wrong_at
  `).bind(crypto.randomUUID(), userId, item.operation, level, item.a, item.b, drillAnswer(item), item.given, now, id));
  statements.push(db.prepare(`INSERT OR IGNORE INTO specific_drill_sessions_v1
    (id, user_id, config_json, question_count, correct, wrong, best_streak, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, userId, JSON.stringify(config), config.count, summary.correct, summary.wrong, summary.bestStreak, now));
  await db.batch(statements);
  const saved = await db.prepare("SELECT id FROM specific_drill_sessions_v1 WHERE id = ? AND user_id = ?").bind(id, userId).first();
  return saved ? json({ saved: true }, 201) : json({ error: "Treino não encontrado para esta conta." }, 404);
}
