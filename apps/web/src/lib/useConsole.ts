import { ref } from "vue";
import type { TargetRole } from "@profile/schema";

export type ConsoleEntry = { kind: "request" | "system"; text: string; payload?: string; time?: string };

export function useConsole(opts: { role: TargetRole; isMobile: boolean }) {
  const state = ref<"open" | "closed">(opts.role !== "default" && !opts.isMobile ? "open" : "closed");
  const entries = ref<ConsoleEntry[]>([]);
  function log(entry: ConsoleEntry) {
    const stamped = entry.time ? entry : { ...entry, time: new Date().toTimeString().slice(0, 8) };
    entries.value = [...entries.value, stamped];
  }
  function toggle() { state.value = state.value === "open" ? "closed" : "open"; }
  function open() { state.value = "open"; }
  function clear() { entries.value = []; }
  return { state, entries, log, toggle, open, clear };
}
