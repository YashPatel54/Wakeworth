import { effectiveTier } from './plan.js';
import { isBedtimeConsistent } from './sleep.js';
import type { TaskUsage } from './usage.js';
import type { DayPlan, SleepLog, Task, Tier } from './types.js';

/**
 * Daily Focus Score, 0–100:
 *
 *   Score = 40·C + 25·A + 20·S + 15·F
 *
 * C  Critical completed   Critical minutes done ÷ planned (each task capped at its plan;
 *                         a Critical task marked done counts as complete)
 * A  Plan adherence       Important minutes done ÷ planned − 0.04 per 5 min of time debt
 * S  Sleep                0.75 × (slept ÷ target, capped) + 0.25 if bedtime was consistent
 * F  Focus quality        1 − 0.15 per mid-task switch after the first 3
 *
 * Minutes entered by hand count half, so editing can't inflate the score.
 */

export const WEIGHTS = { critical: 40, adherence: 25, sleep: 20, focus: 15 } as const;
export const MANUAL_WEIGHT = 0.5;
export const DEBT_PENALTY_PER_5_MIN = 0.04;
export const FREE_SWITCHES = 3;
export const SWITCH_PENALTY = 0.15;

export type Band = 'locked-in' | 'on-track' | 'off-track';

export interface ScoreInput {
  tasks: Task[];
  plan: DayPlan;
  usage: Record<string, TaskUsage>;
  /** Tasks marked done on this day. A Critical task marked done counts as complete. */
  completedTaskIds?: string[];
  /** Time debt created on this day, in minutes. */
  debtMinutes: number;
  sleep: SleepLog | null;
  sleepTargetMinutes: number;
  usualBedtime: number | null;
  switches: number;
}

export interface ScoreBreakdown {
  /** Each part 0–1. */
  critical: number;
  adherence: number;
  sleep: number;
  focus: number;
  score: number;
  band: Band;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * Weighted minutes done ÷ minutes planned for one tier; 1 if nothing was planned.
 * Critical tasks marked done count as fully complete, whatever time they took.
 */
export function tierCompletion(
  tier: Tier,
  tasks: Task[],
  plan: DayPlan,
  usage: Record<string, TaskUsage>,
  completedTaskIds: readonly string[] = [],
): number {
  let planned = 0;
  let done = 0;
  for (const task of tasks) {
    const p = plan[task.id] ?? 0;
    if (p <= 0 || effectiveTier(task) !== tier) continue;
    planned += p;
    if (tier === 'critical' && completedTaskIds.includes(task.id)) {
      done += p;
      continue;
    }
    const u = usage[task.id];
    const weighted = u ? u.timer + MANUAL_WEIGHT * u.manual : 0;
    done += Math.min(p, weighted);
  }
  return planned > 0 ? done / planned : 1;
}

export function sleepPart(
  sleep: SleepLog | null,
  targetMinutes: number,
  usualBedtime: number | null,
): number {
  if (!sleep) return 0;
  const duration = 0.75 * clamp01(sleep.minutesSlept / targetMinutes);
  const consistency = isBedtimeConsistent(sleep.bedtimeMinuteOfDay, usualBedtime) ? 0.25 : 0;
  return duration + consistency;
}

export function focusPart(switches: number): number {
  return clamp01(1 - SWITCH_PENALTY * Math.max(0, switches - FREE_SWITCHES));
}

export function adherencePart(importantCompletion: number, debtMinutes: number): number {
  const penalty = DEBT_PENALTY_PER_5_MIN * Math.floor(debtMinutes / 5);
  return clamp01(importantCompletion - penalty);
}

export function bandFor(score: number): Band {
  if (score >= 85) return 'locked-in';
  if (score >= 70) return 'on-track';
  return 'off-track';
}

export function dailyScore(input: ScoreInput): ScoreBreakdown {
  const critical = tierCompletion(
    'critical',
    input.tasks,
    input.plan,
    input.usage,
    input.completedTaskIds,
  );
  const adherence = adherencePart(
    tierCompletion('important', input.tasks, input.plan, input.usage),
    input.debtMinutes,
  );
  const sleep = sleepPart(input.sleep, input.sleepTargetMinutes, input.usualBedtime);
  const focus = focusPart(input.switches);
  const score = Math.round(
    WEIGHTS.critical * critical +
      WEIGHTS.adherence * adherence +
      WEIGHTS.sleep * sleep +
      WEIGHTS.focus * focus,
  );
  return { critical, adherence, sleep, focus, score, band: bandFor(score) };
}
