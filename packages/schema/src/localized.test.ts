import { describe, expect, it } from "bun:test";
import { Localized, LocalizedInput, LANGS, Tag, TargetRole } from "./index";
import type { LocalizeDeep } from "./index";

describe("Localized", () => {
  it("accepts all three languages", () => {
    expect(Localized.parse({ en: "a", fr: "b", de: "c" })).toEqual({ en: "a", fr: "b", de: "c" });
  });
  it("rejects a missing language (final schema is strict)", () => {
    expect(() => Localized.parse({ en: "a", fr: "b" })).toThrow();
  });
  it("rejects an unknown key", () => {
    expect(() => Localized.parse({ en: "a", fr: "b", de: "c", xx: "d" })).toThrow();
  });
});

describe("LocalizedInput", () => {
  it("allows de to be omitted", () => {
    expect(LocalizedInput.parse({ en: "a", fr: "b" })).toEqual({ en: "a", fr: "b" });
  });
});

describe("LocalizeDeep (type-level, verified by assignment)", () => {
  it("collapses a Localized leaf to string, recurses through objects and arrays, leaves plain fields untouched", () => {
    type Sample = {
      title: { en: string; fr: string; de: string };
      mobility?: { en: string; fr: string; de: string };
      highlights: { en: string; fr: string; de: string }[];
      links: { linkedin?: string };
      level: number;
    };
    // If LocalizeDeep were wrong, this assignment would fail bun run typecheck.
    const value: LocalizeDeep<Sample> = {
      title: "Architect",
      mobility: "Worldwide",
      highlights: ["Shipped X", "Shipped Y"],
      links: { linkedin: "https://linkedin.com/in/x" },
      level: 5,
    };
    expect(value.title).toBe("Architect");
    expect(value.highlights).toEqual(["Shipped X", "Shipped Y"]);
    expect(value.level).toBe(5);
  });
});

describe("enums", () => {
  it("exposes the language list", () => {
    expect(LANGS).toEqual(["en", "fr", "de"]);
  });
  it("accepts known tag and role", () => {
    expect(Tag.parse("dx_tooling")).toBe("dx_tooling");
    expect(TargetRole.parse("ai_dx")).toBe("ai_dx");
  });
});
