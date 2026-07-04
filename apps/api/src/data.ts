import { readFileSync } from "node:fs";
import { ResumeSchema, type Resume } from "@profile/schema";

export function loadResume(path = "data/master_data.i18n.json"): Resume {
  const json = JSON.parse(readFileSync(path, "utf8"));
  return ResumeSchema.parse(json);
}

export const resume: Resume = loadResume();
