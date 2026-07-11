export function curlFor(path: string, base?: string): string {
  const root = base ?? (import.meta.env?.PUBLIC_API_URL || "http://localhost:3000");
  return `curl "${root}${path}"`;
}
