<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watchEffect } from "vue";
import type { Profile } from "@profile/core";
import { useProfile } from "../lib/useProfile";
import { useConsole } from "../lib/useConsole";
import { parseViewParams } from "../lib/params";
import TelemetryBar from "./TelemetryBar.vue";
import RoleSwitcher from "./RoleSwitcher.vue";
import LangSwitcher from "./LangSwitcher.vue";
import ThemeToggle from "./ThemeToggle.vue";
import ProjectCard from "./ProjectCard.vue";
import ProjectDrawer from "./ProjectDrawer.vue";
import SectionBlock from "./SectionBlock.vue";
import ConsolePane from "./ConsolePane.vue";

const params = parseViewParams(typeof window === "undefined" ? "" : window.location.search);
const isMobile = typeof window !== "undefined" && matchMedia("(max-width: 767px)").matches;
const p = useProfile(params);
const c = useConsole({ role: params.role, isMobile });
const cardsEl = ref<HTMLElement | null>(null);
const toast = ref("");
const openProject = ref<any | null>(null);
const reduced = typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const prof = computed<Profile | null>(() => p.profile.value);

function logProfileRequest() {
  const payload = prof.value ? JSON.stringify({ executiveSummary: String(prof.value.executiveSummary).slice(0, 120) + "…", projects: prof.value.projects.map((x) => x.id) }, null, 1) : undefined;
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
function openDetails(project: any) {
  openProject.value = project;
  const path = `/v1/projects/${project.id}?lang=${p.lang.value}`;
  c.log({ kind: "request", text: path, payload: JSON.stringify({ id: project.id, status: project.status, stack: project.stack }, null, 1) });
}

watchEffect(() => { if (typeof document !== "undefined") document.documentElement.lang = p.lang.value; });
onMounted(async () => { await p.fetchProfile(); logProfileRequest(); });
</script>

<template>
  <div class="app">
    <TelemetryBar :degraded="p.status.value === 'degraded'" @retry="p.retry()" />
    <main>
      <nav class="controls no-print">
        <RoleSwitcher :modelValue="p.role.value" @update:modelValue="onRole" />
        <LangSwitcher :modelValue="p.lang.value" @update:modelValue="onLang" />
        <ThemeToggle />
      </nav>

      <template v-if="p.status.value === 'loading'">
        <div class="skeleton" aria-hidden="true"><div class="sk sk-title" /><div class="sk sk-line" /><div class="sk sk-line" /></div>
      </template>

      <template v-else-if="prof">
        <div class="identity">
          <img v-if="prof.person.avatarUrl" class="avatar" :src="prof.person.avatarUrl" alt="" width="56" height="56" />
          <h1>{{ prof.person.name }}</h1>
        </div>
        <p class="title mono">{{ prof.person.title }}</p>
        <p v-if="prof.person.mobility" class="mobility">{{ prof.person.mobility }}</p>
        <p v-if="prof.person.links?.linkedin || prof.person.links?.email || prof.person.links?.github" class="contact mono">
          <a v-if="prof.person.links.linkedin" :href="prof.person.links.linkedin" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" title="LinkedIn">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          </a>
          <a v-if="prof.person.links.email" :href="`mailto:${prof.person.links.email}`" aria-label="Email" title="Email">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/></svg>
          </a>
          <a v-if="prof.person.links.github" :href="prof.person.links.github" target="_blank" rel="noopener noreferrer" aria-label="GitHub" title="GitHub">
            <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
          </a>
        </p>
        <p class="summary" :key="p.role.value + p.lang.value">{{ prof.executiveSummary }}</p>

        <SectionBlock title="Projects" :curlPath="`/v1/projects?role=${p.role.value}&lang=${p.lang.value}`" @copycurl="onCopyCurl">
          <div ref="cardsEl" class="cards">
            <ProjectCard v-for="pr in prof.projects" :key="pr.id" :project="pr" :role="p.role.value" :lang="p.lang.value" @copycurl="onCopyCurl" @open="openDetails" />
          </div>
        </SectionBlock>

        <SectionBlock title="Experience" :curlPath="`/v1/profile/build?target_role=${p.role.value}&lang=${p.lang.value}`" @copycurl="onCopyCurl">
          <ul class="xp">
            <li v-for="e in prof.experiences" :key="e.id">
              <strong>{{ e.role }}</strong><span class="org">, {{ e.org }}</span>
              <p class="xps">{{ e.summary }}</p>
              <ul class="hl">
                <li v-for="(h, i) in e.highlights" :key="i">{{ h }}</li>
              </ul>
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
    <ConsolePane :state="c.state.value" :entries="c.entries.value" :lastRequest="p.lastRequest.value" @toggle="c.toggle()" @clear="c.clear()" />
    <ProjectDrawer :project="openProject" :lang="p.lang.value" @close="openProject = null" @copycurl="onCopyCurl" />
  </div>
</template>

<style scoped>
.app { max-width: 62rem; margin: 0 auto; padding: 0 1.25rem 30vh; }
.controls { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin: 1.25rem 0 2rem; flex-wrap: wrap; }
.identity { display: flex; align-items: center; gap: 0.8rem; }
.avatar { border-radius: 50%; object-fit: cover; border: 1px solid var(--border); filter: grayscale(1); transition: filter 0.25s; }
.avatar:hover { filter: grayscale(0); }
h1 { font-size: 2.2rem; margin: 0; }
.title { color: var(--accent-live); margin: 0.2rem 0 0.2rem; }
.mobility { color: var(--text-muted); font-size: 0.85rem; margin: 0 0 0.4rem; }
.contact { display: flex; gap: 0.7rem; margin: 0 0 1rem; }
.contact a { display: inline-flex; color: var(--text-muted); }
.contact a:hover { color: var(--text); }
.contact svg { flex-shrink: 0; }
.summary { font-size: 1.05rem; max-width: 46rem; transition: opacity 0.2s; animation: fadeIn 0.2s ease-out; }
@keyframes fadeIn { from { opacity: 0; } }
.cards { display: grid; gap: 1rem; }
.xp { list-style: none; padding: 0; } .xp li { margin-bottom: 1rem; }
.org { color: var(--text-muted); } .xps { color: var(--text-muted); font-size: 0.9rem; margin: 0.2rem 0 0; }
.hl { margin: 0.3rem 0 0 1rem; padding: 0; font-size: 0.88rem; } .hl li { margin-bottom: 0.5rem; }
.skills { display: flex; flex-wrap: wrap; gap: 0.4rem; padding: 0; list-style: none; }
.skills li { font-size: 0.75rem; border: 1px solid var(--border); border-radius: 4px; padding: 0.15rem 0.5rem; }
.toast { position: fixed; bottom: 4rem; right: 1.5rem; background: var(--surface); border: 1px solid var(--accent-live); color: var(--accent-live); padding: 0.4rem 0.8rem; border-radius: 6px; }
.skeleton .sk { background: var(--surface); border-radius: 6px; margin: 0.6rem 0; animation: pulse 1.2s infinite; }
.sk-title { height: 2.2rem; width: 40%; } .sk-line { height: 1rem; width: 80%; }
@keyframes pulse { 50% { opacity: 0.5; } }
@media (min-width: 900px) { .cards { grid-template-columns: 1fr 1fr; } }
</style>
