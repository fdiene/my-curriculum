import { describe, expect, it } from "bun:test";
import { resolveLocale } from "./locale";

describe("resolveLocale", () => {
  it("prefers a valid query param", () => { expect(resolveLocale("de", "fr,en")).toBe("de"); });
  it("falls back to the Accept-Language header", () => { expect(resolveLocale(null, "fr-FR,fr;q=0.9,en;q=0.8")).toBe("fr"); });
  it("defaults to en when nothing matches", () => { expect(resolveLocale("es", "es-ES")).toBe("en"); });
  it("defaults to en when everything is absent", () => { expect(resolveLocale(null, null)).toBe("en"); });
  it("is case-insensitive for the query param", () => { expect(resolveLocale("DE", null)).toBe("de"); });
});
