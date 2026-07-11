import { describe, expect, it } from "bun:test";
import { Localized, LocalizedInput, LANGS, Tag, TargetRole } from "./index";

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

describe("enums", () => {
  it("exposes the language list", () => {
    expect(LANGS).toEqual(["en", "fr", "de"]);
  });
  it("accepts known tag and role", () => {
    expect(Tag.parse("dx_tooling")).toBe("dx_tooling");
    expect(TargetRole.parse("ai_dx")).toBe("ai_dx");
  });
});
