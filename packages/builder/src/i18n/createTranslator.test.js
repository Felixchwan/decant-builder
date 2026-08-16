import { describe, expect, it } from "vitest";

import { createTranslator, normalizeLocale } from "./createTranslator.js";
import { enUS } from "./locales/en-US.js";
import { esMX } from "./locales/es-MX.js";

describe("createTranslator", () => {
  it("resolves English copy for en-US", () => {
    const translator = createTranslator("en-US");

    expect(translator.locale).toBe("en-US");
    expect(translator.t("general.catalog")).toBe("Catalog");
    expect(translator.t("composer.composeMyBox")).toBe("Compose My Box");
  });

  it("resolves Mexican Spanish copy for es-MX", () => {
    const translator = createTranslator("es-MX");

    expect(translator.locale).toBe("es-MX");
    expect(translator.t("general.catalog")).toBe("Catálogo");
    expect(translator.t("composer.composeMyBox")).toBe("Armar mi caja");
  });

  it("falls back safely for unsupported locales and missing keys", () => {
    expect(normalizeLocale("fr-FR")).toBe("en-US");
    expect(createTranslator("fr-FR").t("general.myBox")).toBe("My Box");
    expect(createTranslator("es-MX").t("future.missing.key")).toBe("future.missing.key");
  });

  it("keeps canonical taxonomy values separate from display labels", () => {
    const translator = createTranslator("es-MX");

    expect(translator.label("seasons", "winter")).toBe("Invierno");
    expect("winter").toBe("winter");
  });

  it("keeps locale dictionaries in key parity", () => {
    expect(Object.keys(esMX).sort()).toEqual(Object.keys(enUS).sort());
  });

  it("keeps merchant names out of shared dictionaries", () => {
    const dictionaryValues = Object.values({ ...enUS, ...esMX }).join("\n");

    expect(dictionaryValues).not.toMatch(/Discovery Decants|Aurelian/);
  });

  // Regression for a real duplicate-pill bug: "night" and "evening" are two
  // genuinely distinct canonical occasion values (both present as separate
  // tags on real catalog perfumes -- one perfume even carries both at once
  // -- each with its own dedicated metadata icon), correctly distinguished
  // in English ("Night" vs "Evening") but both mistranslated to the same
  // "Noche" in es-MX, so Composer rendered two pills with an identical
  // label under Ocasión. The fix belongs at this locale-mapping layer, not
  // by deduping at render time -- the two options must stay genuinely
  // distinct (different keys, different values), just no longer sharing
  // one Spanish word.
  it("gives night and evening distinct es-MX labels, not a collapsed duplicate", () => {
    const translator = createTranslator("es-MX");

    const night = translator.label("occasions", "night");
    const evening = translator.label("occasions", "evening");

    expect(night).toBe("Noche");
    expect(evening).not.toBe("Noche");
    expect(evening).not.toBe(night);
    expect(evening).toBe("Atardecer");
  });
});
