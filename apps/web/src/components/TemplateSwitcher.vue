<script setup lang="ts">
import { CV_TEMPLATES, type CvTemplateId } from "@profile/core";
defineProps<{ modelValue: CvTemplateId }>();
const emit = defineEmits<{ "update:modelValue": [CvTemplateId] }>();
const templates = Object.keys(CV_TEMPLATES) as CvTemplateId[];
</script>

<template>
  <div class="templates no-print">
    <button v-for="t in templates" :key="t" class="mono" :class="{ active: t === modelValue }"
      :aria-pressed="t === modelValue" @click="emit('update:modelValue', t)">{{ t.toUpperCase() }}</button>
  </div>
</template>

<style scoped>
.templates { display: inline-flex; gap: 0.3rem; align-items: center; }
button { background: none; border: 1px solid var(--border); color: var(--text-muted); border-radius: 4px; padding: 0.2rem 0.5rem; cursor: pointer; font-size: 0.75rem; }
button.active { color: var(--accent-live); border-color: var(--accent-live); }
</style>
