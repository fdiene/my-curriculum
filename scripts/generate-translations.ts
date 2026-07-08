import Anthropic from "@anthropic-ai/sdk";
import { ResumeSchema, type Lang, type ResumeInput } from "@profile/schema";
import { findMissingLocales, applyTranslations, type Translator } from "./translations.core";

const LANG_NAME: Record<Lang, string> = { en: "English", fr: "French", de: "German" };

// Deterministic glossary for terms that have recurred as mistranslations across
// regenerations (cert names / degree names the model can't disambiguate from
// bare strings). Exact matches short-circuit the API call entirely.
const GLOSSARY: Record<string, Partial<Record<Lang, string>>> = {
  "ISTQB Software Testing": { fr: "ISTQB Tests Logiciels", de: "ISTQB Softwaretests" },
  "Mechanical Engineering Degree": { fr: "Diplôme d'ingénieur mécanique", de: "Diplom-Ingenieur Maschinenbau" },
  "Master's in Information Systems Management": { fr: "Master Gestion des systèmes d'information", de: "Master in Informationssystemmanagement" },
};

// Substring hints for phrases embedded in longer text: appended to the system
// prompt rather than short-circuited, since the surrounding text still needs translation.
const PHRASE_HINTS: Record<string, Partial<Record<Lang, string>>> = {
  "Keep / Correct / Reject": { de: "Behalten / Korrigieren / Verwerfen" },
  "Judge Agent": { de: "Judge-Agent (decline the German ending as needed, e.g. dative 'Judge-Agenten')" },
};

/** Exact-match glossary lookup. Returns the canonical translation, or undefined on a miss. */
export function resolveGlossary(text: string, target: Lang): string | undefined {
  return GLOSSARY[text]?.[target];
}

/** Substring hint lookup: phrase-hint keys found inside `text` with a value for `target`. */
export function hintsFor(text: string, target: Lang): string[] {
  const hints: string[] = [];
  for (const [phrase, byLang] of Object.entries(PHRASE_HINTS)) {
    const value = byLang[target];
    if (value && text.includes(phrase)) {
      hints.push(`The phrase "${phrase}" must render as "${value}".`);
    }
  }
  return hints;
}

function anthropicTranslator(client: Anthropic): Translator {
  return async (text, target) => {
    const glossaryHit = resolveGlossary(text, target);
    if (glossaryHit !== undefined) return glossaryHit;

    const hints = hintsFor(text, target);
    const system =
      `You are a professional translator for a technical résumé. Translate the user's text into ${LANG_NAME[target]}. ` +
      `Preserve technical terms, product names, and proper nouns verbatim (e.g. Bun, LangGraph, Enovia, MCP). ` +
      `Translate job titles and degree names into idiomatic ${LANG_NAME[target]} conventions; never leave them in English. ` +
      `Use a consistent nominal style for CV bullet points. ` +
      `Never use the em dash character "—"; use ":" or "-" instead. ` +
      `Return ONLY the translated text, no quotes, no preamble.` +
      (hints.length ? ` ${hints.join(" ")}` : "");

    const msg = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      system,
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
