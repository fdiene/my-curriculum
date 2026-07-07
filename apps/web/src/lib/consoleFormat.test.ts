import { describe, expect, it } from "bun:test";
import { highlightJson } from "./consoleFormat";

describe("highlightJson", () => {
  it("wraps keys, strings, numbers and booleans in classed spans", () => {
    const html = highlightJson('{"name":"Fadel","n":42,"ok":true}');
    expect(html).toContain('<span class="j-key">"name"</span>');
    expect(html).toContain('<span class="j-str">"Fadel"</span>');
    expect(html).toContain('<span class="j-num">42</span>');
    expect(html).toContain('<span class="j-bool">true</span>');
  });
  it("escapes HTML in values", () => {
    expect(highlightJson('{"x":"<img>"}')).not.toContain("<img>");
  });
});
