import { describe, expect, it } from "vitest";

import { createTranslator, normalizeLocale } from "./createTranslator.js";

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

  it("falls back to English when a supported locale is missing a translation", () => {
    const translator = createTranslator("es-MX");

    expect(translator.t("test.englishOnly")).toBe("English fallback");
  });

  it("keeps canonical taxonomy values separate from display labels", () => {
    const translator = createTranslator("es-MX");

    expect(translator.label("seasons", "winter")).toBe("Invierno");
    expect("winter").toBe("winter");
  });
});
