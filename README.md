# Fadel Diène — API-First Profile Engine

Bun + Elysia monorepo serving an i18n (EN/FR/DE), role-aware résumé.
`fdiene.com` (Astro/Vue) consumes `api.fdiene.com` (Elysia) with end-to-end
types via Eden.

## Quick start
```bash
bun install
bun test
bun run api:dev              # http://localhost:3000  (/swagger)
bun --cwd=apps/web run dev   # http://localhost:4321
```

> Note: use the `--cwd=<dir>` (equals) form, not `--cwd <dir>` (space) — on
> Bun 1.3.14, the space form silently no-ops instead of changing directory.

## Data pipeline

`data/master_data.fr.json` is the hand-authored EN+FR source of truth.
`data/master_data.i18n.json` (the file the API actually serves) is a
generated artifact — it was produced offline and is committed so the API
can run without calling out to Anthropic at request time. Regenerate it
any time the source data changes:

```bash
# edit data/master_data.fr.json (EN+FR), then:
ANTHROPIC_API_KEY=... bun run translate   # → data/master_data.i18n.json
```

The generation script (`scripts/generate-translations.ts`) is idempotent:
re-running it with unchanged source data reproduces the same output.

## Private career advisor (output git-ignored)
```bash
ANTHROPIC_API_KEY=... bun scripts/career-advisor.ts          # → docs/career_insights.md
```

## Environment variables
| Var | Where | Purpose |
|-----|-------|---------|
| `ANTHROPIC_API_KEY` | scripts (build-time) | translation + advisor |
| `GITHUB_TOKEN` | api | metrics commit count |
| `GITHUB_REPO` | api | `owner/repo` for metrics |
| `WEB_ORIGIN` | api | CORS allow-origin (prod `https://fdiene.com`) |
| `PUBLIC_API_URL` | web | API base URL |
| `UPTIME_PCT` | api | reported uptime |
| `PORT` | api | listen port (default `3000`) |

None of these are committed to git — populate them via your shell, a local
`.env` (git-ignored), or the deploy environment's secret store.

## Deploy
- **web:** `bun --cwd=apps/web run build` → publish `apps/web/dist` to the CDN (`fdiene.com`), set `PUBLIC_API_URL=https://api.fdiene.com`.
- **api:** on the VPS, `docker compose -f infra/docker-compose.yml up -d --build` (joins the external `traefik` network; TLS via Let's Encrypt).
