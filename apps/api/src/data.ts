import { isAbsolute, join } from "node:path";
import { readFileSync } from "node:fs";
import { ResumeSchema, type Resume } from "@profile/schema";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");

export function loadResume(path = "data/master_data.i18n.json"): Resume {
  const file = isAbsolute(path) ? path : join(REPO_ROOT, path);
  return ResumeSchema.parse(JSON.parse(readFileSync(file, "utf8")));
}

export const resume: Resume = loadResume();
