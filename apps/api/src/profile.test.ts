import { describe, expect, it } from "bun:test";
import { buildProfile } from "./profile";
import { loadResume } from "./data";
import type { Resume } from "@profile/schema";

const data: Resume = loadResume("data/master_data.i18n.json");

describe("buildProfile", () => {
  it("returns the role-specific summary in the requested language", () => {
    const out = buildProfile("ai_dx", "fr", data);
    expect(typeof out.executiveSummary).toBe("string");
    expect((out.person as any).title).toBe((data.person.title as any).fr);
  });
  it("orders ai_dx projects per spec (featured first, artmap last)", () => {
    const ids = (buildProfile("ai_dx", "en", data).projects as any).map((p: any) => p.id);
    expect(ids.slice(0, 4)).toEqual(["harness", "profile-engine", "seomnix", "ops-tools"]);
    expect(ids[ids.length - 1]).toBe("artmap");
  });

  it("features artmap first for the default role", () => {
    expect((buildProfile("default", "en", data).projects as any)[0].id).toBe("artmap");
  });
});
