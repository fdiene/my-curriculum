import { describe, expect, it } from "bun:test";
import { ResumeInputSchema } from "../packages/schema/src/index";
import raw from "./master_data.fr.json";

describe("master_data.fr.json", () => {
  it("is valid against the source schema", () => {
    expect(() => ResumeInputSchema.parse(raw)).not.toThrow();
  });
  it("contains the three portfolio projects", () => {
    const r = ResumeInputSchema.parse(raw);
    const ids = r.projects.map((p) => p.id).sort();
    expect(ids).toEqual(["omnis-agri", "ops-tools", "seomnix"]);
  });
});
