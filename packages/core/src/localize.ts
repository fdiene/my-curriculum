import { LANGS, type Lang, type LocalizeDeep } from "@profile/schema";

function isFullyLocalized(v: unknown): v is Record<Lang, string> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const keys = Object.keys(v);
  return keys.length === LANGS.length && LANGS.every((l) => typeof (v as Record<string, unknown>)[l] === "string");
}

function localizeUnknown(node: unknown, lang: Lang): unknown {
  if (isFullyLocalized(node)) return node[lang];
  if (Array.isArray(node)) return node.map((v) => localizeUnknown(v, lang));
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) out[k] = localizeUnknown(v, lang);
    return out;
  }
  return node;
}

export function localize<T>(node: T, lang: Lang): LocalizeDeep<T> {
  return localizeUnknown(node, lang) as LocalizeDeep<T>;
}
