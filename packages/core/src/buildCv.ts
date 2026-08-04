import type { Lang, Resume, TargetRole } from "@profile/schema";
import { buildProfile, type Profile } from "./buildProfile";
import { orderByRole } from "./routing";
import { localize } from "./localize";

export type CvTemplateId = "fr" | "ch" | "us";

export interface CvTemplateConfig {
  photo: boolean;
  maxExperiences: number;
  maxHighlightsPerExperience: number;
  documentLabel: string;
}

export const CV_TEMPLATES: Record<CvTemplateId, CvTemplateConfig> = {
  fr: { photo: false, maxExperiences: 4, maxHighlightsPerExperience: 3, documentLabel: "Curriculum Vitae" },
  ch: { photo: true, maxExperiences: 5, maxHighlightsPerExperience: 4, documentLabel: "Curriculum Vitae" },
  us: { photo: false, maxExperiences: 3, maxHighlightsPerExperience: 2, documentLabel: "Resume" },
};

const MAX_SKILLS = 15;
const MAX_PROJECTS = 3;

export interface CvView extends Profile {
  documentLabel: string;
}

export function buildCvView(template: CvTemplateId, role: TargetRole, lang: Lang, data: Resume): CvView {
  const config = CV_TEMPLATES[template];
  const profile = buildProfile(role, lang, data);
  const skills = localize(orderByRole(data.skills, role), lang).slice(0, MAX_SKILLS);
  const experiences = profile.experiences
    .slice(0, config.maxExperiences)
    .map((e) => ({ ...e, highlights: e.highlights.slice(0, config.maxHighlightsPerExperience) }));

  return {
    ...profile,
    person: { ...profile.person, avatarUrl: config.photo ? profile.person.avatarUrl : undefined },
    experiences,
    projects: profile.projects.slice(0, MAX_PROJECTS),
    skills,
    documentLabel: config.documentLabel,
  };
}
