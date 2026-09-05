"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import ReviewCard from "./review-card";
import AchievementsCard from "./achievements-card";
import PracticeFlame from "./practice-flame";
import useAchievementData from "./use-achievement-data";
import SpecificTraining from "./specific-training";
import DrillHistory from "./drill-history";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { postJsonOrQueue, privateJsonFetch, readPrivateValue, writePrivateValue } from "./offline-client";

const LEVELS = [
  { id: 0, name: "Aquecimento", short: "1", range: "0–10", color: "#6ee7b7" },
  { id: 1, name: "Base", short: "2", range: "0–30", color: "#67e8f9" },
  { id: 2, name: "Confiança", short: "3", range: "10–99", color: "#a5b4fc" },
  { id: 3, name: "Desafio", short: "4", range: "até 250", color: "#f0abfc" },
  { id: 4, name: "Avançado", short: "5", range: "até 1.000", color: "#fbbf24" }
];

const SESSION_OPTIONS = [
  { value: 60, label: "1 min" },
  { value: 120, label: "2 min" },
  { value: 300, label: "5 min" }
];

const RANKING_OPERATIONS = [
  { value: "add", label: "Soma", action: "Somar" },
  { value: "sub", label: "Subtração", action: "Subtrair" },
  { value: "mul", label: "Multiplicação", action: "Multiplicar" }
];

const RANKING_TIERS = [
  { value: "classic", label: "Clássico", description: "até 250" },
  { value: "advanced", label: "Avançado", description: "até 1.000" }
];

const OPERATION_LABELS = {
  mix: "Misto",
  add: "Soma",
  sub: "Subtração",
  mul: "Multiplicação"
};

const EMPTY_STATS = { sessions: [], totalCorrect: 0, totalWrong: 0, bestStreak: 0 };

function loadLegacyStats() {
  if (typeof window === "undefined") return EMPTY_STATS;
  try {
    const saved = JSON.parse(localStorage.getItem("mente-agil-stats"));
    return saved && Array.isArray(saved.sessions) ? saved : EMPTY_STATS;
  } catch {
    return EMPTY_STATS;
  }
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildQuestion(level, operation) {
  const selectedOperation = operation === "mix"
    ? ["add", "sub", "mul"][randomInt(0, 2)]
    : operation;
  let a;
  let b;

  if (selectedOperation === "mul") {
    const ranges = [
      [1, 5, 1, 10],
      [2, 10, 2, 10],
      [6, 15, 3, 12],
      [11, 25, 4, 20],
      [20, 50, 10, 20]
    ][level];
    a = randomInt(ranges[0], ranges[1]);
    b = randomInt(ranges[2], ranges[3]);
  } else {
    if (level === 0) {
      a = randomInt(1, 10);
      b = randomInt(1, 10);
    } else if (level === 1) {
      a = randomInt(8, 30);
      b = randomInt(2, 25);
    } else if (level === 2) {
      a = randomInt(18, 99);
      b = randomInt(11, 89);
    } else if (level === 3) {
      a = randomInt(45, 250);
      b = randomInt(25, 199);
    } else {
      a = randomInt(250, 1000);
      b = randomInt(100, 999);
    }
  }

  if (selectedOperation === "sub" && b > a) [a, b] = [b, a];
  const answer = selectedOperation === "add" ? a + b : selectedOperation === "sub" ? a - b : a * b;

  return {
    id: `${Date.now()}-${Math.random()}`,
    a,
    b,
    answer,
    operation: selectedOperation,
    symbol: selectedOperation === "add" ? "+" : selectedOperation === "sub" ? "−" : "×"
  };
}

function formatTime(seconds) {
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function calculateBestStreak(results) {
  let current = 0;
  let best = 0;
  results.forEach((item) => {
    current = item.correct ? current + 1 : 0;
    best = Math.max(best, current);
  });
  return best;
}

function playWithAudioContext(audioContextRef, createSound) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  const context = audioContextRef.current ?? new AudioContextClass();
  audioContextRef.current = context;

  if (context.state === "suspended") {
    context.resume().then(() => createSound(context)).catch(() => {});
  } else {
    createSound(context);
  }
}

function playCorrectSound(audioContextRef) {
  playWithAudioContext(audioContextRef, (context) => {
    const startedAt = context.currentTime;
    [
      { frequency: 659.25, delay: 0, duration: 0.12 },
      { frequency: 783.99, delay: 0.07, duration: 0.16 }
    ].forEach(({ frequency, delay, duration }) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const toneStart = startedAt + delay;
      const toneEnd = toneStart + duration;

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, toneStart);
      gain.gain.setValueAtTime(0.0001, toneStart);
      gain.gain.exponentialRampToValueAtTime(0.11, toneStart + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, toneEnd);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(toneStart);
      oscillator.stop(toneEnd);
    });
  });
}

function playErrorSound(audioContextRef) {
  playWithAudioContext(audioContextRef, (context) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const startedAt = context.currentTime;
    const endedAt = startedAt + 0.22;

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(233.08, startedAt);
    oscillator.frequency.exponentialRampToValueAtTime(164.81, endedAt);
    gain.gain.setValueAtTime(0.0001, startedAt);
    gain.gain.exponentialRampToValueAtTime(0.075, startedAt + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, endedAt);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startedAt);
    oscillator.stop(endedAt);
  });
}

function MiniLineChart({ data, valueKey, suffix = "", invert = false, emptyLabel = "Complete sua primeira sessão para ver a evolução." }) {
  const chartId = useId().replace(/:/g, "");
  const values = data.map((item) => Number(item[valueKey]) || 0);
  const max = Math.max(...values, 1);
  const min = values.length ? Math.min(...values) : 0;
  const spread = max - min;
  const points = values.map((value, index) => {
    const x = values.length === 1 ? 50 : 4 + (index * 92) / (values.length - 1);
    const normalized = spread ? (value - min) / spread : .5;
    const y = invert ? 8 + normalized * 70 : 78 - normalized * 70;
    return `${x},${y}`;
  }).join(" ");

  if (!values.length) {
    return <div className="empty-chart">{emptyLabel}</div>;
  }

  return (
    <div className="chart-wrap" aria-label={`Gráfico com ${values.length} sessões`}>
      <svg viewBox="0 0 100 86" preserveAspectRatio="none" role="img">
        <defs>
          <linearGradient id={`fill-${chartId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#67e8f9" stopOpacity=".3" />
            <stop offset="100%" stopColor="#67e8f9" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[15, 46, 77].map((y) => <line key={y} x1="4" y1={y} x2="96" y2={y} className="grid-line" />)}
        {values.length > 1 && <polygon points={`4,82 ${points} 96,82`} fill={`url(#fill-${chartId})`} />}
        <polyline points={points} className="chart-line" />
        {points.split(" ").map((point, index) => {
          const [cx, cy] = point.split(",");
          return <circle key={index} cx={cx} cy={cy} r="1.8" className="chart-dot" />;
        })}
      </svg>
      <div className="chart-labels">
        <span>Anterior</span>
        <strong>{values.at(-1)}{suffix}</strong>
        <span>Mais recente</span>
      </div>
    </div>
  );
}

export default function StudyApp({ children }) {
  const pathname = (usePathname() || "/").replace(/\/$/, "") || "/";
  const router = useRouter();
  const view = pathname.startsWith("/treinar") ? "treinar" : pathname.startsWith("/progresso") ? "progresso" : pathname === "/revisar" ? "revisar" : pathname === "/ranking" ? "ranking" : "inicio";
  const specificTab = pathname === "/treinar/especificos";
  const achievementsTab = pathname === "/progresso/conquistas";
  const [stats, setStats] = useState(EMPTY_STATS);
  const [baseLevel, setBaseLevel] = useState(1);
  const [adaptiveLevel, setAdaptiveLevel] = useState(1);
  const [operation, setOperation] = useState("mix");
  const [duration, setDuration] = useState(120);
  const [status, setStatus] = useState("ready");
  const [timeLeft, setTimeLeft] = useState(120);
  const [question, setQuestion] = useState(() => buildQuestion(1, "mix"));
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [results, setResults] = useState([]);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [rankedMode, setRankedMode] = useState(false);
  const [nickname, setNickname] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  const [rankOperation, setRankOperation] = useState("add");
  const [rankDuration, setRankDuration] = useState(60);
  const [rankTier, setRankTier] = useState("classic");
  const [rankingState, setRankingState] = useState("idle");
  const [rankingMessage, setRankingMessage] = useState("");
  const [viewer, setViewer] = useState({ authenticated: false, account: null });
  const [accountState, setAccountState] = useState("loading");
  const [playerProfile, setPlayerProfile] = useState(null);
  const [playerState, setPlayerState] = useState("idle");
  const [playerMessage, setPlayerMessage] = useState("");
  const [activeDuration, setActiveDuration] = useState(120);
  const [reviewRevision, setReviewRevision] = useState(0);
  const [achievementsRevision, setAchievementsRevision] = useState(0);
  const achievementData = useAchievementData({ viewer, accountState, revision: achievementsRevision });
  const [specificTrainingBusy, setSpecificTrainingBusy] = useState(false);
  const [sessionStarting, setSessionStarting] = useState(false);
  const [achievementSave, setAchievementSave] = useState("idle");
  const trainingSessionRef = useRef(null);
  const trainingSessionOfflineRef = useRef(false);
  const trainingStartedAtRef = useRef(0);
  const pendingTrainingSaveRef = useRef(null);
  const startingRef = useRef(false);
  const sessionEndsAtRef = useRef(0);
  const finishSessionRef = useRef(null);
  const sessionCycleRef = useRef(0);
  const questionStartedAt = useRef(Date.now());
  const inputRef = useRef(null);
  const finishingRef = useRef(false);
  const activeDurationRef = useRef(120);
  const activeOperationRef = useRef("mix");
  const activeRankedRef = useRef(false);
  const activeTierRef = useRef("classic");
  const rankedSessionRef = useRef(null);
  const audioContextRef = useRef(null);
  const refreshAchievements = useCallback(() => setAchievementsRevision((value) => value + 1), []);
  const refreshAfterDrill = useCallback(() => {
    setAchievementsRevision((value) => value + 1);
    setReviewRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    if (status !== "active" || feedback) return;
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [status, feedback, question.id]);

  const loadLeaderboard = useCallback(async (
    selectedOperation = rankOperation,
    selectedDuration = rankDuration,
    selectedTier = rankTier
  ) => {
    try {
      const params = new URLSearchParams({
        operation: selectedOperation,
        duration: String(selectedDuration),
        tier: selectedTier
      });
      const response = await fetch(`/api/ranking?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Ranking indisponível");
      const data = await response.json();
      setLeaderboard(Array.isArray(data.entries) ? data.entries : []);
    } catch {
      setLeaderboard([]);
    }
  }, [rankDuration, rankOperation, rankTier]);

  useEffect(() => {
    let active = true;
    (async () => {
      const secureStats = await readPrivateValue("device:stats");
      const legacy = secureStats ?? loadLegacyStats();
      if (!active) return;
      setStats(legacy && Array.isArray(legacy.sessions) ? legacy : EMPTY_STATS);
      if (secureStats === null && legacy !== EMPTY_STATS) {
        writePrivateValue("device:stats", legacy).then(() => {
          try { localStorage.removeItem("mente-agil-stats"); } catch {}
        }).catch(() => {});
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  useEffect(() => {
    privateJsonFetch("/api/account")
      .then(({ data }) => {
        setViewer(data);
        setNickname(data.account?.nickname ?? "");
        setAccountState("ready");
      })
      .catch(() => setAccountState("error"));
  }, []);

  const totalAnswers = stats.totalCorrect + stats.totalWrong;
  const overallAccuracy = totalAnswers ? Math.round((stats.totalCorrect / totalAnswers) * 100) : 0;
  const recentSessions = useMemo(() => stats.sessions.slice(-8), [stats.sessions]);
  const recentHistory = useMemo(
    () => stats.sessions.slice(-5).reverse(),
    [stats.sessions]
  );

  const persistStats = useCallback((nextStats) => {
    setStats(nextStats);
    writePrivateValue("device:stats", nextStats).catch(() => {});
  }, []);

  const saveTrainingProgress = useCallback(async (payload = pendingTrainingSaveRef.current) => {
    if (!payload) return;
    pendingTrainingSaveRef.current = payload;
    setAchievementSave("saving");
    try {
      const result = await postJsonOrQueue("/api/achievements/complete", payload, { queueKey: payload.sessionId });
      pendingTrainingSaveRef.current = null;
      setAchievementSave(result.state === "queued" ? "queued" : "saved");
      if (result.state === "saved") refreshAchievements();
      setReviewRevision((current) => current + 1);
    } catch {
      setAchievementSave("error");
    }
  }, [refreshAchievements]);

  const loadOwnProfile = useCallback(async () => {
    setPlayerState("loading");
    setPlayerMessage("Carregando seu histórico privado…");
    try {
      const { data } = await privateJsonFetch("/api/player");
      setPlayerProfile(data);
      setPlayerState("ready");
      setPlayerMessage("");
    } catch (error) {
      setPlayerProfile(null);
      setPlayerState("error");
      setPlayerMessage(error.message || "Não foi possível carregar o perfil.");
    }
  }, []);

  useEffect(() => {
    if (accountState !== "ready") return;
    if (!viewer.account) {
      setPlayerProfile(null);
      setPlayerState("idle");
      setPlayerMessage("");
      return;
    }
    loadOwnProfile();
  }, [accountState, loadOwnProfile, viewer.account]);

  const submitRankedScore = useCallback(async (currentResults) => {
    if (!activeRankedRef.current || !rankedSessionRef.current || !currentResults.length) return;
    const correct = currentResults.filter((item) => item.correct).length;
    const wrong = currentResults.length - correct;
    const rankedBestStreak = calculateBestStreak(currentResults);
    setRankingState("submitting");
    setRankingMessage("Enviando resultado…");

    try {
      const response = await fetch("/api/ranking/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: rankedSessionRef.current,
          correct,
          wrong,
          bestStreak: rankedBestStreak
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar.");
      setRankingState("submitted");
      refreshAchievements();
      setRankingMessage(`${data.attemptScore} pontos • ${data.position}º lugar${data.improved ? " • novo recorde" : ""}`);
      setRankOperation(activeOperationRef.current);
      setRankDuration(activeDurationRef.current);
      setRankTier(activeTierRef.current);
      await loadLeaderboard(activeOperationRef.current, activeDurationRef.current, activeTierRef.current);
      await loadOwnProfile();
    } catch (error) {
      setRankingState("error");
      setRankingMessage(error.message || "Não foi possível enviar o resultado.");
    }
  }, [loadLeaderboard, loadOwnProfile, refreshAchievements]);

  const finishSession = useCallback(() => {
    if (finishingRef.current || status !== "active") return;
    finishingRef.current = true;
    setStatus("finished");
    const currentResults = results;
    if (!currentResults.length) return;
    const correct = currentResults.filter((item) => item.correct).length;
    const wrong = currentResults.length - correct;
    const accuracy = Math.round((correct / currentResults.length) * 100);
    const averageMs = Math.round(currentResults.reduce((sum, item) => sum + item.responseMs, 0) / currentResults.length);
    const session = {
      id: Date.now(),
      date: new Date().toISOString(),
      correct,
      wrong,
      accuracy,
      averageSeconds: Number((averageMs / 1000).toFixed(1)),
      level: adaptiveLevel,
      operation: activeOperationRef.current,
      duration: activeDurationRef.current,
      tier: activeTierRef.current,
      ranked: activeRankedRef.current
    };
    const currentStats = stats;
    persistStats({
      sessions: [...currentStats.sessions, session].slice(-40),
      totalCorrect: currentStats.totalCorrect + correct,
      totalWrong: currentStats.totalWrong + wrong,
      bestStreak: Math.max(currentStats.bestStreak, bestStreak)
    });
    submitRankedScore(currentResults);
    if (!activeRankedRef.current && trainingSessionRef.current) {
      saveTrainingProgress({
        sessionId: trainingSessionRef.current,
        offline: trainingSessionOfflineRef.current,
        duration: activeDurationRef.current,
        startedAt: trainingStartedAtRef.current,
        answers: currentResults.map(({ operation: answeredOperation, a, b, given, level }) => ({ operation: answeredOperation, a, b, given, level }))
      });
    }
  }, [adaptiveLevel, bestStreak, persistStats, submitRankedScore, results, status, saveTrainingProgress, stats]);

  useEffect(() => { finishSessionRef.current = finishSession; }, [finishSession]);

  useEffect(() => {
    if (status !== "active") return undefined;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((sessionEndsAtRef.current - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        window.clearInterval(timer);
        finishSessionRef.current?.();
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [status]);

  const startSession = async () => {
    if (specificTrainingBusy || startingRef.current || rankingState === "submitting" || ["saving", "error"].includes(achievementSave)) return;
    startingRef.current = true;
    setSessionStarting(true);
    try {
    const selectedDuration = rankedMode && ![60, 120].includes(duration) ? 60 : duration;
    const selectedOperation = rankedMode && operation === "mix" ? "add" : operation;
    const selectedLevel = rankedMode ? (rankTier === "advanced" ? 4 : 1) : baseLevel;

    if (rankedMode) {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setRankingState("error");
        setRankingMessage("O ranking precisa de internet para validar a sessão.");
        return;
      }
      if (!viewer.account) {
        setRankingState("error");
        setRankingMessage(viewer.authenticated ? "Conclua seu cadastro para participar do ranking." : "Entre ou crie uma conta para participar do ranking.");
        return;
      }
      setRankingState("starting");
      setRankingMessage("Preparando desafio…");
      try {
        const response = await fetch("/api/ranking/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            operation: selectedOperation,
            duration: selectedDuration,
            tier: rankTier
          })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Não foi possível iniciar.");
        rankedSessionRef.current = data.sessionId;
        setNickname(data.nickname);
      } catch (error) {
        setRankingState("error");
        setRankingMessage(error.message || "Ranking indisponível agora.");
        return;
      }
    } else {
      rankedSessionRef.current = null;
      trainingSessionRef.current = null;
      trainingSessionOfflineRef.current = false;
      trainingStartedAtRef.current = Date.now();
      if (viewer.account) {
        const useLocalSession = () => {
          trainingSessionRef.current = crypto.randomUUID();
          trainingSessionOfflineRef.current = true;
        };
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          useLocalSession();
        } else {
          try {
            const response = await fetch("/api/achievements/session", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ duration: selectedDuration })
            });
            if (!response.ok) {
              const error = new Error("Não foi possível preparar o treino.");
              error.serverResponse = true;
              throw error;
            }
            const data = await response.json();
            if (!data.sessionId) throw new Error("Sessão indisponível.");
            trainingSessionRef.current = data.sessionId;
          } catch (error) {
            if (error?.serverResponse) {
              setRankingState("error");
              setRankingMessage("Sua conta não pôde preparar este treino agora.");
              return;
            }
            useLocalSession();
          }
        }
      }
    }

    activeDurationRef.current = selectedDuration;
    sessionEndsAtRef.current = Date.now() + selectedDuration * 1000;
    sessionCycleRef.current += 1;
    activeOperationRef.current = selectedOperation;
    activeRankedRef.current = rankedMode;
    activeTierRef.current = rankedMode ? rankTier : (selectedLevel === 4 ? "advanced" : "classic");
    setActiveDuration(selectedDuration);
    finishingRef.current = false;
    setAdaptiveLevel(selectedLevel);
    setTimeLeft(selectedDuration);
    setResults([]);
    setStreak(0);
    setBestStreak(0);
    setFeedback(null);
    setAchievementSave("idle");
    setAnswer("");
    setQuestion(buildQuestion(selectedLevel, selectedOperation));
    questionStartedAt.current = Date.now();
    setRankingState(rankedMode ? "playing" : "idle");
    setRankingMessage("");
    setStatus("active");
    window.setTimeout(() => inputRef.current?.focus(), 80);
    } finally {
      startingRef.current = false;
      setSessionStarting(false);
    }
  };

  const submitAnswer = (event) => {
    event.preventDefault();
    if (status !== "active" || feedback || answer.trim() === "") return;
    if (Date.now() >= sessionEndsAtRef.current) {
      setTimeLeft(0);
      finishSession();
      return;
    }

    const numericAnswer = Number(answer.replace(",", "."));
    if (!Number.isFinite(numericAnswer)) return;
    const responseMs = Date.now() - questionStartedAt.current;
    const correct = numericAnswer === question.answer;
    const newResult = {
      question: `${question.a} ${question.symbol} ${question.b}`,
      operation: question.operation,
      a: question.a,
      b: question.b,
      expected: question.answer,
      given: numericAnswer,
      correct,
      responseMs,
      level: adaptiveLevel
    };
    const nextResults = [...results, newResult];
    const nextStreak = correct ? streak + 1 : 0;

    if (correct) playCorrectSound(audioContextRef);
    else playErrorSound(audioContextRef);

    setResults(nextResults);
    setStreak(nextStreak);
    setBestStreak((current) => Math.max(current, nextStreak));
    setFeedback({ correct, expected: question.answer });

    let nextLevel = adaptiveLevel;
    const recent = nextResults.slice(-4);
    if (activeRankedRef.current && activeTierRef.current === "advanced") {
      nextLevel = 4;
    } else {
      const maximumLevel = activeRankedRef.current ? 3 : 4;
      if (nextResults.length % 4 === 0 && recent.length === 4 && recent.every((item) => item.correct) && recent.reduce((sum, item) => sum + item.responseMs, 0) / 4 < 9000) {
        nextLevel = Math.min(maximumLevel, adaptiveLevel + 1);
      } else if (nextResults.length % 2 === 0 && nextResults.slice(-2).length === 2 && nextResults.slice(-2).every((item) => !item.correct)) {
        nextLevel = Math.max(0, adaptiveLevel - 1);
      }
    }
    setAdaptiveLevel(nextLevel);
    setAnswer("");
    inputRef.current?.focus({ preventScroll: true });

    const sessionCycle = sessionCycleRef.current;
    window.setTimeout(() => {
      if (sessionCycle !== sessionCycleRef.current || finishingRef.current) return;
      setQuestion(buildQuestion(nextLevel, activeOperationRef.current));
      setFeedback(null);
      questionStartedAt.current = Date.now();
    }, correct ? 420 : 850);
  };

  const currentCorrect = results.filter((item) => item.correct).length;
  const sessionAccuracy = results.length ? Math.round((currentCorrect / results.length) * 100) : 0;
  const lastSession = stats.sessions.at(-1);
  const profileAttempts = playerProfile?.attempts ?? [];
  const profileChartAttempts = profileAttempts.slice(-16);

  const timedBusy = status === "active" || sessionStarting || rankingState === "submitting" || ["saving", "error"].includes(achievementSave);
  const activeTrainingHref = specificTrainingBusy ? "/treinar/especificos" : "/treinar";
  const trainingAway = (timedBusy || specificTrainingBusy) && (view !== "treinar" || specificTab !== specificTrainingBusy);
  const pageHeadings = {
    treinar: ["Treinar", "Escolha uma modalidade e pratique no seu ritmo."],
    revisar: ["Revisar erros", "Reforce as contas que ainda precisam de prática."],
    progresso: ["Meu progresso", "Acompanhe sua evolução, seu histórico e suas conquistas."],
    ranking: ["Ranking", "Compare os recordes na mesma operação, faixa e duração."]
  };

  useEffect(() => {
    const followLegacyLink = () => {
      const destination = { "#treinos-especificos": "/treinar/especificos", "#evolucao": "/ranking", "#revisar-erros": "/revisar", "#conquistas": "/progresso/conquistas", "#perfil": "/progresso" }[window.location.hash];
      if (destination) router.replace(destination);
    };
    followLegacyLink();
    window.addEventListener("hashchange", followLegacyLink);
    return () => window.removeEventListener("hashchange", followLegacyLink);
  }, [router]);

  useEffect(() => {
    if (!timedBusy) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [timedBusy]);

  return (
    <main id="conteudo" className="study-main">
      {children}
      {trainingAway && <div className="training-return" role="status">
        <span>{specificTrainingBusy ? "Você tem um treino específico em andamento." : status === "active" ? `Seu treino continua · ${formatTime(timeLeft)}` : "Confira o resultado do seu treino."}</span>
        <Link href={activeTrainingHref}>Voltar ao treino</Link>
      </div>}

      {view === "inicio" && <div className="home-page">
        <section className="home-welcome" aria-labelledby="home-title">
          <span className="eyebrow">SEU ESPAÇO DE CÁLCULO MENTAL</span>
          <h1 id="home-title">Precisão primeiro.<br /><span>Velocidade depois.</span></h1>
          <p>Soma, subtração e multiplicação. Um treino de cada vez.</p>
          <div className="home-actions">
            <Link className="primary-button" href={timedBusy || specificTrainingBusy ? activeTrainingHref : "/treinar"}>{timedBusy || specificTrainingBusy ? "Continuar treino" : "Começar treino"}<span aria-hidden="true">→</span></Link>
            <Link className="text-link" href="/treinar/especificos">Praticar uma habilidade</Link>
          </div>
          <PracticeFlame progress={achievementData} compact />
        </section>
        <section className="home-overview" aria-labelledby="home-overview-title">
          <header><h2 id="home-overview-title">Seu resumo</h2><span>Treinos com cronômetro neste dispositivo</span></header>
          <div className="overview-stats">
            <div><strong>{totalAnswers ? `${overallAccuracy}%` : "—"}</strong><span>Precisão geral</span></div>
            <div><strong>{stats.totalCorrect}</strong><span>Acertos acumulados</span></div>
            <div><strong>{stats.bestStreak}</strong><span>Melhor sequência</span></div>
          </div>
          {lastSession ? <p className="home-last-session">Último treino: {lastSession.accuracy}% de precisão · {lastSession.correct} acertos.</p> : <p className="home-last-session">Seu primeiro treino começa a preencher este resumo.</p>}
        </section>
        <div className="home-shortcuts">
          <Link href="/revisar"><strong>Revisar meus erros</strong><span>Pratique de novo as contas que errou.</span><b aria-hidden="true">→</b></Link>
          <Link href="/progresso"><strong>Ver meu progresso</strong><span>Histórico, evolução e conquistas.</span><b aria-hidden="true">→</b></Link>
        </div>
      </div>}

      {view !== "inicio" && <header className="page-heading">
        <h1>{pageHeadings[view][0]}</h1><p>{pageHeadings[view][1]}</p>
      </header>}

      <div className="page-surface" hidden={view !== "treinar"}>
        <nav className="page-tabs" aria-label="Modalidades de treino">
          <Link href="/treinar" aria-current={!specificTab ? "page" : undefined}>Treino livre</Link>
          <Link href="/treinar/especificos" aria-current={specificTab ? "page" : undefined}>Treinos específicos</Link>
        </nav>
        <div hidden={specificTab}>
      <section className="trainer-section" aria-labelledby="trainer-title">
        <div className="section-heading">
          <div>
            <h2 id="trainer-title">Treino com cronômetro</h2>
          </div>
          <p>O nível se adapta enquanto você resolve.</p>
        </div>

        <div className={`trainer-card status-${status}`}>
          {status === "ready" && (
            <div className="setup-grid">
              <div className="setup-main">
                <label className="field-label">{rankedMode ? "Dificuldade fixa do ranking" : "Começar no nível"}</label>
                <div className="level-grid">
                  {LEVELS.map((level) => (
                    <button
                      type="button"
                      className={`level-card ${baseLevel === level.id ? "selected" : ""}`}
                      aria-pressed={baseLevel === level.id}
                      key={level.id}
                      disabled={rankedMode}
                      onClick={() => setBaseLevel(level.id)}
                    >
                      <span className="level-number" style={{ "--level-color": level.color }}>{level.short}</span>
                      <span><strong>{level.name}</strong><small>{level.range}</small></span>
                      <i aria-hidden="true">✓</i>
                    </button>
                  ))}
                </div>
              </div>

              <div className="setup-side">
                <div>
                  <label className="field-label">Modo</label>
                  <div className="mode-options">
                    <button className={!rankedMode ? "active" : ""} onClick={() => { setRankedMode(false); setRankingMessage(""); }}>Treino livre</button>
                    <button className={rankedMode ? "active ranked" : ""} onClick={() => { setRankedMode(true); setBaseLevel(rankTier === "advanced" ? 4 : 1); setOperation((current) => current === "mix" ? "add" : current); setDuration((current) => current === 300 ? 60 : current); setRankingMessage(""); }}>Ranking</button>
                  </div>
                </div>
                {rankedMode && (
                  <>
                    <div>
                      <label className="field-label">Faixa do ranking</label>
                      <div className="tier-options">
                        {RANKING_TIERS.map((tier) => (
                          <button
                            key={tier.value}
                            className={rankTier === tier.value ? "active" : ""}
                            onClick={() => {
                              setRankTier(tier.value);
                              setBaseLevel(tier.value === "advanced" ? 4 : 1);
                            }}
                          >
                            <strong>{tier.label}</strong>
                            <small>{tier.description}</small>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="ranking-account-box">
                      <span className="field-label">Conta do ranking</span>
                      {accountState === "loading" && <p>Verificando sua conta…</p>}
                      {accountState === "error" && <p className="error">Não foi possível verificar sua conta agora.</p>}
                      {accountState === "ready" && viewer.account && (
                        <div className="ranking-identity"><span>✓</span><div><strong>{viewer.account.nickname}</strong><small>Apelido protegido pela sua conta</small></div></div>
                      )}
                      {accountState === "ready" && viewer.authenticated && !viewer.account && (
                        <div className="ranking-auth-needed"><p>Falta escolher seu apelido exclusivo.</p><a href="/cadastro">Concluir cadastro →</a></div>
                      )}
                      {accountState === "ready" && !viewer.authenticated && (
                        <div className="ranking-auth-needed"><p>Entre para proteger seus resultados.</p><div><a href="/entrar">Entrar</a><a href="/cadastro">Criar conta</a></div></div>
                      )}
                    </div>
                  </>
                )}
                <div>
                  <label className="field-label">Operações</label>
                  <div className={`segmented ${rankedMode ? "columns-3" : "columns-4"}`}>
                    {(rankedMode
                      ? RANKING_OPERATIONS.map(({ value, action }) => [value, action])
                      : [["mix", "Misturar"], ...RANKING_OPERATIONS.map(({ value, action }) => [value, action])]
                    ).map(([value, label]) => (
                      <button key={value} className={operation === value ? "active" : ""} onClick={() => setOperation(value)}>{label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="field-label">Duração</label>
                  <div className={`duration-options ${rankedMode ? "columns-2" : ""}`}>
                    {SESSION_OPTIONS.filter((option) => !rankedMode || option.value <= 120).map((option) => (
                      <button key={option.value} className={duration === option.value ? "active" : ""} onClick={() => setDuration(option.value)}>{option.label}</button>
                    ))}
                  </div>
                </div>
                {specificTrainingBusy && <p className="drill-note">Conclua o <Link href="/treinar/especificos">treino específico</Link> em andamento antes de começar outro.</p>}
                <button className="primary-button" disabled={specificTrainingBusy || sessionStarting || accountState === "loading" || (rankedMode && !viewer.account)} onClick={startSession}>
                  {sessionStarting ? "Preparando…" : rankedMode ? "Iniciar desafio" : "Iniciar treino"} <span>→</span>
                </button>
                <p className={`setup-message ${rankingState === "error" ? "error" : ""}`}>{rankingMessage || "Dica: pressione Enter para responder."}</p>
              </div>
            </div>
          )}

          {status === "active" && (
            <div className="active-session">
              <header className="session-bar">
                <div><span>Tempo</span><strong className={timeLeft <= 10 ? "urgent" : ""}>{formatTime(timeLeft)}</strong></div>
                <div><span>{activeRankedRef.current && activeTierRef.current === "advanced" ? "Faixa fixa" : "Nível adaptativo"}</span><strong>{LEVELS[adaptiveLevel].name}</strong></div>
                <div><span>Precisão</span><strong>{results.length ? `${sessionAccuracy}%` : "—"}</strong></div>
                <div><span>Sequência</span><strong>{streak} 🔥</strong></div>
              </header>
              <div className="progress-track"><span style={{ width: `${(timeLeft / activeDuration) * 100}%` }} /></div>
              <div className="question-area">
                <span className="question-kicker">Resolva mentalmente</span>
                <div className="equation" aria-live="polite">
                  <span>{question.a}</span><b>{question.symbol}</b><span>{question.b}</span><b>=</b><span className="answer-slot">?</span>
                </div>
                <form onSubmit={submitAnswer}>
                  <input
                    ref={inputRef}
                    inputMode="numeric"
                    autoComplete="off"
                    aria-label="Sua resposta"
                    placeholder="Digite o resultado"
                    value={answer}
                    aria-disabled={Boolean(feedback)}
                    onChange={(event) => {
                      if (!feedback) setAnswer(event.target.value);
                    }}
                  />
                  <button className="primary-button" type="submit" disabled={Boolean(feedback)}>Responder <span>↵</span></button>
                </form>
                <div className={`feedback ${feedback ? (feedback.correct ? "correct" : "wrong") : ""}`} aria-live="assertive">
                  {feedback && (feedback.correct ? "Correto!" : `Quase — a resposta era ${feedback.expected}.`)}
                </div>
              </div>
              {!activeRankedRef.current && <button className="end-button" onClick={finishSession}>Encerrar sessão</button>}
            </div>
          )}

          {status === "finished" && (
            <div className="session-summary">
              <span className="summary-icon">✓</span>
              <span className="eyebrow">SESSÃO CONCLUÍDA</span>
              <h3>{sessionAccuracy >= 85 ? "Base ficando sólida." : sessionAccuracy >= 65 ? "Bom ponto de partida." : "Vamos reforçar este nível."}</h3>
              <p>{results.length ? `Você resolveu ${results.length} contas em ${Math.round((activeDuration - timeLeft) / 60) || 1} minuto(s).` : "Sessão encerrada antes da primeira resposta."}</p>
              {activeRankedRef.current && <div className={`ranking-result ${rankingState}`}>{rankingMessage || "Calculando sua posição…"}</div>}
              {!activeRankedRef.current && achievementSave !== "idle" && (
                <div className={`achievement-save ${achievementSave}`} role="status">
                  {achievementSave === "saving" && "Salvando o progresso das conquistas…"}
                  {achievementSave === "saved" && <>Progresso salvo na sua conta. <Link href="/progresso/conquistas">Ver minhas conquistas</Link></>}
                  {achievementSave === "queued" && "Progresso salvo com segurança neste aparelho. A sincronização será automática quando a internet voltar."}
                  {achievementSave === "error" && <>Não foi possível guardar o progresso. <button type="button" onClick={() => saveTrainingProgress()}>Tentar novamente</button></>}
                </div>
              )}
              <div className="summary-stats">
                <div><strong>{currentCorrect}</strong><span>acertos</span></div>
                <div><strong>{results.length - currentCorrect}</strong><span>erros</span></div>
                <div><strong>{sessionAccuracy}%</strong><span>precisão</span></div>
                <div><strong>{bestStreak}</strong><span>sequência</span></div>
              </div>
              <div className="summary-actions">
                <button className="primary-button" disabled={specificTrainingBusy || sessionStarting || rankingState === "submitting" || ["saving", "error"].includes(achievementSave)} onClick={startSession}>{sessionStarting ? "Preparando…" : "Treinar novamente"} <span>→</span></button>
                <button className="secondary-button" disabled={sessionStarting || rankingState === "submitting" || ["saving", "error"].includes(achievementSave)} onClick={() => setStatus("ready")}>Ajustar treino</button>
                <Link className="summary-achievements-link" href="/progresso/conquistas">Minhas conquistas</Link>
              </div>
            </div>
          )}
        </div>
      </section>
        </div>
        <div hidden={!specificTab}>
          <SpecificTraining viewer={viewer} accountState={accountState}
            otherSessionActive={timedBusy}
            onBusyChange={setSpecificTrainingBusy} onSaved={refreshAfterDrill}
            onFeedback={(correct) => correct ? playCorrectSound(audioContextRef) : playErrorSound(audioContextRef)} />
        </div>
      </div>

      <div className="page-surface review-page" hidden={view !== "revisar"}>
        <ReviewCard viewer={viewer} accountState={accountState} revision={reviewRevision} onResolved={refreshAchievements} />
      </div>

      <div className="page-surface" hidden={view !== "progresso"}>
        <nav className="page-tabs" aria-label="Áreas do progresso">
          <Link href="/progresso" aria-current={!achievementsTab ? "page" : undefined}>Evolução e histórico</Link>
          <Link href="/progresso/conquistas" aria-current={achievementsTab ? "page" : undefined}>Conquistas</Link>
        </nav>
        <div hidden={!achievementsTab}>
          <AchievementsCard viewer={viewer} accountState={accountState} progress={achievementData} />
        </div>
        <div hidden={achievementsTab}>
          <p className="section-note">Evolução dos treinos com cronômetro neste dispositivo.</p>
          <div className="dashboard-grid">
          <article className="chart-card">
            <header><div><span>Precisão</span><strong>{lastSession ? `${lastSession.accuracy}%` : "—"}</strong></div><small>meta: 90%</small></header>
            <MiniLineChart data={recentSessions} valueKey="accuracy" suffix="%" />
          </article>
          <article className="chart-card">
            <header><div><span>Tempo médio</span><strong>{lastSession ? `${lastSession.averageSeconds}s` : "—"}</strong></div><small>por resposta</small></header>
            <MiniLineChart data={recentSessions} valueKey="averageSeconds" suffix="s" invert />
          </article>
          <article className="history-card">
            <header><span>Histórico recente</span><small>{stats.sessions.length} sessões</small></header>
            <div className="history-list">
              {!recentHistory.length && <div className="empty-history">Seu histórico aparecerá aqui.</div>}
              {recentHistory.map((session) => (
                <div className="history-row" key={session.id}>
                  <span className={`history-status ${session.accuracy >= 80 ? "good" : "practice"}`}>{session.accuracy >= 80 ? "✓" : "↗"}</span>
                  <div>
                    <strong>{session.ranked ? `Ranking ${session.tier === "advanced" ? "avançado" : "clássico"} • ${OPERATION_LABELS[session.operation] || "Desafio"} • ${session.duration / 60} min` : LEVELS[session.level]?.name || "Treino"}</strong>
                    <small>{new Date(session.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} • {session.correct} acertos • {session.wrong} erros</small>
                  </div>
                  <b>{session.accuracy}%</b>
                </div>
              ))}
            </div>
          </article>
          <DrillHistory viewer={viewer} accountState={accountState} revision={achievementsRevision} />
          <article className="player-profile-card" id="perfil">
            <header className="player-profile-header">
              <div>
                <span>Perfil privado</span>
                <strong>Seu desempenho</strong>
                <small>O histórico detalhado só aparece para você quando estiver conectado.</small>
              </div>
            </header>

            {accountState === "loading" && (
              <div className="profile-placeholder">Verificando sua conta…</div>
            )}
            {accountState === "ready" && playerState === "idle" && (
              <div className="profile-placeholder">
                <span>Entre ou crie uma conta para acessar seu histórico protegido.</span>
                <div><a href="/entrar">Entrar</a> · <a href="/cadastro">Criar conta</a></div>
              </div>
            )}
            {(playerState === "loading" || playerState === "error") && (
              <div className={`profile-message ${playerState}`}>{playerMessage}</div>
            )}
            {playerState === "ready" && playerProfile && (
              <div className="profile-content">
                <div className="profile-title-row">
                  <div><span>Jogador</span><h3>{playerProfile.nickname}</h3></div>
                  <small>{playerProfile.summary.sessions ? `${playerProfile.summary.sessions} partida${playerProfile.summary.sessions === 1 ? "" : "s"} registrada${playerProfile.summary.sessions === 1 ? "" : "s"}` : "Nenhuma partida ranqueada ainda"}</small>
                </div>
                <div className="profile-stats">
                  <div><strong>{playerProfile.summary.bestScore}</strong><span>melhor pontuação</span></div>
                  <div><strong>{playerProfile.summary.totalCorrect}</strong><span>acertos</span></div>
                  <div><strong>{playerProfile.summary.totalWrong}</strong><span>erros</span></div>
                  <div><strong>{playerProfile.summary.accuracy}%</strong><span>precisão</span></div>
                  <div><strong>{playerProfile.summary.bestStreak}</strong><span>melhor sequência</span></div>
                </div>

                <div className="profile-charts">
                  <section>
                    <header><span>Evolução da pontuação</span><strong>{profileAttempts.at(-1)?.score ?? "—"}</strong></header>
                    <MiniLineChart data={profileChartAttempts} valueKey="score" emptyLabel="A evolução será registrada nas próximas partidas ranqueadas." />
                  </section>
                  <section>
                    <header><span>Evolução da precisão</span><strong>{profileAttempts.length ? `${profileAttempts.at(-1).accuracy}%` : "—"}</strong></header>
                    <MiniLineChart data={profileChartAttempts} valueKey="accuracy" suffix="%" emptyLabel="A evolução será registrada nas próximas partidas ranqueadas." />
                  </section>
                </div>

                <section className="profile-records">
                  <header><span>Melhores resultados por categoria</span><small>{playerProfile.bests.length} categorias</small></header>
                  <div className="record-grid">
                    {playerProfile.bests.map((entry) => (
                      <div className="record-item" key={entry.id}>
                        <span>{OPERATION_LABELS[entry.operation]} • {entry.tier === "advanced" ? "até 1.000" : "até 250"} • {entry.duration / 60} min</span>
                        <strong>{entry.score}<small> pts</small></strong>
                        <small>{entry.correct} acertos • {entry.wrong} erros • sequência {entry.bestStreak}</small>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="profile-attempts">
                  <header><span>Histórico ranqueado</span><small>{profileAttempts.length} partidas recentes</small></header>
                  {!profileAttempts.length && <div className="empty-profile-history">Os recordes atuais já estão acima. O histórico detalhado começa nas próximas partidas.</div>}
                  {profileAttempts.slice().reverse().map((attempt) => (
                    <div className="profile-attempt-row" key={attempt.id}>
                      <span className={`history-status ${attempt.accuracy >= 80 ? "good" : "practice"}`}>{attempt.accuracy >= 80 ? "✓" : "↗"}</span>
                      <div>
                        <strong>{OPERATION_LABELS[attempt.operation]} • {attempt.tier === "advanced" ? "até 1.000" : "até 250"} • {attempt.duration / 60} min</strong>
                        <small>{new Date(attempt.playedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })} • {attempt.correct} acertos • {attempt.wrong} erros • sequência {attempt.bestStreak}</small>
                      </div>
                      <b>{attempt.score}<small> pts</small></b>
                    </div>
                  ))}
                </section>
              </div>
            )}
          </article>

          </div>
        </div>
      </div>

      <div className="page-surface ranking-page" hidden={view !== "ranking"}>
          <article className="leaderboard-card">
            <header>
              <div><span>Ranking público</span><strong>Top 10</strong></div>
              <button onClick={() => loadLeaderboard()} aria-label="Atualizar ranking">↻ Atualizar</button>
            </header>
            <div className="leaderboard-filters" aria-label="Categoria do ranking">
              <div className="rank-tier-tabs">
                {RANKING_TIERS.map((tier) => (
                  <button key={tier.value} className={rankTier === tier.value ? "active" : ""} onClick={() => setRankTier(tier.value)}>{tier.label} • {tier.description}</button>
                ))}
              </div>
              <div className="rank-operation-tabs">
                {RANKING_OPERATIONS.map((item) => (
                  <button key={item.value} className={rankOperation === item.value ? "active" : ""} onClick={() => setRankOperation(item.value)}>{item.label}</button>
                ))}
              </div>
              <div className="rank-duration-tabs">
                {[60, 120].map((seconds) => (
                  <button key={seconds} className={rankDuration === seconds ? "active" : ""} onClick={() => setRankDuration(seconds)}>{seconds / 60} min</button>
                ))}
              </div>
            </div>
            <div className="leaderboard-list">
              {!leaderboard.length && (
                <div className="empty-leaderboard">
                  <strong>O primeiro lugar está livre.</strong>
                  <span>Complete um desafio {rankTier === "advanced" ? "avançado " : ""}de {rankDuration / 60} minuto{rankDuration === 120 ? "s" : ""} de {OPERATION_LABELS[rankOperation].toLocaleLowerCase()}.</span>
                </div>
              )}
              {leaderboard.slice(0, 10).map((entry, index) => (
                <div className={`leaderboard-row ${entry.nickname.toLocaleLowerCase() === nickname.trim().toLocaleLowerCase() ? "is-you" : ""}`} key={entry.id}>
                  <span className={`rank rank-${index + 1}`}>{index < 3 ? ["◆", "◇", "△"][index] : index + 1}</span>
                  <div>
                    <strong>{entry.nickname}</strong>
                    <small>{entry.correct} acertos • sequência {entry.bestStreak}</small>
                  </div>
                  <b>{entry.score}<small> pts</small></b>
                </div>
              ))}
            </div>
          </article>
        <div className="ranking-page-action"><p>Quer participar? Escolha o modo Ranking na página Treinar.</p><Link className="secondary-button" href="/treinar">Preparar meu treino</Link></div>
      </div>
      <footer className="site-footer"><span>Mente Ágil</span><p>Seu progresso é privado. O ranking exibe apelidos e recordes.</p></footer>
    </main>
  );
}
