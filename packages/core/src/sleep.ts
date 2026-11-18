import type { SleepLog } from './types.js';

/** Bedtime within this many minutes of the usual one counts as consistent. */
export const BEDTIME_TOLERANCE_MINUTES = 45;

const DAY_MIN = 24 * 60;

/** Put after-midnight bedtimes after the evening ones (00:30 sorts after 23:00). */
function unwrap(minuteOfDay: number): number {
  return minuteOfDay < 12 * 60 ? minuteOfDay + DAY_MIN : minuteOfDay;
}

/** The user's usual bedtime: the median of recent bedtimes, or null with no history. */
export function usualBedtime(recentBedtimes: number[]): number | null {
  if (recentBedtimes.length === 0) return null;
  const sorted = recentBedtimes.map(unwrap).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  return Math.round(median) % DAY_MIN;
}

/** Is `bedtime` within ±45 min of `usual`, across midnight? No history counts as yes. */
export function isBedtimeConsistent(bedtime: number, usual: number | null): boolean {
  if (usual === null) return true;
  const d = Math.abs(bedtime - usual) % DAY_MIN;
  return Math.min(d, DAY_MIN - d) <= BEDTIME_TOLERANCE_MINUTES;
}

/** Shortfall against the target. Extra sleep never offsets it. */
export function sleepDebtMinutes(logs: SleepLog[], targetMinutes: number): number {
  return logs.reduce((sum, l) => sum + Math.max(0, targetMinutes - l.minutesSlept), 0);
}
