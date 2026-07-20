import { describe, expect, it } from "bun:test";
import { buildAdvisorPrompt, renderInsights, AdvisorReportSchema } from "./advisor.core";
import src from "../data/master_data.fr.json";

describe("buildAdvisorPrompt", () => {
  it("includes the person name and asks for all 7 required sections", () => {
    const p = buildAdvisorPrompt(src as any);
    expect(p).toContain("Fadel Diène");
    for (const s of ["job", "skill gap", "positioning", "ux", "traditional cv", "linkedin", "pitch"]) {
      expect(p.toLowerCase()).toContain(s);
    }
  });

  it("grounds CV advice in the candidate's real experience highlights, not invented ones", () => {
    const p = buildAdvisorPrompt(src as any);
    expect(p).toContain("Designed a new SQL database for composite materials");
  });

  it("includes each experience's real start/end dates, so the model never claims dates are missing", () => {
    const p = buildAdvisorPrompt(src as any);
    expect(p).toContain("2017-08 to 2018-05");
    expect(p).toContain("2023-04 to present");
  });
});

describe("AdvisorReportSchema", () => {
  it("parses a valid report_markdown + telemetry payload", () => {
    const value = AdvisorReportSchema.parse({
      report_markdown: "## 1. Matching current job openings\n...",
      telemetry: {
        top_lanes: ["PLM Solution Architect", "Applied AI Engineer"],
        top_skill_gap: "Evals",
        market_shift_summary: "AI-augmented PLM roles are new since the last run.",
      },
    });
    expect(value.telemetry.top_lanes).toHaveLength(2);
  });

  it("rejects more than 3 top_lanes", () => {
    expect(() =>
      AdvisorReportSchema.parse({
        report_markdown: "x",
        telemetry: { top_lanes: ["a", "b", "c", "d"], top_skill_gap: "x", market_shift_summary: "x" },
      })
    ).toThrow();
  });
});

describe("buildAdvisorPrompt structured output instruction", () => {
  it("tells the model to populate the telemetry object alongside the markdown report", () => {
    const p = buildAdvisorPrompt(src as any);
    expect(p.toLowerCase()).toContain("top_lanes");
    expect(p.toLowerCase()).toContain("telemetry");
  });
});

describe("buildAdvisorPrompt traditional CV constraints", () => {
  it("states the hard formatting constraints from the JobsLead review", () => {
    const p = buildAdvisorPrompt(src as any);
    expect(p).toContain("1 page");
    expect(p).toContain("single font");
    expect(p).toContain("8 to 15 skills");
    expect(p.toLowerCase()).toContain("ats");
  });

  it("instructs against fabricating metrics that are not in the source data", () => {
    const p = buildAdvisorPrompt(src as any);
    expect(p.toLowerCase()).toContain("never invent a metric");
  });
});

describe("buildAdvisorPrompt targeted pitch", () => {
  it("embeds the target job offer and asks for a tailored pitch when provided", () => {
    const p = buildAdvisorPrompt(src as any, undefined, "Looking for a Staff PLM Architect in Toulouse.");
    expect(p).toContain("Looking for a Staff PLM Architect in Toulouse.");
  });

  it("asks for generic pitch guidance instead of fabricating a job offer when none is given", () => {
    const p = buildAdvisorPrompt(src as any);
    expect(p.toLowerCase()).toContain("no target job offer was provided");
  });
});

describe("buildAdvisorPrompt with upskilling", () => {
  it("embeds the upskilling plan and asks to align coaching with it", () => {
    const p = buildAdvisorPrompt(src as any, "## ops-tools\n- [ ] publier sur npm");
    expect(p).toContain("publier sur npm");
    expect(p.toLowerCase()).toContain("upskilling");
  });
  it("stays valid without an upskilling plan", () => {
    expect(buildAdvisorPrompt(src as any)).not.toContain("upskilling plan below");
  });
});

describe("renderInsights", () => {
  it("renders titled markdown sections", () => {
    const md = renderInsights([{ title: "Jobs", body: "- one" }]);
    expect(md).toContain("## Jobs");
    expect(md).toContain("- one");
  });
});
