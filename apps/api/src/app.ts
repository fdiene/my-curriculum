import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { TargetRole, type Tag } from "@profile/schema";
import { resume } from "./data";
import { resolveLocale } from "./locale";
import { localize } from "./localize";
import { orderByRole } from "./routing";
import { buildProfile } from "./profile";
import { getMetrics, recordLatency } from "./metrics";

const roleOf = (v?: string) =>
  (TargetRole.options as readonly string[]).includes(v ?? "") ? (v as any) : "default";

const ALLOWED_ORIGIN = process.env.WEB_ORIGIN ?? "https://fdiene.com";

// Localhost is only useful for local dev/testing; never allow it as a CORS origin in production.
const CORS_ORIGINS: (string | RegExp)[] =
  process.env.NODE_ENV !== "production"
    ? [ALLOWED_ORIGIN, /^http:\/\/localhost:\d+$/]
    : [ALLOWED_ORIGIN];

export const app = new Elysia()
  .use(cors({ origin: CORS_ORIGINS, methods: ["GET"], credentials: false }))
  .use(swagger({ path: "/swagger", documentation: { info: { title: "Profile Engine API", version: "1.0.0" } } }))
  .trace(async ({ onHandle }) => {
    onHandle(({ begin, onStop }) => onStop(({ end }) => recordLatency(end - begin)));
  })
  .get("/health", () => ({ status: "ok" }))
  .get("/v1/profile/build", ({ query, headers }) => {
    const lang = resolveLocale(query.lang, headers["accept-language"]);
    return buildProfile(roleOf(query.target_role), lang);
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
  .get("/v1/metrics", () => getMetrics());

export type App = typeof app;
