import { describe, expect, it } from "bun:test";
import { findMissingLocales, applyTranslations } from "./translations.core";

const resume: any = {
  person: { name: "F", title: { en: "Architect", fr: "Architecte" }, location: "T", links: {} },
  executiveSummaries: {
    ai_dx: { en: "a", fr: "a" }, iot: { en: "b", fr: "b" },
    plm_architect: { en: "c", fr: "c" }, default: { en: "d", fr: "d" },
  },
  experiences: [], projects: [], skills: [], certifications: [], education: [], recommendations: [],
};

describe("findMissingLocales", () => {
  it("finds every localized node missing de", () => {
    const missing = findMissingLocales(resume);
    expect(missing.length).toBe(5); // title + 4 summaries
    expect(missing.every((m) => m.missing.includes("de"))).toBe(true);
    expect(missing[0]).toHaveProperty("en");
  });
});

describe("applyTranslations", () => {
  it("merges filled de values back by path", () => {
    const missing = findMissingLocales(resume);
    const filled: Record<string, any> = {};
    for (const m of missing) filled[m.path] = { de: m.en.toUpperCase() };
    const out: any = applyTranslations(resume, filled);
    expect(out.person.title.de).toBe("ARCHITECT");
    expect(out.executiveSummaries.default.de).toBe("D");
  });
});
