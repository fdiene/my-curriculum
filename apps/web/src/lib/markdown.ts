// Sentinels for token protection (U+0000 / U+0001). Stripped from input by
// esc(), so they can never occur in escaped text: placeholders are
// collision-free by construction.
const CODE_S = String.fromCharCode(0);
const LINK_S = String.fromCharCode(1);
const STRIP_RE = new RegExp("[" + CODE_S + LINK_S + "]", "g");
const LINK_PH_RE = new RegExp(LINK_S + "(\\d+)" + LINK_S, "g");
const CODE_PH_RE = new RegExp(CODE_S + "(\\d+)" + CODE_S, "g");

const esc = (s: string) =>
  s
    .replace(STRIP_RE, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function inline(t: string): string {
  // Token protection: code spans then links are extracted into placeholders
  // BEFORE the emphasis passes, so sequential regexes cannot corrupt code
  // content or URLs. Placeholders are restored in reverse order at the end.
  const codes: string[] = [];
  t = t.replace(/`([^`]+)`/g, (_m, c: string) => {
    codes.push(c);
    return `${CODE_S}${codes.length - 1}${CODE_S}`;
  });
  const links: string[] = [];
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_m, label: string, url: string) => {
    links.push(`<a href="${url}" rel="noopener noreferrer" target="_blank">${label}</a>`);
    return `${LINK_S}${links.length - 1}${LINK_S}`;
  });
  t = t
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  t = t.replace(LINK_PH_RE, (_m, i: string) => links[Number(i)] ?? "");
  t = t.replace(CODE_PH_RE, (_m, i: string) => `<code>${codes[Number(i)] ?? ""}</code>`);
  return t;
}

export function renderMarkdown(src: string): string {
  const out: string[] = [];
  let inList = false;
  for (const raw of esc(src).split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (inList && !line.startsWith("- ")) { out.push("</ul>"); inList = false; }
    if (!line.trim()) continue;
    if (line.startsWith("### ")) out.push(`<h4>${inline(line.slice(4))}</h4>`);
    else if (line.startsWith("## ")) out.push(`<h3>${inline(line.slice(3))}</h3>`);
    else if (line.startsWith("- ")) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inline(line.slice(2))}</li>`);
    } else out.push(`<p>${inline(line)}</p>`);
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}
