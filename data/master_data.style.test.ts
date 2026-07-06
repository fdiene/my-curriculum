import { describe, expect, it } from "bun:test";
import fr from "./master_data.fr.json";
import i18n from "./master_data.i18n.json";

const FORBIDDEN = ["—", "[DRAFT]", "[ENTWURF]"] as const;
const FILES = [
  ["master_data.fr.json", fr],
  ["master_data.i18n.json", i18n],
] as const;

for (const [name, data] of FILES) {
  describe(`${name} typography`, () => {
    const text = JSON.stringify(data);
    for (const marker of FORBIDDEN) {
      it(`contains no "${marker}"`, () => {
        expect(text.includes(marker)).toBe(false);
      });
    }
  });
}
