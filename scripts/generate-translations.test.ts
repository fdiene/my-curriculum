import { describe, expect, it } from "bun:test";
import { run, resolveGlossary, hintsFor } from "./generate-translations";
import src from "../data/master_data.fr.json";

describe("run (with a stub translator)", () => {
  it("produces data valid against the final ResumeSchema", async () => {
    const stub = async (text: string, target: string) => `[${target}] ${text}`;
    const out = await run(src as any, stub as any);
    expect(out.person.title.de.startsWith("[de]")).toBe(true);
    expect(out.projects[0].description.de.startsWith("[de]")).toBe(true);
  });

  it("still routes an exact glossary string through the stub translator (run() has no short-circuit itself)", async () => {
    const calls: Array<{ text: string; target: string }> = [];
    const stub = async (text: string, target: string) => {
      calls.push({ text, target });
      return `[${target}] ${text}`;
    };
    const resume = {
      ...src,
      person: {
        ...(src as any).person,
        title: { en: "ISTQB Software Testing" },
      },
    };
    await run(resume as any, stub as any);
    expect(calls.some((c) => c.text === "ISTQB Software Testing")).toBe(true);
  });
});

describe("resolveGlossary", () => {
  it("returns the canonical German translation on a glossary hit", () => {
    expect(resolveGlossary("ISTQB Software Testing", "de")).toBe("ISTQB Softwaretests");
  });

  it("returns the canonical French translation on a glossary hit", () => {
    expect(resolveGlossary("Mechanical Engineering Degree", "fr")).toBe("Diplôme d'ingénieur mécanique");
  });

  it("returns undefined on a miss (unknown text)", () => {
    expect(resolveGlossary("Some Unrelated Phrase", "de")).toBeUndefined();
  });

  it("returns undefined when the text matches but no translation exists for that target", () => {
    // GLOSSARY entries only define fr/de; en is never a translation target key here,
    // but also verify a lang miss on a defined entry stays undefined if absent.
    expect(resolveGlossary("ISTQB Software Testing", "en" as any)).toBeUndefined();
  });
});

describe("hintsFor", () => {
  it("finds 'Judge Agent' inside a longer paragraph and returns a hint for German", () => {
    const paragraph =
      "Built a Judge Agent that scores candidate outputs against a rubric before merging results into the pipeline.";
    const hints = hintsFor(paragraph, "de");
    expect(hints.length).toBe(1);
    expect(hints[0]).toContain("Judge Agent");
    expect(hints[0]).toContain("Judge-Agent");
  });

  it("returns no hints when the phrase is absent", () => {
    expect(hintsFor("Nothing relevant here.", "de")).toEqual([]);
  });

  it("returns no hints for a target language without a hint value", () => {
    expect(hintsFor("Judge Agent evaluation pipeline", "fr")).toEqual([]);
  });
});
