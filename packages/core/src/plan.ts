import { weekdayOf } from './time.js';
import type { DayPlan, ISODate, PlanOverride, Task, TemplateEntry, Tier } from './types.js';

/**
 * Minutes planned per task on `date`: the weekly template for that weekday,
 * with any date-specific overrides applied on top. Tasks at 0 minutes are kept
 * out of the result.
 */
export function resolveDayPlan(
  template: TemplateEntry[],
  overrides: PlanOverride[],
  date: ISODate,
): DayPlan {
  const weekday = weekdayOf(date);
  const plan: DayPlan = {};
  for (const e of template) {
    if (e.weekday === weekday) plan[e.taskId] = (plan[e.taskId] ?? 0) + e.minutes;
  }
  for (const o of overrides) {
    if (o.date === date) plan[o.taskId] = o.minutes;
  }
  for (const id of Object.keys(plan)) {
    if (!(plan[id]! > 0)) delete plan[id];
  }
  return plan;
}

/** Waking minutes in a day for a given nightly sleep target. */
export function wakingMinutes(sleepTargetMinutes: number): number {
  return 24 * 60 - sleepTargetMinutes;
}

/** Waking minutes per week (112 h = 6,720 min at the default 8 h of sleep). */
export function weeklyWakingMinutes(sleepTargetMinutes: number): number {
  return 7 * wakingMinutes(sleepTargetMinutes);
}

/**
 * Minutes of the day not yet assigned to any task or the buffer.
 * Negative means the day is over-planned; the planner should block saving it.
 */
export function unassignedMinutes(
  plan: DayPlan,
  bufferMinutes: number,
  sleepTargetMinutes: number,
): number {
  const planned = Object.values(plan).reduce((a, b) => a + b, 0);
  return wakingMinutes(sleepTargetMinutes) - bufferMinutes - planned;
}

/** Leisure always follows Flexible rules, whatever tier it was given. */
export function effectiveTier(task: Task): Tier {
  return task.kind === 'leisure' ? 'flexible' : task.tier;
}

const TIER_ORDER: Record<Tier, number> = { critical: 0, important: 1, flexible: 2 };

/** Sort tasks Critical → Important → Flexible, then by name. */
export function sortByTier<T extends Task>(tasks: T[]): T[] {
  return [...tasks].sort(
    (a, b) =>
      TIER_ORDER[effectiveTier(a)] - TIER_ORDER[effectiveTier(b)] || a.name.localeCompare(b.name),
  );
}
