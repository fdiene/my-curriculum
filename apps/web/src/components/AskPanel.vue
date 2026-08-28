<script setup lang="ts">
import { ref } from "vue";
import { api } from "../lib/client";

const question = ref("");
const answer = ref("");
const sources = ref<string[]>([]);
const loading = ref(false);
const error = ref(false);

async function submit() {
  if (!question.value.trim() || loading.value) return;
  loading.value = true;
  error.value = false;
  const { data, error: err } = await api.ask.post({ question: question.value.trim() });
  loading.value = false;
  if (err || !data) {
    error.value = true;
    return;
  }
  answer.value = data.answer;
  sources.value = data.sources;
}
</script>

<template>
  <section class="ask-panel">
    <h2>Ask about this profile</h2>
    <form class="ask-form" @submit.prevent="submit">
      <input v-model="question" class="mono" type="text" placeholder="e.g. What experience does Fadel have with IAM?" :disabled="loading" />
      <button class="mono" type="submit" :disabled="loading">{{ loading ? "..." : "Ask" }}</button>
    </form>
    <p v-if="error" class="ask-error mono">Something went wrong, try again.</p>
    <div v-if="answer" class="ask-answer">
      <p>{{ answer }}</p>
      <p v-if="sources.length" class="ask-sources mono">
        Sources: <span v-for="s in sources" :key="s" class="ask-source-badge">{{ s }}</span>
      </p>
    </div>
  </section>
</template>

<style scoped>
.ask-panel { margin: 2rem 0; padding: 1rem; border: 1px solid var(--border); border-radius: 6px; }
.ask-panel h2 { margin: 0 0 0.75rem; font-size: 1.1rem; }
.ask-form { display: flex; gap: 0.5rem; }
.ask-form input { flex: 1; background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 4px; padding: 0.4rem 0.6rem; }
.ask-form button { background: var(--accent-live); color: #fff; border: none; border-radius: 4px; padding: 0.4rem 0.9rem; cursor: pointer; }
.ask-form button:disabled { opacity: 0.6; cursor: default; }
.ask-error { color: var(--accent-error); margin-top: 0.5rem; font-size: 0.85rem; }
.ask-answer { margin-top: 0.75rem; }
.ask-sources { color: var(--text-muted); font-size: 0.75rem; margin-top: 0.4rem; }
.ask-source-badge { border: 1px solid var(--border); border-radius: 4px; padding: 0.1rem 0.4rem; margin-right: 0.3rem; }
</style>
