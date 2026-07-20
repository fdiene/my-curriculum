import { parseUpskillingSections, type UpskillingSection } from "./admin-dashboard.core";

export interface ProjectDelta {
  project: string;
  checkedTexts: string[];
  total: number;
  newlyChecked: string[];
}

export type UpskillingDelta = ProjectDelta[];

export interface MarketTelemetry {
  top_lanes: string[];
  top_skill_gap: string;
  market_shift_summary: string;
}

export interface TelemetryLine {
  timestamp: string;
  upskilling: UpskillingDelta;
  market: MarketTelemetry;
}

export function diffUpskilling(previous: UpskillingDelta | null, upskillingMarkdown: string): UpskillingDelta {
  const current: UpskillingSection[] = parseUpskillingSections(upskillingMarkdown);
  const prevByProject = new Map((previous ?? []).map((p) => [p.project, p]));

  return current.map((section) => {
    const prevProject = prevByProject.get(section.project);
    const prevCheckedTexts = new Set(prevProject?.checkedTexts ?? []);
    const checkedTexts = section.items.filter((i) => i.checked).map((i) => i.text);
    const newlyChecked = checkedTexts.filter((t) => !prevCheckedTexts.has(t));
    return { project: section.project, checkedTexts, total: section.items.length, newlyChecked };
  });
}

export function readLastTelemetryLine(jsonlText: string): TelemetryLine | null {
  const lines = jsonlText.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  try {
    return JSON.parse(lines[lines.length - 1]!) as TelemetryLine;
  } catch {
    return null;
  }
}

export function buildTelemetryLine(upskilling: UpskillingDelta, market: MarketTelemetry, now: Date = new Date()): string {
  const line: TelemetryLine = { timestamp: now.toISOString(), upskilling, market };
  return JSON.stringify(line);
}
