const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function highlightJson(src: string): string {
  return esc(src).replace(
    /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?)|(true|false|null)/g,
    (_m, str, colon, num, bool) => {
      if (str && colon) return `<span class="j-key">${str}</span>${colon}`;
      if (str) return `<span class="j-str">${str}</span>`;
      if (num) return `<span class="j-num">${num}</span>`;
      return `<span class="j-bool">${bool}</span>`;
    },
  );
}
