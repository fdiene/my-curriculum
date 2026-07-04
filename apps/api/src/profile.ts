import type { Lang, Resume, TargetRole } from "@profile/schema";
import { resume as defaultResume } from "./data";
import { localize } from "./localize";
import { orderByRole } from "./routing";

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

export function buildProfile(role: TargetRole, lang: Lang, data: Resume = defaultResume): Profile {
  const projects = orderByRole(data.projects, role);
  const experiences = orderByRole(data.experiences, role);
  return {
    person: localize(data.person, lang),
    executiveSummary: data.executiveSummaries[role][lang],
    experiences: localize(experiences, lang),
    projects: localize(projects, lang),
    skills: localize(data.skills, lang),
    certifications: localize(data.certifications, lang),
    education: localize(data.education, lang),
    recommendations: localize(data.recommendations, lang),
  };
}
