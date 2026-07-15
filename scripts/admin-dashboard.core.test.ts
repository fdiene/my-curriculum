import { describe, expect, it } from "bun:test";
import {
  parseProjectStatuses,
  parseUpskillingSections,
  nextAction,
  parseRoadmapAxis1,
  renderDashboard,
} from "./admin-dashboard.core";

describe("parseProjectStatuses", () => {
  it("extracts name/status/tagline from master data projects", () => {
    const data = { projects: [{ name: "OMNIS", status: "live", tagline: { en: "Ops-first" } }] };
    expect(parseProjectStatuses(data)).toEqual([{ name: "OMNIS", status: "live", tagline: "Ops-first" }]);
  });

  it("returns an empty list when there are no projects", () => {
    expect(parseProjectStatuses({ projects: [] })).toEqual([]);
  });
});

describe("parseUpskillingSections", () => {
  const md = [
    "## Profile Engine (my-curriculum) : statut `live`",
    "",
    "**Compétences visées : TypeScript avancé.**",
    "",
    "- [ ] First unchecked task.",
    "- [x] Already done task.",
    "",
    "## ops-tools : statut `building`",
    "",
    "**Compétences visées : CLI design.**",
    "",
    "- [ ] Only task here.",
  ].join("\n");

  it("groups checkbox items under their project heading", () => {
    const sections = parseUpskillingSections(md);
    expect(sections).toHaveLength(2);
    expect(sections[0].project).toBe("Profile Engine (my-curriculum) : statut `live`");
    expect(sections[0].competencies).toBe("TypeScript avancé.");
    expect(sections[0].items).toEqual([
      { text: "First unchecked task.", checked: false },
      { text: "Already done task.", checked: true },
    ]);
    expect(sections[1].project).toBe("ops-tools : statut `building`");
  });

  it("ignores nested sub-bullets (only top-level checkboxes are items)", () => {
    const withSubBullet = md.replace(
      "- [ ] First unchecked task.",
      "- [ ] First unchecked task.\n  - Sub-detail, not a checkbox item."
    );
    const sections = parseUpskillingSections(withSubBullet);
    expect(sections[0].items).toHaveLength(2);
  });

  it("parses correctly when the file uses CRLF line endings", () => {
    const crlf = md.replace(/\n/g, "\r\n");
    const sections = parseUpskillingSections(crlf);
    expect(sections[0].project).toBe("Profile Engine (my-curriculum) : statut `live`");
    expect(sections[0].items).toEqual([
      { text: "First unchecked task.", checked: false },
      { text: "Already done task.", checked: true },
    ]);
  });
});

describe("nextAction", () => {
  it("returns the first unchecked item's text", () => {
    const section = {
      project: "P",
      competencies: "",
      items: [
        { text: "Done", checked: true },
        { text: "Next up", checked: false },
        { text: "Later", checked: false },
      ],
    };
    expect(nextAction(section)).toBe("Next up");
  });

  it("returns null when every item is checked", () => {
    const section = { project: "P", competencies: "", items: [{ text: "Done", checked: true }] };
    expect(nextAction(section)).toBeNull();
  });

  it("returns null when there are no items", () => {
    expect(nextAction({ project: "P", competencies: "", items: [] })).toBeNull();
  });
});

describe("parseRoadmapAxis1", () => {
  const md = [
    "## AXE 1 — Évolution technique des projets existants",
    "",
    "### SEOMNIX Empire",
    "",
    "**Killer feature suivante :** la boucle de calibration juge-humain.",
    "",
    "### Harness",
    "",
    "**Killer feature suivante :** moteur de policy déclaratif.",
    "",
    "## AXE 2 — Design system des nouveaux projets",
    "",
    "### Copy Trading App",
    "",
    "**Killer feature suivante :** ne devrait pas apparaître (hors AXE 1).",
  ].join("\n");

  it("extracts only AXE 1 project sections with their killer feature line", () => {
    const entries = parseRoadmapAxis1(md);
    expect(entries).toEqual([
      { project: "SEOMNIX Empire", killerFeature: "la boucle de calibration juge-humain." },
      { project: "Harness", killerFeature: "moteur de policy déclaratif." },
    ]);
  });

  it("returns null killerFeature when a section has none", () => {
    const noKiller = "## AXE 1 — X\n\n### Foo\n\nSome other text, no killer feature line.";
    expect(parseRoadmapAxis1(noKiller)).toEqual([{ project: "Foo", killerFeature: null }]);
  });

  it("parses correctly when the file uses CRLF line endings", () => {
    const crlf = md.replace(/\n/g, "\r\n");
    expect(parseRoadmapAxis1(crlf)).toEqual([
      { project: "SEOMNIX Empire", killerFeature: "la boucle de calibration juge-humain." },
      { project: "Harness", killerFeature: "moteur de policy déclaratif." },
    ]);
  });
});

describe("renderDashboard", () => {
  it("renders all four sections as markdown", () => {
    const md = renderDashboard({
      projects: [{ name: "OMNIS", status: "live", tagline: "Ops-first" }],
      upskilling: [
        {
          project: "Profile Engine (my-curriculum) : statut `live`",
          competencies: "TS avancé.",
          items: [{ text: "Do X", checked: false }],
        },
      ],
      roadmap: [{ project: "Harness", killerFeature: "moteur de policy déclaratif." }],
      staleness: [{ repo: "harness", lastCommitDate: "2026-07-15", lastCommitSubject: "chore: initial commit" }],
    });
    expect(md).toContain("OMNIS");
    expect(md).toContain("live");
    expect(md).toContain("Do X");
    expect(md).toContain("moteur de policy déclaratif.");
    expect(md).toContain("harness");
    expect(md).toContain("2026-07-15");
  });

  it("marks a project with no remaining action as fully done", () => {
    const md = renderDashboard({
      projects: [],
      upskilling: [{ project: "P", competencies: "", items: [{ text: "Done", checked: true }] }],
      roadmap: [],
      staleness: [],
    });
    expect(md.toLowerCase()).toContain("aucune action restante");
  });

  it("marks a repo with unknown staleness explicitly instead of fabricating a date", () => {
    const md = renderDashboard({
      projects: [],
      upskilling: [],
      roadmap: [],
      staleness: [{ repo: "harness", lastCommitDate: null, lastCommitSubject: null }],
    });
    expect(md).toContain("n/a");
  });
});
