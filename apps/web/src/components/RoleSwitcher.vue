<script setup lang="ts">
import type { TargetRole } from "@profile/schema";
const props = defineProps<{ modelValue: TargetRole }>();
const emit = defineEmits<{ "update:modelValue": [TargetRole] }>();
const roles: { value: TargetRole; label: string }[] = [
  { value: "default", label: "General" },
  { value: "ai_dx", label: "AI Tooling & DX Engineer" },
  { value: "iot", label: "IoT Architect" },
  { value: "plm_architect", label: "PLM Architect" },
];
</script>

<template>
  <label class="switch no-print">
    <span class="lbl">Viewing profile as:</span>
    <select class="mono" :value="modelValue" @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value as TargetRole)">
      <option v-for="r in roles" :key="r.value" :value="r.value">{{ r.label }}</option>
    </select>
  </label>
</template>

<style scoped>
.switch { display: inline-flex; gap: 0.5rem; align-items: center; }
.lbl { color: var(--text-muted); font-size: 0.85rem; }
select { background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 0.3rem 0.6rem; }
</style>
