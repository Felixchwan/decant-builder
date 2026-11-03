import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { aurelianConfig } from "../../../apps/aurelian/src/merchant/config.js";
import { discoveryDecantsConfig } from "../../../src/merchants/discoveryDecants/config.js";
import { createBuilderConfig } from "./builder/config/index.js";
import { createTranslator } from "./i18n/createTranslator.js";
import { enUS } from "./i18n/locales/en-US.js";
import { esMX } from "./i18n/locales/es-MX.js";

// BuilderRuntime's App is never rendered whole in this package's tests (see BuilderRuntime.test.jsx), so its wiring is
// pinned as a source contract, the established pattern here; the behaviour itself (label, floating tab, scroll into the
// box, catalog scroll restored on return, focus) is exercised in a real browser against the Aurelian Builder. Beyond
// source text, the two handlers below are also RUN here against a stub window, so capture and restoration are checked
// as behaviour, not only as text.
const runtimeSource = readFileSync(new URL("./BuilderRuntime.jsx", import.meta.url), "utf8");

// Pull the two handlers (and the helper they share) out of the source and build them over injectable state.
const section = runtimeSource.slice(
  runtimeSource.indexOf("const mobileBoxShortcut = "),
  runtimeSource.indexOf("const [panelStickyTop")
);
function buildHandlers({ flag, position, activeMobileTab, scrollY, explorerDisplay = "none", focused = "explore" }) {
  const calls = { tab: [], scrollTo: [], scrollIntoView: [], focus: [] };
  const frames = [];
  const explore = { id: "explore" };
  const box = { focus: (options) => calls.focus.push(options) };
  const win = {
    scrollY,
    requestAnimationFrame: (callback) => frames.push(callback),
    getComputedStyle: (element) => (element === box ? { position } : { display: explorerDisplay }),
    scrollTo: (options) => calls.scrollTo.push(options),
  };
  const doc = { body: { id: "body" }, activeElement: focused === "explore" ? explore : focused === "body" ? { id: "body" } : { id: "other" } };
  if (focused === "body") doc.activeElement = doc.body;
  const refs = {
    savedCatalogScrollRef: { current: null },
    mobileBoxButtonRef: { current: box },
    mobileTabsRef: { current: { scrollIntoView: (options) => calls.scrollIntoView.push(options), querySelector: () => explore } },
  };
  const code = section
    .replace(/useRef\(null\)/g, "null")
    .replace(/const mobileTabsRef = null;\n/, "")
    .replace(/const mobileBoxButtonRef = null;\n/, "")
    .replace(/const savedCatalogScrollRef = null;\n/, "")
    .replace("builderConfig.features?.mobileBoxShortcut === true", "flag")
    .replace(/\n\s*const \[panelStickyTop[\s\S]*$/, "");
  const factory = new Function(
    "flag", "window", "document", "setActiveMobileTab", "activeMobileTab", "mobileTabsRef", "mobileBoxButtonRef", "savedCatalogScrollRef", "typeof_window",
    `${code}\n return { openMobileBoxTab, openMobileCatalogTab };`
  );
  const handlers = factory(flag, win, doc, (tab) => calls.tab.push(tab), activeMobileTab, refs.mobileTabsRef, refs.mobileBoxButtonRef, refs.savedCatalogScrollRef);
  return { ...handlers, calls, refs, flush: () => frames.splice(0).forEach((callback) => callback()), win };
}

describe("features.mobileBoxShortcut: the box tab as a shortcut (opt-in)", () => {
  it("is off by default and for Discovery Decants; Aurelian turns it on", () => {
    expect(aurelianConfig.features.mobileBoxShortcut).toBe(true);
    expect(discoveryDecantsConfig.features.mobileBoxShortcut).toBe(false);
    expect(
      createBuilderConfig({ brand: { businessName: "Test" }, finalization: { whatsappNumber: "5210000000000" } }).features.mobileBoxShortcut
    ).toBe(false);
  });

  it("has a Spanish and an English label, and a host that does not opt in still reads My Box", () => {
    expect(esMX["app.mobileBoxShortcut"]).toBe("Ver caja");
    expect(enUS["app.mobileBoxShortcut"]).toBe("View box");
    expect(createTranslator("en-US").t("general.myBox")).toBe("My Box");
    expect(esMX["general.myBox"]).toBe("Mi caja");
    expect(enUS["general.myBox"]).toBe("My Box");
  });

  it("wires the label and both tabs through the handlers, and changes nothing else about the tab bar", () => {
    expect(runtimeSource).toContain("const mobileBoxShortcut = builderConfig.features?.mobileBoxShortcut === true;");
    expect(runtimeSource).toContain('{mobileBoxShortcut ? t("app.mobileBoxShortcut") : t("general.myBox")} <span>{totalSlots}</span>');
    expect(runtimeSource).toMatch(/onClick=\{openMobileBoxTab\}\s+ref=\{mobileBoxButtonRef\}\s+aria-controls="my-box-panel"\s+aria-selected=\{activeMobileTab === "box"\}/);
    expect(runtimeSource).toMatch(/onClick=\{openMobileCatalogTab\}\s+aria-controls="catalog-panel"\s+aria-selected=\{activeMobileTab === "catalog"\}/);
    expect(runtimeSource).toContain('<nav className="mobile-builder-tabs" aria-label={t("app.mobileTabs")} ref={mobileTabsRef}>');
    expect(runtimeSource.match(/mobile-builder-tabs/g)).toHaveLength(1); // no second control, no new markup
  });

  it("keeps the catalog position in a ref, never in storage, state or the URL", () => {
    expect(runtimeSource).toContain("const savedCatalogScrollRef = useRef(null);");
    const region = runtimeSource.slice(
      runtimeSource.indexOf("const mobileTabsRef = useRef(null);"),
      runtimeSource.indexOf("const [panelStickyTop")
    );
    expect(region).toContain("savedCatalogScrollRef");
    expect(region).not.toMatch(/localStorage|sessionStorage|history\.|location\./);
    expect(region).not.toMatch(/useState/);
  });

  it("captures the catalog scroll when the box opens from the floating shortcut, and jumps (not animates) to the box", () => {
    const { openMobileBoxTab, calls, refs, flush } = buildHandlers({ flag: true, position: "fixed", activeMobileTab: "catalog", scrollY: 4321 });
    openMobileBoxTab();
    expect(calls.tab).toEqual(["box"]);
    expect(refs.savedCatalogScrollRef.current).toBe(4321);
    flush();
    expect(calls.scrollIntoView).toEqual([{ block: "start", behavior: "instant" }]);
  });

  it("restores that position, exactly once, when the reader returns to the catalog", () => {
    const { openMobileCatalogTab, calls, refs, flush } = buildHandlers({ flag: true, position: "fixed", activeMobileTab: "box", scrollY: 90 });
    refs.savedCatalogScrollRef.current = 4321;
    openMobileCatalogTab();
    expect(calls.tab).toEqual(["catalog"]);
    expect(refs.savedCatalogScrollRef.current).toBeNull(); // consumed immediately: a later visit never reuses it
    expect(calls.scrollTo).toEqual([]); // not before the catalog is back on screen
    flush();
    expect(calls.scrollTo).toEqual([{ top: 4321, behavior: "instant" }]);
  });

  it("does not restore on a first visit, on initial load, or when nothing was captured", () => {
    const { openMobileCatalogTab, calls, flush } = buildHandlers({ flag: true, position: "fixed", activeMobileTab: "box", scrollY: 0 });
    openMobileCatalogTab();
    flush();
    expect(calls.scrollTo).toEqual([]);
    // the runtime never scrolls by itself at mount: scrolling lives only inside the two click handlers
    expect(runtimeSource.match(/savedCatalogScrollRef/g).length).toBeGreaterThan(0);
    expect(runtimeSource.slice(0, runtimeSource.indexOf("const mobileBoxShortcut"))).not.toMatch(/scrollTo|scrollIntoView/);
  });

  it("captures and scrolls only while the host has actually floated the button; the package's own tab bar is untouched", () => {
    for (const config of [{ flag: false, position: "fixed" }, { flag: true, position: "static" }, { flag: true, position: "sticky" }]) {
      const { openMobileBoxTab, calls, refs, flush } = buildHandlers({ ...config, activeMobileTab: "catalog", scrollY: 999 });
      openMobileBoxTab();
      flush();
      expect(calls.tab).toEqual(["box"]); // the tab still switches
      expect(refs.savedCatalogScrollRef.current).toBeNull(); // nothing captured
      expect(calls.scrollIntoView).toEqual([]); // nothing scrolled
    }
  });

  it("does not capture when the box is already open, and never restores for a host without the flag", () => {
    const open = buildHandlers({ flag: true, position: "fixed", activeMobileTab: "box", scrollY: 777 });
    open.openMobileBoxTab();
    expect(open.refs.savedCatalogScrollRef.current).toBeNull();
    const off = buildHandlers({ flag: false, position: "fixed", activeMobileTab: "box", scrollY: 0 });
    off.refs.savedCatalogScrollRef.current = 55;
    off.openMobileCatalogTab();
    off.flush();
    expect(off.calls.scrollTo).toEqual([]);
    expect(off.calls.focus).toEqual([]);
  });

  it("moves keyboard focus to the shortcut when Explorar, which the host hides while the catalog shows, had it", () => {
    for (const focused of ["explore", "body"]) {
      const { openMobileCatalogTab, calls, flush } = buildHandlers({ flag: true, position: "fixed", activeMobileTab: "box", scrollY: 0, explorerDisplay: "none", focused });
      openMobileCatalogTab();
      flush();
      expect(calls.focus).toEqual([{ preventScroll: true }]); // never scrolls the page by focusing
    }
    // focus somewhere else is left alone, and so is focus on a still-visible Explorar (the package's own bar)
    const elsewhere = buildHandlers({ flag: true, position: "fixed", activeMobileTab: "box", scrollY: 0, focused: "other" });
    elsewhere.openMobileCatalogTab();
    elsewhere.flush();
    expect(elsewhere.calls.focus).toEqual([]);
    const visible = buildHandlers({ flag: true, position: "fixed", activeMobileTab: "box", scrollY: 0, explorerDisplay: "block", focused: "explore" });
    visible.openMobileCatalogTab();
    visible.flush();
    expect(visible.calls.focus).toEqual([]);
  });

  it("does not touch the shared stylesheet", () => {
    const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
    expect(styles).not.toContain("mobileBoxShortcut");
    expect(styles).not.toContain("Ver caja");
  });
});
