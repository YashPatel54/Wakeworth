import { describe, expect, it } from 'vitest';
import {
  canPayFor,
  computeBank,
  needsConfirmation,
  needsSecondConfirmation,
  type BankInput,
} from '../src/index.js';
import { MON, TUE, at, session, tasks } from './helpers.js';

function bank(overrides: Partial<BankInput>) {
  return computeBank({
    tasks,
    dates: [MON, TUE],
    plans: {},
    sessions: [],
    completions: [],
    dayEnds: { [MON]: at(MON, 23), [TUE]: at(TUE, 23) },
    now: at(MON, 22),
    ...overrides,
  });
}

describe('borrowing rules', () => {
  it('follows the spec matrix', () => {
    expect(canPayFor('critical', 'critical')).toBe(false);
    expect(canPayFor('critical', 'flexible')).toBe(false);
    expect(canPayFor('important', 'critical')).toBe(true);
    expect(canPayFor('important', 'important')).toBe(true);
    expect(canPayFor('important', 'flexible')).toBe(false);
    expect(canPayFor('flexible', 'critical')).toBe(true);
    expect(canPayFor('flexible', 'important')).toBe(true);
    expect(canPayFor('flexible', 'flexible')).toBe(true);
  });

  it('asks for confirmation only when spending on Flexible', () => {
    expect(needsConfirmation('flexible')).toBe(true);
    expect(needsConfirmation('important')).toBe(false);
    expect(needsConfirmation('critical')).toBe(false);
  });

  it('asks again when Flexible spending would leave under 30 min with Critical unfinished', () => {
    const balance = { important: 20, flexible: 40 };
    expect(
      needsSecondConfirmation({ toTier: 'flexible', minutes: 40, balance, unfinishedCriticalToday: true }),
    ).toBe(true);
    expect(
      needsSecondConfirmation({ toTier: 'flexible', minutes: 20, balance, unfinishedCriticalToday: true }),
    ).toBe(false);
    expect(
      needsSecondConfirmation({ toTier: 'flexible', minutes: 40, balance, unfinishedCriticalToday: false }),
    ).toBe(false);
  });
});

describe('computeBank', () => {
  it('banks Flexible time saved early and spends it on a Critical overrun, rest is debt', () => {
    const r = bank({
      plans: { [MON]: { study: 60, cook: 60 } },
      sessions: [session('cook', MON, [9, 0], [9, 40]), session('study', MON, [10, 0], [11, 30])],
      completions: [{ taskId: 'cook', date: MON, at: at(MON, 9, 40) }],
    });
    expect(r.byDate[MON]).toEqual({ saved: 20, borrowed: 20, debt: 10, criticalMissed: 0 });
    expect(r.balance).toEqual({ important: 0, flexible: 0 });
    expect(r.weeklyBalance).toBe(-10);
  });

  it('never banks unused Critical time; it is reported as missed', () => {
    const r = bank({
      plans: { [MON]: { study: 120 } },
      sessions: [session('study', MON, [9, 0], [10, 0])],
      now: at(TUE, 1),
    });
    expect(r.byDate[MON]!.criticalMissed).toBe(60);
    expect(r.totals.saved).toBe(0);
    expect(r.balance).toEqual({ important: 0, flexible: 0 });
  });

  it('counts a Critical task marked done early as complete: nothing missed, nothing banked', () => {
    const r = bank({
      plans: { [MON]: { study: 180 } },
      sessions: [session('study', MON, [9, 0], [11, 0])],
      completions: [{ taskId: 'study', date: MON, at: at(MON, 11, 0) }],
      now: at(TUE, 1),
    });
    expect(r.byDate[MON]).toEqual({ saved: 0, borrowed: 0, debt: 0, criticalMissed: 0 });
    expect(r.balance).toEqual({ important: 0, flexible: 0 });
  });

  it('does not let Important savings pay for Leisure', () => {
    const r = bank({
      plans: { [MON]: { gym: 60, tv: 30 } },
      sessions: [session('gym', MON, [7, 0], [7, 30]), session('tv', MON, [20, 0], [21, 0])],
      completions: [{ taskId: 'gym', date: MON, at: at(MON, 7, 30) }],
    });
    expect(r.balance.important).toBe(30);
    expect(r.byDate[MON]!.debt).toBe(30);
    expect(r.byDate[MON]!.borrowed).toBe(0);
  });

  it('cannot borrow time that has not been saved yet', () => {
    const r = bank({
      plans: { [MON]: { study: 60, cook: 60 } },
      sessions: [session('study', MON, [8, 0], [9, 30]), session('cook', MON, [11, 0], [11, 30])],
      completions: [{ taskId: 'cook', date: MON, at: at(MON, 12, 0) }],
    });
    expect(r.byDate[MON]!.debt).toBe(30);
    expect(r.balance.flexible).toBe(30);
  });

  it('waits until the day closes before banking an unfinished task', () => {
    const plans = { [MON]: { cook: 60 } };
    const sessions = [session('cook', MON, [12, 0], [12, 30])];
    expect(bank({ plans, sessions, now: at(MON, 22) }).totals.saved).toBe(0);
    expect(bank({ plans, sessions, now: at(MON, 23) }).totals.saved).toBe(30);
  });

  it('treats resuming a task after "Mark done" as an overrun', () => {
    const r = bank({
      plans: { [MON]: { cook: 60 } },
      sessions: [session('cook', MON, [9, 0], [9, 30]), session('cook', MON, [13, 0], [13, 10])],
      completions: [{ taskId: 'cook', date: MON, at: at(MON, 9, 30) }],
    });
    expect(r.byDate[MON]).toMatchObject({ saved: 30, borrowed: 10, debt: 0 });
    expect(r.balance.flexible).toBe(20);
  });

  it('carries the bank from one day to the next within the week', () => {
    const r = bank({
      plans: { [MON]: { gym: 90 }, [TUE]: { study: 60 } },
      sessions: [session('gym', MON, [7, 0], [8, 0]), session('study', TUE, [9, 0], [10, 20])],
      completions: [{ taskId: 'gym', date: MON, at: at(MON, 8, 0) }],
      now: at(TUE, 12),
    });
    expect(r.byDate[MON]!.saved).toBe(30);
    expect(r.byDate[TUE]).toMatchObject({ borrowed: 20, debt: 0 });
    expect(r.balance.important).toBe(10);
    expect(r.weeklyBalance).toBe(10);
  });

  it('charges time on an unplanned task entirely as overrun', () => {
    const r = bank({ sessions: [session('cook', MON, [12, 0], [12, 45])] });
    expect(r.byDate[MON]!.debt).toBe(45);
  });
});
