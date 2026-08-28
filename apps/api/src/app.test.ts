import { describe, expect, it } from "bun:test";
import { app, resolveCorsOrigins } from "./app";
import { latencySummary } from "./metrics";

async function get(path: string, headers?: Record<string, string>) {
  const res = await app.handle(new Request(`http://localhost${path}`, { headers }));
  return { status: res.status, body: await res.json(), headers: res.headers };
}

describe("resolveCorsOrigins", () => {
  it("allows both the bare and www hosts in production, given a bare configured origin", () => {
    expect(resolveCorsOrigins("https://fdiene.com", "production")).toEqual([
      "https://fdiene.com",
      "https://www.fdiene.com",
    ]);
  });

  it("allows both the bare and www hosts in production, given a www configured origin", () => {
    expect(resolveCorsOrigins("https://www.fdiene.com", "production")).toEqual([
      "https://www.fdiene.com",
      "https://fdiene.com",
    ]);
  });

  it("allows localhost instead of the www variant outside production", () => {
    const origins = resolveCorsOrigins("https://fdiene.com", "development");
    expect(origins[0]).toBe("https://fdiene.com");
    expect(origins[1]).toBeInstanceOf(RegExp);
    expect((origins[1] as RegExp).test("http://localhost:4321")).toBe(true);
  });
});

describe("routes", () => {
  it("GET / returns a welcome index with docs link and endpoint list", async () => {
    const { status, body } = await get("/");
    expect(status).toBe(200);
    expect(typeof body.name).toBe("string");
    expect(body.docs).toBe("/swagger");
    expect(Array.isArray(body.endpoints)).toBe(true);
    expect(body.endpoints).toContain("/health");
    expect(body.endpoints).toContain("/v1/profile/build");
  });
  it("GET /health", async () => {
    expect((await get("/health")).body).toEqual({ status: "ok" });
  });
  it("GET /v1/profile/build applies role + lang", async () => {
    const { status, body } = await get("/v1/profile/build?target_role=ai_dx&lang=fr");
    expect(status).toBe(200);
    expect(body.projects[body.projects.length - 1].id).toBe("omnis");
    expect(typeof body.executiveSummary).toBe("string");
  });
  it("GET /v1/profile/build uses Accept-Language when no query", async () => {
    const { body } = await get("/v1/profile/build", { "Accept-Language": "de-DE,de;q=0.9" });
    expect(typeof body.person.title).toBe("string");
  });
  it("GET /v1/skills?tag= filters", async () => {
    const { body } = await get("/v1/skills?lang=en&tag=dx_tooling");
    expect(body.every((s: any) => s.tags.includes("dx_tooling"))).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });
  it("GET /v1/projects?role= orders", async () => {
    const { body } = await get("/v1/projects?role=iot&lang=en");
    expect(body[0].id).toBe("omnis-agri");
  });
  it("GET /v1/metrics returns the shape", async () => {
    const { body } = await get("/v1/metrics");
    expect(body).toHaveProperty("latency");
    expect(body).toHaveProperty("commits");
    expect(body).toHaveProperty("uptime_pct");
  });
  it("records latency samples for handled requests", async () => {
    await get("/health");
    await get("/health");
    expect(latencySummary().count).toBeGreaterThan(0);
  });
  it("GET /v1/projects/:id returns the localized project", async () => {
    const { status, body } = await get("/v1/projects/profile-engine?lang=fr");
    expect(status).toBe(200);
    expect(body.id).toBe("profile-engine");
    expect(typeof body.tagline).toBe("string");
  });
  it("GET /v1/projects/:id 404s cleanly on unknown id", async () => {
    const { status, body } = await get("/v1/projects/nope");
    expect(status).toBe(404);
    expect(body.error).toBe("project_not_found");
  });
});

describe("cache headers", () => {
  const CACHEABLE_PATHS = [
    "/v1/profile/build",
    "/resume.json",
    "/v1/skills",
    "/v1/projects",
    "/v1/projects/profile-engine",
  ];

  for (const path of CACHEABLE_PATHS) {
    it(`GET ${path} is publicly cacheable with stale-while-revalidate`, async () => {
      const { headers } = await get(path);
      const cacheControl = headers.get("cache-control");
      expect(cacheControl).toContain("public");
      expect(cacheControl).toContain("stale-while-revalidate");
    });
  }

  it("GET /v1/projects/:id 404 is not cached", async () => {
    const { headers } = await get("/v1/projects/nope");
    expect(headers.get("cache-control")).toBeNull();
  });

  it("GET /health and /v1/metrics are not cached (real-time data)", async () => {
    expect((await get("/health")).headers.get("cache-control")).toBeNull();
    expect((await get("/v1/metrics")).headers.get("cache-control")).toBeNull();
  });
});

const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY);

describe("POST /ask", () => {
  async function ask(question: string, headers?: Record<string, string>) {
    const res = await app.handle(
      new Request("http://localhost/ask", {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify({ question }),
      }),
    );
    return { status: res.status, body: await res.json() };
  }

  it("rejects a too-short question with 400", async () => {
    const { status } = await ask("hi");
    expect(status).toBe(400);
  });

  it("rejects a too-long question with 400", async () => {
    const { status } = await ask("a".repeat(501));
    expect(status).toBe(400);
  });

  it("declines an off-topic question without an error status", async () => {
    const { status, body } = await ask("What is the capital of France?");
    expect(status).toBe(200);
    expect(body.sources).toEqual([]);
    expect(typeof body.answer).toBe("string");
  });

  it.skipIf(!hasApiKey)("answers a genuinely relevant question with sources", async () => {
    const { status, body } = await ask("What experience does Fadel have with identity and access management?");
    expect(status).toBe(200);
    expect(Array.isArray(body.sources)).toBe(true);
    expect(body.sources.length).toBeGreaterThan(0);
    expect(typeof body.answer).toBe("string");
    expect(body.answer.length).toBeGreaterThan(0);
  });
});
