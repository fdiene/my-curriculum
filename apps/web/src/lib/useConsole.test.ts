import { describe, expect, it } from "bun:test";
import { useConsole } from "./useConsole";

describe("useConsole initial state", () => {
  it("opens for a targeted role on desktop", () => {
    expect(useConsole({ role: "ai_dx", isMobile: false }).state.value).toBe("open");
  });
  it("stays closed for default role", () => {
    expect(useConsole({ role: "default", isMobile: false }).state.value).toBe("closed");
  });
  it("stays closed on mobile even for a targeted role", () => {
    expect(useConsole({ role: "ai_dx", isMobile: true }).state.value).toBe("closed");
  });
});

describe("log and toggle", () => {
  it("appends entries and toggles", () => {
    const c = useConsole({ role: "default", isMobile: false });
    c.log({ kind: "system", text: "cURL command copied to clipboard" });
    expect(c.entries.value.length).toBe(1);
    c.toggle();
    expect(c.state.value).toBe("open");
  });
});
