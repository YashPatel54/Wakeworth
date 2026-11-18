import { describe, expect, it } from 'vitest';
import { bandFor, dailyScore, type ScoreInput } from '../src/index.js';
import { MON, tasks } from './helpers.js';

const goodSleep = { date: MON, minutesSlept: 480, bedtimeMinuteOfDay: 23 * 60 };

function score(overrides: Partial<ScoreInput>) {
  return dailyScore({
    tasks,
    plan: { study: 180, gym: 60 },
    usage: { study: { timer: 180, manual: 0 }, gym: { timer: 60, manual: 0 } },
    debtMinutes: 0,
    sleep: goodSleep,
    sleepTargetMinutes: 480,
    usualBedtime: 23 * 60,
    switches: 0,
    ...overrides,
  });
}

describe('dailyScore', () => {
  it('gives 100 for a perfect day', () => {
    const r = score({});
    expect(r).toMatchObject({ critical: 1, adherence: 1, sleep: 1, focus: 1, score: 100, band: 'locked-in' });
  });

  it('counts manual minutes at half weight', () => {
    const r = score({ usage: { study: { timer: 0, manual: 180 }, gym: { timer: 60, manual: 0 } } });
    expect(r.critical).toBe(0.5);
    expect(r.score).toBe(80);
  });

  it('counts a Critical task marked done early as complete', () => {
    const usage = { study: { timer: 120, manual: 0 }, gym: { timer: 60, manual: 0 } };
    expect(score({ usage }).critical).toBeCloseTo(2 / 3);
    expect(score({ usage, completedTaskIds: ['study'] }).critical).toBe(1);
  });

  it('does not treat "done" as complete for Important tasks', () => {
    const r = score({
      usage: { study: { timer: 180, manual: 0 }, gym: { timer: 30, manual: 0 } },
      completedTaskIds: ['gym'],
    });
    expect(r.adherence).toBe(0.5);
  });

  it('caps each task at its plan so one task cannot cover another', () => {
    const r = score({
      tasks: [...tasks, { id: 'work', name: 'Work', tier: 'critical' }],
      plan: { study: 60, work: 60, gym: 60 },
      usage: { study: { timer: 120, manual: 0 }, gym: { timer: 60, manual: 0 } },
    });
    expect(r.critical).toBe(0.5);
  });

  it('takes 0.04 off adherence per 5 minutes of time debt', () => {
    expect(score({ debtMinutes: 14 }).adherence).toBeCloseTo(0.92);
    expect(score({ debtMinutes: 200 }).adherence).toBe(0);
  });

  it('scores sleep by duration and bedtime consistency', () => {
    expect(score({ sleep: { ...goodSleep, minutesSlept: 360 } }).sleep).toBeCloseTo(0.8125);
    expect(score({ sleep: { ...goodSleep, bedtimeMinuteOfDay: 60 } }).sleep).toBe(0.75);
    expect(score({ sleep: null }).sleep).toBe(0);
  });

  it('allows 3 free switches, then takes 0.15 each', () => {
    expect(score({ switches: 3 }).focus).toBe(1);
    expect(score({ switches: 5 }).focus).toBeCloseTo(0.7);
    expect(score({ switches: 20 }).focus).toBe(0);
  });

  it('treats a tier with nothing planned as complete', () => {
    const r = score({ plan: {}, usage: {} });
    expect(r.critical).toBe(1);
    expect(r.adherence).toBe(1);
  });

  it('ignores Leisure when scoring Critical', () => {
    const r = score({ plan: { study: 60, tv: 60 }, usage: { study: { timer: 60, manual: 0 } } });
    expect(r.critical).toBe(1);
  });
});

describe('bandFor', () => {
  it('maps scores to bands', () => {
    expect(bandFor(85)).toBe('locked-in');
    expect(bandFor(84)).toBe('on-track');
    expect(bandFor(70)).toBe('on-track');
    expect(bandFor(69)).toBe('off-track');
  });
});
