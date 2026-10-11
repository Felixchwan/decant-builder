import { describe, expect, it } from "vitest";
import { createTranslator } from "../../i18n/createTranslator.js";
import { enUS } from "../../i18n/locales/en-US.js";
import { esMX } from "../../i18n/locales/es-MX.js";
import { buildBalanceHelpModel } from "./collectionIntelligenceLabels.js";

const ROWS = [
  { label: "Versatility", level: 4, score: 71 },
  { label: "Breadth", level: 2, score: 33 },
  { label: "Freshness", level: 5, score: 96 },
  { label: "Season Balance", level: 1, score: 8 },
  { label: "Signature Coherence", level: 5, score: 90 },
];

describe("buildBalanceHelpModel", () => {
  it("explains exactly the five dimensions on screen, in their order, in Spanish", () => {
    const model = buildBalanceHelpModel({ rows: ROWS, translator: createTranslator("es-MX") });

    expect(model.title).toBe("Cómo leer este balance");
    expect(model.intro).toBe("Cada indicador describe una dimensión de tu selección. Coherencia de firma requiere al menos 3 fragancias.");
    expect(model.items.map(({ name }) => name)).toEqual([
      "Versatilidad",
      "Amplitud olfativa",
      "Frescura",
      "Balance de temporada",
      "Coherencia de firma",
    ]);
    expect(model.items.map(({ description }) => description)).toEqual([
      "Variedad de usos, ambientes y temporadas en tu caja.",
      "Diversidad de acordes y notas entre tus fragancias.",
      "Presencia de perfiles frescos, limpios, cítricos, acuáticos o verdes.",
      "Qué tan pareja es la presencia relativa de las cuatro estaciones.",
      "Qué tan parecido es el perfil general de tus fragancias considerando notas, acordes, ambientes, ocasiones y temporadas.",
    ]);
    expect(model.footer).toBe("No existe una puntuación ideal: el balance describe tu colección, no la califica.");
  });

  it("has natural English copy for the same structure", () => {
    const model = buildBalanceHelpModel({ rows: ROWS, translator: createTranslator("en-US") });

    expect(model.title).toBe("How to read this balance");
    expect(model.intro).toBe("Each indicator describes one dimension of your selection. Signature Coherence requires at least 3 fragrances.");
    expect(model.items.map(({ description }) => description)).toEqual([
      "Variety of uses, moods and seasons across your box.",
      "Diversity of accords and notes across your fragrances.",
      "Presence of fresh, clean, citrus, aquatic or green profiles.",
      "How even the relative presence of the four seasons is.",
      "How similar the overall profile of your fragrances is across notes, accords, moods, occasions and seasons.",
    ]);
    expect(model.items.map(({ name }) => name)).toEqual([
      "Versatility",
      "Scent Breadth",
      "Freshness",
      "Season Balance",
      "Signature Coherence",
    ]);
    expect(model.footer).toBe("There is no ideal score: the balance describes your collection, it doesn\u2019t grade it.");
  });

  it("says what the metrics measure without exposing weights or implementation: no percentages, formula or index names", () => {
    ["es-MX", "en-US"].forEach((locale) => {
      const model = buildBalanceHelpModel({ rows: ROWS, translator: createTranslator(locale) });
      const everything = [model.intro, model.footer, ...model.items.map(({ description }) => description)].join(" ");

      expect(everything).not.toMatch(/%|\d\.\d|simpson|jaccard|ponder|weight|fórmula|formula/i);
    });
  });

  it("never frames any level as the thing to aim for: the footer says there is no ideal score, in both languages", () => {
    const es = buildBalanceHelpModel({ rows: ROWS, translator: createTranslator("es-MX") });
    const en = buildBalanceHelpModel({ rows: ROWS, translator: createTranslator("en-US") });

    expect(es.footer).toMatch(/No existe una puntuación ideal/);
    expect(en.footer).toMatch(/no ideal score/i);

    [es, en].forEach((model) => {
      const everything = [model.intro, model.footer, ...model.items.map(({ description }) => description)].join(" ").toLowerCase();

      expect(everything).not.toMatch(/\b(mejor|objetivo|meta|best|goal|aim|should)\b/);
    });
  });

  it("describes Signature Coherence as similarity of the overall profile across all five signals, and states its 3-fragrance minimum in the intro", () => {
    const es = buildBalanceHelpModel({ rows: ROWS, translator: createTranslator("es-MX") });
    const en = buildBalanceHelpModel({ rows: ROWS, translator: createTranslator("en-US") });
    const signature = (model) => model.items.find(({ label }) => label === "Signature Coherence").description;

    expect(signature(es)).toMatch(/notas, acordes, ambientes, ocasiones y temporadas/);
    expect(signature(en)).toMatch(/notes, accords, moods, occasions and seasons/);
    expect(es.intro).toMatch(/al menos 3 fragancias/);
    expect(en.intro).toMatch(/at least 3 fragrances/);
  });

  it("is copy only: it never reads or echoes a level or a score, so the same words appear for every box", () => {
    const low = ROWS.map((row) => ({ ...row, level: 1, score: 0 }));
    const high = ROWS.map((row) => ({ ...row, level: 5, score: 100 }));
    const translator = createTranslator("es-MX");

    expect(buildBalanceHelpModel({ rows: low, translator })).toEqual(buildBalanceHelpModel({ rows: high, translator }));
  });

  it("explains only the dimensions it is given, and tolerates missing rows or an unknown label", () => {
    const translator = createTranslator("es-MX");

    expect(
      buildBalanceHelpModel({ rows: [ROWS[0], { label: "Something Else" }], translator }).items.map(({ label }) => label)
    ).toEqual(["Versatility"]);
    expect(buildBalanceHelpModel({ rows: undefined, translator }).items).toEqual([]);
  });

  it("falls back to English copy without a translator, so it never renders a raw key", () => {
    const model = buildBalanceHelpModel({ rows: ROWS, translator: undefined });

    expect(model.title).toBe("How to read this balance");
    expect(JSON.stringify(model)).not.toContain("collectionIntelligence.");
  });

  it("has every help key in both locales", () => {
    ["title", "intro", "versatility", "breadth", "freshness", "seasonBalance", "signatureCoherence", "footer"]
      .map((name) => `collectionIntelligence.balanceHelp.${name}`)
      .forEach((key) => {
        expect(esMX[key], key).toEqual(expect.any(String));
        expect(enUS[key], key).toEqual(expect.any(String));
      });
  });
});
