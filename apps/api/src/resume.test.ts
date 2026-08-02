import { describe, expect, it } from "bun:test";
import { toJsonResume } from "./resume";
import { buildProfile } from "./profile";
import { loadResume } from "./data";
import type { Resume } from "@profile/schema";

const data: Resume = loadResume("data/master_data.i18n.json");
const profile = buildProfile("default", "en", data);
const NOW = new Date("2026-07-21T00:00:00.000Z");

describe("toJsonResume", () => {
  it("maps basics from person + executiveSummary", () => {
    const out = toJsonResume(profile, { now: NOW });
    expect(out.basics.name).toBe(profile.person.name);
    expect(out.basics.label).toBe(profile.person.title);
    expect(out.basics.summary).toBe(profile.executiveSummary);
    expect(out.basics.location.city).toBe(profile.person.location);
    expect(out.basics.email).toBe(profile.person.links?.email);
  });

  it("derives LinkedIn and GitHub profiles with a username parsed from the URL", () => {
    const out = toJsonResume(profile, { now: NOW });
    const linkedin = out.basics.profiles.find((p) => p.network === "LinkedIn");
    const github = out.basics.profiles.find((p) => p.network === "GitHub");
    expect(linkedin?.username).toBe("fdiene");
    expect(github?.username).toBe("fdiene");
  });

  it("maps work experience with startDate/endDate, omitting endDate for ongoing roles", () => {
    const out = toJsonResume(profile, { now: NOW });
    const safran = out.work.find((w) => w.name === "Safran Aircraft Engines");
    expect(safran?.startDate).toBe("2023-04");
    expect(safran?.endDate).toBeUndefined();
    expect(Array.isArray(safran?.highlights)).toBe(true);
    expect(safran!.highlights.length).toBeGreaterThan(0);
  });

  it("maps education, certificates, and skills", () => {
    const out = toJsonResume(profile, { now: NOW });
    expect(out.education.length).toBe(profile.education.length);
    expect(out.certificates.length).toBe(profile.certifications.length);
    expect(out.skills.length).toBe(profile.skills.length);
    expect(out.skills[0]?.level).toBe(String(profile.skills[0]!.level));
  });

  it("maps projects with stack as keywords", () => {
    const out = toJsonResume(profile, { now: NOW });
    const pe = out.projects.find((p) => p.name.includes("Profile Engine"));
    expect(pe?.keywords).toContain("Elysia");
  });

  it("sets meta.canonical and a deterministic lastModified from the injected clock", () => {
    const out = toJsonResume(profile, { now: NOW, canonical: "https://fdiene.com/resume.json" });
    expect(out.meta.canonical).toBe("https://fdiene.com/resume.json");
    expect(out.meta.lastModified).toBe("2026-07-21T00:00:00.000Z");
  });
});
