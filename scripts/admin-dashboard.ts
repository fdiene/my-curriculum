import { $ } from "bun";
import {
  parseProjectStatuses,
  parseUpskillingSections,
  parseRoadmapAxis1,
  renderDashboard,
  type StalenessEntry,
} from "./admin-dashboard.core";

const REPO_ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, "$1");
const WORKSPACE_ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, "$1");

const SIBLING_REPOS = ["harness", "ops-tools", "AI_agents/seomnix"];

async function lastCommit(repoPath: string): Promise<{ date: string | null; subject: string | null }> {
  try {
    const out = await $`git -C ${repoPath} log -1 --format=%cs%x1f%s`.quiet();
    const [date, subject] = out.stdout.toString().trim().split("\x1f");
    return date ? { date, subject: subject ?? null } : { date: null, subject: null };
  } catch {
    return { date: null, subject: null };
  }
}

if (import.meta.main) {
  const masterData = await Bun.file(`${REPO_ROOT}/data/master_data.fr.json`).json();
  const upskillingMd = await Bun.file(`${REPO_ROOT}/docs/UPSKILLING.md`).text();
  const roadmapMd = await Bun.file(`${WORKSPACE_ROOT}/ops-tools/meta/roadmap-v1.md`).text();

  const staleness: StalenessEntry[] = [];
  for (const repo of ["my-curriculum", ...SIBLING_REPOS]) {
    const { date, subject } = await lastCommit(`${WORKSPACE_ROOT}/${repo}`);
    staleness.push({ repo, lastCommitDate: date, lastCommitSubject: subject });
  }

  const md = renderDashboard({
    projects: parseProjectStatuses(masterData),
    upskilling: parseUpskillingSections(upskillingMd),
    roadmap: parseRoadmapAxis1(roadmapMd),
    staleness,
  });

  await Bun.write(`${REPO_ROOT}/docs/admin_dashboard.md`, md);
  console.log("Wrote docs/admin_dashboard.md (git-ignored)");
}
