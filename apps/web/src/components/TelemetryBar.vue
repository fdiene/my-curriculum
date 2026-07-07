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
    <span>LAT {{ m?.latency?.avg_ms ?? "--" }}ms</span>
    <span>COMMITS {{ m?.commits ?? "--" }}</span>
    <span>UPTIME {{ m?.uptime_pct ?? "--" }}%</span>
    <strong v-if="degraded" class="degraded" role="alert">SYSTEM DEGRADED : SERVING STATIC FALLBACK</strong>
  </header>
</template>

<style scoped>
.tele { display: flex; gap: 1.25rem; align-items: center; font-size: 0.72rem; color: var(--text-muted); padding: 0.5rem 1.25rem; border-bottom: 1px solid var(--border); }
.degraded { margin-left: auto; background: var(--degraded-bg); color: var(--degraded-text); padding: 0.2rem 0.6rem; border-radius: 4px; letter-spacing: 0.04em; }
</style>
