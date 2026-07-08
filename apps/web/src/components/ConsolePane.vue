<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import type { ConsoleEntry } from "../lib/useConsole";
import { highlightJson } from "../lib/consoleFormat";

const props = defineProps<{ state: "open" | "closed"; entries: ConsoleEntry[]; lastRequest: string }>();
const emit = defineEmits<{ toggle: []; clear: [] }>();
const bodyEl = ref<HTMLElement | null>(null);

watch(
  () => props.entries.length,
  async () => {
    await nextTick();
    bodyEl.value?.scrollTo({ top: bodyEl.value.scrollHeight });
  },
);
</script>

<template>
  <section class="console no-print" :class="state" aria-label="API console">
    <div class="tabrow">
      <button class="tab mono" :aria-expanded="state === 'open'" @click="emit('toggle')">
        <span aria-hidden="true">{{ state === "open" ? "⌄" : "⌃" }}</span> Console
        <span v-if="state === 'closed' && lastRequest" class="teaser">GET {{ lastRequest }}</span>
      </button>
      <button v-if="state === 'open'" class="clear mono" aria-label="Clear console" @click="emit('clear')">clear</button>
    </div>
    <div v-if="state === 'open'" ref="bodyEl" class="body mono" role="log" tabindex="0">
      <div v-for="(e, i) in entries" :key="i" class="entry">
        <span class="time">{{ e.time }}</span>
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
.tabrow { display: flex; align-items: center; }
.tab { flex: 1; text-align: left; background: none; border: 0; color: var(--text-muted); padding: 0.4rem 1rem; cursor: pointer; font-size: 0.8rem; }
.clear { background: none; border: 0; color: var(--text-muted); padding: 0.4rem 1rem; cursor: pointer; font-size: 0.75rem; }
.clear:hover { color: var(--accent-error); }
.teaser { opacity: 0.6; margin-left: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-block; max-width: 60vw; vertical-align: bottom; }
.time { color: var(--text-muted); opacity: 0.6; margin-right: 0.5rem; }
.sys { color: var(--accent-building); } .req { color: var(--accent-live); }
.entry { margin-bottom: 0.4rem; }
pre { margin: 0.2rem 0 0; white-space: pre-wrap; word-break: break-all; color: var(--text-muted); }
:deep(.j-key) { color: var(--accent-live); } :deep(.j-str) { color: var(--text); }
:deep(.j-num) { color: var(--accent-building); } :deep(.j-bool) { color: var(--accent-error); }
</style>
