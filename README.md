# Wakeworth

**Make every waking hour count.** 112 hours a week, spent on purpose.

Wakeworth is a weekly time budget for people who want to stop multitasking and
procrastinating. Each task gets a daily allowance, only one timer can run at a
time, unused time goes into a time bank, and a daily Focus Score (0–100) with
streaks shows how the week went.

## Status

| Part | State |
| --- | --- |
| `packages/core` — rules engine | Done: plan, time bank, borrowing, time debt, Focus Score, sleep, streaks, reminders (36 tests) |
| `apps/web` — React PWA | Next |
| `supabase/` — auth, database, sync, notifications | Next |
| `apps/mobile` — Expo app | Later |

## Repo layout

```
wakeworth/
  packages/core/   rules engine + tests (plain TypeScript, no dependencies)
  apps/web/        React PWA (coming)
  apps/mobile/     Expo app (later)
  supabase/        migrations, edge functions, seed data (coming)
  docs/            spec summary and decisions
```

## Getting started

Requires Node 20+.

```bash
npm install
npm test          # run the core test suite
npm run typecheck
```

## How the rules work

See [docs/SPEC.md](docs/SPEC.md) for the full summary. In short:

- **Tiers:** Critical, Important, Flexible. Leisure follows Flexible rules.
- **Time bank:** unused Important and Flexible time is banked when a task is
  marked done or the day closes. Unused Critical time is never banked; it counts
  as "Critical missed" unless the task was marked done early, which counts as
  complete.
- **Borrowing:** an overrun is paid from the bank, same tier first, then lower
  tiers. Important savings can't pay for Flexible tasks. What can't be paid
  becomes time debt. The bank and debt reset each week.
- **Focus Score:** `40·Critical + 25·Adherence + 20·Sleep + 15·Focus`. Manual
  entries count half.
- **Streaks:** days at 70+; one freeze per week; vacation days don't count.

## Core API at a glance

```ts
import { resolveDayPlan, computeBank, dayUsage, countSwitches, dailyScore, computeStreak } from '@wakeworth/core';

const plan = resolveDayPlan(template, overrides, '2026-11-16');
const bank = computeBank({ tasks, dates, plans, sessions, completions, dayEnds, now });
const score = dailyScore({
  tasks, plan,
  usage: dayUsage(sessions, '2026-11-16'),
  completedTaskIds: ['study'],
  debtMinutes: bank.byDate['2026-11-16'].debt,
  sleep, sleepTargetMinutes: 480, usualBedtime,
  switches: countSwitches(daySessions, completions),
});
```

All durations are minutes, instants are epoch milliseconds, and days are
`YYYY-MM-DD` strings in the user's local calendar. The app assigns sessions to
local days; the core does no time-zone math.
