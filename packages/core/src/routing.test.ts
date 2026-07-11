import { describe, expect, it } from "bun:test";
import { scoreItem, orderByRole } from "./routing";

const projects = [
  { id: "seomnix", tags: ["ai_safety", "mlops", "dx_tooling"] as any, featured_for: ["ai_dx"] as any },
  { id: "omnis-agri", tags: ["iot", "edge", "ai_safety", "mcp", "dx_tooling"] as any, featured_for: ["iot"] as any },
  { id: "ops-tools", tags: ["dx_tooling", "devsecops"] as any, featured_for: ["ai_dx"] as any },
];

describe("scoreItem", () => {
  it("scores ai_dx by dx/ai weights", () => {
    expect(scoreItem(["ai_safety", "dx_tooling"] as any, "ai_dx")).toBe(19);
  });
});

describe("orderByRole", () => {
  it("puts SEOMNIX/ops-tools first for ai_dx", () => {
    const order = orderByRole(projects, "ai_dx").map((p) => p.id);
    expect(order[0]).toBe("seomnix"); // highest ai_safety(10)+dx(9)+...
    expect(order).toContain("ops-tools");
    expect(order.indexOf("ops-tools")).toBeLessThan(order.indexOf("omnis-agri"));
  });
  it("puts Omnis-Agri first for iot", () => {
    expect(orderByRole(projects, "iot").map((p) => p.id)[0]).toBe("omnis-agri");
  });
  it("featured_for boost outranks a higher tag score for ai_dx", () => {
    // ops-tools: tag score 15 + boost 100 = 115 > omnis-agri: tag score 26 (not featured)
    const order = orderByRole(projects, "ai_dx").map((p) => p.id);
    expect(order.indexOf("ops-tools")).toBeLessThan(order.indexOf("omnis-agri"));
  });
});
