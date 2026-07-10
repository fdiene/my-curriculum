# Progressive Disclosure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Project side drawer (real detail endpoint, hand-rolled safe Markdown, gallery) + owner's pixel-polish batch.

**Architecture:** Additive optional schema fields; a genuine `GET /v1/projects/:id` Elysia route so the console immersion stays truthful; a zero-dependency escape-first Markdown renderer; a `ProjectDrawer` overlay component wired by the Terminal orchestrator; CSS line-clamp teasers (content untouched).

**Tech Stack:** existing monorepo, ZERO new dependencies.

## Global Constraints

- Branch `feature/profile-engine-phase1`; suite 82 pass; tests from repo root; check port 3000 free before any server smoke (prefer 3223+).
- No em dash anywhere; no Co-Authored-By trailer; UI chrome labels in English.
- Markdown renderer MUST escape HTML before any transformation; link scheme restricted to `https?://`; adversarial tests required.
- Drawer a11y: `role="dialog"`, `aria-modal="true"`, ESC + overlay click close, focus moved to the close button on open, body scroll locked while open, transitions off under `prefers-reduced-motion`.
- Spec: `docs/superpowers/specs/2026-07-09-progressive-disclosure-design.md`.

---

### Task 1: Schema fields `details` + `gallery`

**Files:**
- Modify: `packages/schema/src/entities.ts` (Project)
- Test: `packages/schema/src/resume.test.ts` (append)

**Interfaces:**
- Produces: `Project.details?: Localized` (via factory `L.optional()`), `Project.gallery?: string[]`.

- [ ] **Step 1: Failing test** (append; reuses `validProject`):

```ts
describe("progressive disclosure fields", () => {
  it("accepts optional localized details and gallery", () => {
    const p = ProjectSchema.parse({
      ...validProject,
      details: { en: "d", fr: "d", de: "d" },
      gallery: ["/g/a.png", "/g/b.png"],
    });
    expect((p as any).details.en).toBe("d");
    expect((p as any).gallery).toEqual(["/g/a.png", "/g/b.png"]);
  });
});
```

- [ ] **Step 2: red** (`bun test packages/schema/src/resume.test.ts` : fields stripped, assertions fail).
- [ ] **Step 3: implement** in `entities.ts` Project, after `imageUrl`: `details: L.optional(),` and `gallery: z.array(z.string()).optional(),`.
- [ ] **Step 4: green** full `bun test` (83 pass) + typecheck.
- [ ] **Step 5: commit** `feat(schema): optional project details (markdown) and gallery`.

---

### Task 2: Real endpoint `GET /v1/projects/:id`

**Files:**
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/src/app.test.ts` (append)

**Interfaces:**
- Produces: `GET /v1/projects/:id?lang=` → localized full project (200) or 404 `{ "error": "project_not_found" }`. Consumed by the drawer's console log + copy-curl.

- [ ] **Step 1: Failing tests** (append to app.test.ts):

```ts
  it("GET /v1/projects/:id returns the localized project", async () => {
    const { status, body } = await get("/v1/projects/profile-engine?lang=fr");
    expect(status).toBe(200);
    expect(body.id).toBe("profile-engine");
    expect(typeof body.tagline).toBe("string");
  });
  it("GET /v1/projects/:id 404s cleanly on unknown id", async () => {
    const { status, body } = await get("/v1/projects/nope");
    expect(status).toBe(404);
    expect(body.error).toBe("project_not_found");
  });
```

- [ ] **Step 2: red.**
- [ ] **Step 3: implement** in `app.ts`, after the `/v1/projects` route:

```ts
  .get("/v1/projects/:id", ({ params, query, headers, set }) => {
    const lang = resolveLocale(query.lang, headers["accept-language"]);
    const project = resume.projects.find((p) => p.id === params.id);
    if (!project) { set.status = 404; return { error: "project_not_found" }; }
    return localize(project, lang);
  }, { query: t.Object({ lang: t.Optional(t.String()) }) })
```

- [ ] **Step 4: green** (`bun test apps/api` then full, 85 pass) + typecheck.
- [ ] **Step 5: commit** `feat(api): GET /v1/projects/:id localized detail endpoint`.

---

### Task 3: Zero-dep safe Markdown renderer

**Files:**
- Create: `apps/web/src/lib/markdown.ts`
- Test: `apps/web/src/lib/markdown.test.ts`

**Interfaces:**
- Produces: `renderMarkdown(src: string): string` (HTML). Subset: `## `→h3, `### `→h4, `- ` lists, `**bold**`, `*italic*`, `` `code` ``, `[text](https://url)` links (target _blank, rel noopener noreferrer), blank-line paragraphs.

- [ ] **Step 1: Failing tests**:

```ts
import { describe, expect, it } from "bun:test";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("renders headings, lists, emphasis, code and safe links", () => {
    const html = renderMarkdown("## Title\n- **bold** item\n- `code` item\n\nPara with [link](https://x.dev) and *em*.");
    expect(html).toContain("<h3>Title</h3>");
    expect(html).toContain("<li><strong>bold</strong> item</li>");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain('<a href="https://x.dev" rel="noopener noreferrer" target="_blank">link</a>');
    expect(html).toContain("<em>em</em>");
  });
  it("escapes raw HTML before transforming", () => {
    const html = renderMarkdown('hello <img src=x onerror=alert(1)> world');
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
  it("neutralizes javascript: links (scheme not allowed)", () => {
    const html = renderMarkdown("[x](javascript:alert(1))");
    expect(html).not.toContain("<a ");
  });
});
```

- [ ] **Step 2: red.**
- [ ] **Step 3: implement** `apps/web/src/lib/markdown.ts`:

```ts
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(t: string): string {
  return t
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener noreferrer" target="_blank">$1</a>');
}

export function renderMarkdown(src: string): string {
  const out: string[] = [];
  let inList = false;
  for (const raw of esc(src).split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (inList && !line.startsWith("- ")) { out.push("</ul>"); inList = false; }
    if (!line.trim()) continue;
    if (line.startsWith("### ")) out.push(`<h4>${inline(line.slice(4))}</h4>`);
    else if (line.startsWith("## ")) out.push(`<h3>${inline(line.slice(3))}</h3>`);
    else if (line.startsWith("- ")) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inline(line.slice(2))}</li>`);
    } else out.push(`<p>${inline(line)}</p>`);
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}
```

- [ ] **Step 4: green** (3 tests; full suite 88) + typecheck.
- [ ] **Step 5: commit** `feat(web): zero-dep escape-first markdown renderer`.

---

### Task 4: ProjectDrawer component

**Files:**
- Create: `apps/web/src/components/ProjectDrawer.vue`

**Interfaces:**
- Props: `{ project: any | null }` (null = closed). Emits: `close`, `copycurl: [path: string]`. Uses `renderMarkdown` on `project.details` (already localized string at this point), renders `gallery` images lazily.

- [ ] **Step 1: create the component:**

```vue
<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { renderMarkdown } from "../lib/markdown";
import { curlFor } from "../lib/curl";

const props = defineProps<{ project: any | null; lang: string }>();
const emit = defineEmits<{ close: []; copycurl: [string] }>();
const closeBtn = ref<HTMLButtonElement | null>(null);

watch(() => props.project, async (p) => {
  document.body.style.overflow = p ? "hidden" : "";
  if (p) { await nextTick(); closeBtn.value?.focus(); }
});
function onKey(e: KeyboardEvent) { if (e.key === "Escape") emit("close"); }
function copy() {
  const path = `/v1/projects/${props.project.id}?lang=${props.lang}`;
  navigator.clipboard?.writeText(curlFor(path));
  emit("copycurl", path);
}
</script>

<template>
  <Teleport to="body">
    <div v-if="project" class="wrap no-print" @keydown="onKey">
      <div class="overlay" @click="emit('close')" />
      <aside class="drawer" role="dialog" aria-modal="true" :aria-label="project.name">
        <header>
          <h2>{{ project.name }}</h2>
          <span class="badge" :class="project.status">{{ project.status }}</span>
          <button class="curl mono" title="Copy cURL" @click="copy">curl</button>
          <button ref="closeBtn" class="close mono" aria-label="Close details" @click="emit('close')">esc ✕</button>
        </header>
        <p class="tagline">{{ project.tagline }}</p>
        <div v-if="project.details" class="md" v-html="renderMarkdown(project.details)" />
        <p v-else class="desc">{{ project.description }}</p>
        <div v-if="project.gallery?.length" class="gallery">
          <img v-for="g in project.gallery" :key="g" :src="g" alt="" loading="lazy" />
        </div>
        <ul class="stack mono">
          <li v-for="s in project.stack" :key="s">{{ s }}</li>
        </ul>
      </aside>
    </div>
  </Teleport>
</template>

<style scoped>
.wrap { position: fixed; inset: 0; z-index: 60; }
.overlay { position: absolute; inset: 0; background: rgba(2, 6, 23, 0.55); backdrop-filter: blur(3px); }
.drawer {
  position: absolute; top: 0; right: 0; height: 100%; width: min(480px, 100vw);
  background: var(--surface); border-left: 1px solid var(--border);
  padding: 1.25rem 1.5rem; overflow-y: auto;
  animation: slide-in 0.25s ease-out;
}
@keyframes slide-in { from { transform: translateX(100%); } }
header { display: flex; gap: 0.6rem; align-items: center; }
h2 { margin: 0; flex: 1; font-size: 1.2rem; }
.close, .curl { background: none; border: 1px dashed var(--border); color: var(--text-muted); border-radius: 4px; font-size: 0.72rem; padding: 0.15rem 0.5rem; cursor: pointer; }
.close:hover, .curl:hover { color: var(--text); border-style: solid; }
.tagline { color: var(--text-muted); font-style: italic; }
.md :deep(h3) { font-size: 1.02rem; margin: 1.1rem 0 0.4rem; }
.md :deep(h4) { font-size: 0.92rem; margin: 0.9rem 0 0.3rem; color: var(--text-muted); }
.md :deep(li) { margin-bottom: 0.35rem; }
.md :deep(code) { font-family: var(--font-mono); font-size: 0.85em; border: 1px solid var(--border); border-radius: 3px; padding: 0 0.25em; }
.gallery img { width: 100%; border-radius: 8px; border: 1px solid var(--border); margin: 0.5rem 0; }
.stack { display: flex; flex-wrap: wrap; gap: 0.35rem; padding: 0; margin: 1rem 0 0; list-style: none; }
.stack li { font-size: 0.7rem; border: 1px solid var(--border); border-radius: 4px; padding: 0.1rem 0.4rem; color: var(--text-muted); }
</style>
```

- [ ] **Step 2: verify** `bun --cwd=apps/web run typecheck` + build (component unused yet: OK).
- [ ] **Step 3: commit** `feat(web): ProjectDrawer side panel (dialog a11y, markdown, gallery)`.

---

### Task 5: Integration + pixel-polish batch

**Files:**
- Modify: `apps/web/src/components/Terminal.vue`, `ProjectCard.vue`, `apps/web/src/styles/global.css`

**Interfaces:**
- ProjectCard gains emit `open: [project: any]`; whole card clickable + `View details` button (visible when `project.details` exists; card click always allowed, drawer falls back to description).
- Terminal holds `openProject = ref<any|null>(null)`; opening logs the REAL endpoint: `GET /v1/projects/{id}?lang={lang}` + payload snippet `{ id, status, stack: [...] }`; renders `<ProjectDrawer :project="openProject" :lang="p.lang.value" @close="openProject = null" @copycurl="onCopyCurl" />`.

- [ ] **Step 1: ProjectCard changes**: root `<article>` gains `tabindex="0" role="button"` + `@click="emit('open', project)"` + `@keydown.enter.prevent="emit('open', project)"` + `@keydown.space.prevent="emit('open', project)"`; add after the description: `<button v-if="project.details" class="more mono no-print" @click.stop="emit('open', project)">View details</button>`; the curl button gets `@click.stop`. CSS: `.desc { text-align: left; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }` ; `article { cursor: pointer; }` ; `.more { background: none; border: 1px dashed var(--border); color: var(--text-muted); border-radius: 4px; font-size: 0.72rem; padding: 0.15rem 0.5rem; cursor: pointer; margin-top: 0.5rem; }`.
- [ ] **Step 2: hover affordance (curl + more, both components)**: `.curl:hover, .more:hover { color: var(--text); border-style: solid; }`.
- [ ] **Step 3: Terminal integration**: import ProjectDrawer; `const openProject = ref<any | null>(null);` ; handler:

```ts
function openDetails(project: any) {
  openProject.value = project;
  const path = `/v1/projects/${project.id}?lang=${p.lang.value}`;
  c.log({ kind: "request", text: path, payload: JSON.stringify({ id: project.id, status: project.status, stack: project.stack }, null, 1) });
}
```

Wire `@open="openDetails"` on ProjectCard; mount the drawer at template end.
- [ ] **Step 4: polish batch** in the same commit: `.hl li { margin-bottom: 0.5rem; }` (Terminal styles); experience title line: role stays `--text` bold, confirm `.org` is `--text-muted`; avatar (Terminal styles): `.avatar { border: 1px solid var(--border); filter: grayscale(1); transition: filter 0.25s; } .avatar:hover { filter: grayscale(0); }`.
- [ ] **Step 5: verify** full `bun test` (88 pass), web typecheck, build. Manual quick check deferred to owner pass.
- [ ] **Step 6: commit** `feat(web): progressive-disclosure integration + pixel polish`.

---

### Task 6: Seed details for profile-engine + final verification

**Files:**
- Modify: `data/master_data.fr.json`, `data/master_data.i18n.json`

- [ ] **Step 1: add `details` (en+fr) to the `profile-engine` project** in fr.json (owner reviews wording in the diff):

```json
"details": {
  "en": "## Why this project exists\nThis resume is not a PDF: it is a running system. Every view you see is served by a typed API, and this drawer itself was fetched from `GET /v1/projects/profile-engine`.\n\n## Architecture\n- **Monorepo** Bun + Turborepo: `packages/schema` (Zod source of truth), `packages/core` (pure domain shared by API and web), `apps/api` (Elysia), `apps/web` (Astro + Vue islands).\n- **End-to-end typing**: the web client consumes the API through Eden treaty types exported by the server.\n- **Role-aware ordering**: tag weights plus an editorial `featured_for` boost reorder the whole resume per audience.\n\n## Resilience and safety\n- EN/FR/DE content is generated offline by a schema-validated Claude pipeline: zero LLM calls at runtime.\n- If the API is unreachable, the site rebuilds the exact same view from embedded data and says so: [SYSTEM DEGRADED].\n- The console JSON highlighter is escape-first and adversarially tested.\n\n## Numbers\n- Full test suite green, CI on every push, Docker image behind Traefik.",
  "fr": "## Pourquoi ce projet existe\nCe CV n'est pas un PDF : c'est un système en fonctionnement. Chaque vue est servie par une API typée, et ce panneau lui-même provient de `GET /v1/projects/profile-engine`.\n\n## Architecture\n- **Monorepo** Bun + Turborepo : `packages/schema` (source de vérité Zod), `packages/core` (domaine pur partagé API/web), `apps/api` (Elysia), `apps/web` (îlots Astro + Vue).\n- **Typage de bout en bout** : le client web consomme l'API via les types Eden exportés par le serveur.\n- **Tri par audience** : poids de tags plus un boost éditorial `featured_for` réordonnent tout le CV selon le lecteur.\n\n## Résilience et sûreté\n- Le contenu EN/FR/DE est généré hors ligne par un pipeline Claude validé par schéma : zéro appel LLM au runtime.\n- Si l'API est injoignable, le site reconstruit la même vue depuis les données embarquées et l'assume : [SYSTEM DEGRADED].\n- Le highlighter JSON de la console échappe d'abord, testé de façon adversariale.\n\n## Chiffres\n- Suite de tests au vert, CI à chaque push, image Docker derrière Traefik."
}
```

- [ ] **Step 2: German**: run `bun run translate` (glossary active) : it fills ONLY missing locales? NO: it regenerates from fr.json entirely: acceptable now that the glossary protects known terms; afterwards grep no `—`, spot-check the details.de register, hand-fix if a defect class reappears and document.
- [ ] **Step 3: final verification**: full `bun test`, typecheck, build; dist grep sanity; quick server smoke on PORT=3223: `curl /v1/projects/profile-engine?lang=de` returns German details. Kill server.
- [ ] **Step 4: commit** `feat(data): profile-engine long-form details (FR/EN/DE)`.

## Self-Review

- Owner Partie 1 → Task 5 steps 1-4 (text-left+clamp, hl spacing, org hierarchy, avatar grayscale, curl hover). Partie 2 → Tasks 1-6 (schéma, drawer, teaser, console immersion via endpoint réel). Amendements → Task 2 (endpoint) et Task 3 (markdown zéro-dep). ✅
- Placeholders: none; all code complete; seed content final wording (owner reviews diff). ✅
- Types: `renderMarkdown` consumed by Task 4; `open` emit consumed by Task 5; endpoint path format identical between Task 2 tests, drawer copy-curl, and Terminal log. Suite counts: 82→83 (T1)→85 (T2)→88 (T3), stable after. ✅
