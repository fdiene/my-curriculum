import { describe, expect, it } from "bun:test";
import { loadResume } from "./data";

describe("loadResume", () => {
  it("loads and validates the generated i18n data", () => {
    const r = loadResume("data/master_data.i18n.json");
    expect(r.person.name).toBe("Fadel Diène");
    expect(r.projects.length).toBeGreaterThan(0);
    expect(typeof r.person.title.de).toBe("string");
  });
});
