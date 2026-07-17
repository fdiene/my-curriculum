# Montée en compétences par projet

> Fichier canonique des TODOs de progression, aligné sur les gaps Anthropic
> (CLI tools, TS à grande échelle, runtimes alternatifs, testing/Evals, DX, MCP, safety).
> À nourrir en début de session sur chaque projet : cocher, dater, ajouter.
> Règle : chaque TODO fait progresser à la fois le projet ET une compétence nommée.

---

## Profile Engine (my-curriculum) : statut `live`

**Compétences visées : TypeScript avancé (types mappés/conditionnels), release engineering, CDN/Traefik.**

- [x] Career advisor (`scripts/career-advisor.ts`) : étendre le prompt pour aussi conseiller sur (a) la revalorisation du CV traditionnel PDF/Word (contenu et mise en page), (b) l'optimisation du profil LinkedIn, (c) un pitch généré en fonction d'une offre d'emploi ciblée fournie en entrée. Compétence : prompt engineering appliqué, positionnement carrière. (fait 2026-07-17, `advisor.core.ts` : 7 sections dont CV/LinkedIn/pitch ciblé, CLI accepte un argument offre d'emploi texte ou chemin de fichier)
  - Spec de contraintes dures (review externe JobsLead/Claudia Baker, 14 juil. 2026, sur le CV PDF actuel 2 pages/88 Ko) : cible 1 page strict, police unique (actuellement plusieurs), 2 couleurs de police max, pas de mise en page en colonnes (parsing ATS), ville+CP sans adresse complète, email+téléphone obligatoires tous les deux, dates mois+année obligatoires sur chaque poste (aucune exception), compétences filtrées 8-15 par offre ciblée (pas un dump statique de `master_data`).
  - Formulation : reporter en priorité la formulation Profile Engine (plus forte) vers le PDF plutôt que réinventer : ex. bullets DB SQL composites (`master_data.fr.json:118`) et cutover Enovia VPM V4 (`master_data.fr.json:91`).
  - Gap métriques (confirmé 2026-07-15, aucun chiffre fabriqué) : ni le bullet DB SQL composites ni le bullet cutover Enovia n'ont de métrique chiffrée fiable disponible (owner confirmé aucun chiffre exact connu) : rester qualitatif sur ces deux bullets tant qu'aucune métrique réelle n'est retrouvée.
- [ ] `LocalizeDeep<T>` : type mappé récursif dans @profile/schema, typer `localize()` et `Profile`, supprimer les `as any` et `ref<any>` (ticket final review). Compétence : type-level programming TS.
- [ ] Error-state Terminal.vue (gate de lancement) + état vide. Compétence : UX defensive.
- [ ] Tests metrics manquants : `res.ok`, TTL-hit, header auth, agrégation getMetrics. Compétence : test design HTTP.
- [ ] CI : pin Bun 1.3.14 + job `astro build` + badge tests dans README. Compétence : CI hygiene.
- [ ] Dockerfile `USER bun`, `<html lang>` dynamique. Compétence : hardening.
- [ ] Push GitHub public + achat domaine + déploiement CDN/VPS. Compétence : mise en production réelle de bout en bout.

## ops-tools : statut `building` (objectif : open-source npm)

**Compétences visées : CLI design, publication npm, hygiène supply-chain.**

- [ ] Passe gitleaks + audit manuel : purger tout secret/donnée sensible de l'historique (BFG si nécessaire). Compétence : nettoyage d'historique git.
- [ ] Restructurer en commander.js : `ops run | repo | setup | doctor | dev`, aide intégrée. Compétence : architecture CLI.
- [ ] Télémétrie locale : tracer la durée de chaque commande (fichier JSONL local). Compétence : observabilité DX.
- [ ] Suite Vitest + CI GitHub Actions verte. Compétence : testing infra.
- [ ] `package.json` bin + publication `@fdiene/ops-tools` sur npm (provenance, README avec GIFs vhs/asciinema). Compétence : release npm publique.
- [ ] Une fois public : renseigner `links.repo` dans master_data et passer le badge à `live`.

## SEOMNIX Empire : statut `live` (pipeline) ; Evals à implémenter

**Compétences visées : Evals / LLM-as-a-judge (gap Anthropic n°1), LangGraph avancé.**

- [ ] Apprendre : LangGraph `add_conditional_edges`, state cyclique, checkpointing (docs officielles + un tuto pratique). Compétence : orchestration en graphe.
- [ ] Collection Directus `content_evals` (article_id, factual_score, formatting_score, safety_flag, judge_feedback).
- [ ] `agents/evaluator.py` : juge Claude Haiku, sortie structurée Pydantic (`is_approved`, scores /10), prompt anti-hallucination confrontant l'article aux sources Perplexity. Compétence : structured output + grounding.
- [ ] Routage conditionnel post-eval : Keep → Media ; Reject → alerte Telegram n8n + stop. Compétence : safety loops.
- [ ] `scripts/run_eval_test.py` : tester le juge isolément en CLI + Evals déterministes en CI. Compétence : eval harness reproductible.
- [ ] README section « Evaluation Framework » avec diagramme Mermaid.
- [ ] Analyser le repo : montrable publiquement ou non (secrets, données client) ; décision `links.repo`.

## Omnis-Agri (Agri-OS) : statut `concept`

**Compétences visées : edge/embarqué (ESP32/MQTT), 2e serveur MCP, safety-critical design.**

- [ ] Choisir le nom définitif du projet.
- [ ] Finaliser la liste de courses matériel plug-and-play (capteurs Wi-Fi/Zigbee ou ESP32 compatibles REST/webhooks). Compétence : sourcing hardware.
- [ ] Bases MQTT : broker local (Mosquitto Docker), topics, QoS. Compétence : protocoles IoT.
- [ ] Endpoint FastAPI d'ingestion + schéma Directus serre (mesures, actionneurs, journaux d'actions). Compétence : modélisation données IoT.
- [ ] Design de l'Agent Juge : règles déterministes d'abord, LLM en second avis ; aucune action physique sans validation. Compétence : architecture safety-critical.
- [ ] Serveur MCP « greenhouse » : état de la serre interrogeable depuis Claude Desktop (réutiliser les patterns de Harness). Compétence : MCP server design.
- [ ] `ops status --greenhouse` dans ops-tools (pont entre les deux projets).
- [ ] ETL Excel → Directus avec validation stricte Zod/Pydantic (gap Data Integrity).

## ArtMap : statut `building` (en recette client)

**Compétences visées : release engineering mobile, science de la couleur, produit client.**

- [ ] Clore la recette client en cours (builds QA, tickets S7/S8 restants).
- [ ] Migration Delta E CIE 1976 → CIEDE2000 (prévu dans les règles projet). Compétence : colorimétrie appliquée.
- [ ] Remplacer l'auth `demo-user` par une vraie auth. Compétence : auth mobile.
- [ ] Build EAS + soumission stores (TestFlight puis App Store/Play). Compétence : release mobile de bout en bout.
- [ ] Chiffrer l'impact pour le CV une fois livré (utilisateurs, note, délai de livraison) et passer le badge à `live`.

## Harness : statut `live` (interne)

**Compétences visées : profondeur MCP SDK, économie d'agents, méthodologie de benchmark.**

- [ ] Remplacer les smoke tests .mjs par une vraie suite (Vitest) : router, supervisor, guardrails. Compétence : testing d'un serveur MCP.
- [ ] Calibrer le llm-router avec lmfit sur des benchmarks reproductibles (RD-MODELS). Compétence : benchmark quantitatif de modèles.
- [ ] Étendre les guardrails (R-SEC-1) : journal d'audit des actions destructives refusées/confirmées. Compétence : safety engineering.
- [ ] Intégration Context7 dans le pipeline de délégation. Compétence : injection de docs fraîches.
- [ ] Étudier l'extraction open-source d'un sous-ensemble (le superviseur anti-bloat est le candidat le plus original). Compétence : packaging OSS.

---

## Fil conducteur (ordre suggéré)

1. **Profile Engine → public + déployé** (c'est la vitrine, tout le reste pointe dessus).
2. **SEOMNIX eval_node** (gap Evals, le plus différenciant pour Anthropic).
3. **ops-tools → npm** (gap CLI, artefact public rapide).
4. **Harness tests + calibration** (profondeur MCP).
5. **ArtMap stores** (preuve produit).
6. **Omnis-Agri matériel + MCP serre** (le temps long).
