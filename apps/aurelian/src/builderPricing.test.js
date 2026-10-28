import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { createTranslator } from "../../../packages/builder/src/i18n/createTranslator.js";
import { discoveryDecantsConfig } from "../../../src/merchants/discoveryDecants/config.js";
import { aurelianConfig } from "./merchant/config.js";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (...segments) => readFileSync(join(APP_ROOT, ...segments), "utf8");
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

// Aurelian's customer-facing pricing is direct MXN: tier chips, the box summary and the Curator
// Bonus progress read as amounts, while points stay the internal measure. Discovery Decants
// shares the Builder but keeps its points presentation.
describe("Aurelian money-first builder pricing", () => {
  it("opts in to price display, and Discovery Decants does not", () => {
    expect(aurelianConfig.commerce.priceDisplay).toBe("price");
    expect(discoveryDecantsConfig.commerce.priceDisplay).toBe("points");
    // the underlying model is unchanged: 12 points x $100 is the box minimum
    expect(aurelianConfig.box.minPoints).toBe(12);
    expect(aurelianConfig.commerce.pointValue).toBe(100);
  });

  it("explains the box in the Tu Discovery Box intro: 5 ml decants, 6-14 fragrances, the MXN minimum, no points", () => {
    const header = read("src", "components", "BuilderIntroHeader.jsx");
    const lede = header.slice(header.indexOf('<p className="lede">'), header.indexOf("</p>", header.indexOf('<p className="lede">'))).replace(/\s+/g, " ");
    const minimum = (aurelianConfig.box.minPoints * aurelianConfig.commerce.pointValue).toLocaleString(aurelianConfig.commerce.locale);

    expect(lede).toContain("Cada fragancia es un decant de 5 ml");
    expect(lede).toContain("entre 6 y 14");
    expect(lede).toContain(`mínimo de $${minimum} MXN`);
    expect(lede).toContain("cada una muestra su precio");
    expect(lede).not.toMatch(/punto/i);
    expect(header).toContain("<h1>Elige 6–14 fragancias.</h1>");
  });

  it("labels the box summary Fragancias and Total MXN in Spanish, with no Espacios or Puntos wording", () => {
    const { t } = createTranslator("es-MX");

    expect(t("general.slots")).toBe("Fragancias");
    expect(t("general.orderTotalCompact")).toBe("Total MXN");
    expect(t("filter.sort.pointsAsc")).toBe("Precio: menor a mayor");
    expect(t("filter.sort.pointsDesc")).toBe("Precio: mayor a menor");
    expect(t("builder.introLine2")).toBe("Llega a $1,200 MXN para desbloquear selecciones Curator Bonus.");
    expect(t("curator.pickValue")).toBe("Equivale a $200 MXN en valor bonus.");
    // English (Discovery Decants) keeps its own wording
    expect(createTranslator("en-US").t("general.slots")).toBe("Slots");
    expect(createTranslator("en-US").t("general.orderTotalCompact")).toBe("Total");
  });

  it("gives the tier price chip the same radius as the Agregar button, in the one Buttons rule", () => {
    const geometry = stripComments(read("src", "app", "builder-geometry.css"));
    const rule = [...geometry.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({ selector, body })).find(({ selector }) => selector.includes(".perfume-card-compact-actions button"));

    expect(rule.body.trim()).toBe("border-radius: 8px;");
    expect(rule.selector).toContain(".builder-page .perfume-card-points");
    // and nothing sizes the chip: it keeps the package's own max-content width so it fits any price
    const everyAurelianCss = ["builder-geometry.css", "builder-actions.css", "builder-mobile.css", "builder-catalog-grid.css"].map((file) => stripComments(read("src", "app", file))).join("\n");
    const chipRules = [...everyAurelianCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, selector]) => selector.includes("perfume-card-points"));
    chipRules.forEach(([, selector, body]) => expect(body, selector).not.toMatch(/(?:^|[;\s])(?:width|min-width|max-width|padding[\w-]*)\s*:/));
  });

  it("shows the phone summary as two balanced columns now that the Puntos panel is gone", () => {
    const mobile = stripComments(read("src", "app", "builder-mobile.css"));

    expect(mobile).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(mobile).not.toContain("repeat(3, minmax(0, 1fr))");
  });
});
