import { describe, expect, it, afterEach } from "bun:test";
import { recordLatency, latencySummary, fetchCommitCount } from "./metrics";

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
});
