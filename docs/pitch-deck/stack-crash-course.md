# Master Stack : Crash Course & Interview Prep

> Bible de révision : décortique les choix architecturaux du Profile Engine et des
> projets liés (SEOMNIX, Harness) sous le prisme d'un entretien de niveau
> Staff Engineer / Anthropic. Phase 2 du Profile Engine (déclenchée après
> mise en ligne de fdiene.com, voir spec §11 P2-1).

---

## 1. Model Context Protocol (MCP)

**🎯 L'Elevator Pitch** : MCP est le protocole standardisé (façon USB-C) qui permet aux modèles d'IA d'interagir de manière sécurisée et déterministe avec des sources de données locales ou des outils externes, sans avoir à coder des intégrations sur mesure pour chaque LLM.

**🧠 Pourquoi ce choix ? (Le Trade-off)** : Avant MCP, intégrer un LLM à une base de données ou à un outil CLI (comme ops-tools) nécessitait des scripts ad-hoc fragiles. MCP découple le modèle de l'outil. C'est un choix d'architecture « Future-Proof » : si on remplace Claude par un autre modèle demain, les serveurs MCP (comme le projet Harness) continuent de fonctionner sans modifier le code métier.

**⚠️ Les Subtilités « Senior »** : La sécurité. Un serveur MCP a potentiellement accès au système de fichiers ou à des bases de données de production. Un ingénieur senior sait qu'il ne faut jamais exposer un serveur MCP sans Guardrails (comme dans Harness : budget de tokens, demande de confirmation explicite avant action destructive).

**🎤 Préparation Entretien** :
- **Question piège** : « Comment garantissez-vous qu'un agent utilisant MCP ne supprime pas accidentellement une base de données de production en cas d'hallucination ? »
- **La réponse attendue** : Ne pas parler de « meilleur prompt ». La vraie réponse est systémique (Human-in-the-loop / RBAC). « Dans l'architecture Harness, le serveur MCP applique un principe de moindre privilège. Toute requête classifiée comme "mutative" ou "destructive" par le serveur déclenche un hook de validation (Human-in-the-loop) qui requiert une confirmation explicite via l'UI avant l'exécution du code. »

---

## 2. LLM-as-a-Judge & Evals (SEOMNIX)

**🎯 L'Elevator Pitch** : Une boucle de rétroaction déterministe où un modèle d'IA (souvent rapide et peu coûteux comme Haiku) évalue la sortie d'un autre processus IA en utilisant une grille de critères stricts et une sortie structurée (JSON/Pydantic) avant toute mise en production.

**🧠 Pourquoi ce choix ? (Le Trade-off)** : L'IA générative est probabiliste par nature. Pour l'utiliser dans un environnement industriel (aérospatial, content factory), on doit la contraindre. Les Evals transforment un processus probabiliste en un pipeline « Safety-Critical » : on préfère bloquer un bon contenu (faux négatif) plutôt que de publier une hallucination (faux positif).

**⚠️ Les Subtilités « Senior »** : Un juge IA n'est bon que s'il est « groundé » (ancré dans la réalité). Demander à un LLM « ce texte est-il vrai ? » est inutile. Un senior implémente du Reference-based Evaluation : on fournit au juge le texte généré ET les sources brutes (via Perplexity ou un RAG), et on lui demande : « ce texte contient-il des informations absentes des sources fournies ? ».

**🎤 Préparation Entretien** :
- **Question piège** : « Comment testez-vous la fiabilité de votre propre LLM-as-a-judge dans SEOMNIX ? »
- **La réponse attendue** : « On évalue l'évaluateur via un Golden Dataset. Je maintiens un jeu de données de 100 exemples (50 articles parfaits, 50 contenant des hallucinations subtiles injectées manuellement). En CI/CD, je fais tourner le juge sur ce dataset. Si sa précision de détection (Recall/F1-Score) chute sous les 98 %, le build CI échoue. Je trace ensuite ces métriques dans Directus. »

---

## 3. ElysiaJS + Eden + Zod (Profile Engine)

**🎯 L'Elevator Pitch** : Un framework backend sur Bun qui combine une validation d'entrée impénétrable (Zod) avec une inférence de type automatique de bout en bout (Eden), permettant au frontend d'utiliser l'API comme une simple fonction TypeScript locale.

**🧠 Pourquoi ce choix ? (Le Trade-off)** : Pour la vélocité et la Developer Experience (DX). GraphQL nécessite des schémas lourds, OpenAPI nécessite de la génération de code (codegen) souvent asynchrone. Elysia+Eden offre le beurre et l'argent du beurre : la sécurité d'une validation stricte au runtime (Zod), et une autocomplétion parfaite côté frontend (Astro/Vue) sans étape de build supplémentaire, car les types TS sont partagés via le monorepo.

**⚠️ Les Subtilités « Senior »** : La gestion des erreurs. Puisque Eden masque la requête HTTP, les juniors oublient de gérer les timeouts ou les erreurs réseau. Un senior met en place un fallback déterministe (comme le « System Degraded : Serving Static Fallback » dans `@profile/core`) pour garantir que l'UI ne crashe jamais si l'API est injoignable.

**🎤 Préparation Entretien** :
- **Question piège** : « Puisque Zod vérifie déjà les types au runtime sur votre serveur Elysia, pourquoi s'embêter avec TypeScript (Eden) sur le frontend ? Ne fait-on pas le travail deux fois ? »
- **La réponse attendue** : « Zod protège le serveur contre les données malveillantes au runtime (Security & Validation). Eden protège le développeur contre les fautes de frappe pendant qu'il code (DX & Compile-time). Les deux sont complémentaires. L'objectif de la DX est le "Shift-Left" : découvrir l'erreur d'API dans mon IDE (grâce à Eden) plutôt que dans mes logs serveur en production (grâce à Zod). »

---

## 4. Bun & Turborepo

**🎯 L'Elevator Pitch** : Une stack de tooling moderne qui fusionne le runtime, le package manager, le bundler et le test runner (Bun), orchestrée par un système de cache de build ultra-rapide pour monorepos (Turborepo).

**🧠 Pourquoi ce choix ? (Le Trade-off)** : Dans un écosystème complexe (API, Web, Scripts locaux, Schémas partagés), Node.js classique devient lent et fragmente l'outillage (npm + jest + tsc + esbuild). Bun unifie la toolchain. Turborepo intervient au-dessus pour ne rebuilder que les packages (ex : `@profile/schema`) qui ont réellement changé, économisant des minutes précieuses en CI/CD.

**⚠️ Les Subtilités « Senior »** : La gestion des dépendances en monorepo. Un junior installe les dépendances n'importe où. Un senior utilise le hoisting avec précision, définit des limites strictes de dépendances (ex : le front ne doit jamais importer le backend, seulement les types ou le `@profile/schema`), et s'assure que le cache Turborepo n'est pas « empoisonné » par des variables d'environnement fluctuantes.

**🎤 Préparation Entretien** :
- **Question System Design** : « Dans votre monorepo, vous modifiez l'enum `TargetRole` dans `@profile/schema`. Décrivez l'ordre exact de ce qui se passe dans votre pipeline CI/CD jusqu'à la production. »
- **La réponse attendue** : « 1. Turborepo détecte le changement dans `schema` grâce au hash des fichiers. 2. Il invalide le cache de `schema`, mais aussi de TOUS les projets qui en dépendent (`api`, `web`, `scripts`). 3. Il lance `bun test` et le typecheck en parallèle sur ces dépendances. 4. Si c'est vert, le pipeline CI déclenche le build de l'image Docker de l'API et la compilation statique d'Astro. 5. L'API est redéployée derrière Traefik avec zéro downtime, et les assets Astro sont poussés sur le CDN. »

---

## 🏗️ La Question Architecture « Boss Final » (Staff Level)

**Question de l'interviewer (Anthropic)** : « Imaginez que votre projet SEOMNIX (qui génère du contenu critique) soit victime d'une attaque de type "Prompt Injection" et commence à générer du contenu malveillant. Comment votre architecture globale (de Traefik jusqu'à LangGraph et au Juge) prévient-elle, détecte-t-elle, et mitige-t-elle ce risque, de manière automatisée ? »

**Éléments de réponse (structure Senior)** :

1. **Prévention (Ingress / Traefik)** : « Au niveau Edge, on peut configurer Traefik ou un WAF pour filtrer les payloads HTTP suspects avec des patterns de prompt injection connus avant même de toucher l'API. »
2. **Filtrage (Elysia / Zod)** : « L'API Elysia utilise Zod pour valider strictement la forme des données entrantes. On n'accepte aucun champ non prévu. Si l'input contient des directives d'outrepassage ("ignore previous instructions"), un premier LLM de tri (pas très cher) peut faire office de firewall sémantique. »
3. **Isolement (LangGraph / MCP)** : « Dans LangGraph, l'agent qui navigue sur le web ou exécute du code via MCP est isolé de l'agent qui génère le texte final. Le modèle qui rédige n'a pas les droits MCP d'exécution. »
4. **Le Juge Final (Mitigation)** : « C'est la garantie ultime. Le nœud `eval_node` (Claude Haiku) inspecte la sortie finale avec une grille d'évaluation stricte incluant un critère `is_safe`. Si le contenu est flaggé, il est routé vers la file "Reject", l'action de publication n'est pas appelée, et un log de sécurité critique est envoyé. »

---

## À compléter (prochaine passe)

Le spec Phase 2 prévoit aussi, pour chaque techno : 🔗 Synergie avec le reste de l'architecture, et 📚 Ressources « Gold » (2 liens doc officielle + certifications). Non couverts par ce premier jet : à ajouter dans une prochaine itération si utile pour la préparation.
