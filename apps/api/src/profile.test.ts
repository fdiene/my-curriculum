import { describe, expect, it } from "bun:test";
import { buildProfile } from "./profile";
import { loadResume } from "./data";
import type { Resume } from "@profile/schema";

const data: Resume = loadResume("data/master_data.i18n.json");

describe("buildProfile", () => {
  it("returns the role-specific summary in the requested language", () => {
    const out = buildProfile("anthropic_dx", "fr", data);
    expect(typeof out.executiveSummary).toBe("string");
    expect((out.person as any).title).toBe((data.person.title as any).fr);
  });
  it("orders projects for the role (ops-tools/seomnix before omnis-agri for anthropic_dx)", () => {
    const ids = (buildProfile("anthropic_dx", "en", data).projects as any).map((p: any) => p.id);
    expect(ids.indexOf("omnis-agri")).toBe(ids.length - 1);
  });
});
