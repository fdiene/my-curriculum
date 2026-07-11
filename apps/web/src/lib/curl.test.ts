import { describe, expect, it } from "bun:test";
import { curlFor } from "./curl";

describe("curlFor", () => {
  it("builds the command against an explicit base", () => {
    expect(curlFor("/v1/skills?tag=mcp", "https://api.fdiene.com"))
      .toBe('curl "https://api.fdiene.com/v1/skills?tag=mcp"');
  });
});
