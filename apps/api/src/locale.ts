import { LANGS, type Lang } from "@profile/schema";

function isLang(v: string): v is Lang { return (LANGS as readonly string[]).includes(v); }

export function resolveLocale(query?: string | null, header?: string | null): Lang {
  if (query) {
    const normalized = query.trim().toLowerCase();
    if (isLang(normalized)) return normalized;
  }
  if (header) {
    for (const part of header.split(",")) {
      const code = part.split(";")[0]!.trim().slice(0, 2).toLowerCase();
      if (isLang(code)) return code;
    }
  }
  return "en";
}
