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
  return [...projectChunks, ...experienceChunks];
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
