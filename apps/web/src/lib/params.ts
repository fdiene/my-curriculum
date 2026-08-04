import { LANGS, type Lang, type TargetRole as Role } from "@profile/schema";
import { CV_TEMPLATES, type CvTemplateId } from "@profile/core";

const ROLE_ALIASES: Record<string, Role> = {
  anthropic: "ai_dx", ai: "ai_dx", ai_dx: "ai_dx",
  iot: "iot", plm: "plm_architect", plm_architect: "plm_architect", default: "default",
};

export function parseViewParams(search: string): { role: Role; lang: Lang } {
  const q = new URLSearchParams(search);
  const role = ROLE_ALIASES[(q.get("role") ?? "").toLowerCase()] ?? "default";
  const rawLang = (q.get("lang") ?? "").toLowerCase();
  const lang = (LANGS as readonly string[]).includes(rawLang) ? (rawLang as Lang) : "en";
  return { role, lang };
}

const LANG_TO_DEFAULT_TEMPLATE: Record<Lang, CvTemplateId> = { fr: "fr", de: "ch", en: "us" };

export function parseCvParams(search: string): { role: Role; lang: Lang; template: CvTemplateId } {
  const { role, lang } = parseViewParams(search);
  const rawTemplate = (new URLSearchParams(search).get("template") ?? "").toLowerCase();
  const template = rawTemplate in CV_TEMPLATES ? (rawTemplate as CvTemplateId) : LANG_TO_DEFAULT_TEMPLATE[lang];
  return { role, lang, template };
}
