import type { Lang, Resume, TargetRole } from "@profile/schema";
import { localize } from "./localize";
import { orderByRole } from "./routing";
import { yearsOfExperience, injectYears } from "./experience";

export interface Profile {
  person: unknown;
  executiveSummary: string;
  experiences: unknown;
  projects: unknown;
  skills: unknown;
  certifications: unknown;
  education: unknown;
  recommendations: unknown;
}

export function buildProfile(role: TargetRole, lang: Lang, data: Resume, now: Date = new Date()): Profile {
  const projects = orderByRole(data.projects, role);
  const experiences = orderByRole(data.experiences, role);
  const years = yearsOfExperience(data.experiences, now);
  return {
    person: localize(data.person, lang),
    executiveSummary: injectYears(data.executiveSummaries[role][lang], years),
    experiences: localize(experiences, lang),
    projects: localize(projects, lang),
    skills: localize(data.skills, lang),
    certifications: localize(data.certifications, lang),
    education: localize(data.education, lang),
    recommendations: localize(data.recommendations, lang),
  };
}
