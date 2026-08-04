import type { Lang, Resume, TargetRole } from "@profile/schema";
import { buildProfile, type Profile } from "./buildProfile";
import { orderByRole } from "./routing";

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

export interface CvLabels {
  experience: string;
  projects: string;
  education: string;
  certifications: string;
  skills: string;
  present: string;
}

export const CV_LABELS: Record<Lang, CvLabels> = {
  en: { experience: "Experience", projects: "Independent Projects", education: "Education", certifications: "Certifications", skills: "Skills", present: "Present" },
  fr: { experience: "Expérience", projects: "Projets indépendants", education: "Formation", certifications: "Certifications", skills: "Compétences", present: "Présent" },
  de: { experience: "Berufserfahrung", projects: "Unabhängige Projekte", education: "Ausbildung", certifications: "Zertifizierungen", skills: "Kenntnisse", present: "Heute" },
};

const MAX_SKILLS = 15;
const MAX_PROJECTS = 3;

export interface CvView extends Profile {
  documentLabel: string;
  labels: CvLabels;
}

export function buildCvView(template: CvTemplateId, role: TargetRole, lang: Lang, data: Resume): CvView {
  const config = CV_TEMPLATES[template];
  const profile = buildProfile(role, lang, data);
  const skills = orderByRole(profile.skills, role).slice(0, MAX_SKILLS);
  const experiences = profile.experiences
    .slice(0, config.maxExperiences)
    .map((e) => ({ ...e, highlights: e.highlights.slice(0, config.maxHighlightsPerExperience) }))
    .sort((a, b) => b.period.start.localeCompare(a.period.start));

  return {
    ...profile,
    person: { ...profile.person, avatarUrl: config.photo ? profile.person.avatarUrl : undefined },
    experiences,
    projects: profile.projects.slice(0, MAX_PROJECTS),
    skills,
    documentLabel: config.documentLabel,
    labels: CV_LABELS[lang],
  };
}
