import { describe, expect, it } from "bun:test";
import { useProfile } from "./useProfile";

const ok = async () => ({ executiveSummary: "live" }) as any;
const hang = () => new Promise<never>(() => {});
const boom = async () => { throw new Error("network"); };

describe("useProfile", () => {
  it("reaches ready on success", async () => {
    const p = useProfile({ role: "default", lang: "en" }, { client: ok });
    await p.fetchProfile();
    expect(p.status.value).toBe("ready");
    expect((p.profile.value as any).executiveSummary).toBe("live");
  });

  it("degrades to static fallback on rejection", async () => {
    const p = useProfile({ role: "anthropic_dx", lang: "fr" }, { client: boom });
    await p.fetchProfile();
    expect(p.status.value).toBe("degraded");
    expect(typeof (p.profile.value as any).executiveSummary).toBe("string");
    expect((p.profile.value as any).executiveSummary.length).toBeGreaterThan(0);
  });

  it("degrades on TIMEOUT (hanging fetch, injected 10ms budget)", async () => {
    const p = useProfile({ role: "iot", lang: "de" }, { client: hang as any, timeoutMs: 10 });
    await p.fetchProfile();
    expect(p.status.value).toBe("degraded");
  });

  it("retry returns to ready when the API recovers", async () => {
    let calls = 0;
    const flaky = async (r: any, l: any) => { calls++; if (calls === 1) throw new Error("down"); return ok(); };
    const p = useProfile({ role: "default", lang: "en" }, { client: flaky });
    await p.fetchProfile();
    expect(p.status.value).toBe("degraded");
    await p.retry();
    expect(p.status.value).toBe("ready");
  });

  it("setRole re-fetches and records lastRequest", async () => {
    const p = useProfile({ role: "default", lang: "en" }, { client: ok });
    await p.setRole("iot");
    expect(p.lastRequest.value).toBe("/v1/profile/build?target_role=iot&lang=en");
  });
});
