import { z } from "zod";

export const LANGS = ["en", "fr", "de"] as const;
export type Lang = (typeof LANGS)[number];

/** Final, API-facing localized value: all three languages required. */
export const Localized = z.object({
  en: z.string(),
  fr: z.string(),
  de: z.string(),
}).strict();
export type Localized = z.infer<typeof Localized>;

/** Canonical source value: de may be filled later by the translation pipeline. */
export const LocalizedInput = z.object({
  en: z.string(),
  fr: z.string(),
  de: z.string().optional(),
}).strict();
export type LocalizedInput = z.infer<typeof LocalizedInput>;

/** Recursively replaces every `Localized` leaf in T with `string`, mirroring what `localize()` does at runtime. */
export type LocalizeDeep<T> = T extends Record<Lang, string>
  ? string
  : T extends Array<infer U>
  ? LocalizeDeep<U>[]
  : T extends object
  ? { [K in keyof T]: LocalizeDeep<T[K]> }
  : T;
