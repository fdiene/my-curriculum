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
