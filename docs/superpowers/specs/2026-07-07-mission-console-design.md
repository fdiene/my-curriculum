# Mission Console : style et UX de la vue (v1) - Design

- **Date :** 2026-07-07
- **Statut :** validé en conversation ; spec en relecture owner
- **Prérequis :** branche `feature/profile-engine-phase1`, content-v2 terminé (54 tests verts)
- **Objectif :** une interface qui crie « ingénieur système/DX qui maîtrise l'IA » tout en restant lisible pour un RH classique, et qui ferme le gate de lancement error-state.

## 1. Concept : « Mission Console »

Synthèse des trois directions explorées : peau **Mission Control** (aérospatial/sécurité), moteur révélé via une **console basse repliable façon DevTools** (pleine largeur, ~40 % de hauteur ouverte), esprit **Rendered/Raw** porté par cette console. Le premier regard est contextuel :

| Contexte | Premier chargement |
|---|---|
| Défaut / RH (pas de `?role=` ou role inconnu) | CV rendu épuré, TelemetryBar discrète, onglet « ⌃ Console » fermé |
| `?role=anthropic` / `iot` / `plm` sur desktop (≥ 768px) | Console ouverte (~40 %) rejouant la requête qui a construit la page |
| Mobile (< 768px), quel que soit le rôle | Console TOUJOURS minimisée au chargement ; son onglet affiche la dernière requête en une ligne tronquée (le hook reste au-dessus de la ligne de flottaison) |

## 2. Design system

- **Tokens CSS** (`apps/web/src/styles/tokens.css`) : palette slate/navy (sombre : fond `#0f172a`), accents émeraude (live/succès), ambre (building/dégradé), slate clair (concept). Trois rendus pilotés uniquement par les tokens :
  1. **Sombre** (défaut : l'identité anti-LinkedIn),
  2. **Clair** (toggle + `prefers-color-scheme`),
  3. **Print** (`@media print` : fond blanc, console/télémétrie masquées, badges en texte, marges via `@page` : règle mémorisée).
- **Typo** : Inter variable (texte) + Fira Code (terminal, métriques, tags, badges) : le mix mono/sans est la signature. Self-hosted, `font-display: swap`. Échelle modulaire 1.25.
- **Verre dépoli** : uniquement sur `ProjectCard` (backdrop-filter + fallback opaque `@supports`).
- **Badges statut** : pastilles FIXES (pas de clignotement : en supervision, clignoter = alarme) : `live` émeraude, `building` ambre, `concept` slate.
- **Typographie contenu** : aucune animation machine à écrire (écartée) ; cross-fade du summary + réordonnancement FLIP des cartes (~300 ms), désactivés sous `prefers-reduced-motion`.

## 3. Refactor structurel : `@profile/core` (pures partagées)

Extraction depuis `apps/api/src` des fonctions **pures** vers un nouveau package `packages/core` (`@profile/core`) : `localize.ts`, `routing.ts` (ROLE_WEIGHTS, scoreItem, orderByRole, FEATURED_BOOST), `buildProfile.ts` (signature `buildProfile(role, lang, data)` SANS default lié au fs). L'API les réimporte (son `data.ts`/routes inchangés fonctionnellement) ; le web les importe pour le fallback. Tests des pures déplacés avec elles. Aucune modification de comportement : suite verte inchangée.

## 4. Résilience : fallback statique embarqué

- Le build Astro importe `data/master_data.i18n.json` (copie figée au build, ~15-20 KB gzip) dans l'îlot orchestrateur.
- `useProfile()` (composable, état `loading | ready | error | degraded`) : à l'échec du fetch Eden (timeout 4 s ou erreur réseau), bascule en `degraded` : reconstruction locale via `buildProfile` de `@profile/core` + badge critique `[SYSTEM DEGRADED : SERVING STATIC FALLBACK]` (ambre-rouge) dans la TelemetryBar ; bouton retry qui retente l'API et revient en `ready` si succès.
- En `error` transitoire (avant fallback monté) : squelettes de chargement ; plus AUCUN « Loading… » infini (ferme le gate de lancement).
- TelemetryBar en échec metrics : affiche `—`, ne casse rien.

## 5. Composants Vue (îlots Astro) et état

| Fichier | Responsabilité |
|---|---|
| `src/lib/useProfile.ts` | Composable état partagé : rôle, langue, profil, statut (loading/ready/error/degraded), re-fetch Eden, bascule fallback |
| `src/components/RoleSwitcher.vue` | « Viewing profile as: [ ▾ ] » : maj `?role=` (history.replaceState), re-fetch, événement console |
| `src/components/LangSwitcher.vue` | [EN][FR][DE] ; au changement, badge discret « translated via build-pipeline » (2 s) |
| `src/components/TelemetryBar.vue` | /v1/metrics au chargement + refresh au focus onglet (PAS de polling) ; slot badge degraded |
| `src/components/ConsolePane.vue` | Console basse : historique requêtes réelles, JSON colorisé (highlighter maison ~30 lignes), état ouvert/fermé/minimisé, a11y (`aria-expanded`, clavier) |
| `src/components/ProjectCard.vue` | Verre dépoli, badge statut, stack en tags mono, bouton copy-curl |
| `src/components/SectionBlock.vue` | Wrapper section : titre, ancre, copy-curl |
| `src/components/Terminal.vue` | Orchestrateur (refactor de l'existant) : compose le tout, FLIP + cross-fade |

Pas de Pinia (YAGNI). Événements console via le composable.

## 6. Interactions

- **Changement de rôle** : 1 fetch Eden → cross-fade summary + FLIP cartes → console loggue `GET /v1/profile/build?target_role=…&lang=…` + extrait de réponse colorisé.
- **Clic tag skill** : `GET /v1/skills?tag=…` joué et loggué, cartes skills surlignées.
- **Copy-curl** : copie `curl "https://api.fdiene.com/v1/…"` (base URL de l'env) ; desktop : ouvre la console si fermée + log `[SYSTEM] cURL command copied to clipboard` ; mobile : toast 1,5 s seul (console ouverte : log aussi).
- **i18n** : bascule de langue = re-fetch avec `?lang=` ; `html lang` mis à jour dynamiquement (absorbe le ticket existant).

## 7. Performance et accessibilité

- Astro statique + îlots ; zéro nouvelle dépendance JS (highlighter et FLIP maison) ; fonts self-hosted.
- Budget : Lighthouse ≥ 95 sur les quatre scores (script local `bun run lighthouse`, non bloquant v1).
- Contrastes AA sur les deux thèmes ; focus visibles ; console navigable clavier ; `prefers-reduced-motion` respecté partout.

## 8. Tests (`bun test`)

- `@profile/core` : tests existants déplacés (localize, routing, buildProfile) : inchangés.
- `useProfile` : transitions d'état, bascule degraded sur fetch rejeté (fetch injecté), retry.
- Générateur curl (pure) ; formateur/highlighter console (pure) ; détection mobile (pure, injectée).
- Vérification visuelle owner : 3 rôles × 2 thèmes × desktop/mobile ; print en PDF.

## 9. Hors périmètre v1

Machine à écrire, polling continu, mode IDE/arborescence, LocalizeDeep complet (ticket TS séparé : les `as any` existants ne s'aggravent pas), déploiement, refonte du contenu.
