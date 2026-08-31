# BUILDLOG — AI-usage log (honesty graded, not perfection)

Per capstone brief §3: "Use AI tools freely, but keep BUILDLOG.md honest: where AI helped, where it was wrong, what you changed."

## How to use this file

Append one section per work session (AI + human). For each AI-assisted step, note:
- **Where AI helped** — prompt/tool and what it generated
- **Where it was wrong** — what hallucination, missed edge, or broken code it produced
- **What you changed** — fix you applied, why, and a link to commit/PR

You must be able to explain any 2–3 lines the evaluator picks — "The AI wrote it" is not an answer.

## Template — copy per session

### YYYY-MM-DD — session topic (e.g., "Wayfinder #6 idempotency ADR")

- **Prompt:** "..."
- **AI output:** bullet list of generated files/sections
- **Wrong / corrected:** what you fixed before committing (e.g., "AI used FLOAT for money — replaced with micro-cents integer per ADR 0003")
- **Commit:** `abc1234` — link + 1-line diff summary

---

## Log

### 2026-08-31 — Wayfinder charting + research #3/#4 + provision #5 + grillings #6–#8 + prototypes #9–#10 + data model #11 + stretches #12–#17

- **AI helped:** Generated `docs/DESIGN.md` one-pager, `docs/research/*.md` syntheses via websearch/webfetch, Stripe sandbox `stripe sandbox create --from-git` recipe, `src/config/pricing.ts` integer math, prototype stubs, migrations, ADRs.
- **Where wrong:** Initial Docker port 5432 conflicted with host `postgresql-x64-18` — changed to `5433:5432` and `.env` 5433; `gh api` dependencies `issue_id` sent as string 422 — fell back to `Blocked by:` body convention; template literal `` `stripe.listen` `` inside JS backticks caused syntax error — fixed via PowerShell here-string.
- **Changed:** Switched to native `Blocked by:` fallback, updated `.gitignore` to keep `.env` ignored, proved `stripe listen --print-secret` whsec, seeded 2 tenants (Acme free, Globex pro).
- **Commits:** `87aa91a` design, `250e506`/`62f2c55` research branches, `5150ac2` STRIPE.md, `b18402d` ADR 0001, `5d6466b` ADR 0002, `20228a0` pricing+ADR 0003, `6335dec`/`c4eebd3` prototypes, `c9fb6d1` DB + `9154e20`→`237c402` stretch ADRs.

### 2026-08-31 — Fog graduation #18–#20

- **AI helped:** Auto-graduated remaining fog into 3 tickets (#18 job engine, #19 README/capstone.yaml, #20 BUILDLOG), drafted ADR 0010 node-cron vs BullMQ/pg-boss, ASCII diagram proposal, and this BUILDLOG template.
- **Where wrong:** Initially tried to keep stretch `Detailed spec slices` fog line after all stretches closed — corrected by removing line and marking `<!-- fog cleared -->`.
- **Changed:** Created `docs/adr/0010-job-engine-node-cron.md`, `docs/prototype/readme-capstone.md` on throwaway branch, and this file on main.
- **Commits:** `1235c38` job engine, `2cc735d` prototype branch, `...` BUILDLOG.

*(Add next sessions below)*

