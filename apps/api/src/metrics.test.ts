import { describe, expect, it, afterEach } from "bun:test";
import { recordLatency, latencySummary, fetchCommitCount, getMetrics } from "./metrics";

describe("latency", () => {
  it("summarizes recorded samples", () => {
    for (const ms of [10, 20, 30, 40]) recordLatency(ms);
    const s = latencySummary();
    expect(s.count).toBeGreaterThanOrEqual(4);
    expect(s.avg_ms).toBeGreaterThan(0);
  });
});

describe("fetchCommitCount", () => {
  afterEach(() => {
    delete process.env.GITHUB_REPO;
    delete process.env.GITHUB_TOKEN;
  });

  it("parses the GitHub Link header for the last page number", async () => {
    const fakeFetch = (async () => new Response("[]", {
      headers: { Link: '<https://api.github.com/x?page=2>; rel="next", <https://api.github.com/x?page=7>; rel="last"' },
    })) as unknown as typeof fetch;
    process.env.GITHUB_REPO = "fdiene/my-curriculum";
    expect(await fetchCommitCount(fakeFetch)).toBe(7);
  });
  it("returns 0 when the request throws", async () => {
    const boom = (async () => { throw new Error("network"); }) as unknown as typeof fetch;
    expect(await fetchCommitCount(boom)).toBe(0);
  });
  it("returns 0 without parsing the body when the response is not ok", async () => {
    process.env.GITHUB_REPO = "test/not-ok-repo";
    const notOk = (async () => new Response(JSON.stringify({ message: "rate limited" }), {
      status: 403,
      headers: { Link: '<https://api.github.com/x?page=99>; rel="last"' },
    })) as unknown as typeof fetch;
    expect(await fetchCommitCount(notOk)).toBe(0);
  });
  it("serves the cached count within the TTL window without calling fetch again", async () => {
    process.env.GITHUB_REPO = "test/ttl-hit-repo";
    let secondCallCount = 0;
    const first = (async () => new Response("[]", {
      headers: { Link: '<https://api.github.com/x?page=2>; rel="next", <https://api.github.com/x?page=3>; rel="last"' },
    })) as unknown as typeof fetch;
    const second = (async () => {
      secondCallCount++;
      return new Response("[]", { headers: { Link: '<https://api.github.com/x?page=999>; rel="last"' } });
    }) as unknown as typeof fetch;

    expect(await fetchCommitCount(first)).toBe(3);
    expect(await fetchCommitCount(second)).toBe(3);
    expect(secondCallCount).toBe(0);
  });
  it("sends an Authorization header only when GITHUB_TOKEN is set", async () => {
    process.env.GITHUB_REPO = "test/auth-repo";
    process.env.GITHUB_TOKEN = "secret-token";
    let capturedHeaders: Record<string, string> | undefined;
    const capture = (async (_url: string, init?: RequestInit) => {
      capturedHeaders = init?.headers as Record<string, string>;
      return new Response("[]", { headers: { Link: '<https://api.github.com/x?page=1>; rel="last"' } });
    }) as unknown as typeof fetch;
    await fetchCommitCount(capture);
    expect(capturedHeaders?.Authorization).toBe("Bearer secret-token");
  });
  it("omits the Authorization header when GITHUB_TOKEN is not set", async () => {
    process.env.GITHUB_REPO = "test/no-auth-repo";
    let capturedHeaders: Record<string, string> | undefined;
    const capture = (async (_url: string, init?: RequestInit) => {
      capturedHeaders = init?.headers as Record<string, string>;
      return new Response("[]", { headers: { Link: '<https://api.github.com/x?page=1>; rel="last"' } });
    }) as unknown as typeof fetch;
    await fetchCommitCount(capture);
    expect(capturedHeaders?.Authorization).toBeUndefined();
    expect(capturedHeaders?.["User-Agent"]).toBe("profile-engine");
  });
});

describe("getMetrics", () => {
  afterEach(() => {
    delete process.env.GITHUB_REPO;
    delete process.env.UPTIME_PCT;
  });

  it("aggregates latency summary, commit count and uptime_pct", async () => {
    process.env.GITHUB_REPO = "test/agg-repo";
    process.env.UPTIME_PCT = "97.5";
    const fake = (async () => new Response("[]", {
      headers: { Link: '<https://api.github.com/x?page=4>; rel="last"' },
    })) as unknown as typeof fetch;
    const m = await getMetrics(fake);
    expect(m.commits).toBe(4);
    expect(m.uptime_pct).toBe(97.5);
    expect(m.latency).toEqual(latencySummary());
  });

  it("defaults uptime_pct to 99.9 when UPTIME_PCT is not set", async () => {
    process.env.GITHUB_REPO = "test/agg-default-repo";
    const fake = (async () => new Response("[]", { headers: {} })) as unknown as typeof fetch;
    const m = await getMetrics(fake);
    expect(m.uptime_pct).toBe(99.9);
  });
});
