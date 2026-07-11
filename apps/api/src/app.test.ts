import { describe, expect, it } from "bun:test";
import { app } from "./app";
import { latencySummary } from "./metrics";

async function get(path: string, headers?: Record<string, string>) {
  const res = await app.handle(new Request(`http://localhost${path}`, { headers }));
  return { status: res.status, body: await res.json() };
}

describe("routes", () => {
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
