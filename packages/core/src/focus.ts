import type { Completion, Session } from './types.js';

/** A new timer starting within this long of the last one ending is a switch. */
export const SWITCH_GAP_MS = 60_000;

/**
 * Mid-task switches on one day: the user stopped an unfinished task and started
 * a different one straight away ("Pause Cooking and start Studying?").
 * Finishing a task first, or taking a break before the next one, isn't a switch.
 * Only timer sessions count; pass the sessions of a single day.
 */
export function countSwitches(sessions: Session[], completions: Completion[]): number {
  const timed = sessions.filter((s) => s.source === 'timer').sort((a, b) => a.start - b.start);
  let switches = 0;
  for (let i = 0; i + 1 < timed.length; i++) {
    const a = timed[i]!;
    const b = timed[i + 1]!;
    if (a.taskId === b.taskId) continue;
    if (b.start - a.end > SWITCH_GAP_MS) continue;
    const finished = completions.some(
      (c) => c.taskId === a.taskId && c.date === a.date && c.at <= b.start,
    );
    if (!finished) switches++;
  }
  return switches;
}
