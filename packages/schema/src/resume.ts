import { z, type ZodType } from "zod";
import { Localized, LocalizedInput } from "./localized";
import { TargetRole } from "./enums";
import { buildEntities } from "./entities";

function buildResume(L: ZodType) {
  const e = buildEntities(L);
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

export const ResumeSchema = buildResume(Localized);
export type Resume = z.infer<typeof ResumeSchema>;

export const ResumeInputSchema = buildResume(LocalizedInput);
export type ResumeInput = z.infer<typeof ResumeInputSchema>;

export const ROLES = TargetRole.options;
