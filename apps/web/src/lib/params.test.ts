import { describe, expect, it } from "bun:test";
import { parseViewParams } from "./params";

describe("parseViewParams", () => {
  it("reads role and lang from a query string", () => {
    expect(parseViewParams("?role=anthropic&lang=de")).toEqual({ role: "anthropic_dx", lang: "de" });
  });
  it("maps friendly role aliases and defaults", () => {
    expect(parseViewParams("")).toEqual({ role: "default", lang: "en" });
    expect(parseViewParams("?role=iot")).toEqual({ role: "iot", lang: "en" });
  });
});
