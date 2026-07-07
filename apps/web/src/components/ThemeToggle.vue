<script setup lang="ts">
import { ref } from "vue";

function current(): "dark" | "light" {
  if (typeof document === "undefined") return "dark";
  return (document.documentElement.dataset.theme as "dark" | "light") || "dark";
}

const theme = ref<"dark" | "light">(current());

function toggle() {
  const next = theme.value === "dark" ? "light" : "dark";
  theme.value = next;
  document.documentElement.dataset.theme = next;
  localStorage.setItem("theme", next);
}
</script>

<template>
  <button class="theme-toggle mono no-print" aria-label="Switch theme" @click="toggle">{{ theme }}</button>
</template>

<style scoped>
.theme-toggle { background: none; border: 1px dashed var(--border); color: var(--text-muted); border-radius: 4px; font-size: 0.75rem; padding: 0.2rem 0.5rem; cursor: pointer; }
</style>
