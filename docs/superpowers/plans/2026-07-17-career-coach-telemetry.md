# Career Coach Telemetry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `bun run advise` a persistent, append-only history of career-advisor runs (`docs/career_telemetry.jsonl`) alongside the existing disposable report (`docs/career_insights.md`), computed from a single structured-output LLM call.

**Architecture:** `scripts/career-telemetry.core.ts` holds pure, LLM-free diff logic over `docs/UPSKILLING.md` snapshots (reusing `parseUpskillingSections` from `admin-dashboard.core.ts`). `scripts/advisor.core.ts` gains a Zod schema (`AdvisorReportSchema`) so `career-advisor.ts` can call `client.messages.parse()` with `output_config.format` — one LLM call returns both the markdown report and structured market telemetry, with `web_search` freely available during generation.

**Tech Stack:** Bun 1.3.14, TypeScript, Zod (already a `scripts/` dependency), `@anthropic-ai/sdk` (upgraded in Task 1).

## Global Constraints

- Never fabricate metrics, dates, or facts not present in the source data (project rule, already enforced in `advisor.core.ts`).
- Never use the em dash character "—" in any generated string, prompt, or file content — use ":" or "-" instead (project rule).
- `docs/career_telemetry.jsonl` must be added to `.gitignore` before it is ever written (repo is public — same reasoning as `docs/career_insights.md`).
- Model string is always `"claude-opus-4-8"`, matching the rest of this codebase.
- Every new pure function lives in a `.core.ts` file and is covered by a `bun:test` file in the same directory, matching the existing `admin-dashboard.core.ts` / `admin-dashboard.core.test.ts` pattern.
- `scripts/career-advisor.ts` itself (the CLI entrypoint) has no test file, matching the existing convention (`admin-dashboard.ts`, `generate-translations.ts` are also untested CLI wrappers around tested `.core.ts` logic).

---

### Task 1: Upgrade `@anthropic-ai/sdk` and verify no regression

**Files:**
- Modify: `scripts/package.json:6`
- Test: full monorepo suite (no new test file — this task is a verification gate)

**Interfaces:**
- Consumes: nothing new.
- Produces: `@anthropic-ai/sdk@0.112.3` available for Task 4 (`client.messages.parse`, `output_config`, `@anthropic-ai/sdk/helpers/zod`, `web_search_20260209` tool type — none of which exist in the currently-installed `0.30.1`).

- [ ] **Step 1: Confirm current versions before touching anything**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && grep '"@anthropic-ai/sdk"' scripts/package.json && npm view @anthropic-ai/sdk version`
Expected: shows `"@anthropic-ai/sdk": "^0.30.0"` in the file and `0.112.3` (or newer) from npm. If npm reports a newer version than `0.112.3`, use that exact version in the next step instead.

- [ ] **Step 2: Bump the version in `scripts/package.json`**

Edit `scripts/package.json` line 6, changing only the SDK version:

```json
  "dependencies": { "@profile/schema": "workspace:*", "@anthropic-ai/sdk": "^0.112.3", "zod": "^3.23.8" },
```

- [ ] **Step 3: Reinstall to update the lockfile**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun install`
Expected: exits 0, `bun.lock` shows `@anthropic-ai/sdk@0.112.3` (or the version confirmed in Step 1) resolved.

- [ ] **Step 4: Verify the new SDK exposes what Task 4 needs**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && ls node_modules/@anthropic-ai/sdk/helpers/ && grep -l "parse" node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts`
Expected: `helpers/` directory listing includes a `zod.d.ts` (or `zod.js` + `zod.d.ts` pair); the grep prints the path (confirms a `parse` method exists on the messages resource). If either check fails, the installed version does not support structured outputs — stop and re-run Step 1 with a newer version.

- [ ] **Step 5: Run the full suite and typecheck to confirm no regression**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun test && bun run typecheck`
Expected: same pass count as before the bump (126/126 as of 2026-07-17), 0 typecheck errors. `scripts/generate-translations.ts` only uses `new Anthropic({apiKey})` and `client.messages.create({model, max_tokens, messages})` — the most stable part of the SDK surface — so no call-site changes are expected. If `bun test` or `bun run typecheck` reports an error inside `scripts/generate-translations.ts` or `scripts/translations.core.ts`, fix that specific call site to match the new SDK's types before continuing (do not proceed to Task 2 with a red suite).

- [ ] **Step 6: Commit**

```bash
cd "c:/Users/delfa/git/Workspaces/my-curriculum"
git add scripts/package.json bun.lock
git commit -m "chore: upgrade @anthropic-ai/sdk to 0.112.3

Needed for client.messages.parse(), output_config.format, and the
@anthropic-ai/sdk/helpers/zod structured-output helper used by the
career coach telemetry feature. 0.30.1 predates all of these."
```

---

### Task 2: `scripts/career-telemetry.core.ts` — pure diff/telemetry logic

**Files:**
- Create: `scripts/career-telemetry.core.ts`
- Test: `scripts/career-telemetry.core.test.ts`

**Interfaces:**
- Consumes: `parseUpskillingSections` and `type UpskillingSection` from `./admin-dashboard.core` (signature: `parseUpskillingSections(md: string): UpskillingSection[]`, `UpskillingSection = { project: string; competencies: string; items: { text: string; checked: boolean }[] }` — already defined and tested in `scripts/admin-dashboard.core.ts`).
- Produces (consumed by Task 4):
  - `export interface ProjectDelta { project: string; checkedTexts: string[]; total: number; newlyChecked: string[] }`
  - `export type UpskillingDelta = ProjectDelta[]`
  - `export interface MarketTelemetry { top_lanes: string[]; top_skill_gap: string; market_shift_summary: string }`
  - `export interface TelemetryLine { timestamp: string; upskilling: UpskillingDelta; market: MarketTelemetry }`
  - `export function diffUpskilling(previous: UpskillingDelta | null, upskillingMarkdown: string): UpskillingDelta`
  - `export function readLastTelemetryLine(jsonlText: string): TelemetryLine | null`
  - `export function buildTelemetryLine(upskilling: UpskillingDelta, market: MarketTelemetry, now?: Date): string`

- [ ] **Step 1: Write the failing tests**

Create `scripts/career-telemetry.core.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { diffUpskilling, readLastTelemetryLine, buildTelemetryLine, type UpskillingDelta } from "./career-telemetry.core";

const md = [
  "## Profile Engine (my-curriculum) : statut `live`",
  "",
  "**Compétences visées : TS avancé.**",
  "",
  "- [ ] Task A.",
  "- [x] Task B.",
].join("\n");

describe("diffUpskilling", () => {
  it("treats every checked item as newly checked on the first run (previous is null)", () => {
    const delta = diffUpskilling(null, md);
    expect(delta).toEqual([
      {
        project: "Profile Engine (my-curriculum) : statut `live`",
        checkedTexts: ["Task B."],
        total: 2,
        newlyChecked: ["Task B."],
      },
    ]);
  });

  it("treats a project absent from the previous delta as entirely new", () => {
    const delta = diffUpskilling([], md);
    expect(delta[0]!.newlyChecked).toEqual(["Task B."]);
  });

  it("only reports items newly checked since the previous delta", () => {
    const previous: UpskillingDelta = [
      {
        project: "Profile Engine (my-curriculum) : statut `live`",
        checkedTexts: ["Task B."],
        total: 2,
        newlyChecked: ["Task B."],
      },
    ];
    const mdBothChecked = md.replace("- [ ] Task A.", "- [x] Task A.");
    const delta = diffUpskilling(previous, mdBothChecked);
    expect(delta).toEqual([
      {
        project: "Profile Engine (my-curriculum) : statut `live`",
        checkedTexts: ["Task A.", "Task B."],
        total: 2,
        newlyChecked: ["Task A."],
      },
    ]);
  });

  it("drops an item from checkedTexts if it becomes unchecked again, without erroring", () => {
    const previous: UpskillingDelta = [
      {
        project: "Profile Engine (my-curriculum) : statut `live`",
        checkedTexts: ["Task A.", "Task B."],
        total: 2,
        newlyChecked: [],
      },
    ];
    const mdBUnchecked = md.replace("- [x] Task B.", "- [ ] Task B.");
    const delta = diffUpskilling(previous, mdBUnchecked);
    expect(delta[0]!.checkedTexts).toEqual([]);
    expect(delta[0]!.newlyChecked).toEqual([]);
  });
});

describe("readLastTelemetryLine", () => {
  it("returns null for empty input", () => {
    expect(readLastTelemetryLine("")).toBeNull();
  });

  it("parses the last line when multiple lines are present", () => {
    const line1 = JSON.stringify({
      timestamp: "2026-07-01T00:00:00.000Z",
      upskilling: [],
      market: { top_lanes: [], top_skill_gap: "a", market_shift_summary: "a" },
    });
    const line2 = JSON.stringify({
      timestamp: "2026-07-17T00:00:00.000Z",
      upskilling: [],
      market: { top_lanes: [], top_skill_gap: "b", market_shift_summary: "b" },
    });
    const result = readLastTelemetryLine(`${line1}\n${line2}\n`);
    expect(result?.timestamp).toBe("2026-07-17T00:00:00.000Z");
    expect(result?.market.top_skill_gap).toBe("b");
  });
});

describe("buildTelemetryLine", () => {
  it("serializes timestamp, upskilling delta and market telemetry as one JSON line", () => {
    const upskilling: UpskillingDelta = [
      { project: "P", checkedTexts: ["x"], total: 1, newlyChecked: ["x"] },
    ];
    const market = { top_lanes: ["Lane A"], top_skill_gap: "Evals", market_shift_summary: "More demand for evals." };
    const line = buildTelemetryLine(upskilling, market, new Date("2026-07-17T12:00:00.000Z"));
    expect(JSON.parse(line)).toEqual({
      timestamp: "2026-07-17T12:00:00.000Z",
      upskilling,
      market,
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun test scripts/career-telemetry.core.test.ts`
Expected: FAIL — `Cannot find module './career-telemetry.core'` (the file does not exist yet).

- [ ] **Step 3: Write the implementation**

Create `scripts/career-telemetry.core.ts`:

```ts
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
  return JSON.parse(lines[lines.length - 1]!) as TelemetryLine;
}

export function buildTelemetryLine(upskilling: UpskillingDelta, market: MarketTelemetry, now: Date = new Date()): string {
  const line: TelemetryLine = { timestamp: now.toISOString(), upskilling, market };
  return JSON.stringify(line);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun test scripts/career-telemetry.core.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Typecheck**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun run typecheck`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
cd "c:/Users/delfa/git/Workspaces/my-curriculum"
git add scripts/career-telemetry.core.ts scripts/career-telemetry.core.test.ts
git commit -m "feat: add pure UPSKILLING.md diff logic for career telemetry

diffUpskilling/readLastTelemetryLine/buildTelemetryLine are the
LLM-free half of the career coach telemetry design: reuses
parseUpskillingSections from admin-dashboard.core.ts rather than
duplicating the checkbox parser."
```

---

### Task 3: `AdvisorReportSchema` and prompt update in `advisor.core.ts`

**Files:**
- Modify: `scripts/advisor.core.ts`
- Modify: `scripts/advisor.core.test.ts`

**Interfaces:**
- Consumes: `z` from `zod` (already a `scripts/` dependency).
- Produces (consumed by Task 4):
  - `export const AdvisorReportSchema = z.object({ report_markdown: z.string(), telemetry: z.object({ top_lanes: z.array(z.string()).max(3), top_skill_gap: z.string(), market_shift_summary: z.string() }) })`
  - `export type AdvisorReport = z.infer<typeof AdvisorReportSchema>`
  - `buildAdvisorPrompt` unchanged in signature, only its returned string gains one new instruction line.

- [ ] **Step 1: Write the failing test**

Add to `scripts/advisor.core.test.ts` (after the existing `describe("buildAdvisorPrompt", ...)` block, before `describe("buildAdvisorPrompt traditional CV constraints", ...)`):

```ts
describe("AdvisorReportSchema", () => {
  it("parses a valid report_markdown + telemetry payload", () => {
    const value = AdvisorReportSchema.parse({
      report_markdown: "## 1. Matching current job openings\n...",
      telemetry: {
        top_lanes: ["PLM Solution Architect", "Applied AI Engineer"],
        top_skill_gap: "Evals",
        market_shift_summary: "AI-augmented PLM roles are new since the last run.",
      },
    });
    expect(value.telemetry.top_lanes).toHaveLength(2);
  });

  it("rejects more than 3 top_lanes", () => {
    expect(() =>
      AdvisorReportSchema.parse({
        report_markdown: "x",
        telemetry: { top_lanes: ["a", "b", "c", "d"], top_skill_gap: "x", market_shift_summary: "x" },
      })
    ).toThrow();
  });
});

describe("buildAdvisorPrompt structured output instruction", () => {
  it("tells the model to populate the telemetry object alongside the markdown report", () => {
    const p = buildAdvisorPrompt(src as any);
    expect(p.toLowerCase()).toContain("top_lanes");
    expect(p.toLowerCase()).toContain("telemetry");
  });
});
```

Update the import line at the top of `scripts/advisor.core.test.ts`:

```ts
import { buildAdvisorPrompt, renderInsights, AdvisorReportSchema } from "./advisor.core";
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun test scripts/advisor.core.test.ts`
Expected: FAIL — `AdvisorReportSchema` is not exported / `buildAdvisorPrompt`'s output does not contain "telemetry".

- [ ] **Step 3: Add the schema and the prompt instruction**

In `scripts/advisor.core.ts`, add the import and schema near the top (after the existing `import type { ResumeInput } from "@profile/schema";` line):

```ts
import { z } from "zod";

export const AdvisorReportSchema = z.object({
  report_markdown: z.string().describe(
    "The full markdown report: all 7 sections below, each with a \"## \" heading, exactly as instructed."
  ),
  telemetry: z.object({
    top_lanes: z
      .array(z.string())
      .max(3)
      .describe("Up to 3 short labels for the highest-conversion job/market lanes identified in section 1."),
    top_skill_gap: z.string().describe("A short label for the single highest-priority skill gap identified in section 2."),
    market_shift_summary: z
      .string()
      .describe(
        "1-2 sentences: what is different about the market or positioning compared to a typical prior analysis of this profile."
      ),
  }),
});

export type AdvisorReport = z.infer<typeof AdvisorReportSchema>;
```

Then, in `buildAdvisorPrompt`, replace the final two lines of the `parts` array:

```ts
    `Be specific and actionable. Return Markdown with a "## " heading per section.`,
    `Never use the em dash character "—"; use ":" or "-" instead.`,
```

with:

```ts
    `Be specific and actionable. Return Markdown with a "## " heading per section.`,
    `Never use the em dash character "—"; use ":" or "-" instead.`,
    `Your response must be the structured object described by the response schema: the markdown above goes in report_markdown, and you must also populate telemetry (top_lanes, top_skill_gap, market_shift_summary) as a compact, separate synthesis of the same analysis.`,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun test scripts/advisor.core.test.ts`
Expected: PASS, 12 tests (10 existing + 2 new `describe` blocks totaling the counts above).

- [ ] **Step 5: Run the full suite and typecheck**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun test && bun run typecheck`
Expected: all green, 0 typecheck errors.

- [ ] **Step 6: Commit**

```bash
cd "c:/Users/delfa/git/Workspaces/my-curriculum"
git add scripts/advisor.core.ts scripts/advisor.core.test.ts
git commit -m "feat: add AdvisorReportSchema for structured career-advisor output

Zod schema (report_markdown + telemetry) that career-advisor.ts will
pass to output_config.format in Task 4. Prompt gains one instruction
line telling the model to populate both halves of the response."
```

---

### Task 4: Wire the CLI, bump the web_search tool version, live-verify, gitignore

**Files:**
- Modify: `scripts/career-advisor.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: everything produced by Tasks 1-3 (`AdvisorReportSchema` from `./advisor.core`, `diffUpskilling`/`readLastTelemetryLine`/`buildTelemetryLine` from `./career-telemetry.core`, `zodOutputFormat` from `@anthropic-ai/sdk/helpers/zod`).
- Produces: `docs/career_insights.md` (unchanged behavior) and `docs/career_telemetry.jsonl` (new, append-only).

- [ ] **Step 1: Add the gitignore entry first (before any code can write the file)**

Edit `.gitignore`, adding one line after the existing `docs/career_insights.md` entry:

```
docs/career_insights.md
docs/career_telemetry.jsonl
docs/admin_dashboard.md
```

(The `docs/admin_dashboard.md` line already exists below `docs/career_insights.md` — just insert the new line between them, don't duplicate `docs/admin_dashboard.md`.)

- [ ] **Step 2: Rewrite `scripts/career-advisor.ts`**

Replace the full contents of `scripts/career-advisor.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { appendFileSync } from "node:fs";
import type { ResumeInput } from "@profile/schema";
import { AdvisorReportSchema, buildAdvisorPrompt, renderInsights } from "./advisor.core";
import { buildTelemetryLine, diffUpskilling, readLastTelemetryLine } from "./career-telemetry.core";

if (import.meta.main) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { console.error("ANTHROPIC_API_KEY is required"); process.exit(1); }
  const resume = (await Bun.file("data/master_data.fr.json").json()) as ResumeInput;
  const upskilling = await Bun.file("docs/UPSKILLING.md").exists() ? await Bun.file("docs/UPSKILLING.md").text() : undefined;

  const jobOfferArg = process.argv[2];
  const targetJobOffer = jobOfferArg
    ? (await Bun.file(jobOfferArg).exists()) ? await Bun.file(jobOfferArg).text() : jobOfferArg
    : undefined;

  const telemetryPath = "docs/career_telemetry.jsonl";
  const previousJsonl = await Bun.file(telemetryPath).exists() ? await Bun.file(telemetryPath).text() : "";
  const previousLine = readLastTelemetryLine(previousJsonl);
  const upskillingDelta = diffUpskilling(previousLine?.upskilling ?? null, upskilling ?? "");

  const client = new Anthropic({ apiKey: key });
  const msg = await client.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 8192,
    tools: [{ type: "web_search_20260209", name: "web_search" }],
    output_config: { format: zodOutputFormat(AdvisorReportSchema) },
    messages: [{ role: "user", content: buildAdvisorPrompt(resume, upskilling, targetJobOffer) }],
  });

  const parsed = msg.parsed_output;
  if (!parsed) {
    console.error("Structured output parsing failed; no files were written.");
    process.exit(1);
  }

  const md = renderInsights([{ title: "Advisor Report", body: parsed.report_markdown }]);
  await Bun.write("docs/career_insights.md", md);

  const telemetryLine = buildTelemetryLine(upskillingDelta, parsed.telemetry);
  appendFileSync(telemetryPath, `${telemetryLine}\n`, "utf8");

  console.log("Wrote docs/career_insights.md and appended docs/career_telemetry.jsonl (both git-ignored)");
}
```

- [ ] **Step 3: Typecheck before the live spike**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun run typecheck`
Expected: 0 errors. If `client.messages.parse` or `output_config` don't typecheck against the installed SDK, re-check Task 1 Step 4 — the SDK version may not actually support them despite the `helpers/zod` file existing.

- [ ] **Step 4: Live spike — run the real CLI once and inspect the output**

This is the risk item from the design spec: confirm `output_config.format` and `tools: [web_search]` work together in one call.

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun run advise`
Expected: exits 0, prints `Wrote docs/career_insights.md and appended docs/career_telemetry.jsonl (both git-ignored)`.

Then inspect both outputs:

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && cat docs/career_telemetry.jsonl`
Expected: exactly one line of valid JSON with `timestamp`, `upskilling` (an array matching the current `UPSKILLING.md` state), and `market` (`top_lanes` with at most 3 entries, `top_skill_gap`, `market_shift_summary` — all non-empty strings, not placeholder text).

Read `docs/career_insights.md` and confirm `report_markdown` still contains all 7 "## " sections as before (structured output should not have changed the prose content, only how it's wrapped).

**If the live spike fails** (API error mentioning `tools` and `output_config` together, or `parsed_output` is unexpectedly `null`): switch from `client.messages.parse()` to `client.messages.create()` with the same `tools` and `output_config`, then manually validate the response:

```ts
  const msg = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 8192,
    tools: [{ type: "web_search_20260209", name: "web_search" }],
    output_config: { format: zodOutputFormat(AdvisorReportSchema) },
    messages: [{ role: "user", content: buildAdvisorPrompt(resume, upskilling, targetJobOffer) }],
  });
  const textBlock = msg.content.find((b) => b.type === "text");
  const parseResult = textBlock ? AdvisorReportSchema.safeParse(JSON.parse(textBlock.text)) : null;
  if (!parseResult?.success) {
    console.error("Structured output parsing failed; no files were written.");
    process.exit(1);
  }
  const parsed = parseResult.data;
```

Re-run the live spike after switching before continuing.

- [ ] **Step 5: Re-run the live spike to confirm the telemetry diff works on a second run**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun run advise`
Expected: exits 0, `docs/career_telemetry.jsonl` now has **two** lines. Since no `UPSKILLING.md` checkboxes changed between the two runs, the second line's `upskilling[].newlyChecked` arrays should all be empty (nothing new got checked), while `checkedTexts` stays the same as the first line.

- [ ] **Step 6: Run the full suite, typecheck, and build**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && bun test && bun run typecheck && bun run build`
Expected: all green, 0 typecheck errors, build completes.

- [ ] **Step 7: Show the diff and commit**

Run: `cd "c:/Users/delfa/git/Workspaces/my-curriculum" && git status --short && git diff .gitignore scripts/career-advisor.ts`

Confirm `docs/career_telemetry.jsonl` and `docs/career_insights.md` do **not** appear in `git status` (they must be ignored — if they show up, Step 1 was not applied correctly, fix `.gitignore` before committing).

```bash
cd "c:/Users/delfa/git/Workspaces/my-curriculum"
git add .gitignore scripts/career-advisor.ts
git commit -m "feat: wire career-advisor to structured output + telemetry JSONL

Single client.messages.parse() call with output_config.format (Zod)
and the web_search_20260209 tool returns both the markdown report and
structured market telemetry. Each run now appends one line to
docs/career_telemetry.jsonl (git-ignored) with a deterministic
UPSKILLING.md diff plus the LLM's market synthesis."
```
