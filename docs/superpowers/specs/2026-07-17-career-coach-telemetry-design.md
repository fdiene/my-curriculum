# Career Coach Telemetry : Design

- **Date :** 2026-07-17
- **Statut :** vision owner validée
- **Prérequis :** `master`, 126/126 tests verts au 2026-07-17

## 1. Contexte / objectif

Vision long terme du owner : un agent coach carrière qui suit son évolution dans le temps, pas juste un conseiller stateless. Aujourd'hui, `docs/career_insights.md` est écrasé à chaque exécution de `bun run advise` et git-ignoré : aucun historique n'existe nulle part. V1 ajoute un historique structuré append-only, sans changer le rôle du rapport actuel (qui reste la vue matérialisée jetable de l'état présent).

## 2. Architecture

- **Un seul appel LLM** (pas de second appel pour extraire du structuré depuis du texte libre) : `client.messages.parse()` + `output_config.format` (schéma Zod, Structured Outputs) + `tools: [{ type: "web_search_20260209", name: "web_search" }]`.
- Correction au passage : le code actuel utilise `web_search_20250305`, une version dépassée. `web_search_20260209` (filtrage dynamique) est la version courante pour `claude-opus-4-8`.
- Structured Outputs contraint uniquement le **texte final** ; `web_search` reste librement invocable par le modèle pendant la génération (pas de `tool_choice` forcé sur un tool personnalisé, donc pas de conflit d'ordonnancement entre "chercher d'abord" et "répondre en JSON").
- Schéma Zod :
  ```ts
  const AdvisorReportSchema = z.object({
    report_markdown: z.string(),        // les 7 sections actuelles, inchangées
    telemetry: z.object({
      top_lanes: z.array(z.string()).max(3),
      top_skill_gap: z.string(),
      market_shift_summary: z.string(), // 1-2 phrases : ce qui change vs les runs précédents
    }),
  });
  ```

## 3. Fichiers

- `docs/career_insights.md` : inchangé dans son rôle (écrasé à chaque run, git-ignoré). Contenu = `report_markdown`.
- `docs/career_telemetry.jsonl` (**nouveau**, git-ignoré — même raison que `career_insights.md` : `my-curriculum` est un repo public, l'historique de stratégie carrière ne doit pas y être visible) : une ligne JSON append-only par exécution de `bun run advise`, écrite via `appendFileSync` (même pattern que `harness/packages/guardrails/src/audit.ts`).
  - Champ `upskilling` : delta **déterministe**, aucun appel LLM.
  - Champ `market` : directement le `telemetry` structuré retourné par l'appel LLM (pas de reformulation).
  - Champ `timestamp` : ISO 8601, horodatage de l'exécution.
- **Nouveau fichier** `scripts/career-telemetry.core.ts` (pur, testable, même famille que `admin-dashboard.core.ts`) :
  - importe `parseUpskillingSections` depuis `./admin-dashboard.core` (pas de duplication de logique de parsing).
  - `diffUpskilling(previous: UpskillingSection[] | null, current: UpskillingSection[]): UpskillingDelta` : calcule coché/total par projet + items nouvellement cochés depuis `previous` (ou tout considéré "nouveau" si `previous` est `null`, premier run).
  - `readLastTelemetryLine(jsonlText: string): TelemetryLine | null` : parse la dernière ligne du JSONL existant (ou `null` si fichier absent/vide) pour fournir le `previous` ci-dessus.
  - `appendTelemetryLine(...)` : construit la ligne `{timestamp, upskilling, market}` à écrire.
- `scripts/career-advisor.ts` (CLI) : lit `docs/career_telemetry.jsonl` s'il existe, calcule le delta via `career-telemetry.core.ts`, écrit `career_insights.md` (inchangé) ET append une ligne à `career_telemetry.jsonl`.

## 4. Limitations connues / risques

- **V1 local uniquement** : le JSONL est git-ignoré, donc perdu si la machine change sans backup manuel. Compromis déjà assumé pour `docs/admin_dashboard.md` — cohérent, pas une régression.
- **Combinaison `output_config.format` + `tools` (web_search) non explicitement documentée comme compatible** dans la doc SDK consultée (liste "incompatible avec" mentionne Citations et prefill, pas les tools — donc probablement compatible, mais pas garanti). À valider par un run réel (spike) avant de considérer le design figé.

## 5. Tests

- Schéma Zod : validé par assignment de type (même pattern que `LocalizeDeep`, `packages/schema/src/localized.test.ts`) plutôt qu'un test runtime, puisqu'il s'agit de structure de type.
- Fonction de diff UPSKILLING (déterministe, pure) : testée unitairement avec fixtures, même pattern que `admin-dashboard.core.test.ts`.
- Le run réel avec appel API (le spike de la section 4) n'est pas testable en CI (appel réseau payant, non déterministe) : validation manuelle, documentée dans le ledger de progress (`.superpowers/sdd/progress.md`) une fois faite.

## 6. Hors scope V1

- Pas de graphique/visualisation de la progression à partir du JSONL (piste future mentionnée par le owner, pas demandée maintenant — YAGNI).
- Pas de déclenchement automatique/planifié : reste `bun run advise` manuel, cohérent avec la décision V1 déjà prise pour `admin-dashboard.ts`.
