<script setup lang="ts">
import { computed, ref } from "vue";
import { buildCvView, formatMonthYear, type CvTemplateId } from "@profile/core";
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
            <span v-if="view.person.links?.github"> - {{ view.person.links.github }}</span>
          </p>
        </div>
      </header>
      <p class="doc-label mono">{{ view.documentLabel }}</p>

      <section>
        <p class="summary">{{ view.executiveSummary }}</p>
      </section>

      <section>
        <h2>{{ view.labels.experience }}</h2>
        <div v-for="e in view.experiences" :key="e.id" class="entry">
          <div class="entry-head">
            <strong>{{ e.role }}</strong>, {{ e.org }}
            <span class="dates">{{ formatMonthYear(e.period.start, lang) }} - {{ e.period.end ? formatMonthYear(e.period.end, lang) : view.labels.present }}</span>
          </div>
          <ul>
            <li v-for="(h, i) in e.highlights" :key="i">{{ h }}</li>
          </ul>
        </div>
      </section>

      <section v-if="view.projects.length">
        <h2>{{ view.labels.projects }}</h2>
        <div v-for="pr in view.projects" :key="pr.id" class="entry">
          <div class="entry-head"><strong>{{ pr.name }}</strong> <span class="dates">{{ pr.stack.join(", ") }}</span></div>
          <p class="project-line">{{ pr.tagline }}</p>
        </div>
      </section>

      <section v-if="view.education.length">
        <h2>{{ view.labels.education }}</h2>
        <div v-for="ed in view.education" :key="ed.id" class="entry">
          <div class="entry-head">
            <strong>{{ ed.title }}</strong>, {{ ed.org }}
            <span class="dates">{{ formatMonthYear(ed.period.start, lang) }} - {{ ed.period.end ? formatMonthYear(ed.period.end, lang) : view.labels.present }}</span>
          </div>
        </div>
      </section>

      <section v-if="view.certifications.length">
        <h2>{{ view.labels.certifications }}</h2>
        <div v-for="c in view.certifications" :key="c.id" class="entry">
          <strong>{{ c.title }}</strong>, {{ c.org }} <span class="dates">{{ formatMonthYear(c.period.start, lang) }}</span>
        </div>
      </section>

      <section>
        <h2>{{ view.labels.skills }}</h2>
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
  h2 { break-after: avoid; }
}
</style>
