export interface ProjectStatus {
  name: string;
  status: string;
  tagline?: string;
}

export function parseProjectStatuses(masterData: {
  projects: { name: string; status: string; tagline?: { en?: string } }[];
}): ProjectStatus[] {
  return masterData.projects.map((p) => ({
    name: p.name,
    status: p.status,
    ...(p.tagline?.en ? { tagline: p.tagline.en } : {}),
  }));
}

export interface UpskillingItem {
  text: string;
  checked: boolean;
}

export interface UpskillingSection {
  project: string;
  competencies: string;
  items: UpskillingItem[];
}

function splitLines(md: string): string[] {
  return md.replace(/\r\n/g, "\n").split("\n");
}

const HEADING_RE = /^## (.+)$/;
const COMPETENCIES_RE = /^\*\*Compétences visées\s*:\s*(.+?)\*\*$/;
const CHECKBOX_RE = /^- \[( |x)\] (.+)$/;

export function parseUpskillingSections(md: string): UpskillingSection[] {
  const sections: UpskillingSection[] = [];
  let current: UpskillingSection | null = null;

  for (const line of splitLines(md)) {
    const heading = line.match(HEADING_RE);
    if (heading) {
      current = { project: heading[1].trim(), competencies: "", items: [] };
      sections.push(current);
      continue;
    }
    if (!current) continue;

    const competencies = line.match(COMPETENCIES_RE);
    if (competencies) {
      current.competencies = competencies[1].trim();
      continue;
    }

    const checkbox = line.match(CHECKBOX_RE);
    if (checkbox) {
      current.items.push({ text: checkbox[2].trim(), checked: checkbox[1] === "x" });
    }
  }

  return sections;
}

export function nextAction(section: UpskillingSection): string | null {
  return section.items.find((i) => !i.checked)?.text ?? null;
}

export interface RoadmapEntry {
  project: string;
  killerFeature: string | null;
}

const AXIS_HEADING_RE = /^## AXE (\d+)/;
const SECTION_HEADING_RE = /^### (.+)$/;
const KILLER_FEATURE_RE = /^\*\*Killer feature suivante\s*:\*\*\s*(.+)$/;

export function parseRoadmapAxis1(md: string): RoadmapEntry[] {
  const entries: RoadmapEntry[] = [];
  let inAxis1 = false;
  let current: RoadmapEntry | null = null;

  for (const line of splitLines(md)) {
    const axis = line.match(AXIS_HEADING_RE);
    if (axis) {
      inAxis1 = axis[1] === "1";
      current = null;
      continue;
    }
    if (!inAxis1) continue;

    const section = line.match(SECTION_HEADING_RE);
    if (section) {
      current = { project: section[1].trim(), killerFeature: null };
      entries.push(current);
      continue;
    }
    if (!current) continue;

    const killer = line.match(KILLER_FEATURE_RE);
    if (killer) current.killerFeature = killer[1].trim();
  }

  return entries;
}

export interface StalenessEntry {
  repo: string;
  lastCommitDate: string | null;
  lastCommitSubject: string | null;
}

export interface DashboardInput {
  projects: ProjectStatus[];
  upskilling: UpskillingSection[];
  roadmap: RoadmapEntry[];
  staleness: StalenessEntry[];
}

export function renderDashboard(input: DashboardInput): string {
  const parts: string[] = ["# Admin Dashboard", ""];

  parts.push("## Statut des projets (data/master_data.fr.json)", "");
  for (const p of input.projects) {
    parts.push(`- **${p.name}** : ${p.status}${p.tagline ? ` : ${p.tagline}` : ""}`);
  }
  parts.push("");

  parts.push("## Upskilling : prochaine action par projet (docs/UPSKILLING.md)", "");
  for (const s of input.upskilling) {
    const next = nextAction(s);
    const done = s.items.filter((i) => i.checked).length;
    parts.push(`- **${s.project}** (${done}/${s.items.length} tâches cochées)`);
    parts.push(next ? `  Prochaine action : ${next}` : "  Aucune action restante : toutes les tâches sont cochées.");
  }
  parts.push("");

  parts.push("## Traçabilité roadmap-v1 (AXE 1)", "");
  for (const r of input.roadmap) {
    parts.push(`- **${r.project}** : ${r.killerFeature ?? "(aucune killer feature identifiée dans roadmap-v1.md)"}`);
  }
  parts.push("");

  parts.push("## Staleness des repos frères (dernier commit)", "");
  for (const s of input.staleness) {
    const label = s.lastCommitDate ? `${s.lastCommitDate} : ${s.lastCommitSubject}` : "n/a (pas de commit trouvé)";
    parts.push(`- **${s.repo}** : ${label}`);
  }
  parts.push("");

  return parts.join("\n");
}
