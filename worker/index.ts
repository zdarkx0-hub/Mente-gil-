import vinextHandler from "vinext/server/fetch-handler";
import { handleAchievements } from "./achievements";
import { handleDrills } from "./drills";
import { readObjectBody } from "./request-body";

type Env = {
  DB?: D1Database;
  ASSETS?: Fetcher;
  USER_DATA_HMAC_SECRET?: string;
};

type RankedSession = {
  id: string;
  nickname: string;
  name_key: string;
  operation: string;
  duration: number;
  started_at: number;
  submitted: number;
  userId: string | null;
};

type RankingEntry = {
  id: string;
  name_key: string;
  nickname: string;
  operation: string;
  duration: number;
  score: number;
  correct: number;
  wrong: number;
  bestStreak: number;
  playedAt: number;
};

type RankingAttempt = RankingEntry;

type RankingAccount = {
  userId: string;
  nickname: string;
  nameKey: string;
  createdAt: number;
};

type PracticeError = {
  id: string;
  userId: string;
  operation: string;
  level: number;
  a: number;
  b: number;
  expectedAnswer: number;
  lastGiven: number;
  wrongCount: number;
  lastWrongAt: number;
};

const json = (data: unknown, status = 200, extraHeaders: Record<string, string> = {}) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...extraHeaders
  }
});

const SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self'",
  "font-src 'self' data:",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'"
].join("; ");

function withSecurityHeaders(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("content-security-policy", SECURITY_POLICY);
  headers.set("permissions-policy", "camera=(), geolocation=(), microphone=()");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("x-content-type-options", "nosniff");
  if (!headers.has("cache-control")) headers.set("cache-control", "no-store");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function hasTrustedOrigin(request: Request) {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") return true;
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

const sameOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
};

const cleanNickname = (value: unknown) => String(value ?? "")
  .normalize("NFKC")
  .replace(/[^\p{L}\p{N} _-]/gu, "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, 18);

const allowedOperations = new Set(["add", "sub", "mul"]);
const allowedDurations = new Set([60, 120]);
const allowedTiers = new Set(["classic", "advanced"]);
const rankingOperationKey = (operation: string, tier: string) => tier === "advanced" ? `${operation}_1000` : operation;
const moderationActions: Array<{
  id: string;
  nameKeys?: string[];
  deleteAccounts?: boolean;
  resetAll?: boolean;
}> = [
  { id: "remove-invalid-results-2026-09-02", nameKeys: ["vitorhugo", "nicolas", "hacker"] },
  { id: "remove-nicolaspedro-results-2026-09-02", nameKeys: ["nicolaspedro"] },
  { id: "reset-ranking-for-account-launch-2026-09-02", resetAll: true },
  {
    id: "remove-nicolaslopes-account-and-history-2026-09-02",
    nameKeys: ["nicolaslopes"],
    deleteAccounts: true
  },
  {
    id: "remove-vitorhugo-history-2026-09-03",
    nameKeys: ["vitorhugo"]
  }
];
const decodeRankingOperation = (storedOperation: string) => {
  const tier = storedOperation.endsWith("_1000") ? "advanced" : "classic";
  return {
    operation: tier === "advanced" ? storedOperation.replace(/_1000$/, "") : storedOperation,
    tier
  };
};
let schemaReady: Promise<unknown> | null = null;
let moderationReady: Promise<unknown> | null = null;
let privacyReady: Promise<unknown> | null = null;
let userDataKeyPromise: Promise<CryptoKey> | null = null;

async function ensureSchema(db: D1Database) {
  if (!schemaReady) {
    schemaReady = db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS ranking_entries_v2 (
        id TEXT NOT NULL,
        name_key TEXT NOT NULL,
        nickname TEXT NOT NULL,
        operation TEXT NOT NULL,
        duration INTEGER NOT NULL,
        score INTEGER NOT NULL,
        correct INTEGER NOT NULL,
        wrong INTEGER NOT NULL,
        best_streak INTEGER NOT NULL,
        played_at INTEGER NOT NULL,
        PRIMARY KEY (name_key, operation, duration)
      )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS ranking_sessions_v2 (
        id TEXT PRIMARY KEY,
        nickname TEXT NOT NULL,
        name_key TEXT NOT NULL,
        operation TEXT NOT NULL,
        duration INTEGER NOT NULL,
        started_at INTEGER NOT NULL,
        submitted INTEGER NOT NULL DEFAULT 0
      )`)
    ]).catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

async function applyPendingModeration(db: D1Database) {
  if (!moderationReady) {
    moderationReady = (async () => {
      for (const action of moderationActions) {
        const applied = await db.prepare("SELECT id FROM ranking_moderation_actions_v1 WHERE id = ?")
          .bind(action.id).first<{ id: string }>();
        if (applied) continue;

        const historyDeletions = action.resetAll
          ? [
              db.prepare("DELETE FROM ranking_attempts_v1"),
              db.prepare("DELETE FROM ranking_entries_v2"),
              db.prepare("DELETE FROM ranking_sessions_v2"),
              db.prepare("DELETE FROM ranking_secure_answers_v1"),
              db.prepare("DELETE FROM ranking_secure_sessions_v1")
            ]
          : [
              ...(action.nameKeys ?? []).flatMap((nameKey) => [
                db.prepare("DELETE FROM ranking_attempts_v1 WHERE name_key = ?").bind(nameKey),
                db.prepare("DELETE FROM ranking_entries_v2 WHERE name_key = ?").bind(nameKey),
                db.prepare("DELETE FROM ranking_sessions_v2 WHERE name_key = ?").bind(nameKey),
                db.prepare("DELETE FROM ranking_secure_answers_v1 WHERE name_key = ?").bind(nameKey),
                db.prepare("DELETE FROM ranking_secure_sessions_v1 WHERE name_key = ?").bind(nameKey)
              ])
            ];
        const accountDeletions = action.deleteAccounts
          ? [
              ...(action.nameKeys ?? []).map((nameKey) =>
                db.prepare("DELETE FROM ranking_accounts_v1 WHERE name_key = ?").bind(nameKey)
              )
            ]
          : [];
        await db.batch([
          ...historyDeletions,
          ...accountDeletions,
          db.prepare("INSERT OR IGNORE INTO ranking_moderation_actions_v1 (id, applied_at) VALUES (?, ?)")
            .bind(action.id, Date.now())
        ]);
      }
    })().catch((error) => {
      moderationReady = null;
      throw error;
    });
  }
  return moderationReady;
}

function getUserDataKey(secret: string) {
  if (!userDataKeyPromise) {
    userDataKeyPromise = crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
  }
  return userDataKeyPromise;
}

async function protectUserId(userId: string, secret: string) {
  if (userId.startsWith("h1:")) return userId;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await getUserDataKey(secret),
    new TextEncoder().encode(userId)
  );
  const digest = Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `h1:${digest}`;
}

async function authenticatedUserKey(request: Request, secret: string) {
  const userId = request.headers.get("oai-authenticated-user-id")?.trim();
  return userId ? protectUserId(userId, secret) : null;
}

async function applyPendingPrivacyProtection(db: D1Database, secret: string) {
  if (!privacyReady) {
    privacyReady = (async () => {
      const actionId = "pseudonymize-user-identifiers-hmac-v1";
      const applied = await db.prepare("SELECT id FROM ranking_moderation_actions_v1 WHERE id = ?")
        .bind(actionId).first<{ id: string }>();
      if (applied) return;

      const tables = [
        "ranking_accounts_v1",
        "ranking_attempts_v1",
        "ranking_entries_v2",
        "ranking_sessions_v2",
        "ranking_secure_answers_v1",
        "ranking_secure_sessions_v1"
      ];
      const updates: D1PreparedStatement[] = [];
      const protectedIds = new Map<string, string>();

      for (const table of tables) {
        const result = await db.prepare(
          `SELECT DISTINCT user_id AS userId FROM ${table} WHERE user_id IS NOT NULL AND user_id NOT LIKE 'h1:%'`
        ).all<{ userId: string }>();
        for (const row of result.results ?? []) {
          if (!protectedIds.has(row.userId)) protectedIds.set(row.userId, await protectUserId(row.userId, secret));
          updates.push(db.prepare(`UPDATE ${table} SET user_id = ? WHERE user_id = ?`)
            .bind(protectedIds.get(row.userId), row.userId));
        }
      }

      await db.batch([
        ...updates,
        db.prepare("INSERT OR IGNORE INTO ranking_moderation_actions_v1 (id, applied_at) VALUES (?, ?)")
          .bind(actionId, Date.now())
      ]);
    })().catch((error) => {
      privacyReady = null;
      throw error;
    });
  }
  return privacyReady;
}

const publicAccount = (account: RankingAccount | null) => account ? {
  nickname: account.nickname,
  createdAt: account.createdAt
} : null;

async function loadAccount(db: D1Database, userId: string) {
  return db.prepare(`SELECT user_id AS userId, nickname, name_key AS nameKey, created_at AS createdAt
    FROM ranking_accounts_v1 WHERE user_id = ?`)
    .bind(userId).first<RankingAccount>();
}

async function handleAccount(request: Request, db: D1Database, secret: string) {
  const userKey = await authenticatedUserKey(request, secret);
  if (!userKey) return json({ authenticated: false, account: null }, request.method === "GET" ? 200 : 401);

  if (request.method === "GET") {
    return json({ authenticated: true, account: publicAccount(await loadAccount(db, userKey)) });
  }
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (!sameOrigin(request)) return json({ error: "Origem da solicitação inválida." }, 403);

  const existing = await loadAccount(db, userKey);
  if (existing) return json({ error: "Esta conta já possui um apelido.", account: publicAccount(existing) }, 409);

  let body: Record<string, unknown>;
  try {
    body = await readObjectBody(request);
  } catch {
    return json({ error: "Dados inválidos." }, 400);
  }
  const nickname = cleanNickname(body.nickname);
  if (nickname.length < 2) return json({ error: "Use um apelido com pelo menos 2 caracteres." }, 400);
  const nameKey = nickname.toLocaleLowerCase("pt-BR");
  const used = await db.prepare("SELECT 1 AS found FROM ranking_accounts_v1 WHERE name_key = ?")
    .bind(nameKey).first<{ found: number }>();
  if (used) return json({ error: "Este apelido já pertence a outra conta." }, 409);

  const createdAt = Date.now();
  try {
    await db.prepare(`INSERT INTO ranking_accounts_v1 (user_id, nickname, name_key, created_at)
      VALUES (?, ?, ?, ?)`).bind(userKey, nickname, nameKey, createdAt).run();
  } catch {
    return json({ error: "Não foi possível reservar o apelido. Tente outro nome." }, 409);
  }
  return json({ authenticated: true, account: { nickname, createdAt } }, 201);
}

async function listRanking(db: D1Database, operation: string, duration: number) {
  const result = await db.prepare(`
    SELECT id, name_key, nickname, operation, duration, score, correct, wrong,
      best_streak AS bestStreak, played_at AS playedAt
    FROM ranking_entries_v2
    WHERE operation = ? AND duration = ?
    ORDER BY score DESC, correct DESC, played_at ASC
    LIMIT 100
  `).bind(operation, duration).all<RankingEntry>();
  return result.results ?? [];
}

async function handlePlayer(request: Request, db: D1Database, secret: string) {
  await ensureSchema(db);
  if (request.method !== "GET") return json({ error: "Método não permitido." }, 405);
  const userKey = await authenticatedUserKey(request, secret);
  if (!userKey) return json({ error: "Entre na sua conta para ver seu histórico." }, 401);
  const account = await loadAccount(db, userKey);
  if (!account) return json({ error: "Conclua seu cadastro para ver seu histórico." }, 403);

  const [attemptResult, bestResult] = await Promise.all([
    db.prepare(`
      SELECT id, name_key, nickname, operation, duration, score, correct, wrong,
        best_streak AS bestStreak, played_at AS playedAt
      FROM ranking_attempts_v1
      WHERE user_id = ?
      ORDER BY played_at DESC
      LIMIT 100
    `).bind(userKey).all<RankingAttempt>(),
    db.prepare(`
      SELECT id, name_key, nickname, operation, duration, score, correct, wrong,
        best_streak AS bestStreak, played_at AS playedAt
      FROM ranking_entries_v2
      WHERE user_id = ?
      ORDER BY score DESC, played_at DESC
    `).bind(userKey).all<RankingEntry>()
  ]);

  const storedAttempts = attemptResult.results ?? [];
  const storedBests = bestResult.results ?? [];

  const attempts = storedAttempts.slice().reverse().map((attempt) => {
    const total = attempt.correct + attempt.wrong;
    return {
      id: attempt.id,
      ...decodeRankingOperation(attempt.operation),
      duration: attempt.duration,
      score: attempt.score,
      correct: attempt.correct,
      wrong: attempt.wrong,
      bestStreak: attempt.bestStreak,
      accuracy: total ? Math.round((attempt.correct / total) * 100) : 0,
      playedAt: attempt.playedAt
    };
  });
  const bests = storedBests.map((entry) => ({
    id: entry.id,
    ...decodeRankingOperation(entry.operation),
    duration: entry.duration,
    score: entry.score,
    correct: entry.correct,
    wrong: entry.wrong,
    bestStreak: entry.bestStreak,
    playedAt: entry.playedAt
  }));
  const totalCorrect = attempts.reduce((sum, attempt) => sum + attempt.correct, 0);
  const totalWrong = attempts.reduce((sum, attempt) => sum + attempt.wrong, 0);
  const totalAnswers = totalCorrect + totalWrong;
  return json({
    nickname: account.nickname,
    summary: {
      sessions: attempts.length,
      totalCorrect,
      totalWrong,
      accuracy: totalAnswers ? Math.round((totalCorrect / totalAnswers) * 100) : 0,
      bestStreak: Math.max(0, ...attempts.map((attempt) => attempt.bestStreak), ...bests.map((entry) => entry.bestStreak)),
      bestScore: Math.max(0, ...attempts.map((attempt) => attempt.score), ...bests.map((entry) => entry.score))
    },
    attempts,
    bests
  });
}

const expectedAnswerFor = (operation: string, a: number, b: number) => (
  operation === "add" ? a + b : operation === "sub" ? a - b : a * b
);

async function handleReview(request: Request, db: D1Database, secret: string) {
  const userId = await authenticatedUserKey(request, secret);
  if (!userId) return json({ error: "Entre na sua conta para guardar e revisar seus erros." }, 401);
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/api/review/errors") {
    const result = await db.prepare(`
      SELECT id, user_id AS userId, operation, level, a, b,
        expected_answer AS expectedAnswer, last_given AS lastGiven,
        wrong_count AS wrongCount, last_wrong_at AS lastWrongAt
      FROM practice_errors_v1
      WHERE user_id = ?
      ORDER BY wrong_count DESC, last_wrong_at DESC
      LIMIT 80
    `).bind(userId).all<PracticeError>();
    const errors = result.results ?? [];
    return json({
      errors: errors.map(({ userId: _privateUserId, ...error }) => error),
      summary: {
        total: errors.length,
        add: errors.filter((item) => item.operation === "add").length,
        sub: errors.filter((item) => item.operation === "sub").length,
        mul: errors.filter((item) => item.operation === "mul").length
      }
    });
  }

  if (request.method !== "POST" || !sameOrigin(request)) {
    return json({ error: request.method === "POST" ? "Origem da solicitação inválida." : "Método não permitido." }, request.method === "POST" ? 403 : 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await readObjectBody(request);
  } catch {
    return json({ error: "Dados inválidos." }, 400);
  }

  if (url.pathname === "/api/review/errors") {
    const operation = String(body.operation ?? "");
    const level = Number(body.level);
    const a = Number(body.a);
    const b = Number(body.b);
    const expectedAnswer = Number(body.expectedAnswer);
    const lastGiven = Number(body.lastGiven);
    if (!allowedOperations.has(operation) || ![level, a, b, expectedAnswer, lastGiven].every(Number.isSafeInteger)) {
      return json({ error: "Conta inválida." }, 400);
    }
    if (level < 0 || level > 4 || expectedAnswerFor(operation, a, b) !== expectedAnswer) {
      return json({ error: "Conta inconsistente." }, 400);
    }
    const now = Date.now();
    const id = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO practice_errors_v1
        (id, user_id, operation, level, a, b, expected_answer, last_given, wrong_count, last_wrong_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      ON CONFLICT(user_id, operation, a, b, expected_answer) DO UPDATE SET
        level = excluded.level,
        last_given = excluded.last_given,
        wrong_count = practice_errors_v1.wrong_count + 1,
        last_wrong_at = excluded.last_wrong_at
    `).bind(id, userId, operation, level, a, b, expectedAnswer, lastGiven, now).run();
    return json({ saved: true }, 201);
  }

  if (url.pathname === "/api/review/errors/answer") {
    const id = String(body.id ?? "");
    const given = Number(body.given);
    if (!id || !Number.isSafeInteger(given)) return json({ error: "Resposta inválida." }, 400);
    const item = await db.prepare(`
      SELECT id, user_id AS userId, operation, level, a, b,
        expected_answer AS expectedAnswer, last_given AS lastGiven,
        wrong_count AS wrongCount, last_wrong_at AS lastWrongAt
      FROM practice_errors_v1 WHERE id = ? AND user_id = ?
    `).bind(id, userId).first<PracticeError>();
    if (!item) {
      const resolved = await db.prepare("SELECT error_id FROM achievement_reviews_v1 WHERE error_id = ? AND user_id = ?")
        .bind(id, userId).first();
      if (resolved) return json({ correct: true, resolved: true });
      return json({ error: "Esse erro já foi resolvido ou não existe." }, 404);
    }
    const correct = given === item.expectedAnswer;
    if (correct) {
      // The receipt and removal are atomic; retries cannot award the same error twice.
      const resolved = await db.batch([
        db.prepare(`INSERT OR IGNORE INTO achievement_reviews_v1 (error_id, user_id, resolved_at)
          SELECT id, user_id, ? FROM practice_errors_v1
          WHERE id = ? AND user_id = ? AND last_wrong_at = ?`)
          .bind(Date.now(), id, userId, item.lastWrongAt),
        db.prepare("DELETE FROM practice_errors_v1 WHERE id = ? AND user_id = ? AND last_wrong_at = ?")
          .bind(id, userId, item.lastWrongAt)
      ]);
      if (!resolved[1].meta.changes) {
        const receipt = await db.prepare("SELECT error_id FROM achievement_reviews_v1 WHERE error_id = ? AND user_id = ?")
          .bind(id, userId).first();
        if (!receipt) return json({ error: "Esta conta foi atualizada. Tente responder novamente." }, 409);
      }
    } else {
      await db.prepare(`UPDATE practice_errors_v1
        SET last_given = ?, wrong_count = wrong_count + 1, last_wrong_at = ?
        WHERE id = ? AND user_id = ?`).bind(given, Date.now(), id, userId).run();
    }
    return json({ correct, expectedAnswer: item.expectedAnswer, resolved: correct });
  }

  return json({ error: "Rota não encontrada." }, 404);
}

async function handleRanking(request: Request, db: D1Database, secret: string) {
  await ensureSchema(db);
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/api/ranking") {
    const operation = url.searchParams.get("operation") ?? "add";
    const duration = Number(url.searchParams.get("duration") ?? 60);
    const tier = url.searchParams.get("tier") ?? "classic";
    if (!allowedOperations.has(operation) || !allowedDurations.has(duration) || !allowedTiers.has(tier)) {
      return json({ error: "Categoria de ranking inválida." }, 400);
    }
    return json({
      operation,
      duration,
      tier,
      entries: (await listRanking(db, rankingOperationKey(operation, tier), duration)).slice(0, 20).map((entry) => ({
        id: entry.id,
        nickname: entry.nickname,
        score: entry.score,
        correct: entry.correct,
        bestStreak: entry.bestStreak
      }))
    });
  }

  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (!sameOrigin(request)) return json({ error: "Origem da solicitação inválida." }, 403);

  let body: Record<string, unknown>;
  try {
    body = await readObjectBody(request);
  } catch {
    return json({ error: "Dados inválidos." }, 400);
  }

  if (url.pathname === "/api/ranking/session") {
    const userKey = await authenticatedUserKey(request, secret);
    if (!userKey) return json({ error: "Entre na sua conta para participar do ranking." }, 401);
    const account = await loadAccount(db, userKey);
    if (!account) return json({ error: "Conclua seu cadastro antes de participar do ranking." }, 403);
    const nickname = account.nickname;
    const operation = String(body.operation ?? "");
    const duration = Number(body.duration);
    const tier = String(body.tier ?? "classic");
    if (nickname.length < 2) return json({ error: "Use um apelido com pelo menos 2 caracteres." }, 400);
    if (!allowedOperations.has(operation) || !allowedDurations.has(duration) || !allowedTiers.has(tier)) {
      return json({ error: "Escolha uma operação e duração válidas." }, 400);
    }

    const sessionId = crypto.randomUUID();
    const startedAt = Date.now();
    await db.batch([
      db.prepare("DELETE FROM ranking_sessions_v2 WHERE started_at < ?").bind(startedAt - 10 * 60_000),
      db.prepare(`INSERT INTO ranking_sessions_v2
        (id, nickname, name_key, operation, duration, started_at, submitted, user_id)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?)`)
        .bind(sessionId, nickname, account.nameKey, rankingOperationKey(operation, tier), duration, startedAt, userKey)
    ]);
    return json({ sessionId, nickname, operation, duration, tier }, 201);
  }

  if (url.pathname === "/api/ranking/submit") {
    const userKey = await authenticatedUserKey(request, secret);
    if (!userKey) return json({ error: "Entre na sua conta para enviar o resultado." }, 401);
    const sessionId = String(body.sessionId ?? "");
    const correct = Number(body.correct);
    const wrong = Number(body.wrong);
    const bestStreak = Number(body.bestStreak);

    if (!sessionId || ![correct, wrong, bestStreak].every(Number.isSafeInteger)) {
      return json({ error: "Resultado inválido." }, 400);
    }

    const session = await db.prepare(`SELECT id, nickname, name_key, operation, duration, started_at, submitted,
        user_id AS userId
      FROM ranking_sessions_v2 WHERE id = ?`).bind(sessionId).first<RankedSession>();
    if (!session || session.submitted) return json({ error: "Esta sessão já foi enviada ou expirou." }, 409);
    if (session.userId !== userKey) return json({ error: "Esta sessão pertence a outra conta." }, 403);

    const answerLimit = session.duration === 120 ? 300 : 180;
    if (correct < 0 || wrong < 0 || bestStreak < 0 || correct + wrong > answerLimit || bestStreak > correct) {
      return json({ error: "Resultado fora dos limites." }, 400);
    }

    const elapsed = Date.now() - session.started_at;
    if (elapsed < session.duration * 1000 - 15_000 || elapsed > session.duration * 1000 + 90_000) {
      await db.prepare("DELETE FROM ranking_sessions_v2 WHERE id = ?").bind(sessionId).run();
      return json({ error: "O tempo desta sessão não é válido." }, 400);
    }

    const consumed = await db.prepare("UPDATE ranking_sessions_v2 SET submitted = 1 WHERE id = ? AND submitted = 0")
      .bind(sessionId).run();
    if (!consumed.meta.changes) return json({ error: "Esta sessão já foi enviada." }, 409);

    const score = Math.max(0, correct * 100 + bestStreak * 15 - wrong * 20);
    const entryId = crypto.randomUUID();
    const playedAt = Date.now();
    const previous = await db.prepare(`SELECT score FROM ranking_entries_v2
      WHERE name_key = ? AND operation = ? AND duration = ?`)
      .bind(session.name_key, session.operation, session.duration).first<{ score: number }>();
    const improved = !previous || score > previous.score;

    await db.batch([
      db.prepare(`INSERT INTO ranking_attempts_v1
        (id, name_key, nickname, operation, duration, score, correct, wrong, best_streak, played_at, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(entryId, session.name_key, session.nickname, session.operation, session.duration, score, correct, wrong, bestStreak, playedAt, userKey),
      db.prepare(`INSERT INTO ranking_entries_v2
        (id, name_key, nickname, operation, duration, score, correct, wrong, best_streak, played_at, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(name_key, operation, duration) DO UPDATE SET
          id = excluded.id,
          nickname = excluded.nickname,
          score = excluded.score,
          correct = excluded.correct,
          wrong = excluded.wrong,
          best_streak = excluded.best_streak,
          played_at = excluded.played_at,
          user_id = excluded.user_id
        WHERE excluded.score > ranking_entries_v2.score`)
        .bind(entryId, session.name_key, session.nickname, session.operation, session.duration, score, correct, wrong, bestStreak, playedAt, userKey),
      db.prepare("DELETE FROM ranking_sessions_v2 WHERE id = ?").bind(sessionId)
    ]);

    const ranking = await listRanking(db, session.operation, session.duration);
    const position = ranking.findIndex((item) => item.name_key === session.name_key) + 1;
    return json({ attemptScore: score, improved, position }, 201);
  }

  return json({ error: "Rota não encontrada." }, 404);
}

async function handleRequest(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    // Retired admin URLs cannot read or mutate player data, even with an old cookie.
    const retiredAdminPage = url.pathname === "/admin" || url.pathname.startsWith("/admin/");
    const retiredAdminApi = url.pathname === "/api/admin" || url.pathname.startsWith("/api/admin/");
    if (retiredAdminPage || retiredAdminApi) {
      const headers = {
        "set-cookie": "__Host-mente_agil_admin=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict"
      };
      return withSecurityHeaders(retiredAdminApi
        ? json({ error: "Recurso removido." }, 410, headers)
        : new Response(null, { status: 303, headers: { ...headers, location: "/" } }));
    }
    if (!hasTrustedOrigin(request)) return withSecurityHeaders(json({ error: "Origem da solicitação não permitida." }, 403));

    const secret = env.USER_DATA_HMAC_SECRET?.trim() ?? "";
    if (env.DB) {
      await applyPendingModeration(env.DB);
      if (secret) await applyPendingPrivacyProtection(env.DB, secret);
    }

    let response: Response;
    if (url.pathname === "/api/account" || url.pathname === "/api/account/register") {
      response = !env.DB || !secret
        ? json({ error: "Contas temporariamente indisponíveis." }, 503)
        : await handleAccount(request, env.DB, secret);
    } else if (url.pathname === "/api/player") {
      response = !env.DB || !secret
        ? json({ error: "Perfis temporariamente indisponíveis." }, 503)
        : await handlePlayer(request, env.DB, secret);
    } else if (url.pathname === "/api/drills" || url.pathname.startsWith("/api/drills/")) {
      if (!env.DB || !secret) {
        response = json({ error: "Treinos temporariamente indisponíveis." }, 503);
      } else {
        const userId = await authenticatedUserKey(request, secret);
        response = !userId
          ? json({ error: "Entre na sua conta para guardar seus treinos." }, 401)
          : !(await loadAccount(env.DB, userId))
            ? json({ error: "Conclua seu cadastro para guardar seus treinos." }, 403)
            : await handleDrills(request, env.DB, userId, json);
      }
    } else if (url.pathname === "/api/achievements" || url.pathname.startsWith("/api/achievements/")) {
      if (!env.DB || !secret) {
        response = json({ error: "Conquistas temporariamente indisponíveis." }, 503);
      } else {
        const userId = await authenticatedUserKey(request, secret);
        response = !userId
          ? json({ error: "Entre na sua conta para ver suas conquistas." }, 401)
          : !(await loadAccount(env.DB, userId))
            ? json({ error: "Conclua seu cadastro para guardar suas conquistas." }, 403)
            : await handleAchievements(request, env.DB, userId, json);
      }
    } else if (url.pathname.startsWith("/api/review")) {
      response = !env.DB || !secret
        ? json({ error: "Revisão temporariamente indisponível." }, 503)
        : await handleReview(request, env.DB, secret);
    } else if (url.pathname.startsWith("/api/ranking")) {
      response = !env.DB || (request.method !== "GET" && !secret)
        ? json({ error: "Ranking temporariamente indisponível." }, 503)
        : await handleRanking(request, env.DB, secret);
    } else {
      response = await vinextHandler.fetch(request, env, ctx);
    }
    return withSecurityHeaders(response);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    try {
      return await handleRequest(request, env, ctx);
    } catch (error) {
      const pathname = new URL(request.url).pathname;
      if (!pathname.startsWith("/api/")) throw error;
      // Never log credentials, cookies, request bodies, user details, or SQL.
      console.error("API request failed", {
        method: request.method,
        area: pathname.split("/")[2],
        errorType: error instanceof Error ? error.name : "UnknownError"
      });
      return withSecurityHeaders(json({
        error: "O serviço está temporariamente indisponível. Tente novamente em instantes."
      }, 500));
    }
  }
};
