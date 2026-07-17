export function yearsOfExperience(experiences: { period: { start: string } }[], now: Date = new Date()): number {
  if (experiences.length === 0) return 0;

  const starts = experiences.map((e) => {
    const [year, month] = e.period.start.split("-").map(Number);
    return { year, month };
  });
  const earliest = starts.reduce((a, b) => (a.year < b.year || (a.year === b.year && a.month < b.month) ? a : b));

  let years = now.getUTCFullYear() - earliest.year;
  if (now.getUTCMonth() + 1 < earliest.month) years -= 1;
  return years;
}

export function injectYears(text: string, years: number): string {
  return text.replaceAll("{{YEARS}}", String(years));
}
