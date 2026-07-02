# Profile Engine — API-First Résumé System — Design

- **Date:** 2026-07-02
- **Owner:** Fadel Diène
- **Status:** Approved (design), pending spec review → implementation plan
- **Domain (target):** `fdiene.com` (web) + `api.fdiene.com` (API)

## 1. Purpose & Context

Transform existing CV PDFs (EN + FR) and the LinkedIn export into a dynamic,
internationalized (EN/FR/DE), context-aware **API-First Profile Engine**. The
system is itself a portfolio artifact: it must *demonstrate* system-engineering
skill (DevSecOps, API design, DX) to an Anthropic-style technical audience.

A recruiter opens a link such as `https://fdiene.com/?role=anthropic&lang=en`;
the view adapts instantly — reordering projects and swapping the executive
summary to match the reader's context.

### Source assets (already on disk)
- `_archives/CV_pdf/CV_2026-01-01_FADEL_DIÈNE_ENG.pdf` (EN)
- `_archives/CV_pdf/CV_2026-05-05_FADEL_DIÈNE.pdf` (FR)
- `_archives/Basic_LinkedInDataExport_07-01-2026.zip/Profile.csv`
- `_archives/Basic_LinkedInDataExport_07-01-2026.zip/Recommendations_Given.csv`
- `_archives/Pics/*.jpg` (profile photos)

### Key locked decisions
| Decision | Choice | Rationale |
|---|---|---|
| Runtime/stack | **Bun + Elysia (TypeScript)** | Fills "alternative runtime" gap in the Anthropic backlog; end-to-end type safety via Eden; auto-Swagger satisfies the "API-First" concept. |
| i18n | **Curated static, DE pre-translated offline** | Tier-1 data: no runtime LLM (determinism/safety), sub-ms latency. AI used shift-left in the build pipeline. |
| Project data | **Draft SEOmnix + ops-tools from context; Omnis-Agri = DRAFT stub** | Never invent; Omnis-Agri brief to be supplied by owner. |
| Metrics | **Hybrid** | Live self-latency + live GitHub commits (cached) + config uptime. |
| Deployment | **Split**: web on Edge CDN (`fdiene.com`), API on VPS (`api.fdiene.com`) behind **Traefik** + Let's Encrypt via Docker Compose | Matches existing SEOMNIX infra; showcases CORS/web-security fundamentals. |

## 2. Architecture Overview

Bun + Turborepo monorepo (mirrors the FluxGuard layout):

```
my-curriculum/
├─ apps/
│  ├─ api/                 # Bun + Elysia backend (api.fdiene.com)
│  └─ web/                 # Astro + Vue "terminal" frontend (fdiene.com)
├─ packages/
│  └─ schema/              # @profile/schema — Zod schemas + inferred TS types (SSOT)
├─ data/
│  ├─ master_data.fr.json  # canonical (EN+FR from the 2 CVs) — source of truth
│  └─ master_data.i18n.json# generated EN+FR+DE, schema-validated (API loads THIS)
├─ scripts/
│  ├─ ingest/              # (optional) PDF/CSV → master_data.fr.json helpers
│  └─ generate-translations.ts  # Anthropic SDK, OFFLINE, fills missing DE
├─ infra/
│  └─ docker-compose.yml   # Bun API container + Traefik labels + Let's Encrypt
└─ docs/superpowers/specs/ # this design
```

**Data flow:**
`CVs/LinkedIn → (ETL) master_data.fr.json → (generate-translations, offline) master_data.i18n.json → API loads validated JSON → role-routing + locale-resolution at request time → Eden-typed client → Astro view`.

**Critical DX property:** `packages/schema` is imported by *both* API and web.
The API exports its Eden `treaty` type so the frontend gets end-to-end type
safety with zero contract duplication.

### Unit boundaries
- `packages/schema` — pure types + Zod validators. No IO. Depends on nothing.
- `apps/api` — HTTP + routing/locale/metrics logic. Depends on `schema` + data JSON.
- `apps/web` — presentation only. Depends on `schema` + Eden client type.
- `scripts/generate-translations.ts` — offline build tool. Depends on `schema` + Anthropic SDK. Never imported by the API.

## 3. Data Model (`packages/schema`, Zod)

- **`LocalizedString = z.object({ en, fr, de }).strict()`** — all human-readable
  fields. No optionals: a missing DE value **fails validation at build**, not at
  runtime. This enforces the determinism requirement.
- **`Tag`** enum: `ai_safety`, `dx_tooling`, `devsecops`, `iot`, `edge`, `plm`,
  `cloud`, `security`, `api_design`, `mlops`, `aerospace` (extensible).
- **`TargetRole`** enum: `anthropic_dx`, `iot`, `plm_architect`, `default`.
- **`ExperienceSchema`**: `id, role(Localized), org, location, period{start, end|null}, summary(Localized), highlights(Localized[]), tags[], domain`.
- **`ProjectSchema`**: `id, name, tagline(Localized), description(Localized), stack[], tags[], links{repo?, demo?}, metrics?, status("live"|"draft"), featured_for(TargetRole[])`.
- **`SkillSchema`**: `id, label, category, level(1–5), tags[]`.
- **`CertificationSchema`** / **`EducationSchema`**: `title(Localized), org, location, period`.
- **`RecommendationSchema`**: `author, title, company, text(Localized), date`.
- **`ResumeSchema`** (root): `person, executiveSummaries: Record<TargetRole, Localized>, experiences[], projects[], skills[], certifications[], education[], recommendations[]`.

All inferred TS types (`type Resume = z.infer<typeof ResumeSchema>`, etc.) are
exported from `@profile/schema`.

## 4. Role-Routing & Locale Logic

**Locale resolution** (pure, fail-safe): `?lang` query → `Accept-Language`
header → `'en'`. A `localize(node, lang)` walker recursively collapses every
`LocalizedString` to a plain string for the response payload.

**Role routing** (`/v1/profile/build`): each `TargetRole` maps to a
**tag-weight vector**, e.g.:

```
anthropic_dx → { ai_safety: 10, dx_tooling: 9, devsecops: 6, api_design: 5 }
iot          → { iot: 10, edge: 9, ai_safety: 5, devsecops: 4 }
plm_architect→ { plm: 10, cloud: 7, security: 6, aerospace: 5 }
```

Affinity score for each project/experience = Σ(weights of matching tags).
Lists are **stably sorted** by descending score (ties keep source order), so
`ops-tools` + `SEOMNIX Evals` rank first for `anthropic_dx`, `Omnis-Agri` first
for `iot`. The role also selects `executiveSummaries[role]`. Unknown role →
`default`.

## 5. Endpoints (Elysia, auto-Swagger at `/swagger`)

| Route | Purpose |
|---|---|
| `GET /v1/profile/build?target_role=&lang=` | Full role-tuned, localized résumé |
| `GET /v1/skills?lang=&tag=` | Localized skills, optional tag filter |
| `GET /v1/projects?lang=&role=` | Localized, role-ordered projects |
| `GET /v1/metrics` | Hybrid: live self-latency + live GitHub commits (cached, `GITHUB_TOKEN`) + config uptime |
| `GET /health` | Liveness for Traefik |

**CORS:** strict allowlist — `https://fdiene.com` in prod, `http://localhost:*`
in dev.

## 6. Offline Translation Pipeline (`scripts/generate-translations.ts`)

Bun script using `@anthropic-ai/sdk`:
1. Read `data/master_data.fr.json`.
2. Walk every `LocalizedString`; for any **missing** locale (primarily `de`),
   batch-call Claude with a strict prompt: *translate only, preserve technical
   terms/proper nouns, return valid JSON matching the input shape*.
3. Merge, then **validate the whole object against `ResumeSchema`** before
   writing `data/master_data.i18n.json`.
4. Idempotent — already-filled locales are skipped; re-runnable safely.

Model: `claude-opus-4-8` (or a cheaper alias chosen at build time).
**Never** invoked at request time.

## 7. Metrics Sourcing (Hybrid)

- **Response time:** Elysia middleware records per-request latency; `/v1/metrics`
  reports a rolling summary (self-referential, free).
- **Commits:** GitHub REST API, authenticated via `GITHUB_TOKEN`, results cached
  in-memory with a TTL to respect rate limits.
- **Uptime:** read from a config/status value (deploy-provided), not a live
  external monitor, to avoid an extra dependency and secret.

## 8. Deployment Topology

- **web** → static Astro build on an Edge CDN at `fdiene.com`.
- **api** → Hostinger VPS at `api.fdiene.com`, containerized via
  `infra/docker-compose.yml` with **Traefik labels** (router rule for
  `api.fdiene.com`, Let's Encrypt cert resolver), joining the existing SEOMNIX
  Traefik network.
- Deliverables: compose snippet + Traefik labels + Elysia CORS config.
- **Secrets** documented as env vars in README (`ANTHROPIC_API_KEY` for build,
  `GITHUB_TOKEN` for metrics). No secrets committed to git.

## 9. Testing (`bun test`)

- Schema round-trip validation of `master_data.i18n.json`.
- Locale resolution precedence + EN fail-safe.
- Role-routing ordering assertions (e.g. `ops-tools` ranks #1 for `anthropic_dx`,
  `Omnis-Agri` #1 for `iot`).
- `/v1/metrics` response-shape contract.
- Eden `treaty` handler tests for each endpoint.

## 10. Master Data — Project Entries (drafts)

To be authored during implementation, tagged and marked `DRAFT` for owner review:
- **SEOmnix / SEOMNIX Evals** — LangGraph, FastAPI, AI-safety routing,
  LLM-as-a-judge Evals. Tags: `ai_safety`, `mlops`, `dx_tooling`.
- **ops-tools** — Developer Experience, Bun, TypeScript, local telemetry.
  Tags: `dx_tooling`, `devsecops`.
- **Omnis-Agri** — **DRAFT STUB pending owner brief.** Emphases to apply once
  provided: Edge computing, deterministic safety loops, IoT (ESP32/MQTT), MCP
  protocol. Tags: `iot`, `edge`, `ai_safety`.

## 11. Out of Scope (YAGNI)

- No runtime LLM translation or generation.
- No live external uptime monitor.
- No auth/admin UI (master data edited as JSON + regenerated).
- No database — static validated JSON is the datastore.
