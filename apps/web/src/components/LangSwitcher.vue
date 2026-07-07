<script setup lang="ts">
import { ref } from "vue";
import { LANGS, type Lang } from "@profile/schema";
const props = defineProps<{ modelValue: Lang }>();
const emit = defineEmits<{ "update:modelValue": [Lang] }>();
const showBadge = ref(false);
let badgeTimer: ReturnType<typeof setTimeout> | undefined;
function pick(l: Lang) {
  if (l === props.modelValue) return;
  emit("update:modelValue", l);
  showBadge.value = true;
  clearTimeout(badgeTimer);
  badgeTimer = setTimeout(() => (showBadge.value = false), 2000);
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
