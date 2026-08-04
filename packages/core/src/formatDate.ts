import type { Lang } from "@profile/schema";

export function formatMonthYear(isoYearMonth: string, lang: Lang): string {
  const [year, month] = isoYearMonth.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat(lang, { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}
