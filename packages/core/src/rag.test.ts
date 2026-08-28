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
