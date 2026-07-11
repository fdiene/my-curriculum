import { LANGS, type Lang } from "@profile/schema";

function isFullyLocalized(v: any): boolean {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const keys = Object.keys(v);
  return keys.length === LANGS.length && LANGS.every((l) => typeof v[l] === "string");
}

export function localize(node: unknown, lang: Lang): unknown {
  if (isFullyLocalized(node)) return (node as any)[lang];
  if (Array.isArray(node)) return node.map((v) => localize(v, lang));
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) out[k] = localize(v, lang);
    return out;
  }
  return node;
}
