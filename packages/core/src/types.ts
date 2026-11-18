/**
 * Shared types for the Wakeworth rules engine.
 *
 * Conventions
 * - Durations are whole or fractional MINUTES.
 * - Instants are epoch milliseconds (`number`).
 * - Calendar days are `ISODate` strings ("YYYY-MM-DD") in the user's local
 *   calendar. The app decides which local day a session belongs to (and splits
 *   sessions that cross midnight); the core never touches time zones.
 */

export type Tier = 'critical' | 'important' | 'flexible';

/** Leisure is planned like a task but always follows Flexible rules. */
export type TaskKind = 'task' | 'leisure';

/** 0 = Sunday … 6 = Saturday (same as `Date.prototype.getUTCDay`). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** "YYYY-MM-DD" in the user's local calendar. */
export type ISODate = string;

export interface Task {
  id: string;
  name: string;
  tier: Tier;
  kind?: TaskKind;
}

/** One cell of the repeating weekly template: task × weekday → minutes. */
export interface TemplateEntry {
  taskId: string;
  weekday: Weekday;
  minutes: number;
  /** Optional pinned start, "HH:MM" local time. */
  pinnedTime?: string;
}

/** A date-specific change that wins over the template (vacations, one-offs). */
export interface PlanOverride {
  date: ISODate;
  taskId: string;
  minutes: number;
  pinnedTime?: string;
}

/** Per-day flags that are not about a single task. */
export interface DayMeta {
  date: ISODate;
  /** Vacation days neither count toward nor break a streak. */
  vacation?: boolean;
}

export type SessionSource = 'timer' | 'manual';

/** A closed block of time spent on one task. Open timers are not passed in. */
export interface Session {
  id: string;
  taskId: string;
  date: ISODate;
  start: number;
  end: number;
  source: SessionSource;
}

/** The user tapped "Mark done" for a task on a day. */
export interface Completion {
  taskId: string;
  date: ISODate;
  at: number;
}

export interface SleepLog {
  /** The day the user woke up on; the sleep counts toward this day's score. */
  date: ISODate;
  minutesSlept: number;
  /** Local bedtime as minutes after midnight (e.g. 23:30 → 1410, 00:15 → 15). */
  bedtimeMinuteOfDay: number;
}

export interface UserSettings {
  /** Day the week starts on; Monday (1) by default. */
  weekStart: Weekday;
  /** Nightly sleep target in minutes; 480 (8 h) by default. */
  sleepTargetMinutes: number;
  /** Daily untimed slack for commutes, breaks and switching. */
  bufferMinutes: number;
}

export const DEFAULT_SETTINGS: UserSettings = {
  weekStart: 1,
  sleepTargetMinutes: 8 * 60,
  bufferMinutes: 90,
};

/** Minutes planned per task for one day. */
export type DayPlan = Record<string, number>;
