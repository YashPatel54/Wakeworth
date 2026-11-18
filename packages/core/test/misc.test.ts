import { describe, expect, it } from 'vitest';
import {
  computeStreak,
  countSwitches,
  isBedtimeConsistent,
  isDayRunningOut,
  needsCheckIn,
  resolveDayPlan,
  sleepDebtMinutes,
  startOfWeek,
  unassignedMinutes,
  usualBedtime,
  weekDates,
  weeklyWakingMinutes,
} from '../src/index.js';
import { MON, at, session } from './helpers.js';

describe('weeks', () => {
  it('starts weeks on the chosen day', () => {
    expect(startOfWeek('2026-11-19', 1)).toBe('2026-11-16'); // Thu → Mon
    expect(startOfWeek('2026-11-19', 0)).toBe('2026-11-15'); // Thu → Sun
    expect(weekDates('2026-11-22', 1)).toEqual([
      '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22',
    ]);
  });
});

describe('plans', () => {
  const template = [
    { taskId: 'work', weekday: 1 as const, minutes: 480 },
    { taskId: 'gym', weekday: 1 as const, minutes: 90 },
    { taskId: 'gym', weekday: 3 as const, minutes: 90 },
  ];

  it('uses the template for the weekday', () => {
    expect(resolveDayPlan(template, [], MON)).toEqual({ work: 480, gym: 90 });
    expect(resolveDayPlan(template, [], '2026-11-17')).toEqual({});
  });

  it('lets a date override win, and drops tasks set to 0', () => {
    const overrides = [
      { date: MON, taskId: 'work', minutes: 0 },
      { date: MON, taskId: 'leisure', minutes: 300 },
    ];
    expect(resolveDayPlan(template, overrides, MON)).toEqual({ gym: 90, leisure: 300 });
  });

  it('gives 112 waking hours a week at 8 h of sleep', () => {
    expect(weeklyWakingMinutes(480)).toBe(112 * 60);
  });

  it('reports unassigned minutes after tasks and buffer', () => {
    expect(unassignedMinutes({ work: 480, gym: 90 }, 90, 480)).toBe(960 - 90 - 570);
  });
});

describe('sleep', () => {
  it('finds the usual bedtime across midnight', () => {
    expect(usualBedtime([23 * 60, 30, 23 * 60 + 30])).toBe(23 * 60 + 30);
    expect(usualBedtime([])).toBeNull();
  });

  it('checks consistency within 45 minutes, across midnight', () => {
    expect(isBedtimeConsistent(15, 23 * 60 + 45)).toBe(true);
    expect(isBedtimeConsistent(60, 23 * 60)).toBe(false);
    expect(isBedtimeConsistent(60, null)).toBe(true);
  });

  it('adds up sleep debt without letting extra sleep offset it', () => {
    const logs = [
      { date: MON, minutesSlept: 360, bedtimeMinuteOfDay: 0 },
      { date: MON, minutesSlept: 600, bedtimeMinuteOfDay: 0 },
    ];
    expect(sleepDebtMinutes(logs, 480)).toBe(120);
  });
});

describe('countSwitches', () => {
  it('counts only direct switches away from unfinished tasks', () => {
    const sessions = [
      session('cook', MON, [9, 0], [9, 20]),
      session('study', MON, [9, 20], [10, 0]), // switch: cook unfinished
      session('gym', MON, [10, 0], [11, 0]), // not a switch: study marked done
      session('cook', MON, [13, 0], [13, 30]), // not a switch: long break first
      session('study', MON, [13, 30], [14, 0], 'manual'), // manual entries don't count
    ];
    const completions = [{ taskId: 'study', date: MON, at: at(MON, 10, 0) }];
    expect(countSwitches(sessions, completions)).toBe(1);
  });
});

describe('computeStreak', () => {
  it('extends on 70+, skips vacation, uses one freeze a week, then resets', () => {
    const r = computeStreak(
      [
        { date: '2026-11-16', score: 80 },
        { date: '2026-11-17', score: 75 },
        { date: '2026-11-18', score: 50 }, // frozen
        { date: '2026-11-19', score: 90, vacation: true },
        { date: '2026-11-20', score: 88 },
        { date: '2026-11-21', score: 40 }, // second bad day this week → reset
        { date: '2026-11-22', score: 72 },
      ],
      1,
    );
    expect(r).toEqual({ current: 1, best: 3, frozen: ['2026-11-18'] });
  });

  it('gives a fresh freeze each week', () => {
    const r = computeStreak(
      [
        { date: '2026-11-21', score: 80 },
        { date: '2026-11-22', score: 30 }, // week of 16 Nov
        { date: '2026-11-23', score: 30 }, // week of 23 Nov
        { date: '2026-11-24', score: 80 },
      ],
      1,
    );
    expect(r.current).toBe(2);
    expect(r.frozen).toEqual(['2026-11-22', '2026-11-23']);
  });
});

describe('reminders', () => {
  it('flags the day running out at 1.25× the unfinished time', () => {
    expect(isDayRunningOut(180, 200)).toBe(true);
    expect(isDayRunningOut(180, 225)).toBe(false);
    expect(isDayRunningOut(0, 10)).toBe(false);
  });

  it('checks in 15 min past the allowance or after a 2 h session', () => {
    expect(needsCheckIn({ usedTodayMinutes: 75, allowanceMinutes: 60, currentSessionMinutes: 30 })).toBe(true);
    expect(needsCheckIn({ usedTodayMinutes: 70, allowanceMinutes: 60, currentSessionMinutes: 30 })).toBe(false);
    expect(needsCheckIn({ usedTodayMinutes: 120, allowanceMinutes: 300, currentSessionMinutes: 120 })).toBe(true);
  });
});
