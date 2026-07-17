import type { Lang, LocalizeDeep, Resume, TargetRole } from "@profile/schema";
import { localize } from "./localize";
import { orderByRole } from "./routing";
import { yearsOfExperience, injectYears } from "./experience";

export interface Profile {
  person: LocalizeDeep<Resume["person"]>;
  executiveSummary: string;
  experiences: LocalizeDeep<Resume["experiences"]>;
  projects: LocalizeDeep<Resume["projects"]>;
  skills: LocalizeDeep<Resume["skills"]>;
  certifications: LocalizeDeep<Resume["certifications"]>;
  education: LocalizeDeep<Resume["education"]>;
  recommendations: LocalizeDeep<Resume["recommendations"]>;
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
