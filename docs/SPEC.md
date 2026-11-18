# Wakeworth spec summary (v1)

The full product spec lives in the shared Claude doc "Wakeworth — Product Spec v1".
This file records the rules the code implements, so the repo is self-contained.

## Budget

- A week is 168 h. The user sets a sleep target (default 8 h/night); the rest is
  the waking budget (112 h at the default).
- Buckets: tasks, Leisure (planned free time), and Buffer (untimed slack;
  onboarding asks, suggesting 1.5 h/day).
- One template week repeats; date-specific overrides (vacations, one-offs) win
  over it. Week start: Monday by default, any day in settings.

## Tiers

| Tier | Meaning |
| --- | --- |
| Critical | Must happen; its time is protected |
| Important | Should happen; some flexibility |
| Flexible | Nice to have; fine to shorten. Leisure counts as Flexible |

## Timers

- One timer at a time across all devices (enforced by a unique index in the database).
- Tasks can run in several sessions a day; "Mark done" ends a task for the day.
- Check-in after allowance + 15 min, or a 2 h session; no answer in 10 min auto-pauses.
- Pauses over 20 min close the session.
- Forgotten time can be added by hand the same day or the next; it counts half in the score.

## Time bank

- Unused Important/Flexible time is banked when the task is marked done or the day closes.
- Unused Critical time is never banked; it is reported as "Critical missed".
- Overruns are paid from the bank, same tier first, then lower tiers:

  | Banked from | Pays Critical | Pays Important | Pays Flexible / Leisure |
  | --- | --- | --- | --- |
  | Important | Yes | Yes | No |
  | Flexible / Leisure | Yes | Yes | Yes, after a confirmation |

- A second "Are you sure?" when Flexible spending would leave < 30 min banked while
  a Critical task is unfinished.
- Unpaid overrun becomes time debt. No hard stop.
- Weekly balance = banked minutes left − time debt. Resets each week; history is kept.

## Focus Score (daily, 0–100)

`Score = 40·C + 25·A + 20·S + 15·F`

| Part | Measure (0–1) |
| --- | --- |
| C | Critical minutes done ÷ planned, each task capped at its plan |
| A | Important minutes done ÷ planned, − 0.04 per 5 min of time debt |
| S | 0.75 × (slept ÷ target, capped) + 0.25 if bedtime within ±45 min of usual |
| F | 1 − 0.15 per mid-task switch after the first 3 |

Bands: 85–100 Locked in · 70–84 On track · < 70 Off track.

## Streaks

Consecutive days at 70+. One freeze per week covers a single bad day. Vacation days
neither count nor break the streak.

## Sleep

Logged ("Going to sleep" / "I'm up", or times entered in the morning). Sleeping less
than the target is sleep debt and never adds waking hours.

## Reminders

Timer start · 5 min left · time's up · long-run check-in · pinned start (10 min before) ·
day running out (time to bedtime < 1.25 × unfinished Critical/Important time) · bedtime ·
weekly review.
