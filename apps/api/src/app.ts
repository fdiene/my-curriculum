import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { TargetRole, type Tag } from "@profile/schema";
import { resume } from "./data";
import { resolveLocale } from "./locale";
import { localize, orderByRole, topKRelevant, isRelevant } from "@profile/core";
import { buildProfile } from "./profile";
import { getMetrics, recordLatency } from "./metrics";
import { toJsonResume } from "./resume";
import { embedText, warmEmbeddingModel } from "./embeddings";
import { generateRagAnswer } from "./generateRagAnswer";
import { RAG_INDEX } from "./ragIndex";
import { createRateLimiterState, checkAndRecordPerIp, checkGlobalDailyLimit, recordGlobalDailyUsage } from "./rateLimiter";

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

// These responses are pure functions of (role, lang) over data that only changes on
// redeploy, so they are safe to cache publicly: fast on repeat visits, and revalidated
// in the background rather than blocking once stale.
const RESUME_DATA_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=3600";

const rateLimiterState = createRateLimiterState();
const ASK_TOP_K = 3;
const ASK_MIN_LENGTH = 3;
const ASK_MAX_LENGTH = 500;
const ASK_DECLINE_MESSAGE = "I can only answer questions about Fadel's professional background, grounded in what's on this resume.";

void warmEmbeddingModel().catch((e) => console.error("embedding model warmup failed", e));

export const app = new Elysia()
  .use(cors({ origin: CORS_ORIGINS, methods: ["GET", "POST"], credentials: false }))
  .use(swagger({ path: "/swagger", documentation: { info: { title: "Profile Engine API", version: "1.0.0" } } }))
  .trace(async ({ context, onHandle }) => {
    // /ask legitimately takes seconds (local embedding + a real Claude API round trip),
    // unlike every other route here which serves local data in sub-millisecond time.
    // Folding it into the same rolling average would visibly drag the publicly
    // displayed latency metric away from what it actually claims to measure.
    if (context.path === "/ask") return;
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
      "/ask",
    ],
  }))
  .get("/health", () => ({ status: "ok" }))
  .get("/v1/profile/build", ({ query, headers, set }) => {
    const lang = resolveLocale(query.lang, headers["accept-language"]);
    set.headers["cache-control"] = RESUME_DATA_CACHE_CONTROL;
    return buildProfile(roleOf(query.target_role), lang);
  }, { query: t.Object({ target_role: t.Optional(t.String()), lang: t.Optional(t.String()) }) })
  .get("/resume.json", ({ query, headers, set }) => {
    const lang = resolveLocale(query.lang, headers["accept-language"]);
    const profile = buildProfile(roleOf(query.target_role), lang);
    set.headers["cache-control"] = RESUME_DATA_CACHE_CONTROL;
    return toJsonResume(profile);
  }, { query: t.Object({ target_role: t.Optional(t.String()), lang: t.Optional(t.String()) }) })
  .get("/v1/skills", ({ query, headers, set }) => {
    const lang = resolveLocale(query.lang, headers["accept-language"]);
    const filtered = query.tag ? resume.skills.filter((s) => s.tags.includes(query.tag as Tag)) : resume.skills;
    set.headers["cache-control"] = RESUME_DATA_CACHE_CONTROL;
    return localize(filtered, lang);
  }, { query: t.Object({ lang: t.Optional(t.String()), tag: t.Optional(t.String()) }) })
  .get("/v1/projects", ({ query, headers, set }) => {
    const lang = resolveLocale(query.lang, headers["accept-language"]);
    set.headers["cache-control"] = RESUME_DATA_CACHE_CONTROL;
    return localize(orderByRole(resume.projects, roleOf(query.role)), lang);
  }, { query: t.Object({ lang: t.Optional(t.String()), role: t.Optional(t.String()) }) })
  .get("/v1/projects/:id", ({ params, query, headers, set }) => {
    const lang = resolveLocale(query.lang, headers["accept-language"]);
    const project = resume.projects.find((p) => p.id === params.id);
    if (!project) { set.status = 404; return { error: "project_not_found" }; }
    set.headers["cache-control"] = RESUME_DATA_CACHE_CONTROL;
    return localize(project, lang);
  }, { query: t.Object({ lang: t.Optional(t.String()) }) })
  .get("/v1/metrics", () => getMetrics())
  .post("/ask", async ({ body, headers, set }) => {
    const question = body.question.trim();
    if (question.length < ASK_MIN_LENGTH || question.length > ASK_MAX_LENGTH) {
      set.status = 400;
      return { error: "invalid_question_length" };
    }
    if (!checkGlobalDailyLimit(rateLimiterState)) {
      return { answer: ASK_DECLINE_MESSAGE, sources: [] };
    }
    const ip = (headers["x-forwarded-for"] ?? "unknown").split(",")[0]!.trim();
    if (!checkAndRecordPerIp(rateLimiterState, ip)) {
      return { answer: ASK_DECLINE_MESSAGE, sources: [] };
    }
    try {
      const queryEmbedding = await embedText(question);
      const top = topKRelevant(queryEmbedding, RAG_INDEX, ASK_TOP_K);
      if (top.length === 0 || !isRelevant(top[0]!.score)) {
        return { answer: ASK_DECLINE_MESSAGE, sources: [] };
      }
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        set.status = 500;
        return { error: "server_misconfigured" };
      }
      const answer = await generateRagAnswer(question, top, apiKey);
      recordGlobalDailyUsage(rateLimiterState);
      return { answer, sources: top.map((c) => c.sourceId) };
    } catch (err) {
      // embedText or generateRagAnswer threw (network error, SDK timeout, etc). Log the
      // real error server-side, but respond with the same declined shape a client sees
      // for an off-topic question, at 200 - this avoids leaking SDK error text publicly
      // and avoids revealing that a request specifically reached the Claude call and
      // then failed. recordGlobalDailyUsage above is never reached on this path, so
      // usage stays recorded only after a genuinely successful Claude call.
      console.error("ask: request failed", err);
      set.status = 200;
      return { answer: ASK_DECLINE_MESSAGE, sources: [] };
    }
  }, { body: t.Object({ question: t.String() }) });

export type App = typeof app;
