/** Minutes before a timer runs out that the "5 minutes left" reminder fires. */
export const TIME_LEFT_WARNING_MINUTES = 5;
/** "Still going?" check-in this long past the allowance… */
export const OVERRUN_CHECKIN_MINUTES = 15;
/** …or after one session runs this long. */
export const LONG_SESSION_CHECKIN_MINUTES = 120;
/** No answer to a check-in within this long auto-pauses the timer. */
export const CHECKIN_TIMEOUT_MINUTES = 10;
/** A pause longer than this closes the session. */
export const PAUSE_CLOSES_SESSION_MINUTES = 20;

/**
 * "Day running out": fires when the time left before bedtime is less than
 * 1.25 × the unfinished Critical (or Important) time.
 */
export function isDayRunningOut(unfinishedMinutes: number, minutesUntilBedtime: number): boolean {
  return unfinishedMinutes > 0 && minutesUntilBedtime < 1.25 * unfinishedMinutes;
}

/** Should the running timer ask "Still going?" now? */
export function needsCheckIn(args: {
  usedTodayMinutes: number;
  allowanceMinutes: number;
  currentSessionMinutes: number;
}): boolean {
  return (
    args.usedTodayMinutes >= args.allowanceMinutes + OVERRUN_CHECKIN_MINUTES ||
    args.currentSessionMinutes >= LONG_SESSION_CHECKIN_MINUTES
  );
}
