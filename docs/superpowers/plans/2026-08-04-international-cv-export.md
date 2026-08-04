# International CV Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated `/cv` route rendering an ATS-safe, printable resume with three national templates (France, Switzerland, USA) crossed with the existing 3 languages, per `docs/superpowers/specs/2026-08-04-international-cv-export-design.md`.

**Architecture:** Pure trimming/config logic in `@profile/core` (`buildCv.ts`), URL param parsing in `apps/web/src/lib/params.ts`, and an isolated `CvDocument.vue` presentation component that renders client-side from the site's already-bundled static `Resume` data (no API call, no server-side PDF generation).

**Tech Stack:** Existing stack only - Vue 3 `<script setup>`, Astro, Bun test. No new dependencies.

## Global Constraints

- Never use the em dash character "—" in any code, comment, or generated content - use ":" or "-" instead.
- No Tailwind: this project uses scoped `<style>` blocks with the existing CSS custom properties (`var(--text)`, `var(--border)`, `var(--accent-live)`, etc. from `apps/web/src/styles/tokens.css`), matching every existing component.
- `CvDocument.vue` and its CV content styling do not use theme CSS variables for the document body itself (deliberately plain black-on-white always, since it represents a printable document, not the themed terminal UI). The `no-print` controls bar may use theme variables as normal.
- `CvDocument.vue` reads the bundled static `data/master_data.i18n.json` directly (same file `useProfile.ts` already imports as its offline fallback) - it does not call `useProfile()` or fetch the live API.
- Every new pure function/config lives in a `.ts`/`.core.ts`-equivalent file with a co-located `bun:test` file, matching `buildProfile.ts`/`buildProfile.test.ts`. Vue components (`TemplateSwitcher.vue`, `CvDocument.vue`) and the Astro route (`cv.astro`) do not get dedicated test files, matching the existing convention (`LangSwitcher.vue`, `RoleSwitcher.vue`, `SectionBlock.vue` have none) - verified instead via `bun run build` and a live dev-server smoke check in the final task.
- Exact template values (do not deviate): France `{photo: false, maxExperiences: 4, maxHighlightsPerExperience: 3, documentLabel: "Curriculum Vitae"}`; Switzerland `{photo: true, maxExperiences: 5, maxHighlightsPerExperience: 4, documentLabel: "Curriculum Vitae"}`; USA `{photo: false, maxExperiences: 3, maxHighlightsPerExperience: 2, documentLabel: "Resume"}`.
- Default template when `?template=` is absent or invalid: infer from `lang` - `fr -> fr`, `de -> ch`, `en -> us`. An explicit, valid `?template=` value always wins over this inference.
- The CV includes an "Independent Projects" section, capped at 3, compact (title, stack, one-line tagline). It reuses `profile.projects` as already ordered by `buildProfile`'s existing internal `orderByRole` call - no new sorting logic.

---

### Task 1: Core CV logic and template config (`packages/core`)

**Files:**
- Create: `packages/core/src/buildCv.ts`
- Create: `packages/core/src/buildCv.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `buildProfile(role, lang, data, now?)` and `Profile` from `./buildProfile`; `orderByRole` from `./routing`; `localize` from `./localize`; `Lang`, `Resume`, `TargetRole` from `@profile/schema`.
- Produces: `CvTemplateId` (`"fr" | "ch" | "us"`), `CvTemplateConfig` interface, `CV_TEMPLATES` constant, `CvView` interface, `buildCvView(template, role, lang, data)` function - all re-exported from `@profile/core` for Task 2 and Task 4 to import. `CvView.projects` is capped at 3, already role-ordered.

- [ ] **Step 1: Write the failing tests**

Create `packages/core/src/buildCv.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import type { Resume, Tag, TargetRole } from "@profile/schema";
import { buildCvView, CV_TEMPLATES } from "./buildCv";

const L = { en: "x", fr: "x", de: "x" };

function makeExperience(id: string, highlightCount: number): Resume["experiences"][number] {
  return {
    id,
    role: L,
    org: `Org ${id}`,
    location: "L",
    period: { start: "2020-01", end: null },
    summary: L,
    highlights: Array.from({ length: highlightCount }, (_, i) => ({ en: `h${i}`, fr: `h${i}`, de: `h${i}` })),
    tags: [],
    domain: "d",
  };
}

function makeSkill(id: string, level: number, tags: Tag[] = []): Resume["skills"][number] {
  return { id, label: `Skill ${id}`, category: "cat", level, tags };
}

function makeProject(id: string, tags: Tag[] = [], featuredFor: TargetRole[] = []): Resume["projects"][number] {
  return {
    id,
    name: `Project ${id}`,
    tagline: L,
    description: L,
    stack: ["TypeScript"],
    tags,
    links: {},
    status: "live",
    featured_for: featuredFor,
  };
}

function makeResume(overrides: Partial<Resume> = {}): Resume {
  return {
    person: {
      name: "Test",
      title: L,
      location: "Toulouse",
      links: { linkedin: "https://linkedin.com/in/test", github: "https://github.com/test" },
      avatarUrl: "/avatar.jpg",
    },
    executiveSummaries: { ai_dx: L, iot: L, plm_architect: L, default: L },
    experiences: Array.from({ length: 6 }, (_, i) => makeExperience(`e${i}`, 5)),
    projects: [],
    skills: Array.from({ length: 6 }, (_, i) => makeSkill(`s${i}`, 3)),
    certifications: [],
    education: [],
    recommendations: [],
    ...overrides,
  } as Resume;
}

describe("buildCvView", () => {
  it("trims experiences and their highlights to the France template's limits", () => {
    const view = buildCvView("fr", "default", "en", makeResume());
    expect(view.experiences.length).toBe(CV_TEMPLATES.fr.maxExperiences);
    for (const e of view.experiences) {
      expect(e.highlights.length).toBeLessThanOrEqual(CV_TEMPLATES.fr.maxHighlightsPerExperience);
    }
  });

  it("trims to the Switzerland template's limits (input exceeds even the larger cap)", () => {
    const view = buildCvView("ch", "default", "en", makeResume());
    expect(view.experiences.length).toBe(CV_TEMPLATES.ch.maxExperiences);
  });

  it("trims to the USA template's limits", () => {
    const view = buildCvView("us", "default", "en", makeResume());
    expect(view.experiences.length).toBe(CV_TEMPLATES.us.maxExperiences);
    for (const e of view.experiences) {
      expect(e.highlights.length).toBeLessThanOrEqual(CV_TEMPLATES.us.maxHighlightsPerExperience);
    }
  });

  it("includes the photo only for the Switzerland template", () => {
    const ch = buildCvView("ch", "default", "en", makeResume());
    const fr = buildCvView("fr", "default", "en", makeResume());
    const us = buildCvView("us", "default", "en", makeResume());
    expect(ch.person.avatarUrl).toBe("/avatar.jpg");
    expect(fr.person.avatarUrl).toBeUndefined();
    expect(us.person.avatarUrl).toBeUndefined();
  });

  it("sets documentLabel from the template config", () => {
    expect(buildCvView("us", "default", "en", makeResume()).documentLabel).toBe("Resume");
    expect(buildCvView("fr", "default", "en", makeResume()).documentLabel).toBe("Curriculum Vitae");
    expect(buildCvView("ch", "default", "en", makeResume()).documentLabel).toBe("Curriculum Vitae");
  });

  it("caps skills at 15 and orders them by role relevance", () => {
    const manySkills = Array.from({ length: 20 }, (_, i) => makeSkill(`s${i}`, 3, i === 19 ? (["plm"] as Tag[]) : []));
    const view = buildCvView("ch", "plm_architect", "en", makeResume({ skills: manySkills }));
    expect(view.skills.length).toBe(15);
    expect(view.skills[0]?.id).toBe("s19");
  });

  it("caps projects at 3 and keeps buildProfile's existing role ordering", () => {
    const projects = [
      makeProject("p0"),
      makeProject("p1"),
      makeProject("p2", ["plm"]),
      makeProject("p3"),
      makeProject("p4", [], ["plm_architect"]),
    ];
    const view = buildCvView("us", "plm_architect", "en", makeResume({ projects }));
    expect(view.projects.length).toBe(3);
    expect(view.projects[0]?.id).toBe("p4");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun test packages/core/src/buildCv.test.ts`
Expected: FAIL - `Cannot find module './buildCv'` (file doesn't exist yet).

- [ ] **Step 3: Implement `buildCv.ts`**

Create `packages/core/src/buildCv.ts`:

```ts
import type { Lang, Resume, TargetRole } from "@profile/schema";
import { buildProfile, type Profile } from "./buildProfile";
import { orderByRole } from "./routing";
import { localize } from "./localize";

export type CvTemplateId = "fr" | "ch" | "us";

export interface CvTemplateConfig {
  photo: boolean;
  maxExperiences: number;
  maxHighlightsPerExperience: number;
  documentLabel: string;
}

export const CV_TEMPLATES: Record<CvTemplateId, CvTemplateConfig> = {
  fr: { photo: false, maxExperiences: 4, maxHighlightsPerExperience: 3, documentLabel: "Curriculum Vitae" },
  ch: { photo: true, maxExperiences: 5, maxHighlightsPerExperience: 4, documentLabel: "Curriculum Vitae" },
  us: { photo: false, maxExperiences: 3, maxHighlightsPerExperience: 2, documentLabel: "Resume" },
};

const MAX_SKILLS = 15;
const MAX_PROJECTS = 3;

export interface CvView extends Profile {
  documentLabel: string;
}

export function buildCvView(template: CvTemplateId, role: TargetRole, lang: Lang, data: Resume): CvView {
  const config = CV_TEMPLATES[template];
  const profile = buildProfile(role, lang, data);
  const skills = localize(orderByRole(data.skills, role), lang).slice(0, MAX_SKILLS);
  const experiences = profile.experiences
    .slice(0, config.maxExperiences)
    .map((e) => ({ ...e, highlights: e.highlights.slice(0, config.maxHighlightsPerExperience) }));

  return {
    ...profile,
    person: { ...profile.person, avatarUrl: config.photo ? profile.person.avatarUrl : undefined },
    experiences,
    projects: profile.projects.slice(0, MAX_PROJECTS),
    skills,
    documentLabel: config.documentLabel,
  };
}
```

- [ ] **Step 4: Export from the package barrel**

In `packages/core/src/index.ts`, add one line (file currently has 3 `export *` lines):

```ts
export * from "./buildCv";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun test packages/core/src/buildCv.test.ts`
Expected: PASS, 7/7.

- [ ] **Step 6: Typecheck**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun run typecheck`
Expected: 0 errors across all workspaces.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/buildCv.ts packages/core/src/buildCv.test.ts packages/core/src/index.ts
git commit -m "feat(core): add buildCvView and the 3 national CV templates"
```

---

### Task 2: URL parameter parsing for the CV route (`apps/web`)

**Files:**
- Modify: `apps/web/src/lib/params.ts`
- Modify: `apps/web/src/lib/params.test.ts`

**Interfaces:**
- Consumes: existing `parseViewParams(search)` from the same file (returns `{ role, lang }`); `CV_TEMPLATES`, `CvTemplateId` from `@profile/core` (Task 1).
- Produces: `parseCvParams(search: string): { role: TargetRole; lang: Lang; template: CvTemplateId }`, imported by `CvDocument.vue` in Task 4.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/src/lib/params.test.ts` (after the existing `describe("parseViewParams", ...)` block):

```ts
import { parseCvParams } from "./params";

describe("parseCvParams", () => {
  it("infers the template from the language when template is absent", () => {
    expect(parseCvParams("?lang=fr").template).toBe("fr");
    expect(parseCvParams("?lang=de").template).toBe("ch");
    expect(parseCvParams("").template).toBe("us");
  });

  it("uses an explicit template even when it doesn't match the language default", () => {
    expect(parseCvParams("?lang=en&template=fr").template).toBe("fr");
    expect(parseCvParams("?lang=fr&template=ch").template).toBe("ch");
  });

  it("falls back to the language default on an invalid template value", () => {
    expect(parseCvParams("?lang=de&template=bogus").template).toBe("ch");
  });

  it("still parses role and lang the same way as parseViewParams", () => {
    expect(parseCvParams("?role=iot&lang=de")).toEqual({ role: "iot", lang: "de", template: "ch" });
  });
});
```

Also update the existing top import line in `params.test.ts` from:
```ts
import { parseViewParams } from "./params";
```
to:
```ts
import { parseCvParams, parseViewParams } from "./params";
```
(remove the separate `import { parseCvParams } from "./params";` line added above and fold it into this single import instead.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun test apps/web/src/lib/params.test.ts`
Expected: FAIL - `parseCvParams` is not exported.

- [ ] **Step 3: Implement `parseCvParams`**

In `apps/web/src/lib/params.ts`, add the import and the new function (file currently ends after `parseViewParams`):

```ts
import { CV_TEMPLATES, type CvTemplateId } from "@profile/core";

const LANG_TO_DEFAULT_TEMPLATE: Record<Lang, CvTemplateId> = { fr: "fr", de: "ch", en: "us" };

export function parseCvParams(search: string): { role: Role; lang: Lang; template: CvTemplateId } {
  const { role, lang } = parseViewParams(search);
  const rawTemplate = (new URLSearchParams(search).get("template") ?? "").toLowerCase();
  const template = rawTemplate in CV_TEMPLATES ? (rawTemplate as CvTemplateId) : LANG_TO_DEFAULT_TEMPLATE[lang];
  return { role, lang, template };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun test apps/web/src/lib/params.test.ts`
Expected: PASS, 8/8 (4 existing `parseViewParams` + 4 new `parseCvParams`).

- [ ] **Step 5: Typecheck**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun run typecheck`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/params.ts apps/web/src/lib/params.test.ts
git commit -m "feat(web): add parseCvParams with lang-to-template default inference"
```

---

### Task 3: `TemplateSwitcher.vue`

**Files:**
- Create: `apps/web/src/components/TemplateSwitcher.vue`

**Interfaces:**
- Consumes: `CV_TEMPLATES`, `CvTemplateId` from `@profile/core` (Task 1).
- Produces: a `modelValue`/`update:modelValue` component consumed by `CvDocument.vue` in Task 4, styled identically to `LangSwitcher.vue`.

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/TemplateSwitcher.vue`:

```vue
<script setup lang="ts">
import { CV_TEMPLATES, type CvTemplateId } from "@profile/core";
defineProps<{ modelValue: CvTemplateId }>();
const emit = defineEmits<{ "update:modelValue": [CvTemplateId] }>();
const templates = Object.keys(CV_TEMPLATES) as CvTemplateId[];
</script>

<template>
  <div class="templates no-print">
    <button v-for="t in templates" :key="t" class="mono" :class="{ active: t === modelValue }"
      :aria-pressed="t === modelValue" @click="emit('update:modelValue', t)">{{ t.toUpperCase() }}</button>
  </div>
</template>

<style scoped>
.templates { display: inline-flex; gap: 0.3rem; align-items: center; }
button { background: none; border: 1px solid var(--border); color: var(--text-muted); border-radius: 4px; padding: 0.2rem 0.5rem; cursor: pointer; font-size: 0.75rem; }
button.active { color: var(--accent-live); border-color: var(--accent-live); }
</style>
```

- [ ] **Step 2: Typecheck**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun run typecheck`
Expected: 0 errors. (No dedicated test file for this component - matches `LangSwitcher.vue`/`RoleSwitcher.vue` convention. Functional verification happens in Task 5's live smoke test.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/TemplateSwitcher.vue
git commit -m "feat(web): add TemplateSwitcher component"
```

---

### Task 4: `CvDocument.vue`

**Files:**
- Create: `apps/web/src/components/CvDocument.vue`

**Interfaces:**
- Consumes: `buildCvView`, `type CvTemplateId` from `@profile/core`; `parseCvParams` from `../lib/params`; `RoleSwitcher.vue`, `LangSwitcher.vue`, `TemplateSwitcher.vue`; the bundled `data/master_data.i18n.json` (same file `useProfile.ts` already imports as `FALLBACK`).
- Produces: the default export consumed by `cv.astro` in Task 5 as `<CvDocument client:only="vue" />`.

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/CvDocument.vue`:

```vue
<script setup lang="ts">
import { computed, ref } from "vue";
import { buildCvView, type CvTemplateId } from "@profile/core";
import type { Lang, Resume, TargetRole } from "@profile/schema";
import fallbackJson from "../../../../data/master_data.i18n.json";
import { parseCvParams } from "../lib/params";
import RoleSwitcher from "./RoleSwitcher.vue";
import LangSwitcher from "./LangSwitcher.vue";
import TemplateSwitcher from "./TemplateSwitcher.vue";

const DATA = fallbackJson as unknown as Resume;

const initial = parseCvParams(typeof window === "undefined" ? "" : window.location.search);
const role = ref<TargetRole>(initial.role);
const lang = ref<Lang>(initial.lang);
const template = ref<CvTemplateId>(initial.template);

const view = computed(() => buildCvView(template.value, role.value, lang.value, DATA));

function syncUrl() {
  if (typeof window === "undefined") return;
  history.replaceState(null, "", `?role=${role.value}&lang=${lang.value}&template=${template.value}`);
}
function onRole(r: TargetRole) { role.value = r; syncUrl(); }
function onLang(l: Lang) { lang.value = l; syncUrl(); }
function onTemplate(t: CvTemplateId) { template.value = t; syncUrl(); }
function printCv() { window.print(); }
</script>

<template>
  <div class="cv-page">
    <nav class="controls no-print">
      <RoleSwitcher :modelValue="role" @update:modelValue="onRole" />
      <LangSwitcher :modelValue="lang" @update:modelValue="onLang" />
      <TemplateSwitcher :modelValue="template" @update:modelValue="onTemplate" />
      <button class="print-btn mono" @click="printCv">Print / Save as PDF</button>
    </nav>

    <article class="cv-doc">
      <header class="cv-header">
        <img v-if="view.person.avatarUrl" class="photo" :src="view.person.avatarUrl" alt="" width="96" height="96" />
        <div>
          <h1>{{ view.person.name }}</h1>
          <p class="title">{{ view.person.title }}</p>
          <p class="contact">
            {{ view.person.location }}
            <span v-if="view.person.links?.email"> - {{ view.person.links.email }}</span>
            <span v-if="view.person.links?.linkedin"> - {{ view.person.links.linkedin }}</span>
          </p>
        </div>
      </header>
      <p class="doc-label mono">{{ view.documentLabel }}</p>

      <section>
        <p class="summary">{{ view.executiveSummary }}</p>
      </section>

      <section>
        <h2>Experience</h2>
        <div v-for="e in view.experiences" :key="e.id" class="entry">
          <div class="entry-head">
            <strong>{{ e.role }}</strong>, {{ e.org }}
            <span class="dates">{{ e.period.start }} - {{ e.period.end ?? "Present" }}</span>
          </div>
          <ul>
            <li v-for="(h, i) in e.highlights" :key="i">{{ h }}</li>
          </ul>
        </div>
      </section>

      <section v-if="view.projects.length">
        <h2>Independent Projects</h2>
        <div v-for="pr in view.projects" :key="pr.id" class="entry">
          <div class="entry-head"><strong>{{ pr.name }}</strong> <span class="dates">{{ pr.stack.join(", ") }}</span></div>
          <p class="project-line">{{ pr.tagline }}</p>
        </div>
      </section>

      <section v-if="view.education.length">
        <h2>Education</h2>
        <div v-for="ed in view.education" :key="ed.id" class="entry">
          <div class="entry-head">
            <strong>{{ ed.title }}</strong>, {{ ed.org }}
            <span class="dates">{{ ed.period.start }} - {{ ed.period.end ?? "Present" }}</span>
          </div>
        </div>
      </section>

      <section v-if="view.certifications.length">
        <h2>Certifications</h2>
        <div v-for="c in view.certifications" :key="c.id" class="entry">
          <strong>{{ c.title }}</strong>, {{ c.org }} <span class="dates">{{ c.period.start }}</span>
        </div>
      </section>

      <section>
        <h2>Skills</h2>
        <ul class="skills mono">
          <li v-for="s in view.skills" :key="s.id">{{ s.label }}</li>
        </ul>
      </section>
    </article>
  </div>
</template>

<style scoped>
.cv-page { max-width: 50rem; margin: 0 auto; padding: 1.5rem; }
.controls { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; margin-bottom: 1.5rem; }
.print-btn { background: var(--accent-live); color: #fff; border: none; border-radius: 6px; padding: 0.4rem 0.9rem; cursor: pointer; font-size: 0.8rem; }
.cv-doc { color: #000; background: #fff; font-family: var(--font-sans); }
.cv-header { display: flex; gap: 1rem; align-items: center; margin-bottom: 0.5rem; }
.photo { border-radius: 4px; object-fit: cover; }
h1 { margin: 0; font-size: 1.6rem; }
.title { margin: 0.1rem 0; color: #333; }
.contact { margin: 0; font-size: 0.85rem; color: #333; }
.doc-label { margin: 0 0 1rem; font-size: 0.75rem; color: #666; text-transform: uppercase; letter-spacing: 0.05em; }
.summary { font-size: 0.95rem; }
h2 { font-size: 1.1rem; border-bottom: 1px solid #ccc; padding-bottom: 0.2rem; margin: 1.2rem 0 0.6rem; }
.entry { margin-bottom: 0.7rem; break-inside: avoid; }
.entry-head { font-size: 0.92rem; }
.dates { color: #555; font-size: 0.82rem; }
.project-line { margin: 0.2rem 0 0; font-size: 0.85rem; color: #333; }
ul { margin: 0.3rem 0 0; padding-left: 1.2rem; }
li { font-size: 0.85rem; margin-bottom: 0.2rem; }
.skills { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 0.4rem; }
.skills li { border: 1px solid #ccc; border-radius: 4px; padding: 0.15rem 0.5rem; font-size: 0.75rem; }
@media print {
  .cv-page { padding: 0; }
}
</style>
```

- [ ] **Step 2: Typecheck**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun run typecheck`
Expected: 0 errors. (No dedicated test file - verified live in Task 5.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/CvDocument.vue
git commit -m "feat(web): add CvDocument component with print button and section layout"
```

---

### Task 5: Route, Terminal.vue link, and final verification

**Files:**
- Create: `apps/web/src/pages/cv.astro`
- Modify: `apps/web/src/components/Terminal.vue`

**Interfaces:**
- Consumes: `CvDocument.vue` (Task 4); existing `p.role.value`/`p.lang.value` reactive refs already present in `Terminal.vue` (from `useProfile`).
- Produces: the public `/cv` route.

- [ ] **Step 1: Create the Astro route**

Create `apps/web/src/pages/cv.astro`, following `index.astro`'s exact shape:

```astro
---
import CvDocument from "../components/CvDocument.vue";
import "../styles/global.css";
import resume from "../../../../data/master_data.i18n.json";

const person = resume.person;
---
<html lang="en">
  <head>
    <meta charset="utf-8" /><meta name="viewport" content="width=device-width" />
    <script is:inline>
      const saved = localStorage.getItem("theme");
      const preferred = saved ?? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
      document.documentElement.dataset.theme = preferred;
    </script>
    <title>{person.name} : CV</title>
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="https://fdiene.com/cv" />
  </head>
  <body><CvDocument client:only="vue" /></body>
</html>
```

- [ ] **Step 2: Add the link from the terminal page**

In `apps/web/src/components/Terminal.vue`, locate the existing contact-icons block (the `<p class="contact mono">...</p>` containing the LinkedIn/Email/GitHub SVG links, right after the `<p class="mobility">` line). Add a new line immediately after that closing `</p>`:

```html
<a class="cv-link mono no-print" :href="`/cv?role=${p.role.value}&lang=${p.lang.value}`">Print CV -&gt;</a>
```

Add matching scoped CSS in the same file's `<style scoped>` block (alongside the existing `.contact` rules):

```css
.cv-link { display: inline-block; margin: 0 0 1rem; font-size: 0.8rem; color: var(--text-muted); text-decoration: none; border-bottom: 1px dashed var(--border); }
.cv-link:hover { color: var(--text); border-color: var(--text); }
```

- [ ] **Step 3: Run the full test suite and typecheck**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun test && bun run typecheck`
Expected: all tests pass (prior full-suite count plus the new tests from Tasks 1-2), 0 typecheck errors.

- [ ] **Step 4: Build**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun run build`
Expected: Astro build succeeds and generates a static `/cv/index.html` (or equivalent) alongside the existing `/index.html`.

- [ ] **Step 5: Live smoke test**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun --cwd=apps/web run dev`

With the dev server running, manually verify in a browser:
- `http://localhost:4321/` still works, and the new "Print CV ->" link is visible and points to `/cv` with the currently-selected role/lang carried over.
- `http://localhost:4321/cv` loads with the default `us` template (English default lang).
- Switching `LangSwitcher` to `fr` with no explicit `?template=` in the URL flips the default template to `fr` (Curriculum Vitae label, no photo).
- Switching `LangSwitcher` to `de` flips the default template to `ch` (Curriculum Vitae label, photo visible).
- Manually clicking `TemplateSwitcher` to `CH` while `lang=en` works (explicit selection overrides the language default), and the resulting URL is `?role=...&lang=en&template=ch`.
- The "Independent Projects" section shows at most 3 projects (title, stack, one-line tagline), ordered by role relevance (e.g. `plm_architect` shows OMNIS-flagged projects first, matching the existing `orderByRole` behavior already visible on the terminal page).
- Clicking "Print / Save as PDF" opens the browser's native print dialog, and the print preview shows: no switchers/button/nav (all `no-print`), single-column ATS-safe layout, correct sections (Experience/Independent Projects/Education/Certifications/Skills), plain black-on-white regardless of the site's dark/light theme setting.
- Stop the dev server afterward.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/cv.astro apps/web/src/components/Terminal.vue
git commit -m "feat(web): wire up the /cv route and link it from the terminal page"
```
