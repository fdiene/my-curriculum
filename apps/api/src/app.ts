import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { TargetRole, type Tag } from "@profile/schema";
import { resume } from "./data";
import { resolveLocale } from "./locale";
import { localize, orderByRole } from "@profile/core";
import { buildProfile } from "./profile";
import { getMetrics, recordLatency } from "./metrics";
import { toJsonResume } from "./resume";

const roleOf = (v?: string) =>
  (TargetRole.options as readonly string[]).includes(v ?? "") ? (v as any) : "default";

const ALLOWED_ORIGIN = process.env.WEB_ORIGIN ?? "https://fdiene.com";

// Toggle the "www." prefix so both the bare and www hosts of the same site are allowed,
// since browsers treat them as distinct origins for CORS purposes.
function wwwVariant(origin: string): string {
  const match = origin.match(/^https:\/\/(www\.)?(.*)$/);
  if (!match) return origin;
  const [, hasWww, rest] = match;
  return hasWww ? `https://${rest}` : `https://www.${rest}`;
}

// Localhost is only useful for local dev/testing; never allow it as a CORS origin in production.
export function resolveCorsOrigins(webOrigin: string, nodeEnv: string | undefined): (string | RegExp)[] {
  return nodeEnv !== "production"
    ? [webOrigin, /^http:\/\/localhost:\d+$/]
    : [webOrigin, wwwVariant(webOrigin)];
}

const CORS_ORIGINS = resolveCorsOrigins(ALLOWED_ORIGIN, process.env.NODE_ENV);

export const app = new Elysia()
  .use(cors({ origin: CORS_ORIGINS, methods: ["GET"], credentials: false }))
  .use(swagger({ path: "/swagger", documentation: { info: { title: "Profile Engine API", version: "1.0.0" } } }))
  .trace(async ({ onHandle }) => {
    onHandle(({ begin, onStop }) => onStop(({ end }) => recordLatency(end - begin)));
  })
  .get("/", () => ({
    name: "Fadel Diène : Profile Engine API",
    docs: "/swagger",
    endpoints: [
      "/health",
      "/v1/profile/build",
      "/v1/skills",
      "/v1/projects",
      "/v1/projects/:id",
      "/v1/metrics",
      "/resume.json",
    ],
  }))
  .get("/health", () => ({ status: "ok" }))
  .get("/v1/profile/build", ({ query, headers }) => {
    const lang = resolveLocale(query.lang, headers["accept-language"]);
    return buildProfile(roleOf(query.target_role), lang);
  }, { query: t.Object({ target_role: t.Optional(t.String()), lang: t.Optional(t.String()) }) })
  .get("/resume.json", ({ query, headers }) => {
    const lang = resolveLocale(query.lang, headers["accept-language"]);
    const profile = buildProfile(roleOf(query.target_role), lang);
    return toJsonResume(profile);
  }, { query: t.Object({ target_role: t.Optional(t.String()), lang: t.Optional(t.String()) }) })
  .get("/v1/skills", ({ query, headers }) => {
    const lang = resolveLocale(query.lang, headers["accept-language"]);
    const filtered = query.tag ? resume.skills.filter((s) => s.tags.includes(query.tag as Tag)) : resume.skills;
    return localize(filtered, lang);
  }, { query: t.Object({ lang: t.Optional(t.String()), tag: t.Optional(t.String()) }) })
  .get("/v1/projects", ({ query, headers }) => {
    const lang = resolveLocale(query.lang, headers["accept-language"]);
    return localize(orderByRole(resume.projects, roleOf(query.role)), lang);
  }, { query: t.Object({ lang: t.Optional(t.String()), role: t.Optional(t.String()) }) })
  .get("/v1/projects/:id", ({ params, query, headers, set }) => {
    const lang = resolveLocale(query.lang, headers["accept-language"]);
    const project = resume.projects.find((p) => p.id === params.id);
    if (!project) { set.status = 404; return { error: "project_not_found" }; }
    return localize(project, lang);
  }, { query: t.Object({ lang: t.Optional(t.String()) }) })
  .get("/v1/metrics", () => getMetrics());

export type App = typeof app;
