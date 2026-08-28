# Profile Engine - Architecture

> Maintained reference doc. Update this alongside any change that touches a route,
> a deployment target, or the offline content pipeline. Diagrams are Mermaid -
> GitHub renders them natively in this file, no external tooling required.

## Overview

Profile Engine is the system behind [fdiene.com](https://fdiene.com): a résumé served as
a typed API rather than a static PDF. A Bun + Turborepo monorepo with Zod schemas as the
single source of truth, an Elysia API, and an Astro/Vue frontend that reorders its own
content per audience (`?role=&lang=`).

Almost the entire system is offline-generated and read-only at runtime: content is
authored once, translated and embedded by offline scripts, committed to git, and served
from memory. The one runtime exception is `POST /ask` - a retrieval-augmented endpoint
that answers real questions about the résumé using a live (rate-limited, cost-capped)
Claude call. That exception is deliberate and documented, not an oversight.

---

## 1. System Context

Who and what talks to Profile Engine, and why.

```mermaid
flowchart TB
    visitor["Site visitor / recruiter<br/>(browser)"]
    curl["Direct API consumer<br/>(curl, another service)"]

    subgraph system["Profile Engine"]
        web["apps/web<br/>fdiene.com"]
        api["apps/api<br/>api.fdiene.com"]
    end

    github["GitHub REST API<br/>(commits.count for /v1/metrics)"]
    anthropic["Anthropic API<br/>(POST /ask generation only)"]
    hf["Hugging Face CDN<br/>(embedding model download,<br/>build-time only, pre-warmed in the image)"]

    visitor -->|"HTTPS"| web
    web -->|"Eden-typed HTTPS calls"| api
    curl -->|"HTTPS"| api
    api -->|"GET commits?per_page=1<br/>(optional GITHUB_TOKEN)"| github
    api -->|"POST /v1/messages<br/>(only past 4 free gates, see Sequence 2)"| anthropic
    api -.->|"model download,<br/>Docker build time only"| hf
```

**Non défini / out of scope for this diagram:** no user accounts, no database, no
payment or write path anywhere in the system - everything a visitor sees is a read of
data authored offline.

---

## 2. Containers

The real shape of the monorepo and how the pieces depend on each other.

```mermaid
flowchart TB
    subgraph web["apps/web (Astro 4 + Vue islands)"]
        terminal["Terminal.vue<br/>main view, RoleSwitcher, LangSwitcher"]
        askpanel["AskPanel.vue<br/>calls POST /ask"]
        useprofile["useProfile.ts<br/>fetch + 4s timeout +<br/>embedded-fallback degrade"]
    end

    subgraph api["apps/api (Elysia)"]
        app["app.ts<br/>route chain, CORS, trace/metrics"]
        rag_api["embeddings.ts / generateRagAnswer.ts<br/>/ ragIndex.ts / rateLimiter.ts"]
        data_api["data.ts<br/>loadResume (REPO_ROOT-relative readFileSync)"]
    end

    subgraph core["packages/core (pure domain, shared)"]
        buildprofile["buildProfile.ts / buildCv.ts"]
        routing["routing.ts<br/>ROLE_WEIGHTS, orderByRole, featured_for"]
        rag_core["rag.ts<br/>buildRagChunks, cosineSimilarity,<br/>topKRelevant, isRelevant"]
    end

    subgraph schema["packages/schema (Zod, single source of truth)"]
        resumeschema["ResumeSchema / ResumeInputSchema"]
        enums["enums.ts<br/>TargetRole, Tag, Lang"]
    end

    subgraph scripts["scripts/ (offline, not deployed)"]
        translate["generate-translations.ts<br/>bun run translate"]
        ragindexer["generate-rag-index.ts<br/>bun scripts/generate-rag-index.ts"]
        advisor["career-advisor.ts<br/>bun run advise (private)"]
    end

    subgraph data["data/ (committed, generated artifacts)"]
        masterfr["master_data.fr.json<br/>EN+FR source"]
        masteri18n["master_data.i18n.json<br/>EN+FR+DE, served at runtime"]
        ragindexjson["rag_index.json<br/>12 chunks, 384-dim embeddings"]
    end

    terminal --> useprofile
    askpanel -->|"Eden treaty client"| app
    useprofile -->|"Eden treaty client"| app
    useprofile -.->|"import (build-time),<br/>SYSTEM DEGRADED fallback"| masteri18n

    app --> buildprofile
    app --> rag_api
    app --> data_api
    data_api -->|"readFileSync"| masteri18n
    rag_api -->|"readFileSync (RAG_INDEX)"| ragindexjson

    buildprofile --> routing
    rag_api --> rag_core

    buildprofile --> resumeschema
    rag_core --> resumeschema
    data_api -->|"ResumeSchema.parse"| resumeschema

    translate -->|"reads"| masterfr
    translate -->|"writes"| masteri18n
    ragindexer -->|"reads"| masteri18n
    ragindexer -->|"ResumeSchema.parse + buildRagChunks"| rag_core
    ragindexer -->|"writes"| ragindexjson
```

---

## 3. Components - `apps/api`

The one non-trivial container, broken down.

```mermaid
flowchart TB
    subgraph app["app.ts route chain (Elysia)"]
        direction TB
        r_health["GET /health, GET /"]
        r_build["GET /v1/profile/build<br/>GET /resume.json"]
        r_skills["GET /v1/skills<br/>GET /v1/projects<br/>GET /v1/projects/:id"]
        r_metrics["GET /v1/metrics"]
        r_ask["POST /ask"]
        trace["trace hook<br/>records latency for every route<br/>EXCEPT /ask"]
    end

    cors["cors() plugin<br/>WEB_ORIGIN + www variant,<br/>+ localhost outside production"]
    swaggerui["swagger() plugin<br/>/swagger"]

    resumemod["data.ts<br/>resume (module-level const,<br/>loaded once at startup)"]
    profilemod["profile.ts<br/>buildProfile wrapper"]
    metricsmod["metrics.ts<br/>latencySummary + fetchCommitCount<br/>(5min TTL cache)"]
    ragindexmod["ragIndex.ts<br/>RAG_INDEX (module-level const)"]
    embedmod["embeddings.ts<br/>embedText / warmEmbeddingModel<br/>(Xenova/all-MiniLM-L6-v2, quantized)"]
    genmod["generateRagAnswer.ts<br/>lazy-memoized Anthropic client<br/>(20s timeout, 1 retry)"]
    ratelimitmod["rateLimiter.ts<br/>per-IP sliding window (10/h, evicted)<br/>+ global daily cap (200/day)"]

    cors --> app
    swaggerui --> app
    r_health --> resumemod
    r_build --> profilemod
    r_skills --> resumemod
    r_metrics --> metricsmod
    r_ask --> ratelimitmod
    r_ask --> embedmod
    r_ask --> ragindexmod
    r_ask --> genmod
    trace -.-> app
```

---

## 4. Sequence: normal profile request

The common case - no LLM involved, sub-millisecond on the API side.

```mermaid
sequenceDiagram
    participant B as Browser (Terminal.vue)
    participant U as useProfile.ts
    participant A as apps/api (Elysia)
    participant D as data.ts (in-memory resume)

    B->>U: mount / role or lang changed
    U->>U: start 4s timeout race
    U->>A: GET /v1/profile/build?target_role=&lang=
    A->>D: read module-level resume const
    A->>A: orderByRole (tag weights + featured_for boost)
    A->>A: localize(role, lang)
    A-->>U: 200 JSON (Cache-Control: public, max-age=60,<br/>stale-while-revalidate=3600)
    U-->>B: status = "ready", profile populated

    alt API unreachable or times out (>4s)
        U->>U: buildProfile() locally over the<br/>build-time-embedded master_data.i18n.json
        U-->>B: status = "degraded" (SYSTEM DEGRADED badge)
    end
```

---

## 5. Sequence: `POST /ask` (the one runtime LLM exception)

Every step before the Claude call is free or already-computed. The paid call is the last
possible thing that can happen, gated behind four checks.

```mermaid
sequenceDiagram
    participant B as Browser (AskPanel.vue)
    participant A as apps/api /ask handler
    participant RL as rateLimiter.ts
    participant E as embeddings.ts (local model)
    participant R as ragIndex.ts (RAG_INDEX, 12 chunks)
    participant C as Anthropic API (claude-sonnet-5)

    B->>A: POST /ask { question } (25s client AbortController)
    A->>A: trim + length check (3-500 chars)
    alt out of bounds
        A-->>B: 400 invalid_question_length
    end

    A->>RL: checkGlobalDailyLimit() [Layer: global cap, 200/day]
    alt cap already spent today
        A-->>B: 200, decline message, sources: []
    end

    A->>RL: checkAndRecordPerIp(x-forwarded-for) [Layer: per-IP, 10/hour]
    alt IP over its hourly budget
        A-->>B: 200, decline message, sources: []
    end

    A->>E: embedText(question) [local, no network]
    E-->>A: 384-dim vector
    A->>R: topKRelevant(vector, RAG_INDEX, k=3)
    R-->>A: top 3 scored chunks

    A->>A: isRelevant(topScore) [Layer: free relevance pre-filter]
    alt below threshold (0.15) - off-topic / adversarial
        A-->>B: 200, decline message, sources: []
    end

    Note over A,C: Only past all four free/local gates does<br/>a real, billed call happen.
    A->>C: messages.create (system prompt scoped to the<br/>3 retrieved chunks only, effort: low)
    alt Anthropic call succeeds
        C-->>A: grounded answer text
        A->>RL: recordGlobalDailyUsage() [only after success]
        A-->>B: 200 { answer, sources: [chunk ids] }
    else network/timeout/SDK error
        A-->>B: 200, decline message, sources: []<br/>(usage NOT recorded on this path)
    end
```

**Layer 5** (not visible in this sequence - it lives outside the code): an account-level
spending limit set manually on the Anthropic console for the deployed API key, as the
backstop that holds even if a bug exists in every layer above.

---

## 6. Sequence: offline content pipeline

Runs on a developer machine, never in production. Nothing here executes at request time.

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant FR as master_data.fr.json (EN+FR, hand-authored)
    participant T as generate-translations.ts
    participant Claude as Anthropic API (offline translation pass)
    participant I18N as master_data.i18n.json (EN+FR+DE, committed)
    participant RI as generate-rag-index.ts
    participant HF as Xenova/all-MiniLM-L6-v2 (local, quantized)
    participant IDX as rag_index.json (committed)

    Dev->>FR: hand-edit content
    Dev->>T: bun run translate
    T->>Claude: translate missing/changed DE strings
    Claude-->>T: DE text (glossary-constrained)
    T->>I18N: write full EN+FR+DE resume

    Note over Dev,IDX: Separate step, run whenever content that feeds<br/>RAG chunks changes (no CI check enforces this yet - M1,<br/>a known gap: no rag:index script alias exists today).
    Dev->>RI: bun scripts/generate-rag-index.ts
    RI->>I18N: ResumeSchema.parse + read ONLY this file<br/>(never docs/applications/, career_insights.md,<br/>or career_telemetry.jsonl - privacy boundary)
    RI->>HF: embed each chunk (pooling: mean, normalize: true)
    HF-->>RI: 384-dim vectors
    RI->>IDX: write EmbeddedChunk[]

    Dev->>Dev: git commit + push
```

---

## 7. Deployment

Two independent deploy paths - the web app auto-deploys, the API does not (deliberate,
see below).

```mermaid
flowchart TB
    subgraph github["GitHub (fdiene/my-curriculum, public)"]
        masterbranch["master branch"]
    end

    subgraph vercel["Vercel (fdienes-projects/my-curriculum)"]
        vbuild["Build: bun run build<br/>(vercel.json at repo root,<br/>outputDirectory: apps/web/dist)"]
        vdeploy["Production deployment<br/>auto-aliased to fdiene.com"]
    end

    subgraph vps["VPS 'seo-prod' (shared: n8n, Directus, SEOMNIX also run here)"]
        traefik["Traefik<br/>TLS via Let's Encrypt"]
        subgraph compose["infra/docker-compose.yml"]
            apicontainer["profile-api container<br/>USER bun (non-root), restart: unless-stopped"]
        end
        network["seo-prod-network<br/>(external Docker network,<br/>shared with other VPS services)"]
    end

    dns["DNS (Hostinger)<br/>A @ -> Vercel<br/>CNAME www -> Vercel<br/>A api -> VPS IP"]

    masterbranch -->|"push (auto-deploy, GitHub App integration)"| vbuild
    vbuild --> vdeploy
    masterbranch -.->|"MANUAL: git pull + docker compose<br/>--env-file ./.env -f infra/docker-compose.yml<br/>up -d --build (see README > Deploy)"| compose
    apicontainer --> network
    traefik -->|"Host = api.fdiene.com"| apicontainer
    dns --> vdeploy
    dns --> traefik
```

**Why the API isn't auto-deployed:** it lives on a shared VPS alongside other production
services (n8n, Directus, SEOMNIX). A manual deploy step gives a human checkpoint before
touching shared infrastructure - revisit only if that friction becomes a real problem.

**Required environment variables at each layer** - see `README.md` > Environment
variables for the full table; the two `/ask`-specific deployment prerequisites
(`ANTHROPIC_API_KEY` on the VPS, and a spending limit set on the Anthropic console) are
called out separately in `README.md` > Deploy.

---

## 8. Key constraints and where they're recorded

This file is the map; the following are the primary sources of truth for *why*, kept
separately so this document doesn't drift into duplicating them:

- **The RAG feature's full design rationale** (why local embeddings over a hosted API,
  the exact cost-control layer ordering, what was explicitly ruled out and why):
  `docs/superpowers/specs/2026-08-25-rag-ask-endpoint-design.md`.
- **Environment variables, deploy commands, the `--env-file` vs `--project-directory`
  gotcha:** `README.md`.
- **Data model / schema:** `packages/schema/src/` is the single source of truth; this
  document describes shape and flow, not field-by-field detail.

## 9. Known gaps (honest, not fixed here)

- No CI check that `data/rag_index.json` is in sync with `data/master_data.i18n.json` -
  editing content and forgetting to re-run the indexer goes undetected (tracked, not
  yet fixed).
- No `bun run rag:index` alias exists yet; the indexer is invoked by its full path.
- `cosineSimilarity` (`packages/core/src/rag.ts`) has no zero-vector guard - fails safe
  (routes to the decline path) but the guard itself doesn't exist.
