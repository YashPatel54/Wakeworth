import type { Session, Task } from '../src/index.js';

/** Monday 16 Nov 2026 is used as "today" throughout the tests. */
export const MON = '2026-11-16';
export const TUE = '2026-11-17';

const DAY_OFFSET: Record<string, number> = { [MON]: 16, [TUE]: 17 };

/** An instant on a test day, e.g. at(MON, 9, 30). */
export function at(date: string, h: number, m = 0): number {
  return Date.UTC(2026, 10, DAY_OFFSET[date]!, h, m);
}

let n = 0;
export function session(
  taskId: string,
  date: string,
  from: [number, number],
  to: [number, number],
  source: Session['source'] = 'timer',
): Session {
  return {
    id: `s${++n}`,
    taskId,
    date,
    start: at(date, from[0], from[1]),
    end: at(date, to[0], to[1]),
    source,
  };
}

export const tasks: Task[] = [
  { id: 'study', name: 'Studying', tier: 'critical' },
  { id: 'gym', name: 'Gym', tier: 'important' },
  { id: 'cook', name: 'Cooking & eating', tier: 'flexible' },
  { id: 'tv', name: 'Shows', tier: 'critical', kind: 'leisure' },
];
