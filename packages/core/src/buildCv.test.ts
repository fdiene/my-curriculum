import { describe, expect, it } from "bun:test";
import type { Resume, Tag, TargetRole } from "@profile/schema";
import { buildCvView, CV_TEMPLATES } from "./buildCv";

const L = { en: "x", fr: "x", de: "x" };

function makeExperience(id: string, highlightCount: number): Resume["experiences"][number] {
  return {
    id,
    role: L,
    org: `Org ${id}`,
    location: "L",
    period: { start: "2020-01", end: null },
    summary: L,
    highlights: Array.from({ length: highlightCount }, (_, i) => ({ en: `h${i}`, fr: `h${i}`, de: `h${i}` })),
    tags: [],
    domain: "d",
  };
}

function makeSkill(id: string, level: number, tags: Tag[] = []): Resume["skills"][number] {
  return { id, label: `Skill ${id}`, category: "cat", level, tags };
}

function makeProject(id: string, tags: Tag[] = [], featuredFor: TargetRole[] = []): Resume["projects"][number] {
  return {
    id,
    name: `Project ${id}`,
    tagline: L,
    description: L,
    stack: ["TypeScript"],
    tags,
    links: {},
    status: "live",
    featured_for: featuredFor,
  };
}

function makeResume(overrides: Partial<Resume> = {}): Resume {
  return {
    person: {
      name: "Test",
      title: L,
      location: "Toulouse",
      links: { linkedin: "https://linkedin.com/in/test", github: "https://github.com/test" },
      avatarUrl: "/avatar.jpg",
    },
    executiveSummaries: { ai_dx: L, iot: L, plm_architect: L, enterprise_architect: L, default: L },
    experiences: Array.from({ length: 6 }, (_, i) => makeExperience(`e${i}`, 5)),
    projects: [],
    skills: Array.from({ length: 6 }, (_, i) => makeSkill(`s${i}`, 3)),
    certifications: [],
    education: [],
    recommendations: [],
    ...overrides,
  } as Resume;
}

describe("buildCvView", () => {
  it("trims experiences and their highlights to the France template's limits", () => {
    const view = buildCvView("fr", "default", "en", makeResume());
    expect(view.experiences.length).toBe(CV_TEMPLATES.fr.maxExperiences);
    for (const e of view.experiences) {
      expect(e.highlights.length).toBeLessThanOrEqual(CV_TEMPLATES.fr.maxHighlightsPerExperience);
    }
  });

  it("trims to the Switzerland template's limits (input exceeds even the larger cap)", () => {
    const view = buildCvView("ch", "default", "en", makeResume());
    expect(view.experiences.length).toBe(CV_TEMPLATES.ch.maxExperiences);
    for (const e of view.experiences) {
      expect(e.highlights.length).toBeLessThanOrEqual(CV_TEMPLATES.ch.maxHighlightsPerExperience);
    }
  });

  it("trims to the USA template's limits", () => {
    const view = buildCvView("us", "default", "en", makeResume());
    expect(view.experiences.length).toBe(CV_TEMPLATES.us.maxExperiences);
    for (const e of view.experiences) {
      expect(e.highlights.length).toBeLessThanOrEqual(CV_TEMPLATES.us.maxHighlightsPerExperience);
    }
  });

  it("includes the photo only for the Switzerland template", () => {
    const ch = buildCvView("ch", "default", "en", makeResume());
    const fr = buildCvView("fr", "default", "en", makeResume());
    const us = buildCvView("us", "default", "en", makeResume());
    expect(ch.person.avatarUrl).toBe("/avatar.jpg");
    expect(fr.person.avatarUrl).toBeUndefined();
    expect(us.person.avatarUrl).toBeUndefined();
  });

  it("sets documentLabel from the template config", () => {
    expect(buildCvView("us", "default", "en", makeResume()).documentLabel).toBe("Resume");
    expect(buildCvView("fr", "default", "en", makeResume()).documentLabel).toBe("Curriculum Vitae");
    expect(buildCvView("ch", "default", "en", makeResume()).documentLabel).toBe("Curriculum Vitae");
  });

  it("caps skills at 15 and orders them by role relevance", () => {
    const manySkills = Array.from({ length: 20 }, (_, i) => makeSkill(`s${i}`, 3, i === 19 ? (["plm"] as Tag[]) : []));
    const view = buildCvView("ch", "plm_architect", "en", makeResume({ skills: manySkills }));
    expect(view.skills.length).toBe(15);
    expect(view.skills[0]?.id).toBe("s19");
  });

  it("caps projects at 3 and keeps buildProfile's existing role ordering", () => {
    const projects = [
      makeProject("p0"),
      makeProject("p1"),
      makeProject("p2", ["plm"]),
      makeProject("p3"),
      makeProject("p4", [], ["plm_architect"]),
    ];
    const view = buildCvView("us", "plm_architect", "en", makeResume({ projects }));
    expect(view.projects.length).toBe(3);
    expect(view.projects[0]?.id).toBe("p4");
  });

  it("prints experiences newest-first regardless of input order or role-relevance order", () => {
    const experiences: Resume["experiences"] = [
      { id: "e0", role: L, org: "Org e0", location: "L", period: { start: "2015-03", end: "2018-06" }, summary: L, highlights: [], tags: [], domain: "d" },
      { id: "e1", role: L, org: "Org e1", location: "L", period: { start: "2023-01", end: null }, summary: L, highlights: [], tags: [], domain: "d" },
      { id: "e2", role: L, org: "Org e2", location: "L", period: { start: "2019-07", end: "2022-12" }, summary: L, highlights: [], tags: [], domain: "d" },
      { id: "e3", role: L, org: "Org e3", location: "L", period: { start: "2010-01", end: "2014-12" }, summary: L, highlights: [], tags: [], domain: "d" },
    ];
    const view = buildCvView("ch", "default", "en", makeResume({ experiences }));
    const starts = view.experiences.map((e) => e.period.start);
    const sortedDesc = [...starts].sort((a, b) => b.localeCompare(a));
    expect(starts).toEqual(sortedDesc);
    expect(view.experiences[0]?.id).toBe("e1");
  });

  it("provides language-appropriate section labels", () => {
    expect(buildCvView("fr", "default", "fr", makeResume()).labels.experience).toBe("Expérience");
    expect(buildCvView("ch", "default", "de", makeResume()).labels.present).toBe("Heute");
    expect(buildCvView("us", "default", "en", makeResume()).labels.skills).toBe("Skills");
  });
});
