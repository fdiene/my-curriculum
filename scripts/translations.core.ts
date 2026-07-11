import { LANGS, type Lang, type ResumeInput } from "@profile/schema";

const OTHER: Lang[] = ["fr", "de"]; // en is the required anchor

/** A localized node is any object that has a string `en` and no non-locale keys. */
function isLocalized(v: unknown): v is Record<string, string> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const keys = Object.keys(v);
  if (!keys.includes("en")) return false;
  return keys.every((k) => (LANGS as readonly string[]).includes(k) && typeof (v as any)[k] === "string");
}

export interface MissingNode { path: string; en: string; missing: Lang[]; }

export function findMissingLocales(resume: ResumeInput): MissingNode[] {
  const out: MissingNode[] = [];
  const walk = (node: unknown, path: string) => {
    if (isLocalized(node)) {
      const missing = LANGS.filter((l) => typeof (node as any)[l] !== "string");
      if (missing.length) out.push({ path, en: (node as any).en, missing });
      return;
    }
    if (Array.isArray(node)) { node.forEach((v, i) => walk(v, `${path}[${i}]`)); return; }
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
    }
  };
  walk(resume, "");
  return out;
}

function setByPath(root: any, path: string, lang: Lang, value: string) {
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  let cur = root;
  for (let i = 0; i < parts.length; i++) cur = cur[parts[i]];
  cur[lang] = value;
}

export function applyTranslations(
  resume: ResumeInput,
  filled: Record<string, Partial<Record<Lang, string>>>,
): unknown {
  const clone = structuredClone(resume) as any;
  for (const [path, langs] of Object.entries(filled)) {
    for (const l of OTHER) { const v = langs[l]; if (typeof v === "string") setByPath(clone, path, l, v); }
  }
  return clone;
}

export type Translator = (text: string, target: Lang) => Promise<string>;
