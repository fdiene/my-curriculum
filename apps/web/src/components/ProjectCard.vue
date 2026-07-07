<script setup lang="ts">
import { curlFor } from "../lib/curl";
const props = defineProps<{ project: any; role: string; lang: string }>();
const emit = defineEmits<{ copycurl: [string] }>();
function copy() {
  const path = `/v1/projects?role=${props.role}&lang=${props.lang}`;
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
