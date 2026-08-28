import { describe, expect, it } from "bun:test";
import { parseCvParams, parseViewParams } from "./params";

describe("parseViewParams", () => {
  it("reads role and lang from a query string", () => {
    expect(parseViewParams("?role=anthropic&lang=de")).toEqual({ role: "ai_dx", lang: "de" });
  });
  it("maps friendly role aliases and defaults", () => {
    expect(parseViewParams("")).toEqual({ role: "default", lang: "en" });
    expect(parseViewParams("?role=iot")).toEqual({ role: "iot", lang: "en" });
  });
  it("maps the ai alias to ai_dx", () => {
    expect(parseViewParams("?role=ai")).toEqual({ role: "ai_dx", lang: "en" });
  });
  it("maps the ea alias and the full slug to enterprise_architect", () => {
    expect(parseViewParams("?role=ea")).toEqual({ role: "enterprise_architect", lang: "en" });
    expect(parseViewParams("?role=enterprise_architect")).toEqual({ role: "enterprise_architect", lang: "en" });
  });
});

describe("parseCvParams", () => {
  it("infers the template from the language when template is absent", () => {
    expect(parseCvParams("?lang=fr").template).toBe("fr");
    expect(parseCvParams("?lang=de").template).toBe("ch");
    expect(parseCvParams("").template).toBe("us");
  });

  it("uses an explicit template even when it doesn't match the language default", () => {
    expect(parseCvParams("?lang=en&template=fr").template).toBe("fr");
    expect(parseCvParams("?lang=fr&template=ch").template).toBe("ch");
  });

  it("falls back to the language default on an invalid template value", () => {
    expect(parseCvParams("?lang=de&template=bogus").template).toBe("ch");
  });

  it("still parses role and lang the same way as parseViewParams", () => {
    expect(parseCvParams("?role=iot&lang=de")).toEqual({ role: "iot", lang: "de", template: "ch" });
  });

  it("does not resolve a template value from the prototype chain", () => {
    expect(parseCvParams("?lang=en&template=constructor").template).toBe("us");
  });
});
