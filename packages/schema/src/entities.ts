import { z, type ZodType } from "zod";
import { Tag, TargetRole } from "./enums";

/** Factory builds an entity set from whichever localized schema is passed in. */
export function buildEntities(L: ZodType) {
  const Period = z.object({ start: z.string(), end: z.string().nullable() });

  const Person = z.object({
    name: z.string(),
    title: L,
    location: z.string(),
    photo: z.string().optional(),
    links: z.object({
      linkedin: z.string().optional(),
      email: z.string().optional(),
      website: z.string().optional(),
      github: z.string().optional(),
    }),
  });

  const Experience = z.object({
    id: z.string(),
    role: L,
    org: z.string(),
    location: z.string(),
    period: Period,
    summary: L,
    highlights: z.array(L),
    tags: z.array(Tag),
    domain: z.string(),
  });

  const Project = z.object({
    id: z.string(),
    name: z.string(),
    tagline: L,
    description: L,
    stack: z.array(z.string()),
    tags: z.array(Tag),
    links: z.object({ repo: z.string().optional(), demo: z.string().optional() }),
    metrics: z.record(z.string(), z.string()).optional(),
    status: z.enum(["live", "building", "concept"]),
    featured_for: z.array(TargetRole),
  });

  const Skill = z.object({
    id: z.string(),
    label: z.string(),
    category: z.string(),
    level: z.number().int().min(1).max(5),
    tags: z.array(Tag),
  });

  const Certification = z.object({ id: z.string(), title: L, org: z.string(), location: z.string(), period: Period });
  const Education = z.object({ id: z.string(), title: L, org: z.string(), location: z.string(),
    period: Period, details: z.array(L).default([]) });
  const Recommendation = z.object({ author: z.string(), title: z.string(), company: z.string(),
    text: L, date: z.string() });

  return { Person, Experience, Project, Skill, Certification, Education, Recommendation };
}
