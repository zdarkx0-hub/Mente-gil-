// One fixed calendar for the Site: Brasília, UTC−3. Client clocks never award days.
export const PRACTICE_UTC_OFFSET_MS = -3 * 60 * 60 * 1000;
export const PRACTICE_TIME_LABEL = "Horário de Brasília (UTC−3)";
export const MIN_DAILY_ANSWERS = 10;
const DAY_MS = 86_400_000;
const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export const practiceDay = (timestamp) => new Date(timestamp + PRACTICE_UTC_OFFSET_MS).toISOString().slice(0, 10);
const dayNumber = (key) => Date.parse(`${key}T00:00:00Z`) / DAY_MS;
const dayKey = (day) => new Date(day * DAY_MS).toISOString().slice(0, 10);
const weekStart = (day) => day - ((day + 3) % 7 + 7) % 7;

export function practiceStreak(dayKeys, now = Date.now()) {
  const today = practiceDay(now);
  const todayNumber = dayNumber(today);
  const days = [...new Set(dayKeys.filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key)))]
    .map(dayNumber).filter((day) => Number.isFinite(day) && day <= todayNumber).sort((a, b) => a - b);
  const practiced = new Set(days);
  const protectedDays = new Set();
  let current = 0;
  let best = 0;
  let previous = null;
  let lastProtectedWeek = null;

  // Only elapsed days consume protection. Today remains available until midnight.
  // Once a streak breaks, further missing days do not consume a new week's rest.
  const crossMissingDays = (first, last) => {
    for (let day = first; day <= last && current > 0; day += 1) {
      const week = weekStart(day);
      if (lastProtectedWeek === week) { current = 0; break; }
      lastProtectedWeek = week;
      protectedDays.add(day);
    }
  };

  for (const day of days) {
    if (previous !== null) crossMissingDays(previous + 1, day - 1);
    current += 1;
    best = Math.max(best, current);
    previous = day;
  }
  if (previous !== null) crossMissingDays(previous + 1, todayNumber - 1);

  const monday = weekStart(todayNumber);
  return {
    today, current, best,
    practicedToday: practiced.has(todayNumber),
    restAvailable: lastProtectedWeek !== monday,
    lastPracticeDay: previous === null ? null : dayKey(previous),
    nextDayAt: (todayNumber + 1) * DAY_MS - PRACTICE_UTC_OFFSET_MS,
    week: WEEKDAY_LABELS.map((label, index) => {
      const day = monday + index;
      return {
        date: dayKey(day), label, isToday: day === todayNumber,
        state: practiced.has(day) ? "practiced" : protectedDays.has(day) ? "protected"
          : day > todayNumber ? "future" : day === todayNumber ? "today" : "missed"
      };
    })
  };
}
