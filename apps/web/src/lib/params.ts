import { LANGS, type Lang, type TargetRole as Role } from "@profile/schema";

const ROLE_ALIASES: Record<string, Role> = {
  anthropic: "anthropic_dx", anthropic_dx: "anthropic_dx",
  iot: "iot", plm: "plm_architect", plm_architect: "plm_architect", default: "default",
};

export function parseViewParams(search: string): { role: Role; lang: Lang } {
  const q = new URLSearchParams(search);
  const role = ROLE_ALIASES[(q.get("role") ?? "").toLowerCase()] ?? "default";
  const rawLang = (q.get("lang") ?? "").toLowerCase();
  const lang = (LANGS as readonly string[]).includes(rawLang) ? (rawLang as Lang) : "en";
  return { role, lang };
}
