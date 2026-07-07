import type { Lang, Resume, TargetRole } from "@profile/schema";
import { buildProfile as buildProfileCore, type Profile } from "@profile/core";
import { resume as defaultResume } from "./data";

export type { Profile };

export function buildProfile(role: TargetRole, lang: Lang, data: Resume = defaultResume): Profile {
  return buildProfileCore(role, lang, data);
}
