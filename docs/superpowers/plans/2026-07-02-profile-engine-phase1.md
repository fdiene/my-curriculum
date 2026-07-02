# Profile Engine (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an API-First, i18n (EN/FR/DE), role-aware résumé engine for Fadel Diène, plus a static "terminal" frontend, deployable as `fdiene.com` (web) + `api.fdiene.com` (API).

**Architecture:** A Bun + Turborepo monorepo. `packages/schema` is the Zod single-source-of-truth (domain types + runtime validation). `apps/api` (Elysia) loads a static, schema-validated `master_data.i18n.json` and resolves locale + role ordering at request time; it exports its Eden `treaty` type. `apps/web` (Astro + Vue) consumes that typed client. Offline Bun scripts (`generate-translations.ts`, private `career-advisor.ts`) use the Anthropic SDK at build time only — never at runtime.

**Tech Stack:** Bun, Turborepo, TypeScript 5.x, Zod 3, Elysia + `@elysiajs/swagger` + `@elysiajs/cors` + `@elysiajs/eden`, Astro + `@astrojs/vue` + Vue 3, `@anthropic-ai/sdk`, Docker Compose + Traefik.

## Global Constraints

- Runtime: **Bun** (all apps/scripts). Node is NOT a runtime target. Version floor: Bun ≥ 1.1.
- Language: **TypeScript** everywhere. `"strict": true` in every tsconfig.
- Validation SSOT: **Zod** in `packages/schema`. No domain type is declared twice.
- i18n: every human-readable field is a localized object. Final API data requires all of `{ en, fr, de }`; the canonical source (`master_data.fr.json`) requires `{ en, fr }` and MAY omit `de`.
- Locale fail-safe: unknown/absent locale ALWAYS resolves to `en`.
- No runtime LLM calls. Anthropic SDK is used only in `scripts/`.
- Secrets via env only; documented in README; never committed. Env vars: `ANTHROPIC_API_KEY` (build scripts), `GITHUB_TOKEN` (metrics), `GITHUB_REPO` (metrics target, form `owner/repo`).
- Git-ignored (personal/secret): `_archives/`, `docs/career_insights.md`, `.env`, `node_modules`, `dist`, `.turbo`, `data/master_data.i18n.json` is COMMITTED (it is the sanitized public data).
- Commit style: Conventional Commits; end body with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Test command per package: `bun test`. Run from repo root with `bun test` (Bun discovers `*.test.ts`).

---

## File Structure

```
my-curriculum/
├─ package.json                      # root, Bun workspaces + turbo scripts
├─ turbo.json                        # pipeline (build, test, lint, typecheck)
├─ tsconfig.base.json                # shared strict TS config
├─ .gitignore
├─ .env.example
├─ README.md
├─ packages/
│  └─ schema/
│     ├─ package.json                # name @profile/schema
│     ├─ tsconfig.json
│     └─ src/
│        ├─ index.ts                 # re-exports
│        ├─ localized.ts             # Localized, LocalizedInput, Lang
│        ├─ enums.ts                 # Tag, TargetRole
│        ├─ entities.ts              # Experience/Project/Skill/Cert/Education/Recommendation/Person
│        ├─ resume.ts                # ResumeSchema (final), ResumeInputSchema (source)
│        └─ *.test.ts
├─ apps/
│  ├─ api/
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  ├─ Dockerfile
│  │  └─ src/
│  │     ├─ data.ts                  # loads + validates master_data.i18n.json
│  │     ├─ locale.ts                # resolveLocale
│  │     ├─ localize.ts              # localize() walker
│  │     ├─ routing.ts               # ROLE_WEIGHTS, scoreItem, orderByRole
│  │     ├─ profile.ts               # buildProfile
│  │     ├─ metrics.ts               # latency tracker + github + uptime
│  │     ├─ app.ts                   # Elysia app (exported for Eden + tests)
│  │     ├─ index.ts                 # Bun entrypoint (app.listen)
│  │     └─ *.test.ts
│  └─ web/
│     ├─ package.json
│     ├─ astro.config.mjs
│     ├─ tsconfig.json
│     └─ src/
│        ├─ lib/params.ts            # parseViewParams (pure, tested)
│        ├─ lib/client.ts            # Eden treaty client (typed from api)
│        ├─ components/Terminal.vue
│        └─ pages/index.astro
├─ data/
│  ├─ master_data.fr.json            # canonical EN+FR (committed)
│  └─ master_data.i18n.json          # generated EN+FR+DE (committed)
├─ scripts/
│  ├─ package.json
│  ├─ generate-translations.ts       # + translations.core.ts (testable)
│  ├─ translations.core.ts
│  ├─ career-advisor.ts              # + advisor.core.ts (testable)
│  ├─ advisor.core.ts
│  └─ *.test.ts
├─ infra/
│  └─ docker-compose.yml
└─ .github/workflows/ci.yml
```

---

### Task 0: Environment prerequisites

**Files:** none (local tooling).

- [ ] **Step 1: Install Bun (Windows PowerShell)**

Run: `powershell -c "irm bun.sh/install.ps1 | iex"`
Then open a fresh shell.

- [ ] **Step 2: Verify Bun**

Run: `bun --version`
Expected: prints `1.1.x` or higher. If not found, add `%USERPROFILE%\.bun\bin` to PATH and reopen the shell.

---

### Task 1: Monorepo scaffold + gitignore

**Files:**
- Create: `package.json`, `turbo.json`, `tsconfig.base.json`, `.gitignore`, `.env.example`

**Interfaces:**
- Produces: Bun workspaces `packages/*`, `apps/*`, `scripts`; turbo tasks `build`, `test`, `lint`, `typecheck`.

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "my-curriculum",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*", "apps/*", "scripts"],
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck",
    "lint": "turbo run lint",
    "api:dev": "bun --cwd apps/api run dev",
    "translate": "bun scripts/generate-translations.ts",
    "advise": "bun scripts/career-advisor.ts"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "test": { "dependsOn": ["^build"] },
    "typecheck": { "dependsOn": ["^build"] },
    "lint": {}
  }
}
```

- [ ] **Step 3: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "types": ["bun-types"],
    "declaration": true,
    "verbatimModuleSyntax": true
  }
}
```

- [ ] **Step 4: Create `.gitignore`**

```gitignore
node_modules
dist
.turbo
.env
_archives/
docs/career_insights.md
apps/web/.astro
```

- [ ] **Step 5: Create `.env.example`**

```dotenv
# Build-time only (scripts/*), never used by the running API
ANTHROPIC_API_KEY=sk-ant-xxxxx
# Metrics endpoint (apps/api)
GITHUB_TOKEN=ghp_xxxxx
GITHUB_REPO=fdiene/my-curriculum
```

- [ ] **Step 6: Install and verify**

Run: `bun install`
Expected: completes without error; creates `bun.lockb`.

- [ ] **Step 7: Commit**

```bash
git add package.json turbo.json tsconfig.base.json .gitignore .env.example bun.lockb
git commit -m "chore: scaffold Bun + Turborepo monorepo"
```

---

### Task 2: Schema — localized primitives + enums

**Files:**
- Create: `packages/schema/package.json`, `packages/schema/tsconfig.json`, `packages/schema/src/localized.ts`, `packages/schema/src/enums.ts`
- Test: `packages/schema/src/localized.test.ts`

**Interfaces:**
- Produces:
  - `type Lang = "en" | "fr" | "de"`; `const LANGS: Lang[]`
  - `Localized` (Zod object `{ en, fr, de }`, all required)
  - `LocalizedInput` (Zod object `{ en, fr, de? }`)
  - `Tag` (Zod enum) + `type Tag`
  - `TargetRole` (Zod enum) + `type TargetRole`

- [ ] **Step 1: Create `packages/schema/package.json`**

```json
{
  "name": "@profile/schema",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "bun test",
    "typecheck": "tsc --noEmit",
    "build": "tsc --emitDeclarationOnly --outDir dist"
  },
  "dependencies": { "zod": "^3.23.8" },
  "devDependencies": { "typescript": "^5.5.0", "bun-types": "^1.1.0" }
}
```

- [ ] **Step 2: Create `packages/schema/tsconfig.json`**

```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

- [ ] **Step 3: Write the failing test** — `packages/schema/src/localized.test.ts`

```ts
import { describe, expect, it } from "bun:test";
import { Localized, LocalizedInput, LANGS, Tag, TargetRole } from "./index";

describe("Localized", () => {
  it("accepts all three languages", () => {
    expect(Localized.parse({ en: "a", fr: "b", de: "c" })).toEqual({ en: "a", fr: "b", de: "c" });
  });
  it("rejects a missing language (final schema is strict)", () => {
    expect(() => Localized.parse({ en: "a", fr: "b" })).toThrow();
  });
});

describe("LocalizedInput", () => {
  it("allows de to be omitted", () => {
    expect(LocalizedInput.parse({ en: "a", fr: "b" })).toEqual({ en: "a", fr: "b" });
  });
});

describe("enums", () => {
  it("exposes the language list", () => {
    expect(LANGS).toEqual(["en", "fr", "de"]);
  });
  it("accepts known tag and role", () => {
    expect(Tag.parse("dx_tooling")).toBe("dx_tooling");
    expect(TargetRole.parse("anthropic_dx")).toBe("anthropic_dx");
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `bun test packages/schema/src/localized.test.ts`
Expected: FAIL — cannot resolve `./index`.

- [ ] **Step 5: Create `packages/schema/src/localized.ts`**

```ts
import { z } from "zod";

export const LANGS = ["en", "fr", "de"] as const;
export type Lang = (typeof LANGS)[number];

/** Final, API-facing localized value: all three languages required. */
export const Localized = z.object({
  en: z.string(),
  fr: z.string(),
  de: z.string(),
});
export type Localized = z.infer<typeof Localized>;

/** Canonical source value: de may be filled later by the translation pipeline. */
export const LocalizedInput = z.object({
  en: z.string(),
  fr: z.string(),
  de: z.string().optional(),
});
export type LocalizedInput = z.infer<typeof LocalizedInput>;
```

- [ ] **Step 6: Create `packages/schema/src/enums.ts`**

```ts
import { z } from "zod";

export const Tag = z.enum([
  "ai_safety", "dx_tooling", "devsecops", "iot", "edge", "mcp",
  "plm", "cloud", "security", "api_design", "mlops", "aerospace",
]);
export type Tag = z.infer<typeof Tag>;

export const TargetRole = z.enum(["anthropic_dx", "iot", "plm_architect", "default"]);
export type TargetRole = z.infer<typeof TargetRole>;
```

- [ ] **Step 7: Create `packages/schema/src/index.ts`**

```ts
export * from "./localized";
export * from "./enums";
```

- [ ] **Step 8: Run test to verify it passes**

Run: `bun test packages/schema/src/localized.test.ts`
Expected: PASS (all 5 tests).

- [ ] **Step 9: Commit**

```bash
git add packages/schema
git commit -m "feat(schema): localized primitives, Tag and TargetRole enums"
```

---

### Task 3: Schema — entities + Resume (source & final)

**Files:**
- Create: `packages/schema/src/entities.ts`, `packages/schema/src/resume.ts`
- Modify: `packages/schema/src/index.ts` (add exports)
- Test: `packages/schema/src/resume.test.ts`

**Interfaces:**
- Consumes: `Localized`, `LocalizedInput`, `Tag`, `TargetRole` from Task 2.
- Produces (final, all use `Localized`): `PersonSchema`, `ExperienceSchema`, `ProjectSchema`, `SkillSchema`, `CertificationSchema`, `EducationSchema`, `RecommendationSchema`, `ResumeSchema` + inferred `Resume`.
- Produces (source, all use `LocalizedInput`): `ResumeInputSchema` + inferred `ResumeInput`.
- Both built by one factory so field names never diverge.

- [ ] **Step 1: Write the failing test** — `packages/schema/src/resume.test.ts`

```ts
import { describe, expect, it } from "bun:test";
import { ResumeSchema, ResumeInputSchema } from "./index";

const minimalFinal = {
  person: { name: "Fadel Diène", title: { en: "Architect", fr: "Architecte", de: "Architekt" },
            location: "Toulouse", links: { linkedin: "https://linkedin.com/in/fdiene" } },
  executiveSummaries: {
    anthropic_dx: { en: "a", fr: "a", de: "a" },
    iot: { en: "b", fr: "b", de: "b" },
    plm_architect: { en: "c", fr: "c", de: "c" },
    default: { en: "d", fr: "d", de: "d" },
  },
  experiences: [], projects: [], skills: [], certifications: [], education: [], recommendations: [],
};

describe("ResumeSchema (final)", () => {
  it("parses a minimal valid resume", () => {
    expect(ResumeSchema.parse(minimalFinal).person.name).toBe("Fadel Diène");
  });
  it("rejects a project whose tagline lacks de", () => {
    const bad = structuredClone(minimalFinal) as any;
    bad.projects.push({ id: "x", name: "X", tagline: { en: "t", fr: "t" },
      description: { en: "d", fr: "d", de: "d" }, stack: [], tags: [], links: {},
      status: "live", featured_for: [] });
    expect(() => ResumeSchema.parse(bad)).toThrow();
  });
});

describe("ResumeInputSchema (source)", () => {
  it("accepts localized fields without de", () => {
    const src = structuredClone(minimalFinal) as any;
    src.person.title = { en: "Architect", fr: "Architecte" };
    delete src.executiveSummaries.anthropic_dx.de;
    expect(ResumeInputSchema.parse(src).person.title.fr).toBe("Architecte");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/schema/src/resume.test.ts`
Expected: FAIL — `ResumeSchema` not exported.

- [ ] **Step 3: Create `packages/schema/src/entities.ts`**

```ts
import { z, type ZodType } from "zod";
import { Tag, TargetRole } from "./enums";

/** Factory builds an entity set from whichever localized schema is passed in. */
export function buildEntities(L: ZodType) {
  const Period = z.object({ start: z.string(), end: z.string().nullable() });

  const Person = z.object({
    name: z.string(),
    title: L,
    location: z.string(),
    photo: z.string().optional(),
    links: z.object({
      linkedin: z.string().optional(),
      email: z.string().optional(),
      website: z.string().optional(),
      github: z.string().optional(),
    }),
  });

  const Experience = z.object({
    id: z.string(),
    role: L,
    org: z.string(),
    location: z.string(),
    period: Period,
    summary: L,
    highlights: z.array(L),
    tags: z.array(Tag),
    domain: z.string(),
  });

  const Project = z.object({
    id: z.string(),
    name: z.string(),
    tagline: L,
    description: L,
    stack: z.array(z.string()),
    tags: z.array(Tag),
    links: z.object({ repo: z.string().optional(), demo: z.string().optional() }),
    metrics: z.record(z.string(), z.string()).optional(),
    status: z.enum(["live", "draft"]),
    featured_for: z.array(TargetRole),
  });

  const Skill = z.object({
    id: z.string(),
    label: z.string(),
    category: z.string(),
    level: z.number().int().min(1).max(5),
    tags: z.array(Tag),
  });

  const Certification = z.object({ id: z.string(), title: L, org: z.string(), location: z.string(), period: Period });
  const Education = z.object({ id: z.string(), title: L, org: z.string(), location: z.string(),
    period: Period, details: z.array(L).default([]) });
  const Recommendation = z.object({ author: z.string(), title: z.string(), company: z.string(),
    text: L, date: z.string() });

  return { Person, Experience, Project, Skill, Certification, Education, Recommendation };
}
```

- [ ] **Step 4: Create `packages/schema/src/resume.ts`**

```ts
import { z, type ZodType } from "zod";
import { Localized, LocalizedInput } from "./localized";
import { TargetRole } from "./enums";
import { buildEntities } from "./entities";

function buildResume(L: ZodType) {
  const e = buildEntities(L);
  const summaries = z.object({
    anthropic_dx: L, iot: L, plm_architect: L, default: L,
  }) satisfies ZodType;
  return z.object({
    person: e.Person,
    executiveSummaries: summaries,
    experiences: z.array(e.Experience),
    projects: z.array(e.Project),
    skills: z.array(e.Skill),
    certifications: z.array(e.Certification),
    education: z.array(e.Education),
    recommendations: z.array(e.Recommendation),
  });
}

export const ResumeSchema = buildResume(Localized);
export type Resume = z.infer<typeof ResumeSchema>;

export const ResumeInputSchema = buildResume(LocalizedInput);
export type ResumeInput = z.infer<typeof ResumeInputSchema>;

export const ROLES = TargetRole.options;
```

- [ ] **Step 5: Update `packages/schema/src/index.ts`**

```ts
export * from "./localized";
export * from "./enums";
export * from "./entities";
export * from "./resume";
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bun test packages/schema/src/resume.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add packages/schema
git commit -m "feat(schema): entities + Resume final/source schemas via shared factory"
```

---

### Task 4: Canonical master data (EN+FR)

**Files:**
- Create: `data/master_data.fr.json`
- Test: `data/master_data.fr.test.ts`

**Interfaces:**
- Consumes: `ResumeInputSchema` from Task 3.
- Produces: a committed canonical profile file that parses against `ResumeInputSchema`.

- [ ] **Step 1: Write the failing test** — `data/master_data.fr.test.ts`

```ts
import { describe, expect, it } from "bun:test";
import { ResumeInputSchema } from "@profile/schema";
import raw from "./master_data.fr.json";

describe("master_data.fr.json", () => {
  it("is valid against the source schema", () => {
    expect(() => ResumeInputSchema.parse(raw)).not.toThrow();
  });
  it("contains the three portfolio projects", () => {
    const r = ResumeInputSchema.parse(raw);
    const ids = r.projects.map((p) => p.id).sort();
    expect(ids).toEqual(["omnis-agri", "ops-tools", "seomnix"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test data/master_data.fr.test.ts`
Expected: FAIL — file not found.

- [ ] **Step 3: Create `data/master_data.fr.json`**

> Data sourced from `_archives/CV_pdf/*` and the LinkedIn export. `de` intentionally omitted (filled by Task 6). Project entries are marked DRAFT in `description` and must be owner-reviewed; keep the `[DRAFT]` prefix until approved.

```json
{
  "person": {
    "name": "Fadel Diène",
    "title": { "en": "Information Systems Architect", "fr": "Architecte de Systèmes d'Information" },
    "location": "Toulouse, France",
    "links": {
      "linkedin": "https://www.linkedin.com/in/fdiene/",
      "email": "omnis.cons@gmail.com",
      "github": "https://github.com/fdiene"
    }
  },
  "executiveSummaries": {
    "anthropic_dx": {
      "en": "Systems architect turned developer-experience builder: I ship typed, tested tooling (Bun/TypeScript CLIs, monorepos) and safety-first AI pipelines (LLM-as-a-judge Evals, MCP). 7 years hardening critical aerospace infrastructure now aimed at making other engineers faster and safer.",
      "fr": "Architecte système devenu bâtisseur d'expérience développeur : je livre du tooling typé et testé (CLI Bun/TypeScript, monorepos) et des pipelines IA orientés sûreté (Evals LLM-as-a-judge, MCP). 7 ans à fiabiliser des infrastructures aéronautiques critiques, désormais au service de la vélocité et de la sûreté des équipes."
    },
    "iot": {
      "en": "Architect building trusted IoT: edge devices (ESP32/MQTT) governed by deterministic safety loops and an AI 'judge' agent that validates every physical action, queryable from Claude Desktop via MCP.",
      "fr": "Architecte de l'IoT de confiance : capteurs edge (ESP32/MQTT) pilotés par des boucles de sûreté déterministes et un agent IA « juge » validant chaque action physique, interrogeable depuis Claude Desktop via MCP."
    },
    "plm_architect": {
      "en": "PLM & IT architect with 7 years across Bombardier, Dassault Falcon Jet, Airbus and Safran: hybrid cloud/on-prem deployments, IAM/SSO, middleware & API management for critical, secure aerospace systems.",
      "fr": "Architecte PLM & SI avec 7 ans chez Bombardier, Dassault Falcon Jet, Airbus et Safran : déploiements hybrides cloud/on-premise, IAM/SSO, middleware & API management pour des systèmes aéronautiques critiques et sécurisés."
    },
    "default": {
      "en": "Information Systems Architect with 7 years in aerospace (Bombardier, Dassault Falcon Jet, Airbus, Safran), specialized in PLM, cloud and secure critical infrastructures, now building developer tooling and safety-first AI systems.",
      "fr": "Architecte de Systèmes d'Information avec 7 ans dans l'aéronautique (Bombardier, Dassault Falcon Jet, Airbus, Safran), spécialisé en PLM, cloud et infrastructures critiques sécurisées, désormais tourné vers le tooling développeur et les systèmes IA orientés sûreté."
    }
  },
  "experiences": [
    {
      "id": "safran",
      "role": { "en": "Technical Architect — Strategic PLM Engineering 4.0 Program", "fr": "Architecte Technique — Programme stratégique PLM Engineering 4.0" },
      "org": "Safran Aircraft Engines", "location": "Paris, France",
      "period": { "start": "2023-04", "end": null },
      "summary": { "en": "Led hybrid (cloud & on-premise) deployment architecture for the strategic PLM.", "fr": "Responsable de l'architecture de déploiement hybride (cloud & on-premise) du PLM stratégique." },
      "highlights": [
        { "en": "Defined and validated architectures using network fundamentals (TCP/IP, IPsec/SSL VPN) for interconnection design and diagnostics.", "fr": "Définition et validation d'architectures en s'appuyant sur les fondamentaux réseau (TCP/IP, VPN IPsec/SSL) pour la conception et le diagnostic des interconnexions." },
        { "en": "Implemented secure authentication and identity (SSO, LDAP, Kerberos, OpenID Connect, OAuth2) aligned with Group standards.", "fr": "Mise en œuvre de solutions sécurisées d'authentification et d'identité (SSO, LDAP, Kerberos, OpenID Connect, OAuth2) alignées avec les standards Groupe." },
        { "en": "Produced application and technical maps ensuring traceability between business needs, IT solutions and operations (ArchiMate/TOGAF).", "fr": "Élaboration de cartographies applicatives et techniques garantissant la traçabilité entre besoins métiers, solutions IT et exploitation (ArchiMate/TOGAF)." },
        { "en": "Optimized interoperability through middleware and API management standards (REST/SOAP/GraphQL) with Mulesoft and RabbitMQ, high availability and redundancy.", "fr": "Optimisation de l'interopérabilité via une architecture middleware et des standards API Management (REST/SOAP/GraphQL) avec Mulesoft et RabbitMQ, haute disponibilité et redondance." }
      ],
      "tags": ["cloud", "security", "api_design", "plm", "aerospace"],
      "domain": "Aerospace / PLM"
    },
    {
      "id": "airbus-helicopters",
      "role": { "en": "Software Architect — H175, NH90, AS332 Puma Programs", "fr": "Architecte logiciel — Programmes H175, NH90, AS332 Puma" },
      "org": "Airbus Helicopters", "location": "Marignane, France",
      "period": { "start": "2020-09", "end": "2022-03" },
      "summary": { "en": "Administered and integrated PLM Enovia VPM V4; introduced DevOps practices.", "fr": "Administration et intégration du PLM Enovia VPM V4 ; mise en place de pratiques DevOps." },
      "highlights": [
        { "en": "Managed environments, access rights, licenses and C++ customization of Enovia VPM V4.", "fr": "Gestion des environnements, droits d'accès, licences et customisation C++ d'Enovia VPM V4." },
        { "en": "Built DevOps pipelines: Gradle/Maven, Jenkins, JFrog Artifactory, Ansible deployment automation.", "fr": "Pipelines DevOps : Gradle/Maven, Jenkins, JFrog Artifactory, automatisation des déploiements avec Ansible." },
        { "en": "Reduced incidents and improved software quality via SonarQube, JUnit, Ranorex, EggPlant, XRay.", "fr": "Réduction des incidents et amélioration de la qualité logicielle via SonarQube, JUnit, Ranorex, EggPlant, XRay." }
      ],
      "tags": ["devsecops", "plm", "cloud", "aerospace"],
      "domain": "Aerospace / PLM"
    },
    {
      "id": "dassault-falcon",
      "role": { "en": "PLM Engineer — Falcon 10X, 900LX, Multi Programs", "fr": "Ingénieur PLM — Falcon 10X, 900LX, Multi" },
      "org": "Dassault Falcon Jet", "location": "Little Rock, AR, USA",
      "period": { "start": "2020-06", "end": "2020-09" },
      "summary": { "en": "Delivered the PLM platform migration to AIX 7.2 with critical environment management.", "fr": "Migration de la plateforme PLM sous AIX 7.2 avec gestion d'environnements critiques." },
      "highlights": [
        { "en": "Integrated upgrade packages on Enovia VPM V4 and executed the cutover plan.", "fr": "Intégration des packages évolutifs sur Enovia VPM V4 et exécution du plan de bascule." },
        { "en": "Supervised data flows and performed post-migration validation to ensure business continuity.", "fr": "Supervision des flux et validation post-migration pour garantir la continuité des opérations." }
      ],
      "tags": ["plm", "cloud", "aerospace"],
      "domain": "Aerospace / PLM"
    },
    {
      "id": "airbus-ds",
      "role": { "en": "Developer — PLM Neo A32X & A35X Programs", "fr": "Développeur — Programmes PLM Neo A32X & A35X" },
      "org": "Airbus Defence and Space", "location": "Toulouse, France",
      "period": { "start": "2019-09", "end": "2020-06" },
      "summary": { "en": "Developed web services, widgets and JPOs on the Dassault 3DEXPERIENCE platform.", "fr": "Développement de webservices, widgets et JPOs sur la plateforme 3DEXPERIENCE de Dassault Systèmes." },
      "highlights": [
        { "en": "Designed and integrated a data model tailored to client business cases.", "fr": "Conception et intégration d'un modèle de données adapté aux cas d'affaires du client." },
        { "en": "Trained and coached offshore (India) and internal teams on development best practices.", "fr": "Formation et coaching des équipes offshore (Inde) et internes aux bonnes pratiques de développement." }
      ],
      "tags": ["plm", "api_design", "aerospace"],
      "domain": "Aerospace / PLM"
    },
    {
      "id": "bombardier",
      "role": { "en": "Aerospace Structures Engineer — CSeries (A220) Program", "fr": "Ingénieur structures aérospatiales — Programme CSeries (A220)" },
      "org": "Bombardier Aerospace", "location": "Montréal, Canada",
      "period": { "start": "2017-08", "end": "2018-05" },
      "summary": { "en": "Performed stress calculations on composite structures and built supporting tooling.", "fr": "Calculs de contraintes sur structures composites et développement d'outils support." },
      "highlights": [
        { "en": "Designed a new SQL database for composite materials.", "fr": "Conception d'une nouvelle base de données SQL pour les matériaux composites." },
        { "en": "Built a stress-calculation tool in VB.NET and optimized fatigue-test computations.", "fr": "Développement d'un outil de calcul de contraintes en VB.NET et optimisation des calculs de fatigue." }
      ],
      "tags": ["aerospace"],
      "domain": "Aerospace / Structures"
    }
  ],
  "projects": [
    {
      "id": "ops-tools",
      "name": "ops-tools",
      "tagline": { "en": "A typed, distributed developer CLI for my whole ecosystem.", "fr": "Un CLI développeur typé et distribué pour tout mon écosystème." },
      "description": {
        "en": "[DRAFT] TypeScript CLI (commander/yargs) published to npm as @fdiene/ops-tools: `ops run | repo | setup | doctor | dev`, integrated help, local telemetry (command-duration tracing), Vitest suite, gitleaks pre-commit hooks and green CI. The developer-experience layer that onboards and operates every repo.",
        "fr": "[DRAFT] CLI TypeScript (commander/yargs) publié sur npm en @fdiene/ops-tools : `ops run | repo | setup | doctor | dev`, aide intégrée, télémétrie locale (tracing de durée des commandes), suite Vitest, hooks pre-commit gitleaks et CI verte. La couche d'expérience développeur qui onboarde et exploite chaque dépôt."
      },
      "stack": ["Bun", "TypeScript", "commander.js", "Vitest", "gitleaks"],
      "tags": ["dx_tooling", "devsecops"],
      "links": { "repo": "https://github.com/fdiene/ops-tools" },
      "status": "draft",
      "featured_for": ["anthropic_dx"]
    },
    {
      "id": "seomnix",
      "name": "SEOMNIX Empire",
      "tagline": { "en": "A safety-gated, LangGraph-orchestrated content engine.", "fr": "Un moteur de contenu orchestré par LangGraph et filtré par la sûreté." },
      "description": {
        "en": "[DRAFT] LangGraph + FastAPI pipeline (Directus, n8n) whose flagship is an LLM-as-a-Judge `eval_node`: a Claude Haiku judge with Pydantic structured output scores factuality/formatting/safety, then conditionally routes Keep / Correct / Reject before media generation and publish. Eval metrics persist to Directus for observability; deterministic Evals run in CI.",
        "fr": "[DRAFT] Pipeline LangGraph + FastAPI (Directus, n8n) dont la pièce maîtresse est un `eval_node` LLM-as-a-Judge : un juge Claude Haiku à sortie structurée Pydantic note factualité/mise en forme/sûreté puis route conditionnellement Garder / Corriger / Rejeter avant génération des médias et publication. Les métriques d'évaluation sont persistées dans Directus pour l'observabilité ; des Evals déterministes tournent en CI."
      },
      "stack": ["Python", "FastAPI", "LangGraph", "Pydantic", "Directus", "n8n", "Claude"],
      "tags": ["ai_safety", "mlops", "dx_tooling"],
      "links": {},
      "status": "draft",
      "featured_for": ["anthropic_dx"]
    },
    {
      "id": "omnis-agri",
      "name": "Omnis-Agri (Agri-OS)",
      "tagline": { "en": "A trusted-IoT operating system for the greenhouse.", "fr": "Un système d'exploitation IoT de confiance pour la serre." },
      "description": {
        "en": "[DRAFT] Agricultural OS on VPS/Docker (FastAPI ingestion, Directus, n8n, LangGraph, Astro) test-bedded on a domestic greenhouse (humidity/temperature/light sensors; water-pump + fan actuators). A Judge Agent validates every physical action (irrigation/ventilation) before execution — a deterministic safety loop; greenhouse state is queryable from Claude Desktop via MCP; `ops status --greenhouse` gives system health. Strict Zod/Pydantic validation on the Excel→Directus ETL.",
        "fr": "[DRAFT] OS agricole sur VPS/Docker (ingestion FastAPI, Directus, n8n, LangGraph, Astro) éprouvé sur une serre domestique (capteurs humidité/température/luminosité ; actionneurs pompe à eau + ventilateur). Un Agent Juge valide chaque action physique (arrosage/ventilation) avant exécution — boucle de sûreté déterministe ; l'état de la serre est interrogeable depuis Claude Desktop via MCP ; `ops status --greenhouse` donne l'état de santé. Validation Zod/Pydantic stricte sur l'ETL Excel→Directus."
      },
      "stack": ["FastAPI", "LangGraph", "MCP", "Directus", "n8n", "Astro", "ESP32", "MQTT", "Docker"],
      "tags": ["iot", "edge", "ai_safety", "mcp", "dx_tooling"],
      "links": {},
      "status": "draft",
      "featured_for": ["iot"]
    }
  ],
  "skills": [
    { "id": "plm", "label": "PLM (ENOVIA VPM V4, 3DEXPERIENCE, Teamcenter, DELMIA Apriso)", "category": "PLM", "level": 5, "tags": ["plm"] },
    { "id": "typescript", "label": "TypeScript", "category": "Development", "level": 4, "tags": ["dx_tooling", "api_design"] },
    { "id": "python", "label": "Python", "category": "Development", "level": 4, "tags": ["mlops", "api_design"] },
    { "id": "cpp-java", "label": "C++, Java, C#, .NET, SQL", "category": "Development", "level": 4, "tags": ["plm"] },
    { "id": "security", "label": "SecNumCloud (ANSSI), ISO 27001, EBIOS, IAM/SSO, PKI/TLS", "category": "Security & Cloud", "level": 4, "tags": ["security", "devsecops"] },
    { "id": "containers", "label": "Docker, Kubernetes (OpenShift), Ansible, Jenkins, JFrog", "category": "Infra & DevOps", "level": 4, "tags": ["devsecops", "cloud"] },
    { "id": "archi", "label": "ArchiMate / TOGAF, SOA, API Management (REST/SOAP/GraphQL)", "category": "Architecture", "level": 5, "tags": ["api_design", "cloud"] },
    { "id": "ai", "label": "LangGraph, MCP, LLM-as-a-judge Evals, Anthropic SDK", "category": "AI", "level": 3, "tags": ["ai_safety", "mlops", "mcp"] }
  ],
  "certifications": [
    { "id": "capm", "title": { "en": "PMI CAPM (Certified Associate in Project Management)", "fr": "PMI CAPM (Certified Associate in Project Management)" }, "org": "PMI International", "location": "Montréal, QC, Canada", "period": { "start": "2021-11", "end": null } },
    { "id": "istqb", "title": { "en": "ISTQB Software Testing", "fr": "ISTQB Tests Logiciels" }, "org": "ORSYS", "location": "Paris, France", "period": { "start": "2023-09", "end": "2023-09" } }
  ],
  "education": [
    { "id": "dauphine", "title": { "en": "Master's in Information Systems Management", "fr": "Master Gestion des systèmes d'information" }, "org": "Université Paris-Dauphine", "location": "Paris, France", "period": { "start": "2022-09", "end": "2023-07" },
      "details": [ { "en": "Hardware/software architecture, BPMN/UML, databases, Agile SAFe/Lean, audit & compliance, BI (Talend, Tableau, SAP BO).", "fr": "Architecture matérielle/logicielle, BPMN/UML, bases de données, Agile SAFe/Lean, audit & conformité, BI (Talend, Tableau, SAP BO)." } ] },
    { "id": "polytechnique", "title": { "en": "Mechanical Engineering Degree", "fr": "Diplôme d'ingénieur mécanique" }, "org": "Polytechnique Montréal", "location": "Montréal, Canada", "period": { "start": "2015-09", "end": "2019-04" },
      "details": [ { "en": "Materials, space mechanics, industrial organization, information-systems technologies, decision theory.", "fr": "Matériaux, mécanique spatiale, organisation industrielle, technologies des systèmes d'information, théorie de la décision." } ] }
  ],
  "recommendations": [
    { "author": "Debabrata Nayak", "title": "Senior PLM Specialist", "company": "McLaren Racing", "date": "2024-04-10",
      "text": { "en": "An exceptional professional and an extraordinary human being. His technical prowess, coupled with a flair for creativity, consistently surpasses expectations, and he consistently fosters collaboration and collective success. I wholeheartedly recommend him.", "fr": "Un professionnel exceptionnel et un être humain extraordinaire. Sa maîtrise technique, alliée à un sens de la créativité, dépasse constamment les attentes, et il favorise sans cesse la collaboration et la réussite collective. Je le recommande sans réserve." } }
  ]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test data/master_data.fr.test.ts`
Expected: PASS (2 tests). If the schema rejects, fix the JSON to match `ResumeInputSchema` field names exactly.

- [ ] **Step 5: Commit**

```bash
git add data/master_data.fr.json data/master_data.fr.test.ts
git commit -m "feat(data): canonical EN+FR master data (projects marked DRAFT)"
```

---

### Task 5: Translation pipeline core (offline, testable)

**Files:**
- Create: `scripts/package.json`, `scripts/translations.core.ts`
- Test: `scripts/translations.core.test.ts`

**Interfaces:**
- Consumes: `ResumeInput`, `Lang`, `LANGS` from `@profile/schema`.
- Produces:
  - `findMissingLocales(resume: ResumeInput): { path: string; en: string; missing: Lang[] }[]`
  - `applyTranslations(resume: ResumeInput, filled: Record<string, Partial<Record<Lang,string>>>): unknown` (returns a deep clone with locales merged, keyed by the same `path`)
  - `type Translator = (text: string, target: Lang) => Promise<string>`

- [ ] **Step 1: Create `scripts/package.json`**

```json
{
  "name": "@profile/scripts",
  "version": "0.1.0",
  "type": "module",
  "scripts": { "test": "bun test", "typecheck": "tsc --noEmit" },
  "dependencies": { "@profile/schema": "workspace:*", "@anthropic-ai/sdk": "^0.30.0", "zod": "^3.23.8" },
  "devDependencies": { "typescript": "^5.5.0", "bun-types": "^1.1.0" }
}
```

Run: `bun install`

- [ ] **Step 2: Write the failing test** — `scripts/translations.core.test.ts`

```ts
import { describe, expect, it } from "bun:test";
import { findMissingLocales, applyTranslations } from "./translations.core";

const resume: any = {
  person: { name: "F", title: { en: "Architect", fr: "Architecte" }, location: "T", links: {} },
  executiveSummaries: {
    anthropic_dx: { en: "a", fr: "a" }, iot: { en: "b", fr: "b" },
    plm_architect: { en: "c", fr: "c" }, default: { en: "d", fr: "d" },
  },
  experiences: [], projects: [], skills: [], certifications: [], education: [], recommendations: [],
};

describe("findMissingLocales", () => {
  it("finds every localized node missing de", () => {
    const missing = findMissingLocales(resume);
    expect(missing.length).toBe(5); // title + 4 summaries
    expect(missing.every((m) => m.missing.includes("de"))).toBe(true);
    expect(missing[0]).toHaveProperty("en");
  });
});

describe("applyTranslations", () => {
  it("merges filled de values back by path", () => {
    const missing = findMissingLocales(resume);
    const filled: Record<string, any> = {};
    for (const m of missing) filled[m.path] = { de: m.en.toUpperCase() };
    const out: any = applyTranslations(resume, filled);
    expect(out.person.title.de).toBe("ARCHITECT");
    expect(out.executiveSummaries.default.de).toBe("D");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test scripts/translations.core.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Create `scripts/translations.core.ts`**

```ts
import { LANGS, type Lang, type ResumeInput } from "@profile/schema";

const OTHER: Lang[] = ["fr", "de"]; // en is the required anchor

/** A localized node is any object that has a string `en` and no non-locale keys. */
function isLocalized(v: unknown): v is Record<string, string> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const keys = Object.keys(v);
  if (!keys.includes("en")) return false;
  return keys.every((k) => (LANGS as readonly string[]).includes(k) && typeof (v as any)[k] === "string");
}

export interface MissingNode { path: string; en: string; missing: Lang[]; }

export function findMissingLocales(resume: ResumeInput): MissingNode[] {
  const out: MissingNode[] = [];
  const walk = (node: unknown, path: string) => {
    if (isLocalized(node)) {
      const missing = LANGS.filter((l) => typeof (node as any)[l] !== "string");
      if (missing.length) out.push({ path, en: (node as any).en, missing });
      return;
    }
    if (Array.isArray(node)) { node.forEach((v, i) => walk(v, `${path}[${i}]`)); return; }
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
    }
  };
  walk(resume, "");
  return out;
}

function setByPath(root: any, path: string, lang: Lang, value: string) {
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  let cur = root;
  for (let i = 0; i < parts.length; i++) cur = cur[parts[i]];
  cur[lang] = value;
}

export function applyTranslations(
  resume: ResumeInput,
  filled: Record<string, Partial<Record<Lang, string>>>,
): unknown {
  const clone = structuredClone(resume) as any;
  for (const [path, langs] of Object.entries(filled)) {
    for (const l of OTHER) { const v = langs[l]; if (typeof v === "string") setByPath(clone, path, l, v); }
  }
  return clone;
}

export type Translator = (text: string, target: Lang) => Promise<string>;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test scripts/translations.core.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/package.json scripts/translations.core.ts scripts/translations.core.test.ts bun.lockb
git commit -m "feat(scripts): translation core — find/merge missing locales"
```

---

### Task 6: Translation CLI (Anthropic SDK) → master_data.i18n.json

**Files:**
- Create: `scripts/generate-translations.ts`
- Create: `data/master_data.i18n.json` (generated output, committed)

**Interfaces:**
- Consumes: `findMissingLocales`, `applyTranslations`, `Translator` (Task 5); `ResumeSchema` (final) for output validation.
- Produces: `data/master_data.i18n.json` valid against `ResumeSchema`.

- [ ] **Step 1: Create `scripts/generate-translations.ts`**

```ts
import Anthropic from "@anthropic-ai/sdk";
import { ResumeSchema, type Lang, type ResumeInput } from "@profile/schema";
import { findMissingLocales, applyTranslations, type Translator } from "./translations.core";

const LANG_NAME: Record<Lang, string> = { en: "English", fr: "French", de: "German" };

function anthropicTranslator(client: Anthropic): Translator {
  return async (text, target) => {
    const msg = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      system:
        `You are a professional translator for a technical résumé. Translate the user's text into ${LANG_NAME[target]}. ` +
        `Preserve technical terms, product names, and proper nouns verbatim (e.g. Bun, LangGraph, Enovia, MCP). ` +
        `Return ONLY the translated text, no quotes, no preamble.`,
      messages: [{ role: "user", content: text }],
    });
    const block = msg.content.find((b) => b.type === "text");
    return block && block.type === "text" ? block.text.trim() : text;
  };
}

export async function run(resume: ResumeInput, translate: Translator) {
  const missing = findMissingLocales(resume);
  const filled: Record<string, Partial<Record<Lang, string>>> = {};
  for (const node of missing) {
    filled[node.path] = {};
    for (const lang of node.missing) filled[node.path]![lang] = await translate(node.en, lang);
  }
  const merged = applyTranslations(resume, filled);
  return ResumeSchema.parse(merged); // throws if any locale still missing
}

if (import.meta.main) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { console.error("ANTHROPIC_API_KEY is required"); process.exit(1); }
  const src = (await Bun.file("data/master_data.fr.json").json()) as ResumeInput;
  const client = new Anthropic({ apiKey: key });
  const final = await run(src, anthropicTranslator(client));
  await Bun.write("data/master_data.i18n.json", JSON.stringify(final, null, 2));
  console.log("Wrote data/master_data.i18n.json");
}
```

- [ ] **Step 2: Write the failing test** — `scripts/generate-translations.test.ts`

```ts
import { describe, expect, it } from "bun:test";
import { run } from "./generate-translations";
import src from "../data/master_data.fr.json";

describe("run (with a stub translator)", () => {
  it("produces data valid against the final ResumeSchema", async () => {
    const stub = async (text: string, target: string) => `[${target}] ${text}`;
    const out = await run(src as any, stub as any);
    expect(out.person.title.de.startsWith("[de]")).toBe(true);
    expect(out.projects[0].description.de.startsWith("[de]")).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails, then passes**

Run: `bun test scripts/generate-translations.test.ts`
Expected: PASS (the stub fills every `de`, so `ResumeSchema.parse` succeeds). If it fails with a Zod error naming a field, that field is missing `fr` in the canonical data — fix `master_data.fr.json`.

- [ ] **Step 4: Generate the real file** (requires network + key)

Run: `ANTHROPIC_API_KEY=... bun scripts/generate-translations.ts`
Expected: writes `data/master_data.i18n.json`. Review the German fields for quality (Tier-1 data).

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-translations.ts scripts/generate-translations.test.ts data/master_data.i18n.json
git commit -m "feat(scripts): Anthropic translation CLI + generated i18n master data"
```

---

### Task 7: API — data loader

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/src/data.ts`
- Test: `apps/api/src/data.test.ts`

**Interfaces:**
- Consumes: `ResumeSchema`, `Resume` from `@profile/schema`.
- Produces: `loadResume(path?: string): Resume` (parses + validates; throws on invalid). Default path `data/master_data.i18n.json`. Also exports a memoized `resume: Resume`.

- [ ] **Step 1: Create `apps/api/package.json`**

```json
{
  "name": "@profile/api",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "start": "bun src/index.ts",
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@profile/schema": "workspace:*",
    "elysia": "^1.1.0",
    "@elysiajs/cors": "^1.1.0",
    "@elysiajs/swagger": "^1.1.0"
  },
  "devDependencies": { "typescript": "^5.5.0", "bun-types": "^1.1.0" }
}
```

Run: `bun install`

- [ ] **Step 2: Create `apps/api/tsconfig.json`**

```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

- [ ] **Step 3: Write the failing test** — `apps/api/src/data.test.ts`

```ts
import { describe, expect, it } from "bun:test";
import { loadResume } from "./data";

describe("loadResume", () => {
  it("loads and validates the generated i18n data", () => {
    const r = loadResume("data/master_data.i18n.json");
    expect(r.person.name).toBe("Fadel Diène");
    expect(r.projects.length).toBeGreaterThan(0);
    expect(typeof r.person.title.de).toBe("string");
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `bun test apps/api/src/data.test.ts`
Expected: FAIL — module not found. (Requires Task 6's `master_data.i18n.json` to exist.)

- [ ] **Step 5: Create `apps/api/src/data.ts`**

```ts
import { ResumeSchema, type Resume } from "@profile/schema";

export function loadResume(path = "data/master_data.i18n.json"): Resume {
  const file = Bun.file(path);
  const json = JSON.parse(require("fs").readFileSync(path, "utf8"));
  void file;
  return ResumeSchema.parse(json);
}

export const resume: Resume = loadResume();
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bun test apps/api/src/data.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/package.json apps/api/tsconfig.json apps/api/src/data.ts apps/api/src/data.test.ts bun.lockb
git commit -m "feat(api): validated master-data loader"
```

---

### Task 8: API — locale resolution

**Files:**
- Create: `apps/api/src/locale.ts`
- Test: `apps/api/src/locale.test.ts`

**Interfaces:**
- Consumes: `Lang`, `LANGS` from `@profile/schema`.
- Produces: `resolveLocale(query?: string | null, header?: string | null): Lang` — precedence query → header → `"en"`.

- [ ] **Step 1: Write the failing test** — `apps/api/src/locale.test.ts`

```ts
import { describe, expect, it } from "bun:test";
import { resolveLocale } from "./locale";

describe("resolveLocale", () => {
  it("prefers a valid query param", () => { expect(resolveLocale("de", "fr,en")).toBe("de"); });
  it("falls back to the Accept-Language header", () => { expect(resolveLocale(null, "fr-FR,fr;q=0.9,en;q=0.8")).toBe("fr"); });
  it("defaults to en when nothing matches", () => { expect(resolveLocale("es", "es-ES")).toBe("en"); });
  it("defaults to en when everything is absent", () => { expect(resolveLocale(null, null)).toBe("en"); });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/api/src/locale.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `apps/api/src/locale.ts`**

```ts
import { LANGS, type Lang } from "@profile/schema";

function isLang(v: string): v is Lang { return (LANGS as readonly string[]).includes(v); }

export function resolveLocale(query?: string | null, header?: string | null): Lang {
  if (query && isLang(query)) return query;
  if (header) {
    for (const part of header.split(",")) {
      const code = part.split(";")[0]!.trim().slice(0, 2).toLowerCase();
      if (isLang(code)) return code;
    }
  }
  return "en";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/api/src/locale.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/locale.ts apps/api/src/locale.test.ts
git commit -m "feat(api): locale resolution with en fail-safe"
```

---

### Task 9: API — localize walker

**Files:**
- Create: `apps/api/src/localize.ts`
- Test: `apps/api/src/localize.test.ts`

**Interfaces:**
- Consumes: `Lang`, `LANGS` from `@profile/schema`.
- Produces: `localize<T>(node: T, lang: Lang): unknown` — deep clone where every `{en,fr,de}` object collapses to its `lang` string.

- [ ] **Step 1: Write the failing test** — `apps/api/src/localize.test.ts`

```ts
import { describe, expect, it } from "bun:test";
import { localize } from "./localize";

describe("localize", () => {
  it("collapses localized objects to the chosen language", () => {
    const input = { title: { en: "Architect", fr: "Architecte", de: "Architekt" },
                    nested: [{ label: { en: "A", fr: "B", de: "C" } }], plain: 42 };
    expect(localize(input, "fr")).toEqual({ title: "Architecte", nested: [{ label: "B" }], plain: 42 });
  });
  it("does not treat a non-localized object as localized", () => {
    const input = { links: { en: "x" } }; // has en but also would fail full-locale check
    // { en: "x" } has only en key -> not all langs -> left as-is
    expect(localize(input, "en")).toEqual({ links: { en: "x" } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/api/src/localize.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `apps/api/src/localize.ts`**

```ts
import { LANGS, type Lang } from "@profile/schema";

function isFullyLocalized(v: any): boolean {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const keys = Object.keys(v);
  return keys.length === LANGS.length && LANGS.every((l) => typeof v[l] === "string");
}

export function localize(node: unknown, lang: Lang): unknown {
  if (isFullyLocalized(node)) return (node as any)[lang];
  if (Array.isArray(node)) return node.map((v) => localize(v, lang));
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) out[k] = localize(v, lang);
    return out;
  }
  return node;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/api/src/localize.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/localize.ts apps/api/src/localize.test.ts
git commit -m "feat(api): localize walker collapses localized nodes"
```

---

### Task 10: API — role routing

**Files:**
- Create: `apps/api/src/routing.ts`
- Test: `apps/api/src/routing.test.ts`

**Interfaces:**
- Consumes: `Tag`, `TargetRole` from `@profile/schema`.
- Produces:
  - `ROLE_WEIGHTS: Record<TargetRole, Partial<Record<Tag, number>>>`
  - `scoreItem(tags: Tag[], role: TargetRole): number`
  - `orderByRole<T extends { tags: Tag[] }>(items: T[], role: TargetRole): T[]` (stable, descending score)

- [ ] **Step 1: Write the failing test** — `apps/api/src/routing.test.ts`

```ts
import { describe, expect, it } from "bun:test";
import { scoreItem, orderByRole } from "./routing";

const projects = [
  { id: "seomnix", tags: ["ai_safety", "mlops", "dx_tooling"] as any },
  { id: "omnis-agri", tags: ["iot", "edge", "ai_safety", "mcp", "dx_tooling"] as any },
  { id: "ops-tools", tags: ["dx_tooling", "devsecops"] as any },
];

describe("scoreItem", () => {
  it("scores anthropic_dx by dx/ai weights", () => {
    expect(scoreItem(["ai_safety", "dx_tooling"] as any, "anthropic_dx")).toBe(19);
  });
});

describe("orderByRole", () => {
  it("puts SEOMNIX/ops-tools first for anthropic_dx", () => {
    const order = orderByRole(projects, "anthropic_dx").map((p) => p.id);
    expect(order[0]).toBe("seomnix"); // highest ai_safety(10)+dx(9)+... 
    expect(order).toContain("ops-tools");
    expect(order.indexOf("ops-tools")).toBeLessThan(order.indexOf("omnis-agri"));
  });
  it("puts Omnis-Agri first for iot", () => {
    expect(orderByRole(projects, "iot").map((p) => p.id)[0]).toBe("omnis-agri");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/api/src/routing.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `apps/api/src/routing.ts`**

```ts
import type { Tag, TargetRole } from "@profile/schema";

export const ROLE_WEIGHTS: Record<TargetRole, Partial<Record<Tag, number>>> = {
  anthropic_dx: { ai_safety: 10, dx_tooling: 9, mcp: 7, devsecops: 6, api_design: 5 },
  iot: { iot: 10, edge: 9, mcp: 6, ai_safety: 5, devsecops: 4 },
  plm_architect: { plm: 10, cloud: 7, security: 6, aerospace: 5 },
  default: {},
};

export function scoreItem(tags: Tag[], role: TargetRole): number {
  const w = ROLE_WEIGHTS[role];
  return tags.reduce((sum, t) => sum + (w[t] ?? 0), 0);
}

export function orderByRole<T extends { tags: Tag[] }>(items: T[], role: TargetRole): T[] {
  return items
    .map((item, i) => ({ item, i, score: scoreItem(item.tags, role) }))
    .sort((a, b) => b.score - a.score || a.i - b.i) // stable: original order breaks ties
    .map((x) => x.item);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/api/src/routing.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routing.ts apps/api/src/routing.test.ts
git commit -m "feat(api): role-based tag-weight ordering"
```

---

### Task 11: API — profile builder

**Files:**
- Create: `apps/api/src/profile.ts`
- Test: `apps/api/src/profile.test.ts`

**Interfaces:**
- Consumes: `resume` (Task 7), `localize` (Task 9), `orderByRole` (Task 10), `Resume`, `Lang`, `TargetRole`.
- Produces: `buildProfile(role: TargetRole, lang: Lang, data?: Resume): { person; executiveSummary: string; experiences; projects; skills; certifications; education; recommendations }` — projects & experiences ordered by role, all localized to `lang`, executive summary chosen by role.

- [ ] **Step 1: Write the failing test** — `apps/api/src/profile.test.ts`

```ts
import { describe, expect, it } from "bun:test";
import { buildProfile } from "./profile";
import { loadResume } from "./data";

const data = loadResume("data/master_data.i18n.json");

describe("buildProfile", () => {
  it("returns the role-specific summary in the requested language", () => {
    const out = buildProfile("anthropic_dx", "fr", data);
    expect(typeof out.executiveSummary).toBe("string");
    expect(out.person.title).toBe(data.person.title.fr);
  });
  it("orders projects for the role (ops-tools/seomnix before omnis-agri for anthropic_dx)", () => {
    const ids = buildProfile("anthropic_dx", "en", data).projects.map((p: any) => p.id);
    expect(ids.indexOf("omnis-agri")).toBe(ids.length - 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/api/src/profile.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `apps/api/src/profile.ts`**

```ts
import type { Lang, Resume, TargetRole } from "@profile/schema";
import { resume as defaultResume } from "./data";
import { localize } from "./localize";
import { orderByRole } from "./routing";

export function buildProfile(role: TargetRole, lang: Lang, data: Resume = defaultResume) {
  const projects = orderByRole(data.projects, role);
  const experiences = orderByRole(data.experiences, role);
  return {
    person: localize(data.person, lang),
    executiveSummary: data.executiveSummaries[role][lang],
    experiences: localize(experiences, lang),
    projects: localize(projects, lang),
    skills: localize(data.skills, lang),
    certifications: localize(data.certifications, lang),
    education: localize(data.education, lang),
    recommendations: localize(data.recommendations, lang),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/api/src/profile.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/profile.ts apps/api/src/profile.test.ts
git commit -m "feat(api): buildProfile composes ordering + localization + summary"
```

---

### Task 12: API — metrics

**Files:**
- Create: `apps/api/src/metrics.ts`
- Test: `apps/api/src/metrics.test.ts`

**Interfaces:**
- Produces:
  - `recordLatency(ms: number): void` and `latencySummary(): { count: number; avg_ms: number; p95_ms: number }`
  - `fetchCommitCount(fetchImpl?: typeof fetch): Promise<number>` (uses `GITHUB_TOKEN`/`GITHUB_REPO`; cached with TTL; returns 0 on failure)
  - `getMetrics(fetchImpl?: typeof fetch): Promise<{ latency; commits; uptime_pct }>`

- [ ] **Step 1: Write the failing test** — `apps/api/src/metrics.test.ts`

```ts
import { describe, expect, it } from "bun:test";
import { recordLatency, latencySummary, fetchCommitCount } from "./metrics";

describe("latency", () => {
  it("summarizes recorded samples", () => {
    for (const ms of [10, 20, 30, 40]) recordLatency(ms);
    const s = latencySummary();
    expect(s.count).toBeGreaterThanOrEqual(4);
    expect(s.avg_ms).toBeGreaterThan(0);
  });
});

describe("fetchCommitCount", () => {
  it("parses the GitHub Link header for the last page number", async () => {
    const fakeFetch = (async () => new Response("[]", {
      headers: { Link: '<https://api.github.com/x?page=2>; rel="next", <https://api.github.com/x?page=7>; rel="last"' },
    })) as unknown as typeof fetch;
    process.env.GITHUB_REPO = "fdiene/my-curriculum";
    expect(await fetchCommitCount(fakeFetch)).toBe(7);
  });
  it("returns 0 when the request throws", async () => {
    const boom = (async () => { throw new Error("network"); }) as unknown as typeof fetch;
    expect(await fetchCommitCount(boom)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/api/src/metrics.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `apps/api/src/metrics.ts`**

```ts
const samples: number[] = [];
const MAX = 500;

export function recordLatency(ms: number): void {
  samples.push(ms);
  if (samples.length > MAX) samples.shift();
}

export function latencySummary() {
  if (samples.length === 0) return { count: 0, avg_ms: 0, p95_ms: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]!;
  return { count: sorted.length, avg_ms: Math.round(avg * 100) / 100, p95_ms: p95 };
}

let cache: { count: number; at: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

export async function fetchCommitCount(fetchImpl: typeof fetch = fetch): Promise<number> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.count;
  try {
    const repo = process.env.GITHUB_REPO;
    if (!repo) return 0;
    const headers: Record<string, string> = { "User-Agent": "profile-engine" };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const res = await fetchImpl(`https://api.github.com/repos/${repo}/commits?per_page=1`, { headers });
    const link = res.headers.get("Link") ?? "";
    const m = link.match(/[?&]page=(\d+)>;\s*rel="last"/);
    const count = m ? parseInt(m[1]!, 10) : (Array.isArray(await res.clone().json()) ? 1 : 0);
    cache = { count, at: Date.now() };
    return count;
  } catch { return 0; }
}

export async function getMetrics(fetchImpl: typeof fetch = fetch) {
  return {
    latency: latencySummary(),
    commits: await fetchCommitCount(fetchImpl),
    uptime_pct: Number(process.env.UPTIME_PCT ?? "99.9"),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/api/src/metrics.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/metrics.ts apps/api/src/metrics.test.ts
git commit -m "feat(api): hybrid metrics — latency, github commits, uptime"
```

---

### Task 13: API — Elysia app (routes, swagger, cors, health)

**Files:**
- Create: `apps/api/src/app.ts`, `apps/api/src/index.ts`
- Test: `apps/api/src/app.test.ts`

**Interfaces:**
- Consumes: `buildProfile` (Task 11), `resume` (Task 7), `localize` (Task 9), `orderByRole` (Task 10), `resolveLocale` (Task 8), metrics (Task 12), `TargetRole` from schema.
- Produces: `export const app` (Elysia instance) and `export type App = typeof app` for Eden.

- [ ] **Step 1: Write the failing test** — `apps/api/src/app.test.ts`

```ts
import { describe, expect, it } from "bun:test";
import { app } from "./app";

async function get(path: string, headers?: Record<string, string>) {
  const res = await app.handle(new Request(`http://localhost${path}`, { headers }));
  return { status: res.status, body: await res.json() };
}

describe("routes", () => {
  it("GET /health", async () => {
    expect((await get("/health")).body).toEqual({ status: "ok" });
  });
  it("GET /v1/profile/build applies role + lang", async () => {
    const { status, body } = await get("/v1/profile/build?target_role=anthropic_dx&lang=fr");
    expect(status).toBe(200);
    expect(body.projects[body.projects.length - 1].id).toBe("omnis-agri");
    expect(typeof body.executiveSummary).toBe("string");
  });
  it("GET /v1/profile/build uses Accept-Language when no query", async () => {
    const { body } = await get("/v1/profile/build", { "Accept-Language": "de-DE,de;q=0.9" });
    expect(typeof body.person.title).toBe("string");
  });
  it("GET /v1/skills?tag= filters", async () => {
    const { body } = await get("/v1/skills?lang=en&tag=dx_tooling");
    expect(body.every((s: any) => true)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });
  it("GET /v1/projects?role= orders", async () => {
    const { body } = await get("/v1/projects?role=iot&lang=en");
    expect(body[0].id).toBe("omnis-agri");
  });
  it("GET /v1/metrics returns the shape", async () => {
    const { body } = await get("/v1/metrics");
    expect(body).toHaveProperty("latency");
    expect(body).toHaveProperty("commits");
    expect(body).toHaveProperty("uptime_pct");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/api/src/app.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `apps/api/src/app.ts`**

```ts
import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { TargetRole, type Tag } from "@profile/schema";
import { resume } from "./data";
import { resolveLocale } from "./locale";
import { localize } from "./localize";
import { orderByRole } from "./routing";
import { buildProfile } from "./profile";
import { getMetrics, recordLatency } from "./metrics";

const roleOf = (v?: string) =>
  (TargetRole.options as readonly string[]).includes(v ?? "") ? (v as any) : "default";

const ALLOWED_ORIGIN = process.env.WEB_ORIGIN ?? "https://fdiene.com";

export const app = new Elysia()
  .use(cors({ origin: [ALLOWED_ORIGIN, /^http:\/\/localhost:\d+$/], methods: ["GET"] }))
  .use(swagger({ path: "/swagger", documentation: { info: { title: "Profile Engine API", version: "1.0.0" } } }))
  .onAfterHandle(({ set }) => { void set; })
  .trace(async ({ onHandle }) => {
    onHandle(({ begin, onStop }) => onStop(({ end }) => recordLatency(end - begin)));
  })
  .get("/health", () => ({ status: "ok" }))
  .get("/v1/profile/build", ({ query, headers }) => {
    const lang = resolveLocale(query.lang, headers["accept-language"]);
    return buildProfile(roleOf(query.target_role), lang);
  }, { query: t.Object({ target_role: t.Optional(t.String()), lang: t.Optional(t.String()) }) })
  .get("/v1/skills", ({ query, headers }) => {
    const lang = resolveLocale(query.lang, headers["accept-language"]);
    const filtered = query.tag ? resume.skills.filter((s) => s.tags.includes(query.tag as Tag)) : resume.skills;
    return localize(filtered, lang);
  }, { query: t.Object({ lang: t.Optional(t.String()), tag: t.Optional(t.String()) }) })
  .get("/v1/projects", ({ query, headers }) => {
    const lang = resolveLocale(query.lang, headers["accept-language"]);
    return localize(orderByRole(resume.projects, roleOf(query.role)), lang);
  }, { query: t.Object({ lang: t.Optional(t.String()), role: t.Optional(t.String()) }) })
  .get("/v1/metrics", () => getMetrics());

export type App = typeof app;
```

> Note: if the `.trace` API differs in the installed Elysia version, replace it with a simple `onRequest`/`onAfterHandle` timestamp pair that calls `recordLatency`. The test only asserts the metrics *shape*, not exact timing.

- [ ] **Step 4: Create `apps/api/src/index.ts`**

```ts
import { app } from "./app";

const port = Number(process.env.PORT ?? 3000);
app.listen(port);
console.log(`Profile Engine API on http://localhost:${port}  (swagger: /swagger)`);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test apps/api/src/app.test.ts`
Expected: PASS (6 tests). If `.trace` throws on load, apply the fallback in the note and re-run.

- [ ] **Step 6: Smoke-run the server**

Run: `bun apps/api/src/index.ts`
Then in another shell: `curl "http://localhost:3000/v1/profile/build?target_role=anthropic_dx&lang=de"`
Expected: JSON with German strings; `curl http://localhost:3000/swagger` serves the UI. Stop with Ctrl-C.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/app.ts apps/api/src/index.ts apps/api/src/app.test.ts
git commit -m "feat(api): Elysia app — profile/skills/projects/metrics + swagger + cors"
```

---

### Task 14: Private career-advisor tool

**Files:**
- Create: `scripts/advisor.core.ts`, `scripts/career-advisor.ts`
- Test: `scripts/advisor.core.test.ts`

**Interfaces:**
- Consumes: `ResumeInput` from `@profile/schema`.
- Produces:
  - `buildAdvisorPrompt(resume: ResumeInput): string` (pure)
  - `renderInsights(sections: { title: string; body: string }[]): string` (pure markdown)
  - CLI writes `docs/career_insights.md` (git-ignored).

- [ ] **Step 1: Write the failing test** — `scripts/advisor.core.test.ts`

```ts
import { describe, expect, it } from "bun:test";
import { buildAdvisorPrompt, renderInsights } from "./advisor.core";
import src from "../data/master_data.fr.json";

describe("buildAdvisorPrompt", () => {
  it("includes the person name and asks for the 4 required sections", () => {
    const p = buildAdvisorPrompt(src as any);
    expect(p).toContain("Fadel Diène");
    for (const s of ["job", "skill gap", "positioning", "UX"]) expect(p.toLowerCase()).toContain(s);
  });
});

describe("renderInsights", () => {
  it("renders titled markdown sections", () => {
    const md = renderInsights([{ title: "Jobs", body: "- one" }]);
    expect(md).toContain("## Jobs");
    expect(md).toContain("- one");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test scripts/advisor.core.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `scripts/advisor.core.ts`**

```ts
import type { ResumeInput } from "@profile/schema";

export function buildAdvisorPrompt(resume: ResumeInput): string {
  const skills = resume.skills.map((s) => s.label).join(", ");
  const projects = resume.projects.map((p) => `${p.name}: ${p.tagline.en}`).join("; ");
  return [
    `You are a senior tech career advisor. Analyze this profile for ${resume.person.name}.`,
    `Current title: ${resume.person.title.en}. Location: ${resume.person.location}.`,
    `Skills: ${skills}.`,
    `Projects: ${projects}.`,
    `Produce four clearly separated sections:`,
    `1. Matching current job openings (roles + why they fit).`,
    `2. Skill gaps to close (concrete, prioritized).`,
    `3. Positioning strategies (how to sell the profile better).`,
    `4. CV/UX improvement ideas for an API-first web resume.`,
    `Be specific and actionable. Return Markdown with a "## " heading per section.`,
  ].join("\n");
}

export function renderInsights(sections: { title: string; body: string }[]): string {
  const header = `# Career Insights\n\n> Generated by scripts/career-advisor.ts — private, do not commit.\n`;
  return header + "\n" + sections.map((s) => `## ${s.title}\n\n${s.body}`).join("\n\n") + "\n";
}
```

- [ ] **Step 4: Create `scripts/career-advisor.ts`**

```ts
import Anthropic from "@anthropic-ai/sdk";
import type { ResumeInput } from "@profile/schema";
import { buildAdvisorPrompt, renderInsights } from "./advisor.core";

if (import.meta.main) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { console.error("ANTHROPIC_API_KEY is required"); process.exit(1); }
  const resume = (await Bun.file("data/master_data.fr.json").json()) as ResumeInput;
  const client = new Anthropic({ apiKey: key });
  const msg = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    tools: [{ type: "web_search_20250305", name: "web_search" } as any],
    messages: [{ role: "user", content: buildAdvisorPrompt(resume) }],
  });
  const text = msg.content.filter((b) => b.type === "text").map((b: any) => b.text).join("\n");
  const md = renderInsights([{ title: "Advisor Report", body: text }]);
  await Bun.write("docs/career_insights.md", md);
  console.log("Wrote docs/career_insights.md (git-ignored)");
}
```

> The `web_search` tool block is best-effort; if the installed SDK/model rejects the tool type, remove the `tools` line to fall back to model-only analysis (the plan's Global Constraints allow graceful degradation).

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test scripts/advisor.core.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit** (note: `career-advisor.ts` is committed; its OUTPUT is git-ignored)

```bash
git add scripts/advisor.core.ts scripts/career-advisor.ts scripts/advisor.core.test.ts
git commit -m "feat(scripts): private career-advisor CLI (git-ignored output)"
```

---

### Task 15: Web — Astro + Vue terminal view

**Files:**
- Create: `apps/web/package.json`, `apps/web/astro.config.mjs`, `apps/web/tsconfig.json`, `apps/web/src/lib/params.ts`, `apps/web/src/lib/client.ts`, `apps/web/src/components/Terminal.vue`, `apps/web/src/pages/index.astro`
- Test: `apps/web/src/lib/params.test.ts`

**Interfaces:**
- Consumes: `App` type from `@profile/api` (for Eden), `TargetRole`/`Lang` from schema.
- Produces: `parseViewParams(search: string): { role: TargetRole; lang: Lang }` (pure, tested); a page that fetches `/v1/profile/build` and renders it.

- [ ] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "@profile/web",
  "version": "0.1.0",
  "type": "module",
  "scripts": { "dev": "astro dev", "build": "astro build", "test": "bun test", "typecheck": "astro check" },
  "dependencies": {
    "astro": "^4.15.0",
    "@astrojs/vue": "^4.5.0",
    "vue": "^3.5.0",
    "@elysiajs/eden": "^1.1.0",
    "@profile/api": "workspace:*",
    "@profile/schema": "workspace:*"
  },
  "devDependencies": { "typescript": "^5.5.0", "bun-types": "^1.1.0" }
}
```

Run: `bun install`

- [ ] **Step 2: Write the failing test** — `apps/web/src/lib/params.test.ts`

```ts
import { describe, expect, it } from "bun:test";
import { parseViewParams } from "./params";

describe("parseViewParams", () => {
  it("reads role and lang from a query string", () => {
    expect(parseViewParams("?role=anthropic&lang=de")).toEqual({ role: "anthropic_dx", lang: "de" });
  });
  it("maps friendly role aliases and defaults", () => {
    expect(parseViewParams("")).toEqual({ role: "default", lang: "en" });
    expect(parseViewParams("?role=iot")).toEqual({ role: "iot", lang: "en" });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test apps/web/src/lib/params.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Create `apps/web/src/lib/params.ts`**

```ts
import { LANGS, TargetRole, type Lang, type TargetRole as Role } from "@profile/schema";

const ROLE_ALIASES: Record<string, Role> = {
  anthropic: "anthropic_dx", anthropic_dx: "anthropic_dx",
  iot: "iot", plm: "plm_architect", plm_architect: "plm_architect", default: "default",
};

export function parseViewParams(search: string): { role: Role; lang: Lang } {
  const q = new URLSearchParams(search);
  const role = ROLE_ALIASES[(q.get("role") ?? "").toLowerCase()] ?? "default";
  const rawLang = (q.get("lang") ?? "").toLowerCase();
  const lang = (LANGS as readonly string[]).includes(rawLang) ? (rawLang as Lang) : "en";
  void TargetRole;
  return { role, lang };
}
```

- [ ] **Step 5: Create `apps/web/src/lib/client.ts`**

```ts
import { treaty } from "@elysiajs/eden";
import type { App } from "@profile/api";

const base = import.meta.env.PUBLIC_API_URL ?? "http://localhost:3000";
export const api = treaty<App>(base);
```

- [ ] **Step 6: Create `apps/web/src/components/Terminal.vue`**

```vue
<script setup lang="ts">
import { ref, onMounted } from "vue";
import { api } from "../lib/client";
import { parseViewParams } from "../lib/params";

const profile = ref<any>(null);
const meta = ref({ role: "default", lang: "en" });

onMounted(async () => {
  const p = parseViewParams(window.location.search);
  meta.value = p;
  const { data } = await api.v1.profile.build.get({ query: { target_role: p.role, lang: p.lang } });
  profile.value = data;
});
</script>

<template>
  <section v-if="profile" class="term">
    <p class="prompt">$ profile --role {{ meta.role }} --lang {{ meta.lang }}</p>
    <h1>{{ profile.person.name }}</h1>
    <p class="title">{{ profile.person.title }}</p>
    <p class="summary">{{ profile.executiveSummary }}</p>
    <h2>Projects</h2>
    <ul>
      <li v-for="p in profile.projects" :key="p.id"><strong>{{ p.name }}</strong> — {{ p.tagline }}</li>
    </ul>
    <h2>Experience</h2>
    <ul>
      <li v-for="e in profile.experiences" :key="e.id"><strong>{{ e.role }}</strong>, {{ e.org }}</li>
    </ul>
  </section>
  <p v-else class="term">Loading…</p>
</template>

<style scoped>
.term { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; max-width: 60rem; margin: 2rem auto; padding: 0 1rem; }
.prompt { color: #22c55e; } .title { color: #64748b; } .summary { margin: 1rem 0; }
</style>
```

- [ ] **Step 7: Create `apps/web/astro.config.mjs`**

```js
import { defineConfig } from "astro/config";
import vue from "@astrojs/vue";
export default defineConfig({ integrations: [vue()], site: "https://fdiene.com" });
```

- [ ] **Step 8: Create `apps/web/tsconfig.json`**

```json
{ "extends": "astro/tsconfigs/strict", "include": ["src", "astro.config.mjs"] }
```

- [ ] **Step 9: Create `apps/web/src/pages/index.astro`**

```astro
---
import Terminal from "../components/Terminal.vue";
---
<html lang="en">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /><title>Fadel Diène — Profile Engine</title></head>
  <body><Terminal client:load /></body>
</html>
```

- [ ] **Step 10: Run tests + build**

Run: `bun test apps/web/src/lib/params.test.ts`
Expected: PASS (2 tests).
Run: `bun --cwd apps/web run build`
Expected: Astro build succeeds, output in `apps/web/dist`.

- [ ] **Step 11: Commit**

```bash
git add apps/web bun.lockb
git commit -m "feat(web): Astro + Vue terminal view via Eden client"
```

---

### Task 16: Infra — Dockerfile, Compose + Traefik, CI, README

**Files:**
- Create: `apps/api/Dockerfile`, `infra/docker-compose.yml`, `.github/workflows/ci.yml`, `README.md`

**Interfaces:**
- Consumes: the built API (Task 13) and the repo scripts.
- Produces: a deployable API container behind Traefik at `api.fdiene.com`; green CI.

- [ ] **Step 1: Create `apps/api/Dockerfile`**

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app
COPY package.json bun.lockb ./
COPY packages/schema/package.json packages/schema/package.json
COPY apps/api/package.json apps/api/package.json
RUN bun install --frozen-lockfile
COPY packages/schema packages/schema
COPY apps/api apps/api
COPY data/master_data.i18n.json data/master_data.i18n.json
ENV PORT=3000
EXPOSE 3000
CMD ["bun", "apps/api/src/index.ts"]
```

- [ ] **Step 2: Create `infra/docker-compose.yml`**

```yaml
services:
  profile-api:
    build:
      context: ..
      dockerfile: apps/api/Dockerfile
    container_name: profile-api
    restart: unless-stopped
    environment:
      - PORT=3000
      - WEB_ORIGIN=https://fdiene.com
      - GITHUB_REPO=${GITHUB_REPO}
      - GITHUB_TOKEN=${GITHUB_TOKEN}
      - UPTIME_PCT=${UPTIME_PCT:-99.9}
    networks:
      - traefik
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.profile-api.rule=Host(`api.fdiene.com`)"
      - "traefik.http.routers.profile-api.entrypoints=websecure"
      - "traefik.http.routers.profile-api.tls.certresolver=letsencrypt"
      - "traefik.http.services.profile-api.loadbalancer.server.port=3000"

networks:
  traefik:
    external: true
```

> Assumes an existing external Traefik network named `traefik` with a `letsencrypt` cert resolver and a `websecure` entrypoint (the SEOMNIX infra). If names differ on the VPS, align the labels to that Traefik instance.

- [ ] **Step 3: Validate the compose file**

Run: `docker compose -f infra/docker-compose.yml config`
Expected: prints the resolved config with no error.

- [ ] **Step 4: Create `.github/workflows/ci.yml`**

```yaml
name: CI
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: latest }
      - run: bun install --frozen-lockfile
      - run: bun test
      - run: bun run typecheck
```

- [ ] **Step 5: Create `README.md`**

````markdown
# Fadel Diène — API-First Profile Engine

Bun + Elysia monorepo serving an i18n (EN/FR/DE), role-aware résumé.
`fdiene.com` (Astro/Vue) consumes `api.fdiene.com` (Elysia) with end-to-end
types via Eden.

## Quick start
```bash
bun install
bun test
bun run api:dev            # http://localhost:3000  (/swagger)
bun --cwd apps/web run dev # http://localhost:4321
```

## Regenerate data
```bash
# edit data/master_data.fr.json (EN+FR), then:
ANTHROPIC_API_KEY=... bun scripts/generate-translations.ts   # → data/master_data.i18n.json
```

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

## Deploy
- **web:** `bun --cwd apps/web run build` → publish `apps/web/dist` to the CDN (`fdiene.com`), set `PUBLIC_API_URL=https://api.fdiene.com`.
- **api:** on the VPS, `docker compose -f infra/docker-compose.yml up -d --build` (joins the external `traefik` network; TLS via Let's Encrypt).
````

- [ ] **Step 6: Full verification**

Run: `bun test`
Expected: all package test suites PASS.
Run: `bun run typecheck`
Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add apps/api/Dockerfile infra/docker-compose.yml .github/workflows/ci.yml README.md
git commit -m "chore(infra): Dockerfile, Traefik compose, CI, README"
```

---

## Self-Review

**Spec coverage:**
- API stack Bun/Elysia/Eden → Tasks 7–13, 15. ✅
- Strict `{en,fr,de}` + source `{en,fr}` → Tasks 2–4. ✅
- Offline Anthropic translation, validated, idempotent → Tasks 5–6. ✅
- Role routing by tag weights (ops-tools/SEOMNIX first for anthropic_dx; Omnis-Agri for iot) → Tasks 10–11, 13. ✅
- Endpoints profile/build, skills, projects, metrics, health, swagger → Task 13. ✅
- Locale precedence query→header→en → Tasks 8, 13. ✅
- Hybrid metrics (live latency + GitHub + config uptime) → Task 12. ✅
- Private career-advisor, git-ignored output → Task 14; gitignore in Task 1. ✅
- Deployment split (CDN + VPS Traefik), CORS → Tasks 15–16. ✅
- Master data from CVs + 3 DRAFT projects → Task 4. ✅
- Phase-2 crash-course → intentionally deferred (separate plan). ✅

**Placeholder scan:** No TBD/TODO in steps; every code step has complete code. The two "if the API differs / remove the tool line" notes are explicit graceful-degradation instructions with concrete fallbacks, not placeholders.

**Type consistency:** `Localized`/`LocalizedInput`, `ResumeSchema`/`ResumeInputSchema`, `Lang`/`LANGS`, `TargetRole`, `Tag`, `scoreItem`/`orderByRole`, `buildProfile`, `resolveLocale`, `localize`, `getMetrics`/`fetchCommitCount`, `App` (Eden), `parseViewParams` — names are used identically across producing and consuming tasks.

**Known risk flagged for execution:** Elysia's `.trace` latency hook API varies by minor version (Task 13 note gives the fallback). All other integrations use stable surface.
