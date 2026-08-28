import Anthropic from "@anthropic-ai/sdk";
import type { ScoredChunk } from "@profile/core";

const SYSTEM_PROMPT = "You answer questions about Fadel Diene's professional background using ONLY the context provided below. If the question is unrelated to Fadel's professional background, or the context does not support an answer, say clearly that you can only answer questions about Fadel's professional background and decline to speculate. Never invent information that is not present in the context. Keep answers to 2-4 sentences.";

// The Anthropic SDK's default client has a 10-minute timeout and 2 retries (each also
// subject to that timeout), which could hold a request open for a long time on a
// wedged call. Bound worst-case latency explicitly: 20s is generous for a real answer
// but short enough to keep /ask responsive, and 1 retry (down from the SDK default of
// 2) further bounds the worst case.
//
// Constructed lazily (not unconditionally at module load) and memoized, so the module
// can still be imported safely when ANTHROPIC_API_KEY is absent (local dev without the
// key, CI, the Docker build's model warmup step) without throwing at import time - the
// client is only ever actually built once app.ts's own apiKey guard has already
// confirmed a key is present, and in practice that's always the same env var, so a
// single module-level instance is reused for every call.
let client: Anthropic | null = null;

function getClient(apiKey: string): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey, timeout: 20_000, maxRetries: 1 });
  }
  return client;
}

export async function generateRagAnswer(question: string, chunks: ScoredChunk[], apiKey: string): Promise<string> {
  const anthropic = getClient(apiKey);
  const context = chunks.map((c) => `[${c.id}] ${c.text}`).join("\n\n");
  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 400,
    // Low effort: this is a narrow, retrieval-grounded Q&A task over ~3 pre-selected
    // resume chunks, not open-ended reasoning - the hard part (finding the right
    // facts) is already done by retrieval. Keeps thinking-token cost and latency down
    // while still using a materially more capable model than Haiku for the actual
    // generation quality.
    output_config: { effort: "low" },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Context:\n${context}\n\nQuestion: ${question}` }],
  });
  const textBlock = message.content.find((b) => b.type === "text");
  return textBlock ? textBlock.text : "I could not generate an answer.";
}
