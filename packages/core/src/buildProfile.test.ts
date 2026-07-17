import { describe, expect, it } from "bun:test";
import type { Resume } from "@profile/schema";
import { buildProfile } from "./buildProfile";

const L = { en: "x", fr: "x", de: "x" };

function makeResume(overrides: Partial<Resume> = {}): Resume {
  return {
    person: { name: "Test", title: L, location: "Toulouse", links: {} },
    executiveSummaries: {
      ai_dx: { en: "I spent {{YEARS}} years in aerospace.", fr: "x", de: "x" },
      iot: L,
      plm_architect: L,
      default: { en: "Forged by {{YEARS}} years in aerospace.", fr: "x", de: "x" },
    },
    experiences: [{ id: "e1", role: L, org: "O", location: "L", period: { start: "2017-08", end: null }, summary: L, highlights: [], tags: [], domain: "d" }],
    projects: [],
    skills: [],
    certifications: [],
    education: [],
    recommendations: [],
    ...overrides,
  } as Resume;
}

describe("buildProfile executiveSummary years injection", () => {
  const now = new Date("2026-07-17");

  it("replaces {{YEARS}} with the years elapsed since the earliest experience", () => {
    const profile = buildProfile("ai_dx", "en", makeResume(), now);
    expect(profile.executiveSummary).toBe("I spent 8 years in aerospace.");
  });

  it("leaves summaries without the token untouched", () => {
    const profile = buildProfile("iot", "en", makeResume(), now);
    expect(profile.executiveSummary).toBe("x");
  });
});
