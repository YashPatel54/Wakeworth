import type { ISODate, Weekday } from './types.js';

const DAY_MS = 86_400_000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse "YYYY-MM-DD" as a calendar day (UTC midnight, no time-zone math). */
export function parseISODate(date: ISODate): number {
  const m = ISO_RE.exec(date);
  if (!m) throw new Error(`Invalid ISO date: ${date}`);
  const [, y, mo, d] = m;
  const ms = Date.UTC(Number(y), Number(mo) - 1, Number(d));
  if (formatISODate(ms) !== date) throw new Error(`Invalid ISO date: ${date}`);
  return ms;
}

export function formatISODate(utcMidnightMs: number): ISODate {
  return new Date(utcMidnightMs).toISOString().slice(0, 10);
}

export function weekdayOf(date: ISODate): Weekday {
  return new Date(parseISODate(date)).getUTCDay() as Weekday;
}

export function addDays(date: ISODate, days: number): ISODate {
  return formatISODate(parseISODate(date) + days * DAY_MS);
}

/** First day of the week containing `date`, for a given week-start day. */
export function startOfWeek(date: ISODate, weekStart: Weekday): ISODate {
  const back = (weekdayOf(date) - weekStart + 7) % 7;
  return addDays(date, -back);
}

/** The seven dates of the week containing `date`, in order. */
export function weekDates(date: ISODate, weekStart: Weekday): ISODate[] {
  const first = startOfWeek(date, weekStart);
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}

/** Stable key for "which week is this", e.g. for one streak freeze per week. */
export function weekKey(date: ISODate, weekStart: Weekday): string {
  return startOfWeek(date, weekStart);
}

export function minutesBetween(start: number, end: number): number {
  return Math.max(0, end - start) / 60_000;
}
