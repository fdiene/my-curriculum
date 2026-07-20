import { describe, expect, it } from "bun:test";
import { diffUpskilling, readLastTelemetryLine, buildTelemetryLine, type UpskillingDelta } from "./career-telemetry.core";

const md = [
  "## Profile Engine (my-curriculum) : statut `live`",
  "",
  "**Compétences visées : TS avancé.**",
  "",
  "- [ ] Task A.",
  "- [x] Task B.",
].join("\n");

describe("diffUpskilling", () => {
  it("treats every checked item as newly checked on the first run (previous is null)", () => {
    const delta = diffUpskilling(null, md);
    expect(delta).toEqual([
      {
        project: "Profile Engine (my-curriculum) : statut `live`",
        checkedTexts: ["Task B."],
        total: 2,
        newlyChecked: ["Task B."],
      },
    ]);
  });

  it("treats a project absent from the previous delta as entirely new", () => {
    const delta = diffUpskilling([], md);
    expect(delta[0]!.newlyChecked).toEqual(["Task B."]);
  });

  it("only reports items newly checked since the previous delta", () => {
    const previous: UpskillingDelta = [
      {
        project: "Profile Engine (my-curriculum) : statut `live`",
        checkedTexts: ["Task B."],
        total: 2,
        newlyChecked: ["Task B."],
      },
    ];
    const mdBothChecked = md.replace("- [ ] Task A.", "- [x] Task A.");
    const delta = diffUpskilling(previous, mdBothChecked);
    expect(delta).toEqual([
      {
        project: "Profile Engine (my-curriculum) : statut `live`",
        checkedTexts: ["Task A.", "Task B."],
        total: 2,
        newlyChecked: ["Task A."],
      },
    ]);
  });

  it("drops an item from checkedTexts if it becomes unchecked again, without erroring", () => {
    const previous: UpskillingDelta = [
      {
        project: "Profile Engine (my-curriculum) : statut `live`",
        checkedTexts: ["Task A.", "Task B."],
        total: 2,
        newlyChecked: [],
      },
    ];
    const mdBUnchecked = md.replace("- [x] Task B.", "- [ ] Task B.");
    const delta = diffUpskilling(previous, mdBUnchecked);
    expect(delta[0]!.checkedTexts).toEqual([]);
    expect(delta[0]!.newlyChecked).toEqual([]);
  });
});

describe("readLastTelemetryLine", () => {
  it("returns null for empty input", () => {
    expect(readLastTelemetryLine("")).toBeNull();
  });

  it("parses the last line when multiple lines are present", () => {
    const line1 = JSON.stringify({
      timestamp: "2026-07-01T00:00:00.000Z",
      upskilling: [],
      market: { top_lanes: [], top_skill_gap: "a", market_shift_summary: "a" },
    });
    const line2 = JSON.stringify({
      timestamp: "2026-07-17T00:00:00.000Z",
      upskilling: [],
      market: { top_lanes: [], top_skill_gap: "b", market_shift_summary: "b" },
    });
    const result = readLastTelemetryLine(`${line1}\n${line2}\n`);
    expect(result?.timestamp).toBe("2026-07-17T00:00:00.000Z");
    expect(result?.market.top_skill_gap).toBe("b");
  });

  it("returns null instead of throwing when the last line is malformed or truncated", () => {
    const line1 = JSON.stringify({
      timestamp: "2026-07-01T00:00:00.000Z",
      upskilling: [],
      market: { top_lanes: [], top_skill_gap: "a", market_shift_summary: "a" },
    });
    const truncated = '{"timestamp":"2026-07-17T00:00:00.000Z","upskilling":[],"market":{"top_lan';
    expect(readLastTelemetryLine(`${line1}\n${truncated}`)).toBeNull();
  });
});

describe("buildTelemetryLine", () => {
  it("serializes timestamp, upskilling delta and market telemetry as one JSON line", () => {
    const upskilling: UpskillingDelta = [
      { project: "P", checkedTexts: ["x"], total: 1, newlyChecked: ["x"] },
    ];
    const market = { top_lanes: ["Lane A"], top_skill_gap: "Evals", market_shift_summary: "More demand for evals." };
    const line = buildTelemetryLine(upskilling, market, new Date("2026-07-17T12:00:00.000Z"));
    expect(JSON.parse(line)).toEqual({
      timestamp: "2026-07-17T12:00:00.000Z",
      upskilling,
      market,
    });
  });
});
