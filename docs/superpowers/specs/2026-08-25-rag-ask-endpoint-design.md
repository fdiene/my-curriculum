# RAG "/ask" Endpoint - Design Spec

Date: 2026-08-25
Status: Approved by owner, ready for planning

## Problem

Every job application this session has honestly flagged the same gap: no RAG (retrieval-augmented generation) pipeline. The tool-use pattern already shipped in `career-advisor.ts` (structured output + `web_search`) is real but is not RAG - it grounds generation in live web search, not in a pre-indexed corpus with semantic retrieval. This feature closes that gap with a genuine, live, publicly-verifiable artifact rather than a disconnected toy demo: a `/ask` endpoint on the actual production API that lets a visitor (a recruiter, for instance) ask a natural-language question about Fadel's professional background and get an answer grounded in retrieved chunks of the real resume data, with the retrieved sources shown.

## Scope

**In scope:**
- An offline indexing script that chunks `data/master_data.i18n.json` and embeds each chunk with a locally-run embedding model, producing a committed, generated `data/rag_index.json` artifact (same pattern as `master_data.i18n.json` itself).
- A new `POST /ask` route on `apps/api` that: validates the question, does a free local relevance pre-filter, retrieves the top-K matching chunks by cosine similarity, and (only if relevance clears the bar) calls `claude-haiku-4-5` with a strictly-scoped system prompt to answer from the retrieved context, returning both the answer and the cited chunk IDs.
- Multi-layered cost/abuse protection: relevance pre-filter (free), input length validation, per-IP rate limiting, and a global daily hard cap that stops all further Claude calls once reached.
- A small "ask" UI panel on the terminal page (`Terminal.vue`), in the existing visual language, submitting to `/ask` and displaying the answer with its cited sources.

**Explicitly out of scope (rejected during design, not deferred):**
- **Hosted embeddings (Voyage AI or similar).** Owner chose a locally-run embedding model instead - zero new API key, zero new paid vendor, consistent with the project's established "no heavy dependencies" preference (native `Intl.DateTimeFormat` over `date-fns` earlier this session is the same instinct applied again).
- **Multi-language indexing.** The corpus is indexed in English only. Triplicating embedding work for a corpus this small (~30-60 chunks) for three languages is not worth the complexity; the generation step can and will answer in whatever language the visitor's question is written in, regardless of the source chunk's language.
- **CAPTCHA / human-verification (e.g., Cloudflare Turnstile).** The gold-standard bot defense, deliberately left out per YAGNI - it's real added complexity and UX friction against a currently hypothetical threat. Revisit specifically if abuse actually shows up in logs, not preemptively.
- **Persisting conversation history / multi-turn chat.** Each question is answered independently, no session state. A multi-turn "ask" experience is a different, larger feature.
- **Streaming responses.** Non-streaming is simpler and sufficient for a short grounded Q&A; can be added later if latency becomes a real UX problem.

## Architecture

### Offline indexing (`scripts/generate-rag-index.ts`)

Follows the exact pattern of `scripts/generate-translations.ts`: a manually-run, idempotent script whose output is a committed, generated data file, not something computed at request time.

1. Reads `data/master_data.i18n.json` **only**. Reading any other file, especially anything under `docs/applications/` or the git-ignored `career_insights.md`/`career_telemetry.jsonl`, is out of bounds - see Hard Constraints.
2. Builds one chunk per experience (`role.en` + `org` + `summary.en` + joined `highlights.en`) and one chunk per project (`name` + `tagline.en` + `description.en` + `details.en` where present).
3. Embeds each chunk's text with the locally-run embedding model (loaded once per script run).
4. Writes `data/rag_index.json`: an array of `{ id: string, sourceType: "experience" | "project", sourceId: string, text: string, embedding: number[] }`.

### Runtime (`POST /ask` on `apps/api`)

Request: `{ question: string }`. Response (success): `{ answer: string, sources: string[] }` (source IDs referencing experience/project IDs). Response (declined): `{ answer: string, sources: [] }` with a fixed "I can only answer questions about Fadel's professional background" message - same shape either way, so the frontend doesn't need to special-case rejection.

Pipeline, in order:

1. **Input validation.** Reject (400) if the question is empty, whitespace-only, or exceeds a hard max length (protects against both empty-spam and prompt-stuffing to inflate token cost within quota).
2. **Global daily cap check.** Limit: 200 successful Claude calls per rolling 24 hours (a trivial real cost at Haiku pricing for legitimate traffic; the point is capping the worst case, not limiting normal use). If the day's budget is already spent, return the declined-shape response immediately with zero further work. This is checked first because it's the cheapest possible short-circuit.
3. **Per-IP rate limit check.** In-memory, keyed by `x-forwarded-for` (Traefik sits in front of this API in production, so the real client IP arrives via that header, not the socket's remote address). Limit: 10 requests per IP per rolling hour. Exceeding the limit returns the declined-shape response.
4. **Embed the question** with the same local embedding model used for indexing (loaded once at API container startup, held in memory for the process lifetime).
5. **Cosine similarity search** against the in-memory `rag_index.json` chunks, take the top-K.
6. **Relevance pre-filter (Layer 0 cost control).** If the best-matching chunk's similarity score is below a fixed threshold, the question is judged off-topic or unsupported by the corpus - return the declined-shape response **without calling Claude**. This is the single highest-leverage protection: it is free (already-computed similarity scores), and it rejects the large majority of bot noise, off-topic questions, and adversarial probing before any paid call happens. The exact threshold value is a property of the chosen embedding model's score distribution, not a design decision that can be picked in the abstract - it must be determined empirically during implementation (compute similarity scores for a handful of known-relevant and known-irrelevant real questions against the real corpus, then set the threshold between those two clusters) and recorded as a named constant with that reasoning in a comment, not left as a bare magic number.
7. **Generate the answer.** Only past this point does a real Claude call happen: `claude-haiku-4-5`, given the top-K retrieved chunks as context and a system prompt that strictly scopes it to answering from that context about Fadel's professional background, explicitly instructed to decline anything the context doesn't support. Increment the global daily counter on a successful call.
8. **Return** the answer plus the source chunk IDs that were retrieved and used.

### Frontend (`Terminal.vue` addition)

A small ask panel, styled consistently with the existing terminal aesthetic (matching `ConsolePane.vue`'s visual language), with a text input and submit, POSTing to `/ask` and rendering the returned answer with its cited sources shown (e.g., as small linked badges referencing the project/experience, reinforcing that this is real retrieval, not a canned response).

## Hard constraints

- **The indexing script reads `data/master_data.i18n.json` and nothing else.** No file under `docs/applications/` (private job-application drafts), `docs/career_insights.md`, or `docs/career_telemetry.jsonl` may ever be read by the indexing pipeline. These are private, git-ignored, personal materials; indexing them into a now-public, queryable endpoint would be a real privacy breach, not a style violation. This must be enforced by construction (the script only ever opens the one named file), not by convention alone.
- **No fabricated content.** The endpoint can only ever surface what's already true and public elsewhere on the site (same underlying `master_data.i18n.json`). It does not get to introduce new claims.
- **The relevance pre-filter and rate limits are not optional polish.** They are the cost-control mechanism for a now-non-free public endpoint and must ship in the same change as the endpoint itself, not as a follow-up.
- **This is a deliberate, documented exception to "zero LLM calls at runtime."** The rest of the site's architecture claim stands for every other endpoint; `/ask` is the one explicit exception, and should be described as such wherever the site's architecture is documented (e.g., if `/resume.json`'s own description or the Profile Engine project entry is updated later to mention `/ask`, it must not silently contradict the "zero LLM calls at runtime" claim - it should name the exception explicitly).
- Never use the em dash character "-" in any code, comment, or generated content - use ":" or "-" instead.

## Data flow

```
Offline (manual, committed artifact):
  data/master_data.i18n.json -> chunk builder -> local embedding model -> data/rag_index.json

Runtime (per request to POST /ask):
  question
    -> input validation
    -> global daily cap check (cheapest short-circuit first)
    -> per-IP rate limit check
    -> local embedding model (same model as indexing)
    -> cosine similarity vs. rag_index.json (in-memory)
    -> relevance threshold check (free short-circuit - Layer 0 cost control)
    -> [only if relevant] claude-haiku-4-5 call, scoped system prompt, context = top-K chunks
    -> { answer, sources }
```

## Testing

Following the project's existing convention (pure logic gets unit tests; thin API/CLI wiring does not):

- **Chunk-building logic** (turning a `Resume` into the array of `{sourceType, sourceId, text}` chunks, before embedding): pure, tested in a `.core.ts` file, using the same synthetic `makeResume()`-style fixture pattern as `buildCv.test.ts`.
- **Cosine similarity + top-K selection**: pure, tested with synthetic vectors (no real embedding model needed for this part - fixed numeric arrays are enough to verify the ranking logic is correct).
- **Relevance threshold logic**: pure, tested - given a similarity score and the fixed threshold, does it correctly decide relevant vs. not.
- **Rate limiter (per-IP window + global daily cap)**: pure, tested with an injectable clock (same pattern as `buildTelemetryLine`'s injectable `now` parameter elsewhere in this codebase), so tests don't depend on real wall-clock time.
- **The actual embedding model invocation, the Claude API call, and the Elysia route wiring**: thin, untested wiring - same convention as `career-advisor.ts` (untested CLI wrapper around tested `.core.ts` logic) and the rest of `apps/api/src/app.ts`'s route handlers, which are exercised via `app.test.ts`'s integration-style `app.handle()` tests rather than unit tests. `/ask` should get the same integration-test treatment as the other routes there (with the embedding model and Claude call mocked/injected for the test, matching how `useProfile.test.ts` injects a fake `client` rather than hitting the real API).

## Risks / limitations (stated up front, not discovered later)

- **Local embedding model quality is lower than a hosted embeddings API** (Voyage AI, OpenAI). For a corpus this small and domain-specific (one person's resume), this is an acceptable tradeoff, but it means retrieval relevance may occasionally be worse than a "correct" RAG-benchmark setup would produce. This is a known, accepted limitation, not a bug to chase.
- **In-memory rate limiting and the daily cap reset on every redeploy/restart.** Acceptable at this scale (personal site, infrequent redeploys), but it means a redeploy timed adversarially could theoretically reset an attacker's exhausted quota. The account-level spending cap (set directly on the Anthropic console, not in code) is the real backstop against this, and should be configured as part of shipping this feature, not as an afterthought.
- **The embedding model adds to the API's Docker image size and container memory footprint** (model weights bundled into the image, loaded into memory at startup). Expected to be modest (typical small local embedding models are tens of megabytes), but should be verified during implementation, not assumed.
- **Docker image build for `apps/api` may need a new dependency** (the local embedding library and its model asset). This is the one place this feature adds a real new dependency to the project, despite the "no heavy dependencies" framing elsewhere - unavoidable, since *some* mechanism has to produce embeddings, and the alternative (a hosted API) was explicitly rejected in favor of this tradeoff.
