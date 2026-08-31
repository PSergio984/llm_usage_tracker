# Job engine — node-cron + pg advisory locks (not BullMQ/pg-boss)

Beyond the 5-min spec, alerts (80/100%) and reconciliation (nightly 2am) run as `node-cron` (`*/5 * * * *` and `0 2 * * *`) inside the Node process, with `pg` advisory locks `pg_try_advisory_xact_lock` to ensure single runner per period and a `job_runs(id, name, started_at, finished_at, status, error)` table for retries + failure alert surfaced via `GET /health` (req #3). Delivery stays console + in-app flag in `GET /usage` (phase1) behind `Notifier` interface; email adapter is stubbed for later without SendGrid creds. Chosen over BullMQ (needs Redis — violates $0 stack) and over pg-boss (extra dependency, heavier operational surface for capstone's leanest build); node-cron is zero-infra, deterministic in `npm test` via fake timers, and satisfies "slow work off request path with retries + failure alert" with minimal code. If alerts need email later, swap `Notifier` to `nodemailer` without changing job engine.

## Considered Options

- **BullMQ + Redis:** requires Redis — extra $0 infra and not needed for 5-min/2am cadence.
- **pg-boss:** Postgres-backed but adds polling table and complexity beyond capstone's 30–45h lean scope.
- **Synchronous in handler:** couples request path to notification latency, violates layered principle.

## Consequences

- No extra containers beyond Postgres; `job_runs` dedup per period via unique `(name, date_trunc)`; failures logged and health reflects last run.
