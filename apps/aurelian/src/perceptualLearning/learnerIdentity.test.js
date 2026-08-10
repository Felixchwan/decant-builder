import { describe, expect, it } from "vitest";
import { createLearnerId, isValidLearnerId, resolveLearnerId } from "./learnerIdentity.js";

describe("learnerIdentity", () => {
  it("creates distinct, sufficiently long ids", () => {
    const first = createLearnerId();
    const second = createLearnerId();

    expect(typeof first).toBe("string");
    expect(first.length).toBeGreaterThanOrEqual(8);
    expect(first).not.toBe(second);
  });

  it("validates ids by shape, not by strict UUID format", () => {
    expect(isValidLearnerId(createLearnerId())).toBe(true);
    expect(isValidLearnerId("short")).toBe(false);
    expect(isValidLearnerId("")).toBe(false);
    expect(isValidLearnerId("   ")).toBe(false);
    expect(isValidLearnerId(null)).toBe(false);
    expect(isValidLearnerId(undefined)).toBe(false);
    expect(isValidLearnerId(12345678)).toBe(false);
  });

  it("resolves an existing valid id unchanged", () => {
    const existing = createLearnerId();

    expect(resolveLearnerId(existing)).toBe(existing);
  });

  it("resolves a missing or invalid id to a freshly created one", () => {
    expect(isValidLearnerId(resolveLearnerId(null))).toBe(true);
    expect(isValidLearnerId(resolveLearnerId(undefined))).toBe(true);
    expect(isValidLearnerId(resolveLearnerId("bad"))).toBe(true);
    expect(resolveLearnerId("bad")).not.toBe("bad");
  });
});
