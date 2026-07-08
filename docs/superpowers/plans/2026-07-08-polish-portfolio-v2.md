# Polish & Portfolio v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owner-requested production polish: experience highlights displayed, photos support, SEO + JSON-LD, console UX (timestamps/clear/autoscroll), justified text, OMNIS flagship project added, career advisor wired to UPSKILLING.md.

**Architecture:** Additive schema fields (optional, no migration), one new Tier-1 project entry (OMNIS) + DE regeneration, a web UI batch on existing components, SEO sourced at build time from the embedded master data (no network at build), advisor prompt enrichment.

**Tech Stack:** existing monorepo. Zero new dependencies.

## Global Constraints

- Branch `feature/profile-engine-phase1`; suite currently 68 pass; run tests from repo root; do NOT use port 3000 without checking it's free.
- No em dash `—` anywhere (guard test enforces data; keep it out of code/copy too). No Co-Authored-By trailer in commits.
- OMNIS entry: content below is owner-approved DRAFT wording; transcribe EXACTLY; never write the word "FluxGuard" anywhere.
- SEO data source at build: import `data/master_data.i18n.json` in Astro frontmatter (deviation from "Eden at build" approved: static builds must not require a live API).
- `ANTHROPIC_API_KEY` for the translate run: load from `C:/Users/delfa/git/Workspaces/AI_agents/_shared/.env_global` (never print/commit).

---

### Task 1: Schema photo fields + OMNIS project entry (FR/EN)

**Files:**
- Modify: `packages/schema/src/entities.ts` (Person, Project)
- Modify: `packages/schema/src/resume.test.ts` (append)
- Modify: `data/master_data.fr.json` (add OMNIS project)
- Modify: `data/master_data.fr.test.ts` (ids)

**Interfaces:**
- Produces: `Person.avatarUrl?: string`, `Project.imageUrl?: string` (both `z.string().optional()`); 7th project id `omnis`.

- [ ] **Step 1: Append failing schema tests** to `packages/schema/src/resume.test.ts` (reuses `validProject`):

```ts
describe("photo fields", () => {
  it("accepts optional avatarUrl and imageUrl", () => {
    expect(ProjectSchema.parse({ ...validProject, imageUrl: "/covers/x.jpg" }).imageUrl).toBe("/covers/x.jpg");
    const person = {
      name: "F", title: { en: "a", fr: "a", de: "a" }, location: "T",
      links: {}, avatarUrl: "/avatar.jpg",
    };
    expect(PersonSchema.parse(person).avatarUrl).toBe("/avatar.jpg");
  });
});
```

(Import `PersonSchema` from `./index` if not already.)

- [ ] **Step 2: Run to verify failure** (`bun test packages/schema/src/resume.test.ts`: unknown key rejected? Person/Project are non-strict objects so unknown keys are stripped: the assertion `.toBe("/avatar.jpg")` fails with `undefined`).

- [ ] **Step 3: Add the fields** in `packages/schema/src/entities.ts`: in `Person` after `photo`: `avatarUrl: z.string().optional(),` ; in `Project` after `links`: `imageUrl: z.string().optional(),`.

- [ ] **Step 4: Update the ids test** in `data/master_data.fr.test.ts`:

```ts
    expect(ids).toEqual(["artmap", "harness", "omnis", "omnis-agri", "ops-tools", "profile-engine", "seomnix"]);
```

- [ ] **Step 5: Add the OMNIS entry** to `data/master_data.fr.json` projects array, in source position 2 (right after `profile-engine`, before `harness`), EXACTLY:

```json
{
  "id": "omnis",
  "name": "OMNIS",
  "tagline": {
    "en": "IT-flow governance from the ops floor: map, reconcile, prove.",
    "fr": "La gouvernance des flux SI par les opérations : cartographier, rapprocher, prouver."
  },
  "description": {
    "en": "IT-infrastructure flow-governance platform, piloted in an air-gapped aerospace environment: application and dependency mapping (ArchiMate), flow-conformity reconciliation between the declared repository and security rules (four-state model), deterministic rule-conflict detection and signature-based deduplication. Open-Core TypeScript monorepo with a client edition isolated by carve-out: 88 tests, configurable repository imports with anonymization. Product pivot under way toward IT-landscape governance, as an ops-first challenger to enterprise-architecture tools.",
    "fr": "Plateforme de gouvernance des flux d'infrastructure SI, éprouvée en pilote dans un environnement aéronautique cloisonné : cartographie des applications et de leurs dépendances (ArchiMate), rapprochement de conformité des flux entre référentiel déclaré et règles de sécurité (modèle à quatre états), détection déterministe des conflits de règles et déduplication par signature. Monorepo TypeScript Open-Core avec édition client isolée par carve-out : 88 tests, imports de référentiels configurables avec anonymisation. Pivot produit en cours vers l'urbanisation du SI, en challenger ops-first des outils d'architecture d'entreprise."
  },
  "stack": ["TypeScript", "Node.js", "PostgreSQL", "Zod", "pnpm", "Turborepo", "Docker", "ArchiMate"],
  "tags": ["plm", "cloud", "security", "aerospace"],
  "links": {},
  "status": "building",
  "featured_for": ["plm_architect"]
}
```

- [ ] **Step 6: Green + commit**

Run: `bun test packages/schema data/` then full `bun test` (expect: schema+data green; `apps/api` ordering tests may still pass since i18n is stale: full-suite count noted in report). `git add` the four files; commit `feat: photo fields + OMNIS flagship entry (FR/EN)`.

---

### Task 2: DE regeneration + ordering-test alignment

**Files:**
- Regenerate: `data/master_data.i18n.json`
- Modify: `apps/api/src/profile.test.ts`, `apps/api/src/app.test.ts`

**Interfaces:**
- Produces: i18n data with 7 projects (OMNIS in German included). New ordering facts: `plm_architect` head = `omnis` (28+100 boost); `ai_dx` head unchanged (harness, profile-engine, seomnix, ops-tools) but LAST id becomes `omnis` (score 0 < artmap 15); `iot` first still `omnis-agri`; `default` first still `artmap`.

- [ ] **Step 1: Regenerate** (`export ANTHROPIC_API_KEY=...` from the env_global file, then `bun scripts/generate-translations.ts`). Post-checks: `grep -c "—" data/master_data.i18n.json` → 0; no `[DRAFT]`; spot-read the OMNIS German for register (technical terms verbatim, nominal style); fix by hand if needed and document.

- [ ] **Step 2: Align tests.** `apps/api/src/profile.test.ts`: the ai_dx ordering test's last-id assertion becomes `expect(ids[ids.length - 1]).toBe("omnis");` and add `expect(ids).toContain("artmap");`. Add one new test:

```ts
  it("puts OMNIS first for plm_architect (featured flagship)", () => {
    expect(buildProfile("plm_architect", "en", data).projects[0].id).toBe("omnis");
  });
```

`apps/api/src/app.test.ts`: the profile/build test's last-project assertion `"artmap"` becomes `"omnis"`.

- [ ] **Step 3: Full green + commit**

`bun test` all pass (69+); `bun run typecheck` clean. Commit `feat(data): OMNIS in German via pipeline; align ordering tests`.

---

### Task 3: Web UI batch (highlights, photos, justify, console UX, SEO)

**Files:**
- Modify: `apps/web/src/components/Terminal.vue`, `ProjectCard.vue`, `ConsolePane.vue`
- Modify: `apps/web/src/lib/useConsole.ts` (+ its test)
- Modify: `apps/web/src/pages/index.astro`
- Modify: `apps/web/src/styles/global.css`

**Interfaces:**
- `ConsoleEntry` gains `time: string` (HH:MM:SS, set by `log()`); `useConsole` gains `clear()`.

- [ ] **Step 1: useConsole: failing test additions** (`apps/web/src/lib/useConsole.test.ts`):

```ts
  it("stamps entries with a time and clears", () => {
    const c = useConsole({ role: "default", isMobile: false });
    c.log({ kind: "system", text: "x" });
    expect(c.entries.value[0].time).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    c.clear();
    expect(c.entries.value.length).toBe(0);
  });
```

- [ ] **Step 2: Implement** in `useConsole.ts`: `ConsoleEntry` gains `time?: string`; `log()` sets `time: new Date().toTimeString().slice(0, 8)` when absent; add `function clear() { entries.value = []; }` and return it.

- [ ] **Step 3: ConsolePane.vue**: render `<span class="time">{{ e.time }}</span>` before each entry (muted); add a `clear` button in the tab row (`aria-label="Clear console"`, emits `clear`); auto-scroll: `watch(() => props.entries.length, async () => { await nextTick(); bodyEl.value?.scrollTo({ top: bodyEl.value.scrollHeight }); })` with `ref` on the body div. Wire `@clear="c.clear()"` in Terminal.vue.

- [ ] **Step 4: Experience highlights** in `Terminal.vue` Experience block: under each `.xps` summary add:

```html
<ul class="hl">
  <li v-for="(h, i) in e.highlights" :key="i">{{ h }}</li>
</ul>
```

Style: `.hl { margin: 0.3rem 0 0 1rem; padding: 0; font-size: 0.88rem; } .hl li { margin-bottom: 0.2rem; }`.

- [ ] **Step 5: Photos.** `Terminal.vue`: next to `<h1>`, `<img v-if="(prof.person as any).avatarUrl" class="avatar" :src="(prof.person as any).avatarUrl" alt="" width="56" height="56" />` (`.avatar { border-radius: 50%; object-fit: cover; }`, flexed with h1). `ProjectCard.vue`: `<img v-if="project.imageUrl" class="cover" :src="project.imageUrl" alt="" loading="lazy" />` at the top of the card (`.cover { width: 100%; border-radius: 8px 8px 0 0; max-height: 140px; object-fit: cover; }`). No data change (fields empty until the owner drops files in `apps/web/public/` and fills the JSON).

- [ ] **Step 6: Justify** in `global.css`: `.summary, .desc, .xps { text-align: justify; hyphens: auto; }` (plus `-webkit-hyphens`).

- [ ] **Step 7: SEO + JSON-LD** in `index.astro` frontmatter (build-time, no network):

```astro
---
import Terminal from "../components/Terminal.vue";
import "../styles/global.css";
import resume from "../../../../data/master_data.i18n.json";

const person = resume.person;
const description = resume.executiveSummaries.default.en;
const sameAs = [person.links.linkedin, person.links.github].filter(Boolean);
const ld = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: person.name,
  jobTitle: person.title.en,
  url: "https://fdiene.com",
  sameAs,
};
---
```

Head additions: `<title>{person.name} : {person.title.en}</title>`, `<meta name="description" content={description} />`, OG tags (`og:title`, `og:description`, `og:type=profile`, `og:url`), and `<script type="application/ld+json" set:html={JSON.stringify(ld)} />`. Keep the theme-init script first.

- [ ] **Step 8: Verify + commit**

`bun test` (all pass, includes the new useConsole test), `bun --cwd=apps/web run typecheck`, `bun --cwd=apps/web run build`, then grep the built `dist/index.html` for `application/ld+json` and `og:title`. Commit `feat(web): highlights, photos, justify, console UX, SEO + JSON-LD`.

---

### Task 4: Career advisor wired to UPSKILLING.md

**Files:**
- Modify: `scripts/advisor.core.ts`, `scripts/career-advisor.ts`
- Test: `scripts/advisor.core.test.ts` (append)

**Interfaces:**
- `buildAdvisorPrompt(resume: ResumeInput, upskilling?: string): string`: when `upskilling` is provided, the prompt embeds it and asks the model to align its skill-gap coaching with that per-project plan (which TODO to tackle first, for which market gap).

- [ ] **Step 1: Failing test** (append):

```ts
  it("embeds the upskilling plan and asks to align coaching with it", () => {
    const p = buildAdvisorPrompt(src as any, "## ops-tools\n- [ ] publier sur npm");
    expect(p).toContain("publier sur npm");
    expect(p.toLowerCase()).toContain("upskilling");
  });
  it("stays valid without an upskilling plan", () => {
    expect(buildAdvisorPrompt(src as any)).not.toContain("upskilling plan below");
  });
```

- [ ] **Step 2: Implement.** In `advisor.core.ts`, `buildAdvisorPrompt(resume, upskilling?)`: after the 4 sections list, when `upskilling` is truthy append:

```ts
    `The candidate maintains a per-project upskilling plan (below). Align section 2 with it: `,
    `recommend which unchecked TODO to tackle first, in which project, and for which market gap. `,
    `Reference plan items explicitly.`,
    `--- UPSKILLING PLAN BELOW ---`,
    upskilling,
```

(joined like the rest). In `career-advisor.ts` main block: `const upskilling = await Bun.file("docs/UPSKILLING.md").exists() ? await Bun.file("docs/UPSKILLING.md").text() : undefined;` and pass it.

- [ ] **Step 3: Green + commit**

`bun test scripts/` (5 pass) + full suite. Commit `feat(scripts): career advisor coaches against the UPSKILLING plan`.

---

### Task 5: Final verification

- [ ] `bun test` all green; `bun run typecheck` clean; `bun --cwd=apps/web run build` success.
- [ ] Controller: refresh `docs/review-de.md` with the OMNIS DE back-translation entry.
- [ ] Owner visual pass: highlights visibles, avatar/cover (après dépôt des fichiers), console horodatée + clear + autoscroll, texte justifié, `?role=plm` montre OMNIS en tête.

## Self-Review

- Coverage: owner points 1-4 → T3 (1: Step 4, 2: Step 5 + T1 schema, 3: Step 7, 4: no-op acknowledged) ; console UX → T3 Steps 1-3 ; justify → T3 Step 6 ; OMNIS → T1-T2 ; advisor → T4. ✅
- Placeholders: none; OMNIS wording complete and final (owner-approved approach, exact text above). ✅
- Types: `ConsoleEntry.time` optional (log fills it) so existing constructions stay valid; `buildAdvisorPrompt` second param optional keeps the CLI backward-compatible. Ordering math for T2 verified: omnis ai_dx score 0 (tags plm/cloud/security/aerospace ∉ ai_dx weights) < artmap 15 → omnis last; plm view omnis 28+100 first. ✅
