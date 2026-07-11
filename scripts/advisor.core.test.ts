import { describe, expect, it } from "bun:test";
import { buildAdvisorPrompt, renderInsights } from "./advisor.core";
import src from "../data/master_data.fr.json";

describe("buildAdvisorPrompt", () => {
  it("includes the person name and asks for the 4 required sections", () => {
    const p = buildAdvisorPrompt(src as any);
    expect(p).toContain("Fadel Diène");
    for (const s of ["job", "skill gap", "positioning", "ux"]) expect(p.toLowerCase()).toContain(s);
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
