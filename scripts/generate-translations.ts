import Anthropic from "@anthropic-ai/sdk";
import { ResumeSchema, type Lang, type ResumeInput } from "@profile/schema";
import { findMissingLocales, applyTranslations, type Translator } from "./translations.core";

const LANG_NAME: Record<Lang, string> = { en: "English", fr: "French", de: "German" };

function anthropicTranslator(client: Anthropic): Translator {
  return async (text, target) => {
    const msg = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      system:
        `You are a professional translator for a technical résumé. Translate the user's text into ${LANG_NAME[target]}. ` +
        `Preserve technical terms, product names, and proper nouns verbatim (e.g. Bun, LangGraph, Enovia, MCP). ` +
        `Return ONLY the translated text, no quotes, no preamble.`,
      messages: [{ role: "user", content: text }],
    });
    const block = msg.content.find((b) => b.type === "text");
    return block && block.type === "text" ? block.text.trim() : text;
  };
}

export async function run(resume: ResumeInput, translate: Translator) {
  const missing = findMissingLocales(resume);
  const filled: Record<string, Partial<Record<Lang, string>>> = {};
  for (const node of missing) {
    filled[node.path] = {};
    for (const lang of node.missing) filled[node.path]![lang] = await translate(node.en, lang);
  }
  const merged = applyTranslations(resume, filled);
  return ResumeSchema.parse(merged); // throws if any locale still missing
}

if (import.meta.main) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { console.error("ANTHROPIC_API_KEY is required"); process.exit(1); }
  const src = (await Bun.file("data/master_data.fr.json").json()) as ResumeInput;
  const client = new Anthropic({ apiKey: key });
  const final = await run(src, anthropicTranslator(client));
  await Bun.write("data/master_data.i18n.json", JSON.stringify(final, null, 2));
  console.log("Wrote data/master_data.i18n.json");
}
