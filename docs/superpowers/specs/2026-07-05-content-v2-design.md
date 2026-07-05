# Contenu v2 : de-DRAFT, badges de statut, 6 projets - Design

- **Date :** 2026-07-05
- **Statut :** validé en conversation (blocs approuvés par le owner) ; spec en relecture
- **Annexe (source d'intégration) :** [2026-07-05-content-v2-blocks.json](./2026-07-05-content-v2-blocks.json)
- **Prérequis :** branche `feature/profile-engine-phase1` (Phase 1 complète, 44 tests verts)

## 1. Objectif

Finaliser le contenu du master data avant tout travail de style (« Content dictates Design ») :
résumés exécutifs percutants, 6 projets réels avec badges de statut honnêtes,
expériences au format « Staff Engineer », zéro mention [DRAFT], zéro tiret cadratin.

## 2. Décisions validées

| Décision | Choix |
|---|---|
| Stratégie projets | Badges de statut honnêtes ; chaque phrase défendable en entretien |
| Nouveaux projets | Profile Engine (le site lui-même), ArtMap (client anonymisé), Harness (MCP interne) |
| Statuts | `live` (Profile Engine, SEOMNIX pipeline, Harness interne) ; `building` (ops-tools, ArtMap en recette) ; `concept` (Omnis-Agri) |
| Hook anthropic_dx | Texte exact fourni par le owner (EN/FR), repris verbatim |
| Autres résumés | Alignés sur la mécanique du hook : passé aérospatial → conviction → preuve |
| Typographie | Aucun « — » dans les contenus (règle globale) : remplacer par « : » ou « - » |
| ArtMap | Client anonymisé ; rôle « conception + dev de bout en bout » ; Gemini assumé dans la stack |
| Harness | Badge `live` avec mention « privé et en évolution » dans la description |

## 3. Changements de schéma (`packages/schema`)

- `Project.status` : `z.enum(["live", "draft"])` → `z.enum(["live", "building", "concept"])`.
  La valeur `draft` disparaît (plus aucun usage après intégration).
- `Tag` : ajouter `"product"` (ArtMap). L'enum était prévu extensible.
- Aucun autre changement de forme.

## 4. Contenu (source : annexe JSON)

- **executiveSummaries** : remplacer les 4 entrées (EN+FR de l'annexe ; DE régénéré).
- **projects** : remplacer le tableau par les 6 entrées de l'annexe, dans cet ordre
  source : profile-engine, harness, seomnix, ops-tools, artmap, omnis-agri.
- **experiences** : remplacer `safran` par la version annexe ; réécrire les 4 autres
  (airbus-helicopters, dassault-falcon, airbus-ds, bombardier) au même format
  « [Action accomplie] + [Technologie] + [Impact/Résultat] », EN+FR, sans chiffres
  inventés, sans « — » (les titres `role` passent de « X — Y » à « X - Y »).
- **Balayage typographique** : aucun « — » ne subsiste dans `master_data.fr.json`
  (tous champs confondus) ni dans le `de` régénéré.

## 5. Ordre résultant du routage (vérifié par calcul, à figer en tests)

- `anthropic_dx` : Harness (126) → Profile Engine (120) → SEOMNIX (119) →
  ops-tools (115) → Omnis-Agri (17) → ArtMap (15).
  Validé : Harness en tête ; pour remettre Profile Engine n°1, un ajustement
  de poids suffirait (non retenu).
- `iot` : Omnis-Agri (130) en tête.
- `default` : ArtMap (boost featured) puis ordre source.

## 6. Pipeline DE et garde-fous

1. Après intégration FR/EN : `bun run translate` (clé dans `AI_agents/_shared/.env_global`).
2. Renforcer le prompt système du traducteur avec les leçons de la v1 :
   traduire aussi les intitulés de poste (ne rien laisser en anglais hors noms
   propres/produits), utiliser de vrais titres de diplômes allemands, style
   nominal homogène pour les puces.
3. Re-contrôle post-génération : grep « — » (aucun), aucun champ resté en anglais
   hors termes techniques, relecture par rétro-traduction (mise à jour de
   `docs/review-de.md`).

## 7. Tests à adapter

- `data/master_data.fr.test.ts` : assertion des ids → les 6 nouveaux (triés).
- `apps/api/src/profile.test.ts` : l'attente « omnis-agri dernier pour
  anthropic_dx » devient « ordre de tête = harness, profile-engine, seomnix,
  ops-tools » et « artmap dernier ».
- `apps/api/src/routing.test.ts` : fixtures inchangées (unitaires) ; ajouter un
  cas `product`/`concept` si le typage l'exige.
- Schéma : test du nouvel enum `status` (rejet de `draft`), test du tag `product`.
- Grep-test (nouveau, `data/master_data.style.test.ts`) : aucun « — » et aucun
  « [DRAFT] » dans les deux fichiers data.

## 8. Livrable annexe (hors code)

`docs/UPSKILLING.md` : TODOs de montée en compétences par projet (déjà rédigé),
pointeur en mémoire persistante pour récupération dans les sessions par repo.

## 9. Hors périmètre

Style/design de la vue (chantier suivant), déploiement, liens `links.repo`
(renseignés quand les repos seront publics), refonte des skills.
