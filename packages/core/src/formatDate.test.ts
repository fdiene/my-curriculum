import { describe, expect, it } from "bun:test";
import { formatMonthYear } from "./formatDate";

describe("formatMonthYear", () => {
  it("formats en as abbreviated month + year", () => {
    expect(formatMonthYear("2020-01", "en")).toBe("Jan 2020");
  });

  it("formats fr with the correct accented abbreviation", () => {
    expect(formatMonthYear("2020-01", "fr")).toBe("janv. 2020");
  });

  it("formats de with the correct abbreviation", () => {
    expect(formatMonthYear("2020-01", "de")).toBe("Jan. 2020");
  });

  it("handles a different month correctly (no off-by-one)", () => {
    expect(formatMonthYear("2023-04", "en")).toBe("Apr 2023");
  });
});
