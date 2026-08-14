import { afterEach, describe, expect, it } from "vitest";
import {
  INTRO_DISMISSED_STORAGE_KEY,
  readIntroDismissedPreference,
  writeIntroDismissedPreference,
} from "./introPreference.js";

const originalWindow = globalThis.window;

function mockWindow({ store = {}, throwOnAccess = false } = {}) {
  globalThis.window = {
    localStorage: {
      getItem: (key) => {
        if (throwOnAccess) throw new Error("storage unavailable");
        return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
      },
      setItem: (key, value) => {
        if (throwOnAccess) throw new Error("storage unavailable");
        store[key] = value;
      },
      removeItem: (key) => {
        if (throwOnAccess) throw new Error("storage unavailable");
        delete store[key];
      },
    },
  };
  return store;
}

afterEach(() => {
  globalThis.window = originalWindow;
});

describe("introPreference", () => {
  it("defaults to expanded (not dismissed) when nothing is stored", () => {
    mockWindow();
    expect(readIntroDismissedPreference()).toBe(false);
  });

  it("reads a stored dismissed preference back as true", () => {
    mockWindow({ store: { [INTRO_DISMISSED_STORAGE_KEY]: "true" } });
    expect(readIntroDismissedPreference()).toBe(true);
  });

  it("treats any stored value other than the literal string \"true\" as not dismissed", () => {
    mockWindow({ store: { [INTRO_DISMISSED_STORAGE_KEY]: "false" } });
    expect(readIntroDismissedPreference()).toBe(false);
  });

  it("is SSR-safe: returns the expanded default when window is undefined, never throws", () => {
    globalThis.window = undefined;
    expect(readIntroDismissedPreference()).toBe(false);
  });

  it("never throws when storage access itself throws (private browsing, quota)", () => {
    mockWindow({ throwOnAccess: true });
    expect(() => readIntroDismissedPreference()).not.toThrow();
    expect(readIntroDismissedPreference()).toBe(false);
  });

  it("writes the dismissed preference as the literal string \"true\"", () => {
    const store = mockWindow();
    writeIntroDismissedPreference(true);
    expect(store[INTRO_DISMISSED_STORAGE_KEY]).toBe("true");
  });

  it("restoring (writing false) removes the stored key entirely, rather than writing a falsy value", () => {
    const store = mockWindow({ store: { [INTRO_DISMISSED_STORAGE_KEY]: "true" } });
    writeIntroDismissedPreference(false);
    expect(Object.prototype.hasOwnProperty.call(store, INTRO_DISMISSED_STORAGE_KEY)).toBe(false);
    expect(readIntroDismissedPreference()).toBe(false);
  });

  it("is SSR-safe on write too: does nothing and never throws when window is undefined", () => {
    globalThis.window = undefined;
    expect(() => writeIntroDismissedPreference(true)).not.toThrow();
  });

  it("never throws when the write itself throws (private browsing, quota)", () => {
    mockWindow({ throwOnAccess: true });
    expect(() => writeIntroDismissedPreference(true)).not.toThrow();
  });

  it("uses a dedicated key, independent of Builder/domain persistence", () => {
    expect(INTRO_DISMISSED_STORAGE_KEY).not.toMatch(/box|builder|discovery/i);
  });
});
