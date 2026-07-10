import { describe, expect, it } from "bun:test";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("renders headings, lists, emphasis, code and safe links", () => {
    const html = renderMarkdown("## Title\n- **bold** item\n- `code` item\n\nPara with [link](https://x.dev) and *em*.");
    expect(html).toContain("<h3>Title</h3>");
    expect(html).toContain("<li><strong>bold</strong> item</li>");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain('<a href="https://x.dev" rel="noopener noreferrer" target="_blank">link</a>');
    expect(html).toContain("<em>em</em>");
  });
  it("escapes raw HTML before transforming", () => {
    const html = renderMarkdown('hello <img src=x onerror=alert(1)> world');
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
  it("neutralizes javascript: links (scheme not allowed)", () => {
    const html = renderMarkdown("[x](javascript:alert(1))");
    expect(html).not.toContain("<a ");
  });
});
