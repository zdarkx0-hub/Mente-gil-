"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ACHIEVEMENTS } from "../shared/achievements.mjs";

// One account-scoped request supplies the home flame and the medals page.
export default function useAchievementData({ viewer, accountState, revision }) {
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading");
  const [announcement, setAnnouncement] = useState("");
  const previousUnlocked = useRef(null);
  const requestVersion = useRef(0);
  const loadedAccount = useRef(null);
  // /api/account intentionally exposes no internal user ID.
  const accountKey = viewer.account ? `${viewer.account.nickname}:${viewer.account.createdAt}` : null;

  useEffect(() => {
    setData(null);
    setAnnouncement("");
    previousUnlocked.current = null;
  }, [accountKey]);

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    if (accountState === "loading") return;
    if (accountState === "error") { setState("error"); return; }
    if (!accountKey) { setData(null); setState("guest"); return; }
    setState("loading");
    try {
      const response = await fetch("/api/achievements", { cache: "no-store" });
      if (!response.ok) throw new Error("Conquistas indisponíveis");
      const next = await response.json();
      if (!Array.isArray(next.achievements) || !Array.isArray(next.streak?.week)) throw new Error("Resposta inválida");
      if (version !== requestVersion.current) return;
      const unlocked = next.achievements.filter((item) => item.unlocked).map((item) => item.id);
      const added = previousUnlocked.current === null ? [] : unlocked.filter((id) => !previousUnlocked.current.includes(id));
      setAnnouncement(added.length
        ? `Conquista desbloqueada: ${ACHIEVEMENTS.filter((item) => added.includes(item.id)).map((item) => item.name).join(", ")}!` : "");
      previousUnlocked.current = unlocked;
      loadedAccount.current = accountKey;
      setData(next);
      setState("ready");
    } catch { if (version === requestVersion.current) setState("error"); }
  }, [accountKey, accountState]);

  useEffect(() => {
    load();
    return () => { requestVersion.current += 1; };
  }, [load, revision]);

  useEffect(() => {
    if (!accountKey) return;
    const refreshVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", refreshVisible);
    // Keep an open page accurate when the server's day rolls over.
    const delay = data?.streak.nextDayAt ? Math.max(1000, data.streak.nextDayAt - Date.now() + 250) : null;
    const timer = delay === null ? null : window.setTimeout(load, Math.min(delay, 86_400_000));
    return () => { document.removeEventListener("visibilitychange", refreshVisible); if (timer !== null) window.clearTimeout(timer); };
  }, [accountKey, data?.streak.nextDayAt, load]);

  return { data: loadedAccount.current === accountKey ? data : null, state, announcement, load };
}
