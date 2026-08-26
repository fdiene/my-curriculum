# RAG "/ask" Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `POST /ask` endpoint to the live API that answers natural-language questions about Fadel Diène's professional background using real retrieval-augmented generation (local embeddings + cosine similarity over an offline-indexed corpus + a scoped Claude Haiku call), with layered cost/abuse protection, plus a small UI panel on the terminal page to use it.

**Architecture:** An offline script embeds resume/project content into a committed `data/rag_index.json` using a locally-run embedding model (no hosted embeddings API). At request time, the API embeds the incoming question with the same model, does an in-memory cosine-similarity search, and only calls Claude if a free relevance pre-filter and two rate limiters (per-IP, global daily cap) all pass.

**Tech Stack:** `@huggingface/transformers` (v4.2.0) + `onnxruntime-node` for local embeddings (`Xenova/all-MiniLM-L6-v2`, quantized), `@anthropic-ai/sdk` for the generation call, existing Bun/Elysia/Vue stack. No hosted embeddings vendor.

**Spec:** `docs/superpowers/specs/2026-08-25-rag-ask-endpoint-design.md`

## Global Constraints

- Never use the em dash character "—" in any code, comment, or generated content - use ":" or "-" instead.
- The indexing script reads `data/master_data.i18n.json` and nothing else. Never read `docs/applications/`, `docs/career_insights.md`, or `docs/career_telemetry.jsonl` - those are private, git-ignored job-application material and must never be indexed into a public endpoint.
- Embedding model: `Xenova/all-MiniLM-L6-v2`, loaded via `@huggingface/transformers`'s `feature-extraction` pipeline with `{ dtype: "q8" }` (the quantized, 22MB variant, not the 87MB fp32 default), called with `{ pooling: "mean", normalize: true }`. `onnxruntime-node` must be installed as an explicit direct dependency alongside `@huggingface/transformers` in every workspace that uses it - it is not auto-installed, and omitting it fails with `ENOENT while resolving package 'onnxruntime-common'`.
- Generation model: `claude-haiku-4-5`.
- Relevance threshold: `0.15` (cosine similarity). Empirically calibrated against this exact model and real chunk text: relevant questions scored 0.30-0.54, off-topic questions scored -0.04 to 0.04 - 0.15 sits with wide margin in the gap between those two clusters.
- Per-IP rate limit: 10 requests per rolling hour, keyed by the `x-forwarded-for` header (Traefik sits in front of the API in production).
- Global daily cap: 200 successful Claude calls per rolling 24 hours, incremented only after a successful Claude call (not on every request).
- Question length bounds: reject (400) if under 3 characters or over 500 characters after trimming.
- Never fabricate content: the endpoint only ever surfaces what's already true and public elsewhere on the site.

---

### Task 1: Core RAG logic (`packages/core`)

**Files:**
- Create: `packages/core/src/rag.ts`
- Create: `packages/core/src/rag.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `type { Resume }` from `@profile/schema`.
- Produces: `RagChunk`, `EmbeddedChunk`, `ScoredChunk` types; `buildRagChunks(data: Resume): RagChunk[]`; `cosineSimilarity(a: number[], b: number[]): number`; `topKRelevant(queryEmbedding: number[], corpus: EmbeddedChunk[], k: number): ScoredChunk[]`; `RAG_RELEVANCE_THRESHOLD` constant; `isRelevant(topScore: number): boolean` - all re-exported from `@profile/core` for Task 2 and Task 5 to import.

- [ ] **Step 1: Write the failing tests**

Create `packages/core/src/rag.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import type { Resume } from "@profile/schema";
import { buildRagChunks, cosineSimilarity, topKRelevant, isRelevant, RAG_RELEVANCE_THRESHOLD, type EmbeddedChunk } from "./rag";

const L = { en: "x", fr: "x", de: "x" };

function makeResume(overrides: Partial<Resume> = {}): Resume {
  return {
    person: { name: "Test", title: L, location: "Toulouse", links: {} },
    executiveSummaries: { ai_dx: L, iot: L, plm_architect: L, default: L },
    experiences: [
      {
        id: "e1", role: { en: "Architect", fr: "x", de: "x" }, org: "Acme",
        location: "L", period: { start: "2020-01", end: null },
        summary: { en: "Owned the platform.", fr: "x", de: "x" },
        highlights: [{ en: "Shipped the thing.", fr: "x", de: "x" }],
        tags: [], domain: "d",
      },
    ],
    projects: [
      {
        id: "p1", name: "Widget", tagline: { en: "A tagline.", fr: "x", de: "x" },
        description: { en: "A description.", fr: "x", de: "x" },
        stack: ["TypeScript"], tags: [], links: {}, status: "live", featured_for: [],
      },
      {
        id: "p2", name: "NoDetails", tagline: { en: "Short.", fr: "x", de: "x" },
        description: { en: "Also short.", fr: "x", de: "x" },
        stack: [], tags: [], links: {}, status: "concept", featured_for: [],
      },
    ],
    certifications: [], education: [], recommendations: [],
    ...overrides,
  } as Resume;
}

describe("buildRagChunks", () => {
  it("builds one chunk per experience with role, org, summary, and highlights joined", () => {
    const chunks = buildRagChunks(makeResume());
    const expChunk = chunks.find((c) => c.sourceType === "experience");
    expect(expChunk).toBeDefined();
    expect(expChunk!.id).toBe("experience:e1");
    expect(expChunk!.sourceId).toBe("e1");
    expect(expChunk!.text).toContain("Architect");
    expect(expChunk!.text).toContain("Acme");
    expect(expChunk!.text).toContain("Owned the platform.");
    expect(expChunk!.text).toContain("Shipped the thing.");
  });

  it("builds one chunk per project, omitting details when absent", () => {
    const chunks = buildRagChunks(makeResume());
    const projectChunks = chunks.filter((c) => c.sourceType === "project");
    expect(projectChunks.length).toBe(2);
    const p1 = projectChunks.find((c) => c.sourceId === "p1")!;
    expect(p1.text).toContain("Widget");
    expect(p1.text).toContain("A tagline.");
    expect(p1.text).toContain("A description.");
  });

  it("includes the details field when present", () => {
    const withDetails = makeResume({
      projects: [
        {
          id: "p1", name: "Widget", tagline: { en: "A tagline.", fr: "x", de: "x" },
          description: { en: "A description.", fr: "x", de: "x" },
          details: { en: "Long detailed writeup.", fr: "x", de: "x" },
          stack: [], tags: [], links: {}, status: "live", featured_for: [],
        },
      ],
    });
    const chunks = buildRagChunks(withDetails);
    expect(chunks[0]!.text).toContain("Long detailed writeup.");
  });
});

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1, 5);
  });
  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });
  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 5);
  });
});

describe("topKRelevant", () => {
  const corpus: EmbeddedChunk[] = [
    { id: "a", sourceType: "experience", sourceId: "a", text: "a", embedding: [1, 0, 0] },
    { id: "b", sourceType: "experience", sourceId: "b", text: "b", embedding: [0, 1, 0] },
    { id: "c", sourceType: "experience", sourceId: "c", text: "c", embedding: [0.9, 0.1, 0] },
  ];

  it("returns the top K chunks sorted by descending similarity score", () => {
    const results = topKRelevant([1, 0, 0], corpus, 2);
    expect(results.length).toBe(2);
    expect(results[0]!.id).toBe("a");
    expect(results[1]!.id).toBe("c");
    expect(results[0]!.score).toBeGreaterThan(results[1]!.score);
  });
});

describe("isRelevant", () => {
  it("matches the calibrated threshold", () => {
    expect(RAG_RELEVANCE_THRESHOLD).toBe(0.15);
  });
  it("treats scores at or above the threshold as relevant", () => {
    expect(isRelevant(0.15)).toBe(true);
    expect(isRelevant(0.3)).toBe(true);
  });
  it("treats scores below the threshold as not relevant", () => {
    expect(isRelevant(0.14)).toBe(false);
    expect(isRelevant(0)).toBe(false);
    expect(isRelevant(-0.04)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun test packages/core/src/rag.test.ts`
Expected: FAIL - `Cannot find module './rag'` (file doesn't exist yet).

- [ ] **Step 3: Implement `rag.ts`**

Create `packages/core/src/rag.ts`:

```ts
import type { Resume } from "@profile/schema";

export interface RagChunk {
  id: string;
  sourceType: "experience" | "project";
  sourceId: string;
  text: string;
}

export interface EmbeddedChunk extends RagChunk {
  embedding: number[];
}

export interface ScoredChunk extends EmbeddedChunk {
  score: number;
}

export function buildRagChunks(data: Resume): RagChunk[] {
  const experienceChunks: RagChunk[] = data.experiences.map((e) => ({
    id: `experience:${e.id}`,
    sourceType: "experience",
    sourceId: e.id,
    text: [e.role.en, e.org, e.summary.en, ...e.highlights.map((h) => h.en)].join(". "),
  }));
  const projectChunks: RagChunk[] = data.projects.map((p) => ({
    id: `project:${p.id}`,
    sourceType: "project",
    sourceId: p.id,
    text: [p.name, p.tagline.en, p.description.en, p.details?.en]
      .filter((s): s is string => Boolean(s))
      .join(". "),
  }));
  return [...experienceChunks, ...projectChunks];
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function topKRelevant(queryEmbedding: number[], corpus: EmbeddedChunk[], k: number): ScoredChunk[] {
  return corpus
    .map((c) => ({ ...c, score: cosineSimilarity(queryEmbedding, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

// Calibrated empirically against Xenova/all-MiniLM-L6-v2: real relevant questions scored
// 0.30-0.54 against real chunk text, real off-topic questions scored -0.04 to 0.04.
// 0.15 sits with wide margin in the gap between those two clusters.
export const RAG_RELEVANCE_THRESHOLD = 0.15;

export function isRelevant(topScore: number): boolean {
  return topScore >= RAG_RELEVANCE_THRESHOLD;
}
```

- [ ] **Step 4: Export from the package barrel**

In `packages/core/src/index.ts`, add:

```ts
export * from "./rag";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun test packages/core/src/rag.test.ts`
Expected: PASS, 10/10.

- [ ] **Step 6: Typecheck**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun run typecheck`
Expected: 0 errors across all workspaces.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/rag.ts packages/core/src/rag.test.ts packages/core/src/index.ts
git commit -m "feat(core): add RAG chunk building, cosine similarity, and relevance threshold"
```

---

### Task 2: Offline indexing script (`scripts`)

**Files:**
- Create: `scripts/generate-rag-index.ts`
- Modify: `scripts/package.json`

**Interfaces:**
- Consumes: `buildRagChunks`, `type EmbeddedChunk` from `@profile/core` (Task 1); `ResumeSchema`, `type Resume` from `@profile/schema`.
- Produces: `data/rag_index.json`, an `EmbeddedChunk[]` array consumed by Task 5's runtime loader.

- [ ] **Step 1: Add dependencies**

In `scripts/package.json`, add to `"dependencies"`:

```json
"@huggingface/transformers": "^4.2.0",
"onnxruntime-node": "^1.29.0"
```

Also add `"@profile/core": "workspace:*"` if not already present (check the file first - `scripts/package.json` currently depends on `@profile/schema` but not `@profile/core`).

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun install`
Expected: installs cleanly, `bun.lock` updated.

- [ ] **Step 2: Create the script**

Create `scripts/generate-rag-index.ts`:

```ts
import { pipeline } from "@huggingface/transformers";
import { ResumeSchema, type Resume } from "@profile/schema";
import { buildRagChunks, type EmbeddedChunk } from "@profile/core";

if (import.meta.main) {
  const raw = await Bun.file("data/master_data.i18n.json").json();
  const data: Resume = ResumeSchema.parse(raw);
  const chunks = buildRagChunks(data);

  console.log(`Embedding ${chunks.length} chunks with Xenova/all-MiniLM-L6-v2 (quantized)...`);
  const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "q8" });

  const embedded: EmbeddedChunk[] = [];
  for (const chunk of chunks) {
    const out = await extractor(chunk.text, { pooling: "mean", normalize: true });
    embedded.push({ ...chunk, embedding: Array.from(out.data as Float32Array) });
  }

  await Bun.write("data/rag_index.json", JSON.stringify(embedded, null, 2));
  console.log(`Wrote data/rag_index.json with ${embedded.length} chunks.`);
}
```

- [ ] **Step 3: Run it for real and inspect the output**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun scripts/generate-rag-index.ts`
Expected: completes without error, prints the chunk count, creates `data/rag_index.json`.

Then verify the file's shape:

Run: `node -e "const d = require('./data/rag_index.json'); console.log('chunks:', d.length); console.log('first embedding length:', d[0].embedding.length); console.log('sample ids:', d.slice(0,3).map(c => c.id));"`
Expected: `embedding length` is 384 (the model's real output dimension, confirmed during design spike), `chunks` count roughly matches the number of experiences plus projects in `data/master_data.i18n.json` (5 experiences + 7 projects = 12 as of this plan's writing - re-verify against the actual current file, since it may have grown).

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-rag-index.ts scripts/package.json bun.lock data/rag_index.json
git commit -m "feat(scripts): add offline RAG index generation script"
```

---

### Task 3: Rate limiter (`apps/api`)

**Files:**
- Create: `apps/api/src/rateLimiter.ts`
- Create: `apps/api/src/rateLimiter.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `RateLimiterState`, `createRateLimiterState(): RateLimiterState`, `checkAndRecordPerIp(state, ip, now?): boolean`, `checkGlobalDailyLimit(state, now?): boolean`, `recordGlobalDailyUsage(state, now?): void` - consumed by Task 5.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/rateLimiter.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { createRateLimiterState, checkAndRecordPerIp, checkGlobalDailyLimit, recordGlobalDailyUsage } from "./rateLimiter";

describe("checkAndRecordPerIp", () => {
  it("allows up to 10 requests per IP within an hour, then blocks", () => {
    const state = createRateLimiterState();
    const now = new Date("2026-01-01T12:00:00.000Z");
    for (let i = 0; i < 10; i++) {
      expect(checkAndRecordPerIp(state, "1.2.3.4", now)).toBe(true);
    }
    expect(checkAndRecordPerIp(state, "1.2.3.4", now)).toBe(false);
  });

  it("tracks different IPs independently", () => {
    const state = createRateLimiterState();
    const now = new Date("2026-01-01T12:00:00.000Z");
    for (let i = 0; i < 10; i++) checkAndRecordPerIp(state, "1.2.3.4", now);
    expect(checkAndRecordPerIp(state, "5.6.7.8", now)).toBe(true);
  });

  it("allows requests again after the 1-hour window has passed", () => {
    const state = createRateLimiterState();
    const t0 = new Date("2026-01-01T12:00:00.000Z");
    for (let i = 0; i < 10; i++) checkAndRecordPerIp(state, "1.2.3.4", t0);
    expect(checkAndRecordPerIp(state, "1.2.3.4", t0)).toBe(false);
    const tLater = new Date(t0.getTime() + 61 * 60 * 1000);
    expect(checkAndRecordPerIp(state, "1.2.3.4", tLater)).toBe(true);
  });
});

describe("checkGlobalDailyLimit and recordGlobalDailyUsage", () => {
  it("allows up to 200 calls per day, then blocks", () => {
    const state = createRateLimiterState();
    const now = new Date("2026-01-01T12:00:00.000Z");
    for (let i = 0; i < 200; i++) {
      expect(checkGlobalDailyLimit(state, now)).toBe(true);
      recordGlobalDailyUsage(state, now);
    }
    expect(checkGlobalDailyLimit(state, now)).toBe(false);
  });

  it("does not increment on check alone, only on recordGlobalDailyUsage", () => {
    const state = createRateLimiterState();
    const now = new Date("2026-01-01T12:00:00.000Z");
    checkGlobalDailyLimit(state, now);
    checkGlobalDailyLimit(state, now);
    checkGlobalDailyLimit(state, now);
    expect(state.globalDaily.count).toBe(0);
  });

  it("resets the count on a new day", () => {
    const state = createRateLimiterState();
    const day1 = new Date("2026-01-01T23:59:00.000Z");
    for (let i = 0; i < 200; i++) recordGlobalDailyUsage(state, day1);
    expect(checkGlobalDailyLimit(state, day1)).toBe(false);
    const day2 = new Date("2026-01-02T00:01:00.000Z");
    expect(checkGlobalDailyLimit(state, day2)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun test apps/api/src/rateLimiter.test.ts`
Expected: FAIL - `Cannot find module './rateLimiter'`.

- [ ] **Step 3: Implement `rateLimiter.ts`**

Create `apps/api/src/rateLimiter.ts`:

```ts
export interface RateLimiterState {
  perIp: Map<string, number[]>;
  globalDaily: { day: string; count: number };
}

export function createRateLimiterState(): RateLimiterState {
  return { perIp: new Map(), globalDaily: { day: "", count: 0 } };
}

const PER_IP_LIMIT = 10;
const PER_IP_WINDOW_MS = 60 * 60 * 1000;
const GLOBAL_DAILY_LIMIT = 200;

export function checkAndRecordPerIp(state: RateLimiterState, ip: string, now: Date = new Date()): boolean {
  const cutoff = now.getTime() - PER_IP_WINDOW_MS;
  const timestamps = (state.perIp.get(ip) ?? []).filter((t) => t > cutoff);
  if (timestamps.length >= PER_IP_LIMIT) {
    state.perIp.set(ip, timestamps);
    return false;
  }
  timestamps.push(now.getTime());
  state.perIp.set(ip, timestamps);
  return true;
}

function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function checkGlobalDailyLimit(state: RateLimiterState, now: Date = new Date()): boolean {
  const key = dayKey(now);
  if (state.globalDaily.day !== key) return true;
  return state.globalDaily.count < GLOBAL_DAILY_LIMIT;
}

export function recordGlobalDailyUsage(state: RateLimiterState, now: Date = new Date()): void {
  const key = dayKey(now);
  if (state.globalDaily.day !== key) {
    state.globalDaily.day = key;
    state.globalDaily.count = 0;
  }
  state.globalDaily.count += 1;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun test apps/api/src/rateLimiter.test.ts`
Expected: PASS, 5/5.

- [ ] **Step 5: Typecheck**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun run typecheck`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/rateLimiter.ts apps/api/src/rateLimiter.test.ts
git commit -m "feat(api): add per-IP and global-daily rate limiter for /ask"
```

---

### Task 4: Embeddings and answer generation wrappers (`apps/api`)

**Files:**
- Create: `apps/api/src/embeddings.ts`
- Create: `apps/api/src/generateRagAnswer.ts`
- Create: `apps/api/src/ragIndex.ts`
- Modify: `apps/api/package.json`
- Modify: `apps/api/Dockerfile`
- Modify: `infra/docker-compose.yml`

**Interfaces:**
- Consumes: `type { EmbeddedChunk, ScoredChunk }` from `@profile/core` (Task 1); `data/rag_index.json` (Task 2's output).
- Produces: `embedText(text: string): Promise<number[]>`; `generateRagAnswer(question: string, chunks: ScoredChunk[], apiKey: string): Promise<string>`; `RAG_INDEX: EmbeddedChunk[]`, `loadRagIndex(path?: string): EmbeddedChunk[]` - all consumed by Task 5.

This task has no dedicated test file for the three new source files (matches the existing convention - `career-advisor.ts`'s Anthropic/model-invocation code is untested wiring; `apps/api/src/data.ts`'s `loadResume` follows the same `REPO_ROOT`-relative-`readFileSync` pattern used here for `loadRagIndex` and is likewise untested directly, verified instead through the routes that consume it in `app.test.ts`). Verification for this task is: it compiles, and a manual smoke run confirms the model loads and produces a real embedding.

- [ ] **Step 1: Add dependencies**

In `apps/api/package.json`, add to `"dependencies"`:

```json
"@huggingface/transformers": "^4.2.0",
"onnxruntime-node": "^1.29.0",
"@anthropic-ai/sdk": "^0.112.3"
```

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun install`

- [ ] **Step 2: Create the embeddings wrapper**

Create `apps/api/src/embeddings.ts`:

```ts
import { pipeline } from "@huggingface/transformers";

let extractorPromise: ReturnType<typeof pipeline> | null = null;

function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "q8" });
  }
  return extractorPromise;
}

export async function embedText(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const out = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(out.data as Float32Array);
}

// Call once at server startup (see app.ts) so the first real visitor request
// does not pay for model load time - it should already be resident in memory.
export function warmEmbeddingModel(): Promise<void> {
  return embedText("warmup").then(() => undefined);
}
```

- [ ] **Step 3: Create the answer-generation wrapper**

Create `apps/api/src/generateRagAnswer.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";
import type { ScoredChunk } from "@profile/core";

const SYSTEM_PROMPT = "You answer questions about Fadel Diene's professional background using ONLY the context provided below. If the question is unrelated to Fadel's professional background, or the context does not support an answer, say clearly that you can only answer questions about Fadel's professional background and decline to speculate. Never invent information that is not present in the context. Keep answers to 2-4 sentences.";

export async function generateRagAnswer(question: string, chunks: ScoredChunk[], apiKey: string): Promise<string> {
  const client = new Anthropic({ apiKey });
  const context = chunks.map((c) => `[${c.id}] ${c.text}`).join("\n\n");
  const message = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Context:\n${context}\n\nQuestion: ${question}` }],
  });
  const textBlock = message.content.find((b) => b.type === "text");
  return textBlock ? textBlock.text : "I could not generate an answer.";
}
```

- [ ] **Step 4: Create the RAG index loader**

Create `apps/api/src/ragIndex.ts`, following the exact pattern of `apps/api/src/data.ts`'s `loadResume`:

```ts
import { isAbsolute, join } from "node:path";
import { readFileSync } from "node:fs";
import type { EmbeddedChunk } from "@profile/core";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");

export function loadRagIndex(path = "data/rag_index.json"): EmbeddedChunk[] {
  const file = isAbsolute(path) ? path : join(REPO_ROOT, path);
  return JSON.parse(readFileSync(file, "utf8")) as EmbeddedChunk[];
}

export const RAG_INDEX: EmbeddedChunk[] = loadRagIndex();
```

- [ ] **Step 5: Manual smoke verification**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun -e "import('./apps/api/src/embeddings.ts').then(async (m) => { const v = await m.embedText('test'); console.log('embedding length:', v.length); })"`
Expected: prints `embedding length: 384`.

- [ ] **Step 6: Pre-warm the model in the Docker build**

In `apps/api/Dockerfile`, after the existing `RUN bun install --frozen-lockfile` step and after `COPY apps/api apps/api` (so `embeddings.ts` exists in the image at this point), add a build step that runs the extractor once so the model file is downloaded and baked into this image layer rather than fetched by the first live request:

```dockerfile
RUN bun -e "import('./apps/api/src/embeddings.ts').then((m) => m.warmEmbeddingModel())"
```

Read the current `apps/api/Dockerfile` first to place this line correctly relative to the existing `COPY`/`ENV`/`CMD` instructions - it must come after the app source is copied in and before the final `CMD`.

- [ ] **Step 7: Add the API key to the production environment**

In `infra/docker-compose.yml`, add to the `profile-api` service's `environment:` list:

```yaml
- ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
```

This follows the existing pattern for `GITHUB_REPO`/`GITHUB_TOKEN` (referencing a host-side environment variable, never a literal secret value in the committed file). Note in the commit message that the VPS's actual environment (wherever `docker compose` is invoked from, e.g. a `.env` file alongside `infra/docker-compose.yml` on the server, not in this repo) must have `ANTHROPIC_API_KEY` set before the next deploy, or `/ask` will fail at runtime with a `server_misconfigured` response (Task 5 handles that failure mode gracefully, but the key still needs to actually be present for the feature to work).

**Also required (manual, on the Anthropic console, not code):** set a spending/usage limit on whichever API key is deployed for this endpoint, per the spec's Layer 4 cost-control requirement. The rate limiter (Task 3) and relevance filter (Task 5) are the application-level protections; the account-level cap is the backstop that holds even if there's a bug in either of those. This is a deployment prerequisite for this feature, not optional follow-up - do not consider this task done until it's set, and say so explicitly when reporting this task's completion.

- [ ] **Step 8: Typecheck**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun run typecheck`
Expected: 0 errors.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/embeddings.ts apps/api/src/generateRagAnswer.ts apps/api/src/ragIndex.ts apps/api/package.json apps/api/Dockerfile infra/docker-compose.yml bun.lock
git commit -m "feat(api): add local embeddings, Claude answer generation, and RAG index loader"
```

---

### Task 5: `/ask` route wiring and tests (`apps/api`)

**Files:**
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/app.test.ts`

**Interfaces:**
- Consumes: `topKRelevant`, `isRelevant` from `@profile/core` (Task 1); `embedText`, `warmEmbeddingModel` from `./embeddings` (Task 4); `generateRagAnswer` from `./generateRagAnswer` (Task 4); `RAG_INDEX` from `./ragIndex` (Task 4); `createRateLimiterState`, `checkAndRecordPerIp`, `checkGlobalDailyLimit`, `recordGlobalDailyUsage` from `./rateLimiter` (Task 3).
- Produces: `POST /ask` route, consumed by Task 6's frontend via the typed Eden client (`api.ask.post({ question })`).

- [ ] **Step 1: Write the failing tests**

Read `apps/api/src/app.test.ts` first to match its exact `get()`-helper and `describe`/`it` style before adding to it. Append a new `describe` block:

```ts
describe("POST /ask", () => {
  async function ask(question: string, headers?: Record<string, string>) {
    const res = await app.handle(
      new Request("http://localhost/ask", {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify({ question }),
      }),
    );
    return { status: res.status, body: await res.json() };
  }

  it("rejects a too-short question with 400", async () => {
    const { status } = await ask("hi");
    expect(status).toBe(400);
  });

  it("rejects a too-long question with 400", async () => {
    const { status } = await ask("a".repeat(501));
    expect(status).toBe(400);
  });

  it("declines an off-topic question without an error status", async () => {
    const { status, body } = await ask("What is the capital of France?");
    expect(status).toBe(200);
    expect(body.sources).toEqual([]);
    expect(typeof body.answer).toBe("string");
  });

  it("answers a genuinely relevant question with sources", async () => {
    const { status, body } = await ask("What experience does Fadel have with identity and access management?");
    expect(status).toBe(200);
    expect(Array.isArray(body.sources)).toBe(true);
    expect(body.sources.length).toBeGreaterThan(0);
    expect(typeof body.answer).toBe("string");
    expect(body.answer.length).toBeGreaterThan(0);
  });
});
```

Note: these tests hit the real embedding model and, for the last one, the real Claude API. `.github/workflows/ci.yml` does not set `ANTHROPIC_API_KEY` (verified: no such variable appears anywhere in that file), so the one test that reaches the Claude call must skip gracefully in CI rather than fail the whole suite - there is no existing precedent for this in the codebase (`career-advisor.ts` has no test file at all), so use `bun:test`'s `it.skipIf`:

```ts
const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY);
```

and change the last test's declaration from `it("answers a genuinely relevant question with sources", ...)` to `it.skipIf(!hasApiKey)("answers a genuinely relevant question with sources", ...)`. The other three tests (both 400 cases, the off-topic decline case) do not require an API key since they short-circuit before the Claude call, and should run unconditionally.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun test apps/api/src/app.test.ts`
Expected: FAIL - no `/ask` route exists yet (404s where 200/400 are expected).

- [ ] **Step 3: Implement the route**

In `apps/api/src/app.ts`, add the new imports near the existing ones:

```ts
import { topKRelevant, isRelevant } from "@profile/core";
import { embedText, warmEmbeddingModel } from "./embeddings";
import { generateRagAnswer } from "./generateRagAnswer";
import { RAG_INDEX } from "./ragIndex";
import { createRateLimiterState, checkAndRecordPerIp, checkGlobalDailyLimit, recordGlobalDailyUsage } from "./rateLimiter";
```

Add near the top-level constants (alongside `CORS_ORIGINS` etc.):

```ts
const rateLimiterState = createRateLimiterState();
const ASK_TOP_K = 3;
const ASK_MIN_LENGTH = 3;
const ASK_MAX_LENGTH = 500;
const ASK_DECLINE_MESSAGE = "I can only answer questions about Fadel's professional background, grounded in what's on this resume.";

void warmEmbeddingModel();
```

Add the route to the `app` chain (after the existing `/v1/metrics` route, before `export type App`):

```ts
  .post("/ask", async ({ body, headers, set }) => {
    const question = body.question.trim();
    if (question.length < ASK_MIN_LENGTH || question.length > ASK_MAX_LENGTH) {
      set.status = 400;
      return { error: "invalid_question_length" };
    }
    if (!checkGlobalDailyLimit(rateLimiterState)) {
      return { answer: ASK_DECLINE_MESSAGE, sources: [] };
    }
    const ip = (headers["x-forwarded-for"] ?? "unknown").split(",")[0]!.trim();
    if (!checkAndRecordPerIp(rateLimiterState, ip)) {
      return { answer: ASK_DECLINE_MESSAGE, sources: [] };
    }
    const queryEmbedding = await embedText(question);
    const top = topKRelevant(queryEmbedding, RAG_INDEX, ASK_TOP_K);
    if (top.length === 0 || !isRelevant(top[0]!.score)) {
      return { answer: ASK_DECLINE_MESSAGE, sources: [] };
    }
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      set.status = 500;
      return { error: "server_misconfigured" };
    }
    const answer = await generateRagAnswer(question, top, apiKey);
    recordGlobalDailyUsage(rateLimiterState);
    return { answer, sources: top.map((c) => c.sourceId) };
  }, { body: t.Object({ question: t.String() }) })
```

Also add `"/ask"` to the `endpoints` array in the `/` route's response, alongside the existing entries.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun test apps/api/src/app.test.ts`
Expected: PASS, all tests including the 4 new `/ask` tests (assuming `ANTHROPIC_API_KEY` is available in this environment - it should be, since `bun run advise` has been used successfully in this repo before).

- [ ] **Step 5: Run the full suite and typecheck**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun test && bun run typecheck`
Expected: all tests pass, 0 typecheck errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/app.ts apps/api/src/app.test.ts
git commit -m "feat(api): wire up POST /ask with rate limiting and relevance gating"
```

---

### Task 6: Frontend ask panel and final verification

**Files:**
- Create: `apps/web/src/components/AskPanel.vue`
- Modify: `apps/web/src/components/Terminal.vue`

**Interfaces:**
- Consumes: `api` (the typed Eden client) from `../lib/client` - `/ask` is automatically available on it as `api.ask.post({ question })` once Task 5 lands, since Eden's typing is derived from the live `App` type export.
- Produces: nothing consumed by later tasks (this is the final task).

- [ ] **Step 1: Create the ask panel component**

Create `apps/web/src/components/AskPanel.vue`:

```vue
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
```

- [ ] **Step 2: Add it to the terminal page**

In `apps/web/src/components/Terminal.vue`, add the import near the other component imports:

```ts
import AskPanel from "./AskPanel.vue";
```

Add `<AskPanel />` inside the `v-else-if="prof"` template block, after the closing `</SectionBlock>` of the Skills section and before the closing of that `<template>` block (i.e., as the last content section, after Projects/Experience/Skills).

- [ ] **Step 3: Run the full test suite, typecheck, and build**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun test && bun run typecheck && bun run build`
Expected: all pass, build succeeds.

- [ ] **Step 4: Live smoke test**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun run api:dev` (foreground or background with a bounded timeout) and in another terminal:

```bash
curl -s -X POST http://localhost:3000/ask -H "content-type: application/json" -d '{"question":"What experience does Fadel have with identity and access management?"}'
```

Expected: a JSON response with a non-empty `answer` and a non-empty `sources` array referencing real experience/project IDs (e.g. `experience:safran`).

Then test the decline path:

```bash
curl -s -X POST http://localhost:3000/ask -H "content-type: application/json" -d '{"question":"What is the capital of France?"}'
```

Expected: `{ "answer": "I can only answer questions about Fadel's professional background...", "sources": [] }`.

Stop the dev server afterward.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/AskPanel.vue apps/web/src/components/Terminal.vue
git commit -m "feat(web): add ask panel UI wired to POST /ask"
```
