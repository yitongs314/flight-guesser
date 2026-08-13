/** Personal play stats, kept in this browser only. */

export interface ModeStats {
  played: number;
  solved: number;
  points: number;
}

interface Stats {
  perMode: Record<string, ModeStats>;
}

const KEY = 'fg-stats';

export function loadStats(): Stats {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '') as Stats;
    if (raw && typeof raw === 'object' && raw.perMode) return raw;
  } catch {
    // fresh start
  }
  return { perMode: {} };
}

export function recordFlight(mode: string, solved: boolean, points: number): void {
  const stats = loadStats();
  const m = (stats.perMode[mode] ??= { played: 0, solved: 0, points: 0 });
  m.played++;
  if (solved) m.solved++;
  m.points += points;
  localStorage.setItem(KEY, JSON.stringify(stats));
}

export function statsSummary(): { played: number; solved: number; avg: number } {
  const stats = loadStats();
  let played = 0;
  let solved = 0;
  let points = 0;
  for (const m of Object.values(stats.perMode)) {
    played += m.played;
    solved += m.solved;
    points += m.points;
  }
  return { played, solved, avg: played ? Math.round(points / played) : 0 };
}
