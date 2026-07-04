import { z, type ZodType } from "zod";
import { Localized, LocalizedInput } from "./localized";
import { TargetRole } from "./enums";
import { buildEntities } from "./entities";

// Single shared instance for final entity schemas
const finalEntities = buildEntities(Localized);

// Export named final entity schemas
export const PersonSchema = finalEntities.Person;
export const ExperienceSchema = finalEntities.Experience;
export const ProjectSchema = finalEntities.Project;
export const SkillSchema = finalEntities.Skill;
export const CertificationSchema = finalEntities.Certification;
export const EducationSchema = finalEntities.Education;
export const RecommendationSchema = finalEntities.Recommendation;

function buildResume(e: ReturnType<typeof buildEntities>, L: ZodType) {
  const summaries = z.object({
    anthropic_dx: L, iot: L, plm_architect: L, default: L,
  }) satisfies ZodType;
  return z.object({
    person: e.Person,
    executiveSummaries: summaries,
    experiences: z.array(e.Experience),
    projects: z.array(e.Project),
    skills: z.array(e.Skill),
    certifications: z.array(e.Certification),
    education: z.array(e.Education),
    recommendations: z.array(e.Recommendation),
  });
}

export const ResumeSchema = buildResume(finalEntities, Localized);
export type Resume = z.infer<typeof ResumeSchema>;

export const ResumeInputSchema = buildResume(buildEntities(LocalizedInput), LocalizedInput);
export type ResumeInput = z.infer<typeof ResumeInputSchema>;

export const ROLES = TargetRole.options;
