<script setup lang="ts">
import { ref, onMounted } from "vue";
import { api } from "../lib/client";
import { parseViewParams } from "../lib/params";

const profile = ref<any>(null);
const meta = ref({ role: "default", lang: "en" });

onMounted(async () => {
  const p = parseViewParams(window.location.search);
  meta.value = p;
  const { data } = await api.v1.profile.build.get({ query: { target_role: p.role, lang: p.lang } });
  profile.value = data;
});
</script>

<template>
  <section v-if="profile" class="term">
    <p class="prompt">$ profile --role {{ meta.role }} --lang {{ meta.lang }}</p>
    <h1>{{ profile.person.name }}</h1>
    <p class="title">{{ profile.person.title }}</p>
    <p class="summary">{{ profile.executiveSummary }}</p>
    <h2>Projects</h2>
    <ul>
      <li v-for="p in profile.projects" :key="p.id"><strong>{{ p.name }}</strong> — {{ p.tagline }}</li>
    </ul>
    <h2>Experience</h2>
    <ul>
      <li v-for="e in profile.experiences" :key="e.id"><strong>{{ e.role }}</strong>, {{ e.org }}</li>
    </ul>
  </section>
  <p v-else class="term">Loading…</p>
</template>

<style scoped>
.term { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; max-width: 60rem; margin: 2rem auto; padding: 0 1rem; }
.prompt { color: #22c55e; } .title { color: #64748b; } .summary { margin: 1rem 0; }
</style>
