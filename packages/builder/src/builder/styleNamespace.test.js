import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const builderCss = readFileSync(new URL("../../styles.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const originalRulesStart = builderCss.indexOf(":where(.builder-scope) .app {");
const transformedOriginalRules = builderCss.slice(originalRulesStart);
const BASELINE_SHA256 = "5672c88368be3c27e13e92877b2dc530552434859b48bff26d8afc19ee9f07da";
const unitDefinitions = [...builderCss.matchAll(/(--builder-unit-(\d+)):\s*([\d.]+)px;/g)];
const unitReferences = [...builderCss.matchAll(/var\((--builder-unit-(\d+))\)/g)];

function remMagnitude(tokenDigits) {
  return Number(tokenDigits) / 100;
}

function splitSelectors(selectorList) {
  const selectors = [];
  let start = 0;
  let round = 0;
  let square = 0;
  for (let index = 0; index < selectorList.length; index += 1) {
    const char = selectorList[index];
    if (char === "(") round += 1;
    else if (char === ")") round -= 1;
    else if (char === "[") square += 1;
    else if (char === "]") square -= 1;
    else if (char === "," && round === 0 && square === 0) {
      selectors.push(selectorList.slice(start, index).trim());
      start = index + 1;
    }
  }
  selectors.push(selectorList.slice(start).trim());
  return selectors;
}

function collectRuleSelectors(css, insideKeyframes = false) {
  const selectors = [];
  let cursor = 0;
  while (cursor < css.length) {
    const open = css.indexOf("{", cursor);
    if (open < 0) break;
    let start = open;
    while (start > cursor && !/[;}]/.test(css[start - 1])) start -= 1;
    const prelude = css.slice(start, open).trim();
    let depth = 1;
    let close = open + 1;
    while (depth && close < css.length) {
      if (css[close] === "{") depth += 1;
      else if (css[close] === "}") depth -= 1;
      close += 1;
    }
    const body = css.slice(open + 1, close - 1);
    if (/^@keyframes\b/.test(prelude)) {
      collectRuleSelectors(body, true);
    } else if (/^@(?:media|supports|container|layer)\b/.test(prelude)) {
      selectors.push(...collectRuleSelectors(body, insideKeyframes));
    } else if (!prelude.startsWith("@") && !insideKeyframes) {
      selectors.push(...splitSelectors(prelude));
    }
    cursor = close;
  }
  return selectors;
}

describe("Builder stylesheet namespace", () => {
  it("recovers the normalized baseline by removing only the approved namespace and unit substitution", () => {
    const recovered = transformedOriginalRules
      .replace(/:where\(\.builder-scope\) ?/g, "")
      .replace(/var\(--builder-unit-(\d+)\)/g, (_, digits) => `${remMagnitude(digits)}rem`);
    expect(createHash("sha256").update(recovered).digest("hex")).toBe(BASELINE_SHA256);
    expect((builderCss.match(/!important/g) || [])).toHaveLength(17);
    expect((builderCss.match(/color-mix\(/g) || [])).toHaveLength(141);
    expect((builderCss.match(/var\([^,()]+,/g) || [])).toHaveLength(222);
  });

  it("defines a complete fixed-length token set for every former rem magnitude", () => {
    expect(builderCss).not.toMatch(/\brem\b/);
    expect(unitReferences).toHaveLength(242);
    expect(unitDefinitions).toHaveLength(98);

    const referencedNames = new Set(unitReferences.map((match) => match[1]));
    const desktopDefinitions = new Map(unitDefinitions.slice(0, 49).map((match) => [match[1], Number(match[3])]));
    const responsiveDefinitions = new Map(unitDefinitions.slice(49).map((match) => [match[1], Number(match[3])]));

    expect(referencedNames.size).toBe(49);
    expect([...desktopDefinitions.keys()]).toEqual([...responsiveDefinitions.keys()]);
    expect(new Set(desktopDefinitions.keys())).toEqual(referencedNames);

    desktopDefinitions.forEach((value, name) => {
      const magnitude = remMagnitude(name.match(/(\d+)$/)[1]);
      expect(value).toBeCloseTo(magnitude * 18, 8);
      expect(responsiveDefinitions.get(name)).toBeCloseTo(magnitude * 16, 8);
      expect(name).not.toMatch(/aurelian|discovery|merchant/i);
    });

    expect(builderCss).toMatch(/^:where\(\.builder-scope\)\s*\{\s*--builder-unit-/);
    expect(builderCss).not.toMatch(/^(?:html|body|:root)[^{]*\{[^}]*--builder-unit-/m);
  });

  it("binds every ordinary selector to the neutral scope exactly once", () => {
    const selectors = collectRuleSelectors(builderCss);
    expect(selectors).toHaveLength(1211);
    selectors.forEach((selector) => {
      expect(selector.startsWith(":where(.builder-scope)")).toBe(true);
      expect(selector.match(/:where\(\.builder-scope\)/g)).toHaveLength(1);
      expect(selector).not.toMatch(/^:where\(\.builder-scope\)\s+\.builder-(?:theme|portal)-root/);
    });
    expect(selectors.some((selector) => /^(?:html|body|#root)(?:\b|\s|[.#:[>+~])/.test(selector))).toBe(false);
  });

  it("keeps collision-prone host classes behind the namespace", () => {
    for (const className of ["app", "modal-overlay", "ghost-button", "perfume-card"]) {
      expect(collectRuleSelectors(builderCss)).toContain(`:where(.builder-scope) .${className}`);
      expect(collectRuleSelectors(builderCss)).not.toContain(`.${className}`);
    }
  });

  it("keeps keyframe steps unprefixed and all named keyframes unchanged", () => {
    expect([...builderCss.matchAll(/@keyframes\s+([\w-]+)/g)].map((match) => match[1])).toHaveLength(14);
    expect(builderCss).not.toMatch(/:where\(\.builder-scope\)\s+(?:from|to|\d+(?:\.\d+)?%)(?:\s|,|\{)/);
  });
});
