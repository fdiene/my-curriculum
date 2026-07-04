import { describe, expect, it } from "bun:test";
import { ResumeSchema, ResumeInputSchema } from "./index";

const minimalFinal = {
  person: { name: "Fadel Diène", title: { en: "Architect", fr: "Architecte", de: "Architekt" },
            location: "Toulouse", links: { linkedin: "https://linkedin.com/in/fdiene" } },
  executiveSummaries: {
    anthropic_dx: { en: "a", fr: "a", de: "a" },
    iot: { en: "b", fr: "b", de: "b" },
    plm_architect: { en: "c", fr: "c", de: "c" },
    default: { en: "d", fr: "d", de: "d" },
  },
  experiences: [], projects: [], skills: [], certifications: [], education: [], recommendations: [],
};

describe("ResumeSchema (final)", () => {
  it("parses a minimal valid resume", () => {
    expect(ResumeSchema.parse(minimalFinal).person.name).toBe("Fadel Diène");
  });
  it("rejects a project whose tagline lacks de", () => {
    const bad = structuredClone(minimalFinal) as any;
    bad.projects.push({ id: "x", name: "X", tagline: { en: "t", fr: "t" },
      description: { en: "d", fr: "d", de: "d" }, stack: [], tags: [], links: {},
      status: "live", featured_for: [] });
    expect(() => ResumeSchema.parse(bad)).toThrow();
  });
});

describe("ResumeInputSchema (source)", () => {
  it("accepts localized fields without de", () => {
    const src = structuredClone(minimalFinal) as any;
    src.person.title = { en: "Architect", fr: "Architecte" };
    delete src.executiveSummaries.anthropic_dx.de;
    expect(ResumeInputSchema.parse(src).person.title.fr).toBe("Architecte");
  });
});
