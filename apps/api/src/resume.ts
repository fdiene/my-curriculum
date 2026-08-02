import type { Profile } from "@profile/core";

export interface JsonResume {
  basics: {
    name: string;
    label: string;
    image?: string;
    email?: string;
    url: string;
    summary: string;
    location: { city: string };
    profiles: Array<{ network: string; username: string; url: string }>;
  };
  work: Array<{
    name: string;
    position: string;
    location: string;
    startDate: string;
    endDate?: string;
    summary: string;
    highlights: string[];
  }>;
  education: Array<{
    institution: string;
    studyType: string;
    location: string;
    startDate: string;
    endDate?: string;
    courses: string[];
  }>;
  certificates: Array<{ name: string; date: string; issuer: string }>;
  skills: Array<{ name: string; level: string; keywords: string[] }>;
  projects: Array<{ name: string; description: string; url?: string; keywords: string[] }>;
  meta: { canonical: string; version: string; lastModified: string };
}

function usernameFromUrl(url: string): string {
  const segments = url.replace(/\/+$/, "").split("/");
  return segments[segments.length - 1] ?? "";
}

export function toJsonResume(
  profile: Profile,
  opts: { canonical?: string; now?: Date } = {},
): JsonResume {
  const canonical = opts.canonical ?? "https://fdiene.com/resume.json";
  const now = opts.now ?? new Date();
  const { person } = profile;

  const profiles: JsonResume["basics"]["profiles"] = [];
  if (person.links?.linkedin) profiles.push({ network: "LinkedIn", username: usernameFromUrl(person.links.linkedin), url: person.links.linkedin });
  if (person.links?.github) profiles.push({ network: "GitHub", username: usernameFromUrl(person.links.github), url: person.links.github });

  return {
    basics: {
      name: person.name,
      label: person.title,
      image: person.avatarUrl,
      email: person.links?.email,
      url: person.links?.website ?? "https://fdiene.com",
      summary: profile.executiveSummary,
      location: { city: person.location },
      profiles,
    },
    work: profile.experiences.map((e) => ({
      name: e.org,
      position: e.role,
      location: e.location,
      startDate: e.period.start,
      endDate: e.period.end ?? undefined,
      summary: e.summary,
      highlights: e.highlights,
    })),
    education: profile.education.map((ed) => ({
      institution: ed.org,
      studyType: ed.title,
      location: ed.location,
      startDate: ed.period.start,
      endDate: ed.period.end ?? undefined,
      courses: ed.details,
    })),
    certificates: profile.certifications.map((c) => ({
      name: c.title,
      date: c.period.end ?? c.period.start,
      issuer: c.org,
    })),
    skills: profile.skills.map((s) => ({
      name: s.label,
      level: String(s.level),
      keywords: s.tags,
    })),
    projects: profile.projects.map((pr) => ({
      name: pr.name,
      description: pr.description,
      url: pr.links.demo ?? pr.links.repo,
      keywords: pr.stack,
    })),
    meta: { canonical, version: "v1.0.0", lastModified: now.toISOString() },
  };
}
