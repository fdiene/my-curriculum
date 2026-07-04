import { describe, expect, it } from "bun:test";
import { localize } from "./localize";

describe("localize", () => {
  it("collapses localized objects to the chosen language", () => {
    const input = { title: { en: "Architect", fr: "Architecte", de: "Architekt" },
                    nested: [{ label: { en: "A", fr: "B", de: "C" } }], plain: 42 };
    expect(localize(input, "fr")).toEqual({ title: "Architecte", nested: [{ label: "B" }], plain: 42 });
  });
  it("does not treat a non-localized object as localized", () => {
    const input = { links: { en: "x" } }; // has en but also would fail full-locale check
    // { en: "x" } has only en key -> not all langs -> left as-is
    expect(localize(input, "en")).toEqual({ links: { en: "x" } });
  });
});
