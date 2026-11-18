import { minutesBetween } from './time.js';
import type { ISODate, Session } from './types.js';

export interface TaskUsage {
  timer: number;
  manual: number;
}

/** Minutes spent per task on `date`, split by how they were recorded. */
export function dayUsage(sessions: Session[], date: ISODate): Record<string, TaskUsage> {
  const usage: Record<string, TaskUsage> = {};
  for (const s of sessions) {
    if (s.date !== date) continue;
    const u = (usage[s.taskId] ??= { timer: 0, manual: 0 });
    u[s.source] += minutesBetween(s.start, s.end);
  }
  return usage;
}

export function totalMinutes(u: TaskUsage | undefined): number {
  return u ? u.timer + u.manual : 0;
}
