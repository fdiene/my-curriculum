import { describe, expect, it } from "bun:test";
import { run } from "./generate-translations";
import src from "../data/master_data.fr.json";

describe("run (with a stub translator)", () => {
  it("produces data valid against the final ResumeSchema", async () => {
    const stub = async (text: string, target: string) => `[${target}] ${text}`;
    const out = await run(src as any, stub as any);
    expect(out.person.title.de.startsWith("[de]")).toBe(true);
    expect(out.projects[0].description.de.startsWith("[de]")).toBe(true);
  });
});
