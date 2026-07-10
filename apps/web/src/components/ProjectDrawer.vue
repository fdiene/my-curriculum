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
