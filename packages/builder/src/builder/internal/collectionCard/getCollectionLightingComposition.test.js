import { describe, expect, it } from "vitest";

import {
  getCollectionCardAmbientThemeByKey,
  getCollectionLightingComposition,
} from "./getCollectionLightingComposition.js";

const AURELIAN_GOLD = "#C8A665";
const AURELIAN_GOLD_STRONG = "#9F7D43";
const MOOD_KEYS = ["fresh", "green", "signature", "warm", "office", "balanced"];

describe("getCollectionCardAmbientThemeByKey", () => {
  it("derives every mood's lighting hue from the passed-in theme accent, not a fixed color", () => {
    for (const key of MOOD_KEYS) {
      const theme = getCollectionCardAmbientThemeByKey(key, AURELIAN_GOLD, AURELIAN_GOLD_STRONG);

      for (const prop of ["ambient", "ambientSoft", "titleGlow", "moodAccent"]) {
        expect(theme[prop]).toContain(AURELIAN_GOLD);
      }
    }
  });

  it("produces a different hue family for a different theme (green vs gold)", () => {
    const greenTheme = getCollectionCardAmbientThemeByKey("warm", "#4ade80", "#22c55e");
    const goldTheme = getCollectionCardAmbientThemeByKey("warm", AURELIAN_GOLD, AURELIAN_GOLD_STRONG);

    expect(greenTheme.ambient).toContain("#4ade80");
    expect(greenTheme.ambient).not.toContain(AURELIAN_GOLD);
    expect(goldTheme.ambient).toContain(AURELIAN_GOLD);
    expect(goldTheme.ambient).not.toContain("#4ade80");
  });

  it("keeps every mood key visually distinct through composition (alpha / accent-vs-strong blend), not identical output", () => {
    const themesByKey = Object.fromEntries(
      MOOD_KEYS.map((key) => [key, getCollectionCardAmbientThemeByKey(key, AURELIAN_GOLD, AURELIAN_GOLD_STRONG)])
    );
    const serialized = MOOD_KEYS.map((key) => JSON.stringify(themesByKey[key]));

    expect(new Set(serialized).size).toBe(MOOD_KEYS.length);
  });

  it("preserves the pre-existing key remapping for signature (dark) and office (balanced)", () => {
    expect(getCollectionCardAmbientThemeByKey("signature", AURELIAN_GOLD, AURELIAN_GOLD_STRONG).key).toBe("dark");
    expect(getCollectionCardAmbientThemeByKey("office", AURELIAN_GOLD, AURELIAN_GOLD_STRONG).key).toBe("balanced");
    expect(getCollectionCardAmbientThemeByKey("balanced", AURELIAN_GOLD, AURELIAN_GOLD_STRONG).key).toBe("balanced");
  });

  it("preserves each mood's origin position (x/y), which is layout, not color", () => {
    expect(getCollectionCardAmbientThemeByKey("fresh", AURELIAN_GOLD, AURELIAN_GOLD_STRONG)).toMatchObject({ x: 28, y: "3%" });
    expect(getCollectionCardAmbientThemeByKey("signature", AURELIAN_GOLD, AURELIAN_GOLD_STRONG)).toMatchObject({ x: 65, y: "0%" });
  });

  it("contains no hardcoded amber/yellow literal for any mood's theme-dependent lighting", () => {
    const amberLiterals = [/250,\s*204,\s*21/, /#fde68a/i, /#fef3c7/i, /#facc15/i];

    for (const key of MOOD_KEYS) {
      const theme = getCollectionCardAmbientThemeByKey(key, "#4ade80", "#22c55e");
      const serialized = JSON.stringify(theme);

      for (const pattern of amberLiterals) {
        expect(serialized).not.toMatch(pattern);
      }
    }
  });

  it("falls back to the default builder theme accent when no theme colors are supplied", () => {
    const theme = getCollectionCardAmbientThemeByKey("balanced");

    expect(theme.ambient).toContain("#4ade80");
  });
});

describe("getCollectionLightingComposition", () => {
  it("threads the active theme accent through to the returned theme and keeps the origin/composition contract", () => {
    const composition = getCollectionLightingComposition({
      perfumes: [],
      palette: "warm",
      themeAccent: AURELIAN_GOLD,
      themeAccentStrong: AURELIAN_GOLD_STRONG,
    });

    expect(composition.theme.ambient).toContain(AURELIAN_GOLD);
    expect(composition.theme.key).toBe("warm");
    expect(composition).toHaveProperty("baseOriginX");
    expect(composition).toHaveProperty("finalOriginX");
    expect(composition).toHaveProperty("originY");
  });
});
