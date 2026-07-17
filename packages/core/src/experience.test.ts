import { describe, expect, it } from "bun:test";
import { yearsOfExperience, injectYears } from "./experience";

describe("yearsOfExperience", () => {
  it("computes whole years elapsed since the earliest experience start", () => {
    const experiences = [{ period: { start: "2020-06" } }, { period: { start: "2017-08" } }];
    expect(yearsOfExperience(experiences, new Date("2026-07-17"))).toBe(8);
  });

  it("counts a full year only once the anniversary month is reached", () => {
    const experiences = [{ period: { start: "2017-08" } }];
    expect(yearsOfExperience(experiences, new Date("2026-07-31"))).toBe(8);
    expect(yearsOfExperience(experiences, new Date("2026-08-01"))).toBe(9);
  });

  it("returns 0 when there are no experiences", () => {
    expect(yearsOfExperience([], new Date("2026-07-17"))).toBe(0);
  });
});

describe("injectYears", () => {
  it("replaces every {{YEARS}} token with the computed number", () => {
    expect(injectYears("I spent {{YEARS}} years in {{YEARS}} sectors.", 8)).toBe(
      "I spent 8 years in 8 sectors."
    );
  });

  it("leaves text unchanged when there is no token", () => {
    expect(injectYears("No placeholder here.", 8)).toBe("No placeholder here.");
  });

  it("renders 0 correctly instead of treating it as falsy", () => {
    expect(injectYears("{{YEARS}} years", 0)).toBe("0 years");
  });
});
