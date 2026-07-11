# Progressive Disclosure + UI Polish : Design

- **Date :** 2026-07-09
- **Statut :** vision owner validée avec 2 amendements (endpoint réel, markdown zéro-dep)
- **Prérequis :** branche `feature/profile-engine-phase1` (82 tests verts)

## 1. Polish frontend (Partie 1 owner)

- **Cartes** : `text-align: left` sur `.desc` des ProjectCard (fin des rivières) ; le justify reste sur `.summary`/`.xps` (colonnes larges).
- **Expériences** : espacement des puces `.hl li` porté à 0.5rem ; hiérarchie de la ligne de titre : poste en `--text` gras, entreprise en `--text-muted` (vérifier l'existant `.org`).
- **Avatar** : style console : rond, bordure `--border`, `filter: grayscale(1)` par défaut, `grayscale(0)` au hover (transition douce, désactivée sous reduced-motion).
- **Boutons curl** : hover affirmé : texte `--text`, bordure pleine (dashed → solid), `cursor: pointer`.

## 2. Divulgation progressive (Partie 2 owner + amendements)

- **Schéma** (`@profile/schema`, Project) : `details: L.optional()` (Markdown localisé, récit long) ; `gallery: z.array(z.string()).optional()` (URLs images/diagrammes, non localisées).
- **Endpoint réel** (amendement 1) : `GET /v1/projects/:id?lang=` sur l'API Elysia : projet complet localisé (details/gallery inclus) ; 404 JSON `{error:"project_not_found"}` sinon. Le log console de l'ouverture du tiroir référence CET endpoint : immersion honnête, curl-able.
- **Markdown maison** (amendement 2) : `apps/web/src/lib/markdown.ts` : `renderMarkdown(src): string` : sous-ensemble (##/### titres, paragraphes, **gras**, *italique*, `code`, listes -, [liens](url) avec `rel="noopener"`), échappement HTML AVANT toute transformation, tests adversariaux (script, onerror, javascript: URLs neutralisés).
- **ProjectDrawer.vue** : panneau glissant depuis la droite (~480px, 100% mobile), overlay `backdrop-filter: blur` cliquable pour fermer, ESC ferme, `role="dialog"` `aria-modal="true"`, focus déplacé sur le bouton fermer à l'ouverture, scroll body verrouillé, transitions désactivées sous reduced-motion. Contenu : titre + badge + tagline, markdown de `details`, images `gallery` (lazy), stack complète, bouton copy-curl de l'endpoint détail.
- **Cartes teaser** : `.desc` limité par `-webkit-line-clamp: 3` (contenu intact pour API/print/SEO) ; bouton « View details » + carte cliquable (Enter/Espace au clavier, `cursor: pointer`) ; ouverture → log console `GET /v1/projects/{id}?lang=…` + extrait de réponse.
- **Print** : le tiroir et l'overlay sont `.no-print` ; les `details` ne s'impriment pas en v1 (le CV papier reste la vue synthétique).

## 3. Contenu

Les champs `details`/`gallery` sont optionnels : le tiroir n'apparaît comme action que si `details` existe. Seed de démonstration : `profile-engine` reçoit un `details` FR/EN rédigé depuis les faits déjà validés (architecture, résilience, pipeline i18n), marqué pour relecture owner dans le diff ; DE via `bun run translate` (glossaire actif). Les autres projets seront nourris par le owner via le workflow JSON → translate → build.

## 4. Tests

Schéma (champs optionnels), endpoint (200 localisé, 404, shape), markdown (rendu + XSS), drawer logic extraite pure si besoin (open/close/esc), suite complète verte, build + greps dist.
