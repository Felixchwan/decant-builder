import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { execPath } from "node:process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { createMerchantCatalog } from "./createMerchantCatalog.js";

describe("createMerchantCatalog", () => {
  const first = Object.freeze({ id: 1, name: "One", points: 1 });
  const second = Object.freeze({ id: 2, name: "Two", points: 1.5 });

  it("projects canonical records in explicit availability order", () => {
    const source = [first, second];
    const availableIds = [2, 1];
    const projected = createMerchantCatalog({ source, availableIds });

    expect(projected).toEqual([second, first]);
    expect(projected).not.toBe(source);
    expect(projected[0]).toBe(second);
    expect(projected[1]).toBe(first);
    expect(source).toEqual([first, second]);
    expect(availableIds).toEqual([2, 1]);
  });

  it("accepts an explicit empty availability list", () => {
    const source = [first];
    const projected = createMerchantCatalog({ source, availableIds: [] });
    expect(projected).toEqual([]);
    expect(projected).not.toBe(source);
  });

  it("rejects duplicate source IDs", () => {
    expect(() => createMerchantCatalog({
      source: [first, { id: 1, name: "Duplicate" }],
      availableIds: [1],
    })).toThrow("source contains duplicate ID 1");
  });

  it("rejects duplicate available IDs", () => {
    expect(() => createMerchantCatalog({
      source: [first],
      availableIds: [1, 1],
    })).toThrow("availableIds contains duplicate ID 1");
  });

  it("rejects unknown IDs", () => {
    expect(() => createMerchantCatalog({
      source: [first],
      availableIds: [99],
    })).toThrow("availableIds contains unknown ID 99");
  });

  it.each([
    ["source", [{ id: "1" }], []],
    ["source", [{ id: Number.NaN }], []],
    ["source", [{ id: Number.POSITIVE_INFINITY }], []],
    ["availableIds", [first], ["1"]],
    ["availableIds", [first], [Number.NaN]],
    ["availableIds", [first], [Number.NEGATIVE_INFINITY]],
  ])("rejects nonnumeric or nonfinite %s IDs", (owner, source, availableIds) => {
    expect(() => createMerchantCatalog({ source, availableIds })).toThrow(
      new RegExp(`${owner} contains invalid ID`)
    );
  });

  it.each([
    undefined,
    {},
    { source: {}, availableIds: [] },
    { source: [], availableIds: {} },
  ])("rejects malformed inputs", (input) => {
    expect(() => createMerchantCatalog(input)).toThrow(/must be an array/);
  });

  it("imports in plain Node without browser, React, or Vite dependencies", () => {
    const moduleUrl = new URL("./createMerchantCatalog.js", import.meta.url);
    const output = execFileSync(
      execPath,
      ["--input-type=module", "--eval", `await import(${JSON.stringify(moduleUrl.href)}); console.log("safe");`],
      { encoding: "utf8" }
    );
    const source = readFileSync(fileURLToPath(moduleUrl), "utf8");

    expect(output.trim()).toBe("safe");
    expect(source).not.toMatch(/\b(?:window|document|navigator|localStorage|React)\b/);
    expect(source).not.toContain("import.meta.env");
  });
});
