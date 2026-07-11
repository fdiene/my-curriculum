<script setup lang="ts">
import { curlFor } from "../lib/curl";
const props = defineProps<{ project: any; role: string; lang: string }>();
const emit = defineEmits<{ copycurl: [string]; open: [project: any] }>();
function copy() {
  const path = `/v1/projects?role=${props.role}&lang=${props.lang}`;
  navigator.clipboard?.writeText(curlFor(path));
  emit("copycurl", path);
}
</script>

<template>
  <article class="card" :data-project="project.id" tabindex="0" role="button" @click="emit('open', project)" @keydown.enter.prevent="emit('open', project)" @keydown.space.prevent="emit('open', project)">
    <img v-if="project.imageUrl" class="cover" :src="project.imageUrl" alt="" loading="lazy" />
    <header>
      <h3>{{ project.name }}</h3>
      <span class="badge" :class="project.status">{{ project.status }}</span>
      <button class="curl mono no-print" title="Copy cURL" @click.stop="copy" @keydown.stop>curl</button>
    </header>
    <p class="tagline">{{ project.tagline }}</p>
    <p class="desc">{{ project.description }}</p>
    <button v-if="project.details" class="more mono no-print" @click.stop="emit('open', project)" @keydown.stop>View details</button>
    <ul class="stack mono">
      <li v-for="s in project.stack" :key="s">{{ s }}</li>
    </ul>
  </article>
</template>

<style scoped>
.card { background: var(--surface-glass); border: 1px solid var(--border); border-radius: 12px; padding: 1rem 1.25rem; }
article { cursor: pointer; }
.cover { width: 100%; border-radius: 8px 8px 0 0; max-height: 140px; object-fit: cover; }
@supports (backdrop-filter: blur(8px)) { .card { backdrop-filter: blur(8px); } }
@supports not (backdrop-filter: blur(8px)) { .card { background: var(--surface); } }
header { display: flex; gap: 0.6rem; align-items: center; }
h3 { margin: 0; font-size: 1.05rem; flex: 1; }
.curl { background: none; border: 1px dashed var(--border); color: var(--text-muted); border-radius: 4px; font-size: 0.7rem; padding: 0.1rem 0.4rem; cursor: pointer; }
.tagline { color: var(--text-muted); font-style: italic; margin: 0.4rem 0; }
.desc { text-align: left; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; font-size: 0.9rem; }
.more { background: none; border: 1px dashed var(--border); color: var(--text-muted); border-radius: 4px; font-size: 0.72rem; padding: 0.15rem 0.5rem; cursor: pointer; margin-top: 0.5rem; }
.curl:hover, .more:hover { color: var(--text); border-style: solid; }
.stack { display: flex; flex-wrap: wrap; gap: 0.35rem; padding: 0; margin: 0.6rem 0 0; list-style: none; }
.stack li { font-size: 0.7rem; border: 1px solid var(--border); border-radius: 4px; padding: 0.1rem 0.4rem; color: var(--text-muted); }
@media print {
  .desc { -webkit-line-clamp: unset; }
}
</style>
