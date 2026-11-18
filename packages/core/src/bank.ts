import { effectiveTier } from './plan.js';
import { minutesBetween } from './time.js';
import type { Completion, DayPlan, ISODate, Session, Task, Tier } from './types.js';

/**
 * The time bank.
 *
 * - Unused Important and Flexible time is banked, into a pool per tier, when the
 *   task is marked done or when its day closes.
 * - Unused Critical time is never banked. If the day closes without the task
 *   marked done, it is reported as "Critical missed"; marked done early, it isn't.
 * - Time spent past a task's allowance is paid from the bank: same tier first,
 *   then lower tiers. Whatever can't be paid becomes time debt.
 * - Everything is computed per week; the bank starts empty each week.
 */

export type Pool = 'important' | 'flexible';

/** Which pools may pay for an overrun of each tier, in the order they're drawn. */
export const BORROW_ORDER: Readonly<Record<Tier, readonly Pool[]>> = {
  critical: ['important', 'flexible'],
  important: ['important', 'flexible'],
  flexible: ['flexible'],
};

/** Can time banked from a `from` task pay for a `to` task? */
export function canPayFor(from: Tier, to: Tier): boolean {
  if (from === 'critical') return false; // Critical time is never banked.
  return BORROW_ORDER[to].includes(from);
}

/** Spending banked time on Flexible tasks or Leisure needs a confirmation. */
export function needsConfirmation(to: Tier): boolean {
  return to === 'flexible';
}

/** Below this many banked minutes left, Critical work is considered at risk. */
export const CRITICAL_RESERVE_MINUTES = 30;

/**
 * The second "Are you sure?": spending banked time on something Flexible while a
 * Critical task is unfinished and it would leave less than 30 min in the bank.
 */
export function needsSecondConfirmation(args: {
  toTier: Tier;
  minutes: number;
  balance: Record<Pool, number>;
  unfinishedCriticalToday: boolean;
}): boolean {
  if (args.toTier !== 'flexible' || !args.unfinishedCriticalToday) return false;
  const left = args.balance.important + args.balance.flexible - args.minutes;
  return left < CRITICAL_RESERVE_MINUTES;
}

export interface BankInput {
  tasks: Task[];
  /** The days to compute, in order — normally the seven days of one week. */
  dates: ISODate[];
  plans: Record<ISODate, DayPlan>;
  sessions: Session[];
  completions: Completion[];
  /**
   * When each day closes (normally the user's bedtime). Unused time on tasks
   * that weren't marked done is settled at this instant, once it has passed.
   */
  dayEnds: Record<ISODate, number>;
  now: number;
}

export type LedgerKind = 'deposit' | 'borrow' | 'debt';

export interface LedgerEntry {
  at: number;
  date: ISODate;
  taskId: string;
  tier: Tier;
  kind: LedgerKind;
  minutes: number;
  /** For deposits: the pool filled. For borrows: the pool drawn from. */
  pool?: Pool;
}

export interface DayBank {
  /** Minutes banked from tasks finished under their allowance. */
  saved: number;
  /** Overrun minutes paid from the bank. */
  borrowed: number;
  /** Overrun minutes the bank couldn't pay. */
  debt: number;
  /** Planned Critical minutes left unused on tasks not marked done. */
  criticalMissed: number;
}

export interface BankResult {
  entries: LedgerEntry[];
  /** What's left in each pool now. */
  balance: Record<Pool, number>;
  byDate: Record<ISODate, DayBank>;
  totals: DayBank;
  /** Banked minutes still available minus time debt: the one number on Home. */
  weeklyBalance: number;
}

interface PendingEvent {
  at: number;
  date: ISODate;
  taskId: string;
  tier: Tier;
  type: 'deposit' | 'withdraw';
  minutes: number;
}

const EPSILON = 1e-9;

export function computeBank(input: BankInput): BankResult {
  const taskById = new Map(input.tasks.map((t) => [t.id, t]));
  const events: PendingEvent[] = [];
  const byDate: Record<ISODate, DayBank> = {};

  for (const date of input.dates) {
    byDate[date] = { saved: 0, borrowed: 0, debt: 0, criticalMissed: 0 };
    const plan = input.plans[date] ?? {};
    const daySessions = input.sessions.filter((s) => s.date === date);
    const taskIds = new Set([...Object.keys(plan), ...daySessions.map((s) => s.taskId)]);
    const dayEnd = input.dayEnds[date];
    const dayClosed = dayEnd !== undefined && input.now >= dayEnd;

    for (const taskId of taskIds) {
      const task = taskById.get(taskId);
      if (!task) continue;
      const tier = effectiveTier(task);
      const planned = plan[taskId] ?? 0;
      const sessions = daySessions
        .filter((s) => s.taskId === taskId)
        .sort((a, b) => a.start - b.start);
      const completion = input.completions.find((c) => c.taskId === taskId && c.date === date);

      // Minutes spent before "Mark done" was tapped.
      const usedAtDone = completion
        ? sessions.reduce(
            (sum, s) => sum + minutesBetween(s.start, Math.min(s.end, completion.at)),
            0,
          )
        : null;

      // Overruns: anything past the allowance. After "Mark done" the allowance
      // shrinks to what had been used, so resuming the task is an overrun.
      let used = 0;
      for (const s of sessions) {
        const m = minutesBetween(s.start, s.end);
        const allowance =
          completion && usedAtDone !== null && s.start >= completion.at ? usedAtDone : planned;
        const over = Math.max(0, used + m - Math.max(used, allowance));
        used += m;
        if (over > EPSILON) {
          events.push({ at: s.end, date, taskId, tier, type: 'withdraw', minutes: over });
        }
      }

      // Settle unused time when the task is done or the day has closed.
      const settledAt = completion ? completion.at : dayClosed ? dayEnd! : null;
      if (settledAt === null || planned <= 0) continue;
      const unused = planned - (usedAtDone ?? used);
      if (unused <= EPSILON) continue;
      if (tier === 'critical') {
        // Finishing a Critical task early counts as complete: nothing is missed,
        // but the leftover time is still never banked.
        if (!completion) byDate[date]!.criticalMissed += unused;
      } else {
        events.push({ at: settledAt, date, taskId, tier, type: 'deposit', minutes: unused });
      }
    }
  }

  // Replay in time order; at the same instant, deposits land before withdrawals.
  events.sort((a, b) => a.at - b.at || (a.type === 'deposit' ? -1 : 1) - (b.type === 'deposit' ? -1 : 1));

  const balance: Record<Pool, number> = { important: 0, flexible: 0 };
  const entries: LedgerEntry[] = [];

  for (const ev of events) {
    const day = byDate[ev.date]!;
    const base = { at: ev.at, date: ev.date, taskId: ev.taskId, tier: ev.tier };
    if (ev.type === 'deposit') {
      const pool = ev.tier as Pool;
      balance[pool] += ev.minutes;
      day.saved += ev.minutes;
      entries.push({ ...base, kind: 'deposit', minutes: ev.minutes, pool });
      continue;
    }
    let remaining = ev.minutes;
    for (const pool of BORROW_ORDER[ev.tier]) {
      const take = Math.min(balance[pool], remaining);
      if (take <= EPSILON) continue;
      balance[pool] -= take;
      remaining -= take;
      day.borrowed += take;
      entries.push({ ...base, kind: 'borrow', minutes: take, pool });
    }
    if (remaining > EPSILON) {
      day.debt += remaining;
      entries.push({ ...base, kind: 'debt', minutes: remaining });
    }
  }

  const totals: DayBank = { saved: 0, borrowed: 0, debt: 0, criticalMissed: 0 };
  for (const d of Object.values(byDate)) {
    totals.saved += d.saved;
    totals.borrowed += d.borrowed;
    totals.debt += d.debt;
    totals.criticalMissed += d.criticalMissed;
  }

  return {
    entries,
    balance,
    byDate,
    totals,
    weeklyBalance: balance.important + balance.flexible - totals.debt,
  };
}
