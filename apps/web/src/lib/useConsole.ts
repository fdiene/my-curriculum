import { ref } from "vue";
import type { TargetRole } from "@profile/schema";

export type ConsoleEntry = { kind: "request" | "system"; text: string; payload?: string };

export function useConsole(opts: { role: TargetRole; isMobile: boolean }) {
  const state = ref<"open" | "closed">(opts.role !== "default" && !opts.isMobile ? "open" : "closed");
  const entries = ref<ConsoleEntry[]>([]);
  function log(entry: ConsoleEntry) { entries.value = [...entries.value, entry]; }
  function toggle() { state.value = state.value === "open" ? "closed" : "open"; }
  function open() { state.value = "open"; }
  return { state, entries, log, toggle, open };
}
