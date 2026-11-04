import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  EDGE_TAB_BOTTOM_PX,
  EDGE_TAB_ZONE_MARGIN_PX,
  FOOTER_NEAR_ATTRIBUTE,
  observeFooterNearEdgeTab,
} from "./footerEdgeTabClearance.js";

const APP_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const read = (...segments) => readFileSync(join(APP_ROOT, ...segments), "utf8").replace(/\r\n/g, "\n");

// A DOM-like document and an IntersectionObserver that records what it was given (no jsdom in this repo).
function createFakes({ footer = { id: "footer" } } = {}) {
  const attributes = new Map();
  const doc = {
    querySelector: vi.fn(() => footer),
    documentElement: {
      setAttribute: (name, value) => attributes.set(name, value),
      removeAttribute: (name) => attributes.delete(name),
      hasAttribute: (name) => attributes.has(name),
    },
  };
  const instances = [];

  class FakeObserver {
    constructor(callback, options) {
      this.callback = callback;
      this.options = options;
      this.observed = [];
      this.disconnected = false;
      instances.push(this);
    }

    observe(element) {
      this.observed.push(element);
    }

    disconnect() {
      this.disconnected = true;
    }
  }

  return { doc, FakeObserver, instances, attributes };
}

describe("observeFooterNearEdgeTab: the phone edge tab steps aside while the footer is in its band", () => {
  it("creates ONE observer, on the footer, once", () => {
    const { doc, FakeObserver, instances } = createFakes();

    observeFooterNearEdgeTab({ doc, ObserverClass: FakeObserver });

    expect(instances).toHaveLength(1);
    expect(instances[0].observed).toEqual([{ id: "footer" }]);
    expect(doc.querySelector).toHaveBeenCalledTimes(1);
    expect(doc.querySelector).toHaveBeenCalledWith("footer.site-footer");
  });

  it("shrinks the observer's root from the bottom by the tab's bottom offset plus a margin, and nowhere else", () => {
    const { doc, FakeObserver, instances } = createFakes();

    observeFooterNearEdgeTab({ doc, ObserverClass: FakeObserver });

    expect(EDGE_TAB_BOTTOM_PX).toBe(120);
    expect(instances[0].options).toEqual({ rootMargin: `0px 0px -${EDGE_TAB_BOTTOM_PX + EDGE_TAB_ZONE_MARGIN_PX}px 0px` });
    expect(instances[0].options.rootMargin).toBe("0px 0px -160px 0px");
  });

  it("sets the attribute when the footer enters the band and clears it when it leaves", () => {
    const { doc, FakeObserver, instances, attributes } = createFakes();

    observeFooterNearEdgeTab({ doc, ObserverClass: FakeObserver });
    instances[0].callback([{ isIntersecting: true }]);
    expect(attributes.has(FOOTER_NEAR_ATTRIBUTE)).toBe(true);

    instances[0].callback([{ isIntersecting: false }]);
    expect(attributes.has(FOOTER_NEAR_ATTRIBUTE)).toBe(false);
  });

  it("follows the LAST entry when several are batched", () => {
    const { doc, FakeObserver, instances, attributes } = createFakes();

    observeFooterNearEdgeTab({ doc, ObserverClass: FakeObserver });
    instances[0].callback([{ isIntersecting: false }, { isIntersecting: true }]);

    expect(attributes.has(FOOTER_NEAR_ATTRIBUTE)).toBe(true);
  });

  it("disconnects on cleanup and leaves no attribute behind", () => {
    const { doc, FakeObserver, instances, attributes } = createFakes();
    const cleanup = observeFooterNearEdgeTab({ doc, ObserverClass: FakeObserver });

    instances[0].callback([{ isIntersecting: true }]);
    cleanup();

    expect(instances[0].disconnected).toBe(true);
    expect(attributes.has(FOOTER_NEAR_ATTRIBUTE)).toBe(false);
  });

  it("does nothing, harmlessly, when there is no footer or no IntersectionObserver", () => {
    const noFooter = createFakes({ footer: null });
    const noObserver = createFakes();

    expect(() => observeFooterNearEdgeTab({ doc: noFooter.doc, ObserverClass: noFooter.FakeObserver })()).not.toThrow();
    expect(noFooter.instances).toHaveLength(0);
    expect(() => observeFooterNearEdgeTab({ doc: noObserver.doc, ObserverClass: null })()).not.toThrow();
    expect(noObserver.attributes.size).toBe(0);
  });

  it("keeps its state to one attribute: no storage, no scroll listener, no timer, no polling", () => {
    const code = read("src", "lib", "footerEdgeTabClearance.js").replace(/^\s*\/\/.*$/gm, "");

    expect(code).not.toMatch(/localStorage|sessionStorage|addEventListener|setInterval|setTimeout|requestAnimationFrame|scrollY|scroll"/);
    expect(code.match(/new ObserverClass\(/g)).toHaveLength(1);
  });
});

describe("the band matches the tab's own CSS, and the hook is wired once for the Builder route", () => {
  const css = read("src", "app", "builder-suggestions.css").replace(/\/\*[\s\S]*?\*\//g, "");
  const experience = read("src", "components", "BuilderExperience.jsx");

  it("uses the same 120px minimum bottom offset as the tab", () => {
    expect(css).toContain(`bottom: max(${EDGE_TAB_BOTTOM_PX}px, calc(env(safe-area-inset-bottom) + 104px));`);
  });

  it("hides the tab with a plain display change while the attribute is set, inside the phone query, and nothing is animated", () => {
    const rule = css.match(/html\[data-footer-near\]([^{]+)\{([^}]*)\}/);

    expect(rule).not.toBeNull();
    expect(rule[1]).toContain("+ .suggestions-edge-tab");
    expect(rule[2].trim()).toBe("display: none;");
    expect(css.indexOf("html[data-footer-near]")).toBeGreaterThan(css.indexOf("@media (max-width: 619px)"));
    expect(css.indexOf("html[data-footer-near]")).toBeLessThan(css.indexOf("@media (prefers-reduced-motion"));
    expect(css).not.toMatch(/transition/);
  });

  it("Ver caja is left alone by the footer rule (it never meets the footer's links)", () => {
    const rule = css.match(/html\[data-footer-near\]([^{]+)\{/)[1];

    expect(rule).not.toContain("last-child");
  });

  it("the attribute name in the CSS is the one the script sets", () => {
    expect(FOOTER_NEAR_ATTRIBUTE).toBe("data-footer-near");
  });

  it("is mounted by BuilderExperience (the Builder route only), exactly once", () => {
    expect(experience).toContain('import { useFooterNearEdgeTab } from "../lib/footerEdgeTabClearance.js";');
    expect(experience.match(/useFooterNearEdgeTab\(\);/g)).toHaveLength(1);
  });
});
