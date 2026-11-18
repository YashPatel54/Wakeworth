import { weekKey } from './time.js';
import type { ISODate, Weekday } from './types.js';

/** A day keeps the streak alive at this score or above. */
export const STREAK_THRESHOLD = 70;
/** One bad day per week can be covered by a freeze. */
export const FREEZES_PER_WEEK = 1;

export interface StreakDay {
  date: ISODate;
  /** Final score, or null if the day has no score (not finished yet). */
  score: number | null;
  vacation?: boolean;
}

export interface StreakResult {
  current: number;
  best: number;
  /** Dates a freeze was spent on. */
  frozen: ISODate[];
}

/**
 * Walk the days oldest → newest. A day at 70+ extends the streak; vacation days
 * and unscored days are skipped; one sub-70 day per week is absorbed by a freeze;
 * any other sub-70 day resets the streak to 0.
 */
export function computeStreak(days: StreakDay[], weekStart: Weekday): StreakResult {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const freezesUsed = new Map<string, number>();
  const frozen: ISODate[] = [];
  let current = 0;
  let best = 0;

  for (const day of sorted) {
    if (day.vacation || day.score === null) continue;
    if (day.score >= STREAK_THRESHOLD) {
      current++;
      best = Math.max(best, current);
      continue;
    }
    const key = weekKey(day.date, weekStart);
    const used = freezesUsed.get(key) ?? 0;
    if (current > 0 && used < FREEZES_PER_WEEK) {
      freezesUsed.set(key, used + 1);
      frozen.push(day.date);
      continue;
    }
    current = 0;
  }

  return { current, best, frozen };
}
