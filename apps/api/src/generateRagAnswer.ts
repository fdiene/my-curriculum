import Anthropic from "@anthropic-ai/sdk";
import type { ScoredChunk } from "@profile/core";

const SYSTEM_PROMPT = "You answer questions about Fadel Diene's professional background using ONLY the context provided below. If the question is unrelated to Fadel's professional background, or the context does not support an answer, say clearly that you can only answer questions about Fadel's professional background and decline to speculate. Never invent information that is not present in the context. Keep answers to 2-4 sentences.";

export async function generateRagAnswer(question: string, chunks: ScoredChunk[], apiKey: string): Promise<string> {
  const client = new Anthropic({ apiKey });
  const context = chunks.map((c) => `[${c.id}] ${c.text}`).join("\n\n");
  const message = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Context:\n${context}\n\nQuestion: ${question}` }],
  });
  const textBlock = message.content.find((b) => b.type === "text");
  return textBlock ? textBlock.text : "I could not generate an answer.";
}
