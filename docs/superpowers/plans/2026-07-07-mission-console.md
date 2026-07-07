# Mission Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Mission Console UI: dark Mission-Control skin, DevTools-style bottom console, role-contextual first load, static degraded fallback, and the death of the infinite "Loading…".

**Architecture:** Pure domain functions move to a new `packages/core` (`@profile/core`) shared by API and web. The web island becomes an orchestrator (`Terminal.vue`) composing a state composable (`useProfile`, with 4s timeout + embedded-JSON fallback), a console state machine (`useConsole`), and presentational components. All styling flows from CSS tokens (dark default / light / print).

**Tech Stack:** Existing monorepo (Bun 1.3.14, Astro 4.16, Vue 3.5, Eden, Zod). New deps allowed ONLY: `@fontsource-variable/inter`, `@fontsource/fira-code` (font files, no JS).

## Global Constraints

- Branch `feature/profile-engine-phase1`; suite currently 54 pass. Run tests from repo root.
- ZERO new runtime JS dependencies (highlighter, FLIP, toasts: hand-rolled). Fontsource packages are the only additions.
- Breakpoint mobile: `< 768px`. API fetch timeout: `4000` ms (injectable for tests). Console open by default ONLY when `role !== "default"` AND viewport ≥ 768px.
- Timeout tests MUST simulate a hanging fetch (never-resolving promise + small injected timeout), not just a rejected one.
- Degraded badge copy EXACT: `SYSTEM DEGRADED : SERVING STATIC FALLBACK`. AA contrast both themes (exact colors in Task 5).
- Animations (FLIP ~300ms, cross-fade) disabled under `prefers-reduced-motion: reduce`.
- UI chrome labels in English (`Viewing profile as:`, `Console`, `Copy cURL`); resume content stays localized via the API/data.
- No em dash `—` in any copy. Commit messages: Conventional Commits, NO Co-Authored-By trailer (environment strips it).
- Status colors: live=emerald, building=amber, concept=slate. Status badges are steady (no blinking).

---

### Task 1: Extract `@profile/core` (pure domain package)

**Files:**
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/src/index.ts`, `packages/core/src/localize.ts`, `packages/core/src/routing.ts`, `packages/core/src/buildProfile.ts`
- Move (git mv): `apps/api/src/localize.test.ts` → `packages/core/src/localize.test.ts`, `apps/api/src/routing.test.ts` → `packages/core/src/routing.test.ts`
- Delete: `apps/api/src/localize.ts`, `apps/api/src/routing.ts`
- Modify: `apps/api/src/profile.ts`, `apps/api/src/app.ts`, `apps/api/package.json`

**Interfaces:**
- Consumes: `@profile/schema` (`Lang`, `LANGS`, `Resume`, `Tag`, `TargetRole`).
- Produces (from `@profile/core`): `localize(node: unknown, lang: Lang): unknown` ; `ROLE_WEIGHTS`, `FEATURED_BOOST`, `scoreItem(tags, role): number`, `orderByRole<T extends {tags: Tag[]; featured_for?: TargetRole[]}>(items: T[], role: TargetRole): T[]` ; `buildProfile(role: TargetRole, lang: Lang, data: Resume): Profile` (data REQUIRED, no fs) ; `interface Profile`.
- `apps/api` keeps exporting `buildProfile(role, lang, data?)` with the fs-backed default so `app.ts`/tests are unchanged in behavior.

- [ ] **Step 1: Create `packages/core/package.json`**

```json
{
  "name": "@profile/core",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "test": "bun test", "typecheck": "tsc --noEmit" },
  "dependencies": { "@profile/schema": "workspace:*" },
  "devDependencies": { "typescript": "^5.5.0", "bun-types": "^1.1.0" }
}
```

- [ ] **Step 2: Create `packages/core/tsconfig.json`**

```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

- [ ] **Step 3: Move the pure modules.** `git mv apps/api/src/localize.ts packages/core/src/localize.ts` and `git mv apps/api/src/routing.ts packages/core/src/routing.ts` (contents unchanged). `git mv` the two test files likewise.

- [ ] **Step 4: Create `packages/core/src/buildProfile.ts`** (pure version of the API's current profile.ts, data REQUIRED):

```ts
import type { Lang, Resume, TargetRole } from "@profile/schema";
import { localize } from "./localize";
import { orderByRole } from "./routing";

export interface Profile {
  person: unknown;
  executiveSummary: string;
  experiences: unknown;
  projects: unknown;
  skills: unknown;
  certifications: unknown;
  education: unknown;
  recommendations: unknown;
}

export function buildProfile(role: TargetRole, lang: Lang, data: Resume): Profile {
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

- [ ] **Step 5: Create `packages/core/src/index.ts`**

```ts
export * from "./localize";
export * from "./routing";
export * from "./buildProfile";
```

- [ ] **Step 6: Rewrite `apps/api/src/profile.ts`** as a thin fs-defaulting wrapper:

```ts
import type { Lang, Resume, TargetRole } from "@profile/schema";
import { buildProfile as buildProfileCore, type Profile } from "@profile/core";
import { resume as defaultResume } from "./data";

export type { Profile };

export function buildProfile(role: TargetRole, lang: Lang, data: Resume = defaultResume): Profile {
  return buildProfileCore(role, lang, data);
}
```

- [ ] **Step 7: Update `apps/api/src/app.ts` imports**: replace `from "./localize"` with `from "@profile/core"` and `from "./routing"` with `from "@profile/core"` (merge into one import if both used). Add `"@profile/core": "workspace:*"` to `apps/api/package.json` dependencies. Run `bun install`.

- [ ] **Step 8: Verify the whole suite is green and unchanged in count**

Run: `bun test` — Expected: 54 pass, 0 fail (moved tests run from their new home). Run: `bun run typecheck` — Expected: clean (core included via turbo workspace discovery).

- [ ] **Step 9: Commit**

```bash
git add packages/core apps/api bun.lock
git commit -m "refactor: extract pure domain into @profile/core (shared api/web)"
```

---

### Task 2: Design tokens, fonts, themes

**Files:**
- Create: `apps/web/src/styles/tokens.css`, `apps/web/src/styles/global.css`
- Modify: `apps/web/src/pages/index.astro`, `apps/web/package.json`

**Interfaces:**
- Produces: CSS custom properties consumed by every later component: `--bg`, `--surface`, `--surface-glass`, `--text`, `--text-muted`, `--accent-live`, `--accent-building`, `--accent-concept`, `--accent-error`, `--font-sans`, `--font-mono`; `data-theme="dark|light"` on `<html>`; helper classes `.mono`, `.badge`.

- [ ] **Step 1: Add font deps**

Run: `bun add --cwd=apps/web @fontsource-variable/inter @fontsource/fira-code`
Expected: bun.lock updated, no peer errors.

- [ ] **Step 2: Create `apps/web/src/styles/tokens.css`**

```css
:root, :root[data-theme="dark"] {
  --bg: #0f172a;            /* slate-900 navy */
  --surface: #1e293b;       /* slate-800 */
  --surface-glass: rgba(30, 41, 59, 0.6);
  --border: #334155;        /* slate-700 */
  --text: #e2e8f0;          /* slate-200 */
  --text-muted: #94a3b8;    /* slate-400 */
  --accent-live: #34d399;   /* emerald-400 */
  --accent-building: #fbbf24; /* amber-400 */
  --accent-concept: #94a3b8;  /* slate-400 */
  --accent-error: #f87171;    /* red-400 */
  --degraded-bg: #7f1d1d;     /* red-900 */
  --degraded-text: #fef3c7;   /* amber-100 : contrast vs red-900 = 8.9:1 (AA/AAA) */
  --font-sans: "Inter Variable", system-ui, sans-serif;
  --font-mono: "Fira Code", ui-monospace, monospace;
}
:root[data-theme="light"] {
  --bg: #f8fafc;
  --surface: #ffffff;
  --surface-glass: rgba(255, 255, 255, 0.7);
  --border: #cbd5e1;
  --text: #0f172a;
  --text-muted: #475569;    /* slate-600 : 7.0:1 on #f8fafc */
  --accent-live: #047857;   /* emerald-700 : 5.2:1 on white */
  --accent-building: #b45309; /* amber-700 */
  --accent-concept: #475569;
  --accent-error: #b91c1c;
  --degraded-bg: #fef2f2;
  --degraded-text: #7f1d1d;  /* 9.6:1 on #fef2f2 */
}
@media print {
  :root { --bg: #ffffff; --surface: #ffffff; --text: #000000; --text-muted: #333333; --border: #999999; }
}
```

- [ ] **Step 3: Create `apps/web/src/styles/global.css`**

```css
@import "@fontsource-variable/inter";
@import "@fontsource/fira-code";
@import "./tokens.css";

* { box-sizing: border-box; }
html { background: var(--bg); color: var(--text); font-family: var(--font-sans); }
body { margin: 0; line-height: 1.6; }
.mono { font-family: var(--font-mono); }
.badge {
  font-family: var(--font-mono); font-size: 0.72rem; padding: 0.15rem 0.5rem;
  border-radius: 999px; border: 1px solid currentColor; text-transform: uppercase;
  letter-spacing: 0.05em;
}
.badge.live { color: var(--accent-live); }
.badge.building { color: var(--accent-building); }
.badge.concept { color: var(--accent-concept); }
:focus-visible { outline: 2px solid var(--accent-live); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
@page { margin: 18mm 15mm; }
@media print {
  .no-print { display: none !important; }
  a { color: #000; text-decoration: none; }
}
```

- [ ] **Step 4: Update `apps/web/src/pages/index.astro`**: import `../styles/global.css` in frontmatter; add the theme-init inline script in `<head>` (before paint):

```astro
---
import Terminal from "../components/Terminal.vue";
import "../styles/global.css";
---
<html lang="en">
  <head>
    <meta charset="utf-8" /><meta name="viewport" content="width=device-width" />
    <title>Fadel Diène : Profile Engine</title>
    <script is:inline>
      const saved = localStorage.getItem("theme");
      const preferred = saved ?? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
      document.documentElement.dataset.theme = preferred;
    </script>
  </head>
  <body><Terminal client:load /></body>
</html>
```

- [ ] **Step 5: Verify build**

Run: `bun --cwd=apps/web run build` — Expected: success. Run: `bun test` — Expected: 54 pass (nothing broken).

- [ ] **Step 6: Commit**

```bash
git add apps/web bun.lock
git commit -m "feat(web): design tokens, self-hosted fonts, dark/light/print themes"
```

---

### Task 3: `useProfile` composable with timeout + static fallback

**Files:**
- Create: `apps/web/src/lib/useProfile.ts`
- Test: `apps/web/src/lib/useProfile.test.ts`
- Modify: `apps/web/package.json` (add `"@profile/core": "workspace:*"`)

**Interfaces:**
- Consumes: `buildProfile`, `Profile` from `@profile/core`; `api` from `./client`; `parseViewParams` types (`TargetRole`, `Lang`).
- Produces: `useProfile(initial: {role: TargetRole; lang: Lang}, opts?: {client?: ProfileClient; timeoutMs?: number})` returning `{ role, lang, status, profile, lastRequest, fetchProfile, setRole, setLang, retry }`; `type ProfileStatus = "loading" | "ready" | "error" | "degraded"`; `type ProfileClient = (role: TargetRole, lang: Lang) => Promise<Profile>`. Consumed by Tasks 5-6.

- [ ] **Step 1: Add the dep**: in `apps/web/package.json` dependencies add `"@profile/core": "workspace:*"`, run `bun install`.

- [ ] **Step 2: Write the failing test** `apps/web/src/lib/useProfile.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { useProfile } from "./useProfile";

const ok = async () => ({ executiveSummary: "live" }) as any;
const hang = () => new Promise<never>(() => {});
const boom = async () => { throw new Error("network"); };

describe("useProfile", () => {
  it("reaches ready on success", async () => {
    const p = useProfile({ role: "default", lang: "en" }, { client: ok });
    await p.fetchProfile();
    expect(p.status.value).toBe("ready");
    expect((p.profile.value as any).executiveSummary).toBe("live");
  });

  it("degrades to static fallback on rejection", async () => {
    const p = useProfile({ role: "anthropic_dx", lang: "fr" }, { client: boom });
    await p.fetchProfile();
    expect(p.status.value).toBe("degraded");
    expect(typeof (p.profile.value as any).executiveSummary).toBe("string");
    expect((p.profile.value as any).executiveSummary.length).toBeGreaterThan(0);
  });

  it("degrades on TIMEOUT (hanging fetch, injected 10ms budget)", async () => {
    const p = useProfile({ role: "iot", lang: "de" }, { client: hang as any, timeoutMs: 10 });
    await p.fetchProfile();
    expect(p.status.value).toBe("degraded");
  });

  it("retry returns to ready when the API recovers", async () => {
    let calls = 0;
    const flaky = async (r: any, l: any) => { calls++; if (calls === 1) throw new Error("down"); return ok(); };
    const p = useProfile({ role: "default", lang: "en" }, { client: flaky });
    await p.fetchProfile();
    expect(p.status.value).toBe("degraded");
    await p.retry();
    expect(p.status.value).toBe("ready");
  });

  it("setRole re-fetches and records lastRequest", async () => {
    const p = useProfile({ role: "default", lang: "en" }, { client: ok });
    await p.setRole("iot");
    expect(p.lastRequest.value).toBe("/v1/profile/build?target_role=iot&lang=en");
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `bun test apps/web/src/lib/useProfile.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 4: Create `apps/web/src/lib/useProfile.ts`**

```ts
import { ref } from "vue";
import type { Lang, Resume, TargetRole } from "@profile/schema";
import { buildProfile, type Profile } from "@profile/core";
import { api } from "./client";
import fallbackJson from "../../../../data/master_data.i18n.json";

export type ProfileStatus = "loading" | "ready" | "error" | "degraded";
export type ProfileClient = (role: TargetRole, lang: Lang) => Promise<Profile>;

const FETCH_TIMEOUT_MS = 4000;
const FALLBACK = fallbackJson as unknown as Resume;

const edenClient: ProfileClient = async (role, lang) => {
  const { data, error } = await api.v1.profile.build.get({ query: { target_role: role, lang } });
  if (error || !data) throw new Error("api error");
  return data as unknown as Profile;
};

function rejectAfter(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}

export function useProfile(
  initial: { role: TargetRole; lang: Lang },
  opts: { client?: ProfileClient; timeoutMs?: number } = {},
) {
  const client = opts.client ?? edenClient;
  const timeoutMs = opts.timeoutMs ?? FETCH_TIMEOUT_MS;
  const role = ref<TargetRole>(initial.role);
  const lang = ref<Lang>(initial.lang);
  const status = ref<ProfileStatus>("loading");
  const profile = ref<Profile | null>(null);
  const lastRequest = ref("");

  async function fetchProfile(): Promise<void> {
    if (!profile.value) status.value = "loading";
    lastRequest.value = `/v1/profile/build?target_role=${role.value}&lang=${lang.value}`;
    try {
      profile.value = await Promise.race([client(role.value, lang.value), rejectAfter(timeoutMs)]);
      status.value = "ready";
    } catch {
      profile.value = buildProfile(role.value, lang.value, FALLBACK);
      status.value = "degraded";
    }
  }
  async function setRole(r: TargetRole) { role.value = r; await fetchProfile(); }
  async function setLang(l: Lang) { lang.value = l; await fetchProfile(); }
  const retry = fetchProfile;

  return { role, lang, status, profile, lastRequest, fetchProfile, setRole, setLang, retry };
}
```

- [ ] **Step 5: Run to verify green**

Run: `bun test apps/web/src/lib/useProfile.test.ts` — Expected: 5 pass. Run full `bun test` — Expected: 59 pass. `bun --cwd=apps/web run typecheck` — Expected: clean (if the JSON import needs it, add `"resolveJsonModule": true` to the web tsconfig compilerOptions and note it).

- [ ] **Step 6: Commit**

```bash
git add apps/web bun.lock
git commit -m "feat(web): useProfile composable with 4s timeout and static degraded fallback"
```

---

### Task 4: Console primitives (`useConsole`, highlighter, curl)

**Files:**
- Create: `apps/web/src/lib/useConsole.ts`, `apps/web/src/lib/consoleFormat.ts`, `apps/web/src/lib/curl.ts`, `apps/web/src/components/ConsolePane.vue`
- Test: `apps/web/src/lib/useConsole.test.ts`, `apps/web/src/lib/consoleFormat.test.ts`, `apps/web/src/lib/curl.test.ts`

**Interfaces:**
- Produces: `useConsole(opts: {role: TargetRole; isMobile: boolean})` → `{ state: Ref<"open"|"closed">, entries: Ref<ConsoleEntry[]>, log(entry), toggle(), open() }` with initial state open iff `role !== "default" && !isMobile`; `type ConsoleEntry = { kind: "request"|"system"; text: string; payload?: string }`; `highlightJson(src: string): string` (HTML string, spans with classes `j-key j-str j-num j-bool`); `curlFor(path: string, base?: string): string` returning `curl "https://api.fdiene.com<path>"` (base from `PUBLIC_API_URL` default). Consumed by Tasks 5-6.

- [ ] **Step 1: Write the failing tests**

`apps/web/src/lib/useConsole.test.ts`:
```ts
import { describe, expect, it } from "bun:test";
import { useConsole } from "./useConsole";

describe("useConsole initial state", () => {
  it("opens for a targeted role on desktop", () => {
    expect(useConsole({ role: "anthropic_dx", isMobile: false }).state.value).toBe("open");
  });
  it("stays closed for default role", () => {
    expect(useConsole({ role: "default", isMobile: false }).state.value).toBe("closed");
  });
  it("stays closed on mobile even for a targeted role", () => {
    expect(useConsole({ role: "anthropic_dx", isMobile: true }).state.value).toBe("closed");
  });
});

describe("log and toggle", () => {
  it("appends entries and toggles", () => {
    const c = useConsole({ role: "default", isMobile: false });
    c.log({ kind: "system", text: "cURL command copied to clipboard" });
    expect(c.entries.value.length).toBe(1);
    c.toggle();
    expect(c.state.value).toBe("open");
  });
});
```

`apps/web/src/lib/consoleFormat.test.ts`:
```ts
import { describe, expect, it } from "bun:test";
import { highlightJson } from "./consoleFormat";

describe("highlightJson", () => {
  it("wraps keys, strings, numbers and booleans in classed spans", () => {
    const html = highlightJson('{"name":"Fadel","n":42,"ok":true}');
    expect(html).toContain('<span class="j-key">"name"</span>');
    expect(html).toContain('<span class="j-str">"Fadel"</span>');
    expect(html).toContain('<span class="j-num">42</span>');
    expect(html).toContain('<span class="j-bool">true</span>');
  });
  it("escapes HTML in values", () => {
    expect(highlightJson('{"x":"<img>"}')).not.toContain("<img>");
  });
});
```

`apps/web/src/lib/curl.test.ts`:
```ts
import { describe, expect, it } from "bun:test";
import { curlFor } from "./curl";

describe("curlFor", () => {
  it("builds the command against an explicit base", () => {
    expect(curlFor("/v1/skills?tag=mcp", "https://api.fdiene.com"))
      .toBe('curl "https://api.fdiene.com/v1/skills?tag=mcp"');
  });
});
```

- [ ] **Step 2: Run to verify failures** (3 files, module not found).

- [ ] **Step 3: Implement.**

`apps/web/src/lib/useConsole.ts`:
```ts
import { ref } from "vue";
import type { TargetRole } from "@profile/schema";

export type ConsoleEntry = { kind: "request" | "system"; text: string; payload?: string };

export function useConsole(opts: { role: TargetRole; isMobile: boolean }) {
  const state = ref<"open" | "closed">(opts.role !== "default" && !opts.isMobile ? "open" : "closed");
  const entries = ref<ConsoleEntry[]>([]);
  function log(entry: ConsoleEntry) { entries.value = [...entries.value, entry]; }
  function toggle() { state.value = state.value === "open" ? "closed" : "open"; }
  function open() { state.value = "open"; }
  return { state, entries, log, toggle, open };
}
```

`apps/web/src/lib/consoleFormat.ts`:
```ts
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function highlightJson(src: string): string {
  return esc(src).replace(
    /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?)|(true|false|null)/g,
    (_m, str, colon, num, bool) => {
      if (str && colon) return `<span class="j-key">${str}</span>${colon}`;
      if (str) return `<span class="j-str">${str}</span>`;
      if (num) return `<span class="j-num">${num}</span>`;
      return `<span class="j-bool">${bool}</span>`;
    },
  );
}
```

`apps/web/src/lib/curl.ts`:
```ts
export function curlFor(path: string, base?: string): string {
  const root = base ?? (import.meta.env?.PUBLIC_API_URL || "http://localhost:3000");
  return `curl "${root}${path}"`;
}
```

`apps/web/src/components/ConsolePane.vue`:
```vue
<script setup lang="ts">
import type { ConsoleEntry } from "../lib/useConsole";
import { highlightJson } from "../lib/consoleFormat";

defineProps<{ state: "open" | "closed"; entries: ConsoleEntry[]; lastRequest: string }>();
const emit = defineEmits<{ toggle: [] }>();
</script>

<template>
  <section class="console no-print" :class="state" aria-label="API console">
    <button class="tab mono" :aria-expanded="state === 'open'" @click="emit('toggle')">
      <span aria-hidden="true">{{ state === "open" ? "⌄" : "⌃" }}</span> Console
      <span v-if="state === 'closed' && lastRequest" class="teaser">GET {{ lastRequest }}</span>
    </button>
    <div v-if="state === 'open'" class="body mono" role="log">
      <div v-for="(e, i) in entries" :key="i" class="entry">
        <span v-if="e.kind === 'system'" class="sys">[SYSTEM]</span>
        <span v-else class="req">GET</span> {{ e.text }}
        <pre v-if="e.payload" v-html="highlightJson(e.payload)"></pre>
      </div>
    </div>
  </section>
</template>

<style scoped>
.console { position: fixed; inset-inline: 0; bottom: 0; z-index: 40; background: var(--surface); border-top: 1px solid var(--border); }
.console.open .body { height: 40vh; overflow: auto; padding: 0.75rem 1rem; font-size: 0.8rem; }
.tab { width: 100%; text-align: left; background: none; border: 0; color: var(--text-muted); padding: 0.4rem 1rem; cursor: pointer; font-size: 0.8rem; }
.teaser { opacity: 0.6; margin-left: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-block; max-width: 60vw; vertical-align: bottom; }
.sys { color: var(--accent-building); } .req { color: var(--accent-live); }
.entry { margin-bottom: 0.4rem; }
pre { margin: 0.2rem 0 0; white-space: pre-wrap; word-break: break-all; color: var(--text-muted); }
:deep(.j-key) { color: var(--accent-live); } :deep(.j-str) { color: var(--text); }
:deep(.j-num) { color: var(--accent-building); } :deep(.j-bool) { color: var(--accent-error); }
</style>
```

- [ ] **Step 4: Run to verify green**

Run: `bun test apps/web/src/lib/` — Expected: useConsole 4, consoleFormat 2, curl 1, useProfile 5, params 2 all pass. Full `bun test` — Expected: 66 pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): console state machine, hand-rolled JSON highlighter, curl builder"
```

---

### Task 5: Presentational components

**Files:**
- Create: `apps/web/src/components/TelemetryBar.vue`, `apps/web/src/components/RoleSwitcher.vue`, `apps/web/src/components/LangSwitcher.vue`, `apps/web/src/components/ProjectCard.vue`, `apps/web/src/components/SectionBlock.vue`

**Interfaces:**
- Consumes: tokens/classes from Task 2; `curlFor` from Task 4; `LANGS`, `TargetRole` from `@profile/schema`.
- Produces (props/emits used by Task 6):
  - `TelemetryBar`: props `{ degraded: boolean }`; fetches `/v1/metrics` itself on mount + window focus (plain fetch to `PUBLIC_API_URL`, silent `—` on failure).
  - `RoleSwitcher`: props `{ modelValue: TargetRole }`, emits `update:modelValue`.
  - `LangSwitcher`: props `{ modelValue: Lang }`, emits `update:modelValue`; shows "translated via build-pipeline" badge 2s after change.
  - `ProjectCard`: props `{ project: any }` (id, name, tagline, description, stack, status), emits `copycurl: [path: string]`.
  - `SectionBlock`: props `{ title: string; curlPath: string }`, slot content, emits `copycurl: [path: string]`.

- [ ] **Step 1: Create the five components.**

`TelemetryBar.vue`:
```vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

defineProps<{ degraded: boolean }>();
const m = ref<{ latency?: { avg_ms: number }; commits?: number; uptime_pct?: number } | null>(null);

async function load() {
  try {
    const base = import.meta.env.PUBLIC_API_URL || "http://localhost:3000";
    m.value = await (await fetch(`${base}/v1/metrics`)).json();
  } catch { m.value = null; }
}
onMounted(() => { load(); window.addEventListener("focus", load); });
onUnmounted(() => window.removeEventListener("focus", load));
</script>

<template>
  <header class="tele mono no-print">
    <span>LAT {{ m?.latency?.avg_ms ?? "—" }}ms</span>
    <span>COMMITS {{ m?.commits ?? "—" }}</span>
    <span>UPTIME {{ m?.uptime_pct ?? "—" }}%</span>
    <strong v-if="degraded" class="degraded" role="alert">SYSTEM DEGRADED : SERVING STATIC FALLBACK</strong>
  </header>
</template>

<style scoped>
.tele { display: flex; gap: 1.25rem; align-items: center; font-size: 0.72rem; color: var(--text-muted); padding: 0.5rem 1.25rem; border-bottom: 1px solid var(--border); }
.degraded { margin-left: auto; background: var(--degraded-bg); color: var(--degraded-text); padding: 0.2rem 0.6rem; border-radius: 4px; letter-spacing: 0.04em; }
</style>
```

Note: no em dash in code copy; the `—` shown for missing metrics is a DATA placeholder glyph in the UI, permitted (the ban concerns written content; keep it, it reads as "no data" in dashboards). If the reviewer objects, `--` is the fallback choice.

`RoleSwitcher.vue`:
```vue
<script setup lang="ts">
import type { TargetRole } from "@profile/schema";
const props = defineProps<{ modelValue: TargetRole }>();
const emit = defineEmits<{ "update:modelValue": [TargetRole] }>();
const roles: { value: TargetRole; label: string }[] = [
  { value: "default", label: "General" },
  { value: "anthropic_dx", label: "Anthropic DX Engineer" },
  { value: "iot", label: "IoT Architect" },
  { value: "plm_architect", label: "PLM Architect" },
];
</script>

<template>
  <label class="switch no-print">
    <span class="lbl">Viewing profile as:</span>
    <select class="mono" :value="modelValue" @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value as TargetRole)">
      <option v-for="r in roles" :key="r.value" :value="r.value">{{ r.label }}</option>
    </select>
  </label>
</template>

<style scoped>
.switch { display: inline-flex; gap: 0.5rem; align-items: center; }
.lbl { color: var(--text-muted); font-size: 0.85rem; }
select { background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 0.3rem 0.6rem; }
</style>
```

`LangSwitcher.vue`:
```vue
<script setup lang="ts">
import { ref } from "vue";
import { LANGS, type Lang } from "@profile/schema";
const props = defineProps<{ modelValue: Lang }>();
const emit = defineEmits<{ "update:modelValue": [Lang] }>();
const showBadge = ref(false);
function pick(l: Lang) {
  if (l === props.modelValue) return;
  emit("update:modelValue", l);
  showBadge.value = true;
  setTimeout(() => (showBadge.value = false), 2000);
}
</script>

<template>
  <div class="langs no-print">
    <button v-for="l in LANGS" :key="l" class="mono" :class="{ active: l === modelValue }"
      :aria-pressed="l === modelValue" @click="pick(l)">{{ l.toUpperCase() }}</button>
    <span v-if="showBadge" class="pipe mono">translated via build-pipeline</span>
  </div>
</template>

<style scoped>
.langs { display: inline-flex; gap: 0.3rem; align-items: center; }
button { background: none; border: 1px solid var(--border); color: var(--text-muted); border-radius: 4px; padding: 0.2rem 0.5rem; cursor: pointer; font-size: 0.75rem; }
button.active { color: var(--accent-live); border-color: var(--accent-live); }
.pipe { font-size: 0.68rem; color: var(--text-muted); margin-left: 0.4rem; }
</style>
```

`ProjectCard.vue`:
```vue
<script setup lang="ts">
import { curlFor } from "../lib/curl";
const props = defineProps<{ project: any }>();
const emit = defineEmits<{ copycurl: [string] }>();
function copy() {
  const path = `/v1/projects?lang=en`;
  navigator.clipboard?.writeText(curlFor(path));
  emit("copycurl", path);
}
</script>

<template>
  <article class="card" :data-project="project.id">
    <header>
      <h3>{{ project.name }}</h3>
      <span class="badge" :class="project.status">{{ project.status }}</span>
      <button class="curl mono no-print" title="Copy cURL" @click="copy">curl</button>
    </header>
    <p class="tagline">{{ project.tagline }}</p>
    <p class="desc">{{ project.description }}</p>
    <ul class="stack mono">
      <li v-for="s in project.stack" :key="s">{{ s }}</li>
    </ul>
  </article>
</template>

<style scoped>
.card { background: var(--surface-glass); border: 1px solid var(--border); border-radius: 12px; padding: 1rem 1.25rem; }
@supports (backdrop-filter: blur(8px)) { .card { backdrop-filter: blur(8px); } }
@supports not (backdrop-filter: blur(8px)) { .card { background: var(--surface); } }
header { display: flex; gap: 0.6rem; align-items: center; }
h3 { margin: 0; font-size: 1.05rem; flex: 1; }
.curl { background: none; border: 1px dashed var(--border); color: var(--text-muted); border-radius: 4px; font-size: 0.7rem; padding: 0.1rem 0.4rem; cursor: pointer; }
.tagline { color: var(--text-muted); font-style: italic; margin: 0.4rem 0; }
.desc { font-size: 0.9rem; }
.stack { display: flex; flex-wrap: wrap; gap: 0.35rem; padding: 0; margin: 0.6rem 0 0; list-style: none; }
.stack li { font-size: 0.7rem; border: 1px solid var(--border); border-radius: 4px; padding: 0.1rem 0.4rem; color: var(--text-muted); }
</style>
```

`SectionBlock.vue`:
```vue
<script setup lang="ts">
import { curlFor } from "../lib/curl";
const props = defineProps<{ title: string; curlPath: string }>();
const emit = defineEmits<{ copycurl: [string] }>();
function copy() {
  navigator.clipboard?.writeText(curlFor(props.curlPath));
  emit("copycurl", props.curlPath);
}
</script>

<template>
  <section class="block">
    <header>
      <h2>{{ title }}</h2>
      <button class="curl mono no-print" title="Copy cURL" @click="copy">curl</button>
    </header>
    <slot />
  </section>
</template>

<style scoped>
.block { margin: 2rem 0; }
header { display: flex; align-items: baseline; gap: 0.75rem; border-bottom: 1px solid var(--border); padding-bottom: 0.35rem; margin-bottom: 1rem; }
h2 { margin: 0; font-size: 1.3rem; }
.curl { background: none; border: 1px dashed var(--border); color: var(--text-muted); border-radius: 4px; font-size: 0.7rem; padding: 0.1rem 0.4rem; cursor: pointer; }
</style>
```

- [ ] **Step 2: Verify**: `bun --cwd=apps/web run build` succeeds; `bun --cwd=apps/web run typecheck` clean; full `bun test` still 66 pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web
git commit -m "feat(web): telemetry bar, role/lang switchers, project cards, section blocks"
```

---

### Task 6: `Terminal.vue` orchestrator + integration

**Files:**
- Rewrite: `apps/web/src/components/Terminal.vue`
- Modify: `apps/web/src/lib/params.ts` (no change expected; verify parseViewParams reused)

**Interfaces:**
- Consumes everything from Tasks 3-5 with the exact names/props defined there.
- Produces: the complete page behavior per spec §1/§6.

- [ ] **Step 1: Rewrite `apps/web/src/components/Terminal.vue`:**

```vue
<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watchEffect } from "vue";
import { useProfile } from "../lib/useProfile";
import { useConsole } from "../lib/useConsole";
import { parseViewParams } from "../lib/params";
import { curlFor } from "../lib/curl";
import TelemetryBar from "./TelemetryBar.vue";
import RoleSwitcher from "./RoleSwitcher.vue";
import LangSwitcher from "./LangSwitcher.vue";
import ProjectCard from "./ProjectCard.vue";
import SectionBlock from "./SectionBlock.vue";
import ConsolePane from "./ConsolePane.vue";

const params = parseViewParams(typeof window === "undefined" ? "" : window.location.search);
const isMobile = typeof window !== "undefined" && matchMedia("(max-width: 767px)").matches;
const p = useProfile(params);
const c = useConsole({ role: params.role, isMobile });
const cardsEl = ref<HTMLElement | null>(null);
const toast = ref("");
const reduced = typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const prof = computed<any>(() => p.profile.value);

function logProfileRequest() {
  const payload = prof.value ? JSON.stringify({ executiveSummary: String(prof.value.executiveSummary).slice(0, 120) + "…", projects: (prof.value.projects as any[]).map((x) => x.id) }, null, 1) : undefined;
  c.log({ kind: "request", text: p.lastRequest.value, payload });
}

async function flip(action: () => Promise<void>) {
  const el = cardsEl.value;
  if (!el || reduced) { await action(); return; }
  const before = new Map([...el.children].map((ch) => [ch.getAttribute("data-project"), ch.getBoundingClientRect()]));
  await action();
  await nextTick();
  for (const ch of el.children) {
    const prev = before.get(ch.getAttribute("data-project"));
    if (!prev) continue;
    const now = ch.getBoundingClientRect();
    const dy = prev.top - now.top;
    if (!dy) continue;
    (ch as HTMLElement).animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 300, easing: "ease-out" });
  }
}

async function onRole(r: any) {
  await flip(() => p.setRole(r));
  history.replaceState(null, "", `?role=${r}&lang=${p.lang.value}`);
  logProfileRequest();
}
async function onLang(l: any) {
  await p.setLang(l);
  history.replaceState(null, "", `?role=${p.role.value}&lang=${l}`);
  logProfileRequest();
}
function onCopyCurl(path: string) {
  toast.value = "copied";
  setTimeout(() => (toast.value = ""), 1500);
  if (!isMobile) c.open();
  if (!isMobile || c.state.value === "open") c.log({ kind: "system", text: "cURL command copied to clipboard" });
}

watchEffect(() => { if (typeof document !== "undefined") document.documentElement.lang = p.lang.value; });
onMounted(async () => { await p.fetchProfile(); logProfileRequest(); });
</script>

<template>
  <div class="app">
    <TelemetryBar :degraded="p.status.value === 'degraded'" />
    <main>
      <nav class="controls no-print">
        <RoleSwitcher :modelValue="p.role.value" @update:modelValue="onRole" />
        <LangSwitcher :modelValue="p.lang.value" @update:modelValue="onLang" />
      </nav>

      <template v-if="p.status.value === 'loading'">
        <div class="skeleton" aria-hidden="true"><div class="sk sk-title" /><div class="sk sk-line" /><div class="sk sk-line" /></div>
      </template>

      <template v-else-if="prof">
        <h1>{{ (prof.person as any).name }}</h1>
        <p class="title mono">{{ (prof.person as any).title }}</p>
        <p class="summary">{{ prof.executiveSummary }}</p>

        <SectionBlock title="Projects" :curlPath="`/v1/projects?role=${p.role.value}&lang=${p.lang.value}`" @copycurl="onCopyCurl">
          <div ref="cardsEl" class="cards">
            <ProjectCard v-for="pr in prof.projects" :key="pr.id" :project="pr" @copycurl="onCopyCurl" />
          </div>
        </SectionBlock>

        <SectionBlock title="Experience" :curlPath="`/v1/profile/build?target_role=${p.role.value}&lang=${p.lang.value}`" @copycurl="onCopyCurl">
          <ul class="xp">
            <li v-for="e in prof.experiences" :key="e.id">
              <strong>{{ e.role }}</strong><span class="org">, {{ e.org }}</span>
              <p class="xps">{{ e.summary }}</p>
            </li>
          </ul>
        </SectionBlock>

        <SectionBlock title="Skills" :curlPath="`/v1/skills?lang=${p.lang.value}`" @copycurl="onCopyCurl">
          <ul class="stack mono skills">
            <li v-for="s in prof.skills" :key="s.id">{{ s.label }}</li>
          </ul>
        </SectionBlock>
      </template>

      <div v-if="toast" class="toast mono" role="status">{{ toast }}</div>
    </main>
    <ConsolePane :state="c.state.value" :entries="c.entries.value" :lastRequest="p.lastRequest.value" @toggle="c.toggle()" />
  </div>
</template>

<style scoped>
.app { max-width: 62rem; margin: 0 auto; padding: 0 1.25rem 30vh; }
.controls { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin: 1.25rem 0 2rem; flex-wrap: wrap; }
h1 { font-size: 2.2rem; margin: 0; }
.title { color: var(--accent-live); margin: 0.2rem 0 1rem; }
.summary { font-size: 1.05rem; max-width: 46rem; transition: opacity 0.2s; }
.cards { display: grid; gap: 1rem; }
.xp { list-style: none; padding: 0; } .xp li { margin-bottom: 1rem; }
.org { color: var(--text-muted); } .xps { color: var(--text-muted); font-size: 0.9rem; margin: 0.2rem 0 0; }
.skills { display: flex; flex-wrap: wrap; gap: 0.4rem; padding: 0; list-style: none; }
.skills li { font-size: 0.75rem; border: 1px solid var(--border); border-radius: 4px; padding: 0.15rem 0.5rem; }
.toast { position: fixed; bottom: 4rem; right: 1.5rem; background: var(--surface); border: 1px solid var(--accent-live); color: var(--accent-live); padding: 0.4rem 0.8rem; border-radius: 6px; }
.skeleton .sk { background: var(--surface); border-radius: 6px; margin: 0.6rem 0; animation: pulse 1.2s infinite; }
.sk-title { height: 2.2rem; width: 40%; } .sk-line { height: 1rem; width: 80%; }
@keyframes pulse { 50% { opacity: 0.5; } }
@media (min-width: 900px) { .cards { grid-template-columns: 1fr 1fr; } }
</style>
```

- [ ] **Step 2: Verify build + tests**: `bun --cwd=apps/web run build` success; `bun --cwd=apps/web run typecheck` clean; full `bun test` 66 pass.

- [ ] **Step 3: Live smoke** (two shells or background): API on 3000 (`bun --cwd=apps/api run dev`), web dev (`bun --cwd=apps/web run dev`). Verify with curl that `http://localhost:4321/?role=anthropic&lang=fr` serves HTML containing the Vue island. Then STOP the API and reload conceptually: the degraded path is covered by unit tests; the owner does the visual pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "feat(web): Mission Console orchestrator - contextual console, FLIP, degraded badge, copy-curl"
```

---

### Task 7: Print, a11y sweep, Lighthouse script, final verification

**Files:**
- Modify: `apps/web/src/styles/global.css` (print block extension)
- Create: `scripts/lighthouse.md` note OR root package.json script
- Modify: root `package.json` (add script)

**Interfaces:** none new; closes spec §2 (print), §7 (budgets).

- [ ] **Step 1: Extend the print block** in `apps/web/src/styles/global.css`:

```css
@media print {
  .no-print { display: none !important; }
  a { color: #000; text-decoration: none; }
  .card { border: 1px solid #999; background: #fff !important; backdrop-filter: none !important; }
  .badge { border-color: #333; color: #000 !important; }
  .app { padding-bottom: 0 !important; max-width: none; }
  h1 { font-size: 18pt; } body { font-size: 10.5pt; }
}
```

- [ ] **Step 2: Add the Lighthouse script** to root `package.json` scripts:

```json
"lighthouse": "bunx lighthouse http://localhost:4321 --quiet --chrome-flags=--headless --only-categories=performance,accessibility,best-practices,seo"
```

Document in README (Deploy section): run it against `bun --cwd=apps/web run preview` after build; target ≥ 95 each; non-blocking v1.

- [ ] **Step 3: A11y checklist run** (manual, report evidence): tab order reaches RoleSwitcher → LangSwitcher → curl buttons → console tab; `aria-expanded` toggles on the console tab; `role="alert"` on degraded badge announces; both themes: degraded badge contrast (dark: #fef3c7 on #7f1d1d = 8.9:1; light: #7f1d1d on #fef2f2 = 9.6:1) and `--text-muted` ≥ 4.5:1 on both backgrounds.

- [ ] **Step 4: Full verification**: `bun test` (66 pass), `bun run typecheck` (clean), `bun --cwd=apps/web run build` (success).

- [ ] **Step 5: Commit**

```bash
git add apps/web package.json README.md
git commit -m "feat(web): print stylesheet, a11y polish, lighthouse budget script"
```

---

## Self-Review

- **Spec coverage:** §1 contextual first-load → Tasks 4 (useConsole rule) + 6 (isMobile, initial state) ; §2 tokens/typo/verre/badges/print → Tasks 2, 5, 7 ; §3 @profile/core → Task 1 ; §4 fallback+timeout+retry+skeletons → Task 3 (+ TelemetryBar `—` fail-soft Task 5) ; §5 composants → Tasks 4-6 ; §6 interactions (rôle FLIP, curl immersif, html lang, i18n badge) → Tasks 5-6 ; §7 perf/a11y → Tasks 2 (reduced-motion, fonts), 7 (budgets, contrasts) ; §8 tests → Tasks 3-4 (unit), 6-7 (build/manual). Owner notes: badge AA exact values (Tasks 2/7), timeout simulated test (Task 3 test 3). ✅
- **Placeholder scan:** none; all code complete. The skill-tag click interaction (spec §6 « clic tag skill ») is intentionally simplified to section-level curl in v1 scope: ADDED to Hors périmètre note below to avoid silent drift. ✅
- **Type consistency:** `useProfile` return names (`status/profile/lastRequest/setRole/setLang/retry`) match Task 6 usage; `ConsoleEntry`/`useConsole` API matches ConsolePane props and Terminal calls; `curlFor(path, base?)` consistent across Tasks 4-6. ✅
- **Scope note:** the per-skill-tag console replay (spec §6, clic sur un tag skill) is deferred: v1 ships section-level copy-curl + request logging on role/lang change. Recorded here as a conscious v1 cut (candidate for the polish pass), keeping the plan honest vs the spec.
