import { describe, expect, it } from "bun:test";
import { ResumeSchema, ResumeInputSchema, ProjectSchema } from "./index";

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

describe("Named entity schemas (final)", () => {
  it("ProjectSchema parses a valid final project object", () => {
    const validProject = {
      id: "proj-1",
      name: "My Project",
      tagline: { en: "A tagline", fr: "Un tagline", de: "Ein Tagline" },
      description: { en: "desc", fr: "desc", de: "desc" },
      stack: ["TypeScript", "React"],
      tags: [],
      links: { repo: "https://github.com/example" },
      status: "live" as const,
      featured_for: [],
    };
    const parsed = ProjectSchema.parse(validProject);
    expect(parsed.name).toBe("My Project");
  });

  it("ProjectSchema is identical to ResumeSchema.shape.projects.element", () => {
    expect(ProjectSchema).toBe(ResumeSchema.shape.projects.element);
  });
});

const validProject = {
  id: "x", name: "X",
  tagline: { en: "t", fr: "t", de: "t" },
  description: { en: "d", fr: "d", de: "d" },
  stack: [], tags: [], links: {}, status: "live", featured_for: [],
};

describe("status enum v2", () => {
  it("accepts building and concept", () => {
    expect(ProjectSchema.parse({ ...validProject, status: "building" }).status).toBe("building");
    expect(ProjectSchema.parse({ ...validProject, status: "concept" }).status).toBe("concept");
  });
});

describe("product tag", () => {
  it("accepts product", () => {
    expect(ProjectSchema.parse({ ...validProject, tags: ["product"] }).tags).toEqual(["product"]);
  });
});
