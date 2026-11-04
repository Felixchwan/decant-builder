import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getBuilderBoxShortcut,
  registerBuilderBoxShortcut,
  subscribeToBuilderBoxShortcut,
  useBuilderBoxShortcut,
} from "./builderBoxShortcut.js";

const APP_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const read = (...segments) => readFileSync(join(APP_ROOT, ...segments), "utf8").replace(/\r\n/g, "\n");

afterEach(() => registerBuilderBoxShortcut(null));

describe("builderBoxShortcut: the Builder's box action, handed to the header across sibling trees", () => {
  it("starts empty, and holds whatever the Builder last published", () => {
    const open = () => {};

    expect(getBuilderBoxShortcut()).toBeNull();
    registerBuilderBoxShortcut({ count: 3, open });
    expect(getBuilderBoxShortcut()).toEqual({ count: 3, open });
  });

  it("tells every subscriber when it changes, and stops telling one that unsubscribed", () => {
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = subscribeToBuilderBoxShortcut(first);
    subscribeToBuilderBoxShortcut(second);

    registerBuilderBoxShortcut({ count: 1, open: () => {} });
    stopFirst();
    registerBuilderBoxShortcut({ count: 2, open: () => {} });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
  });

  it("does not re-notify for the same count and the same action", () => {
    const open = () => {};
    const listener = vi.fn();

    registerBuilderBoxShortcut({ count: 2, open });
    subscribeToBuilderBoxShortcut(listener);
    registerBuilderBoxShortcut({ count: 2, open });
    registerBuilderBoxShortcut({ count: 2, open });
    registerBuilderBoxShortcut({ count: 3, open });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("notices a new action even at the same count (a stale handler is replaced, never kept)", () => {
    const listener = vi.fn();

    registerBuilderBoxShortcut({ count: 2, open: () => "old" });
    subscribeToBuilderBoxShortcut(listener);
    registerBuilderBoxShortcut({ count: 2, open: () => "new" });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getBuilderBoxShortcut().open()).toBe("new");
  });

  it("unregisters: null (or undefined) clears it, and clearing twice is silent", () => {
    const listener = vi.fn();

    registerBuilderBoxShortcut({ count: 1, open: () => {} });
    subscribeToBuilderBoxShortcut(listener);
    registerBuilderBoxShortcut(null);
    registerBuilderBoxShortcut(undefined);

    expect(getBuilderBoxShortcut()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("calls the Builder's own function: the store neither wraps nor re-implements the action", () => {
    const open = vi.fn();

    registerBuilderBoxShortcut({ count: 1, open });
    getBuilderBoxShortcut().open();

    expect(open).toHaveBeenCalledTimes(1);
    expect(getBuilderBoxShortcut().open).toBe(open);
  });

  it("renders as null on the server, so the server markup (and so hydration) is always the default call to action", () => {
    function Probe() {
      return <span>{useBuilderBoxShortcut() === null ? "none" : "some"}</span>;
    }

    registerBuilderBoxShortcut({ count: 4, open: () => {} });

    expect(renderToStaticMarkup(<Probe />)).toBe("<span>none</span>");
  });

  it("is not persisted anywhere", () => {
    const code = read("src", "lib", "builderBoxShortcut.js").replace(/^\s*\/\/.*$/gm, "");

    expect(code).not.toMatch(/localStorage|sessionStorage|document\.|window\.|dispatchEvent|querySelector/);
  });
});

describe("SiteHeader: the mobile menu's call to action", () => {
  const header = read("src", "components", "SiteHeader.jsx");

  it("is the box action only inside the Builder, with at least one fragrance in the box", () => {
    expect(header).toContain('const isBuilderRoute = pathname.startsWith("/build-your-box");');
    expect(header).toContain("const showBoxShortcut = isBuilderRoute && boxShortcut !== null && boxShortcut.count >= 1;");
    expect(header).toContain("const boxShortcut = useBuilderBoxShortcut();");
  });

  it("says 'Ver mi caja' (never Checkout) as a button, and 'Construye tu Discovery Box' as the link everywhere else", () => {
    expect(header).toContain('<button type="button" className="button" onClick={openBox}>Ver mi caja</button>');
    expect(header).toContain('<Link className="button" href="/build-your-box" onClick={() => closeMenu()}>Construye tu Discovery Box</Link>');
    expect(header).not.toMatch(/checkout/i);
  });

  it("shows no count in the label", () => {
    expect(header).not.toMatch(/Ver mi caja[^<]*\{/);
    expect(header).not.toMatch(/\{boxShortcut\.count\}/);
  });

  it("closes the menu WITHOUT restoring focus to 'Menú', then runs the Builder's own action", () => {
    const start = header.indexOf("function openBox()");
    const body = header.slice(start, header.indexOf("return (", start));

    expect(body).toContain("closeMenu();");
    expect(body).not.toContain("restoreFocus: true");
    expect(body.indexOf("closeMenu();")).toBeLessThan(body.indexOf("boxShortcut.open();"));
    expect(body).toContain("boxShortcut.open();");
  });

  it("does not reach the Builder any other way", () => {
    const code = header.replace(/^\s*\/\/.*$/gm, "");

    expect(code).not.toMatch(/querySelector|dispatchEvent|localStorage|\.click\(\)/);
    expect(code).not.toMatch(/scrollTo|scrollIntoView|setActiveMobileTab/);
  });

  it("keeps the unchanged Escape handling, with focus restored to 'Menú' for Escape only", () => {
    expect(header).toContain('event.key === "Escape"');
    expect(header).toContain("closeMenu({ restoreFocus: true });");
  });
});

describe("BuilderExperience: wires the host pieces", () => {
  const experience = read("src", "components", "BuilderExperience.jsx");

  it("hands the Builder the store's register function and the Monterrey context", () => {
    expect(experience).toContain('import { registerBuilderBoxShortcut } from "../lib/builderBoxShortcut.js";');
    expect(experience).toContain('import { getMonterreyTodayContext } from "../lib/monterreyContext.js";');
    expect(experience).toContain("onBoxShortcutChange={registerBuilderBoxShortcut}");
    expect(experience).toContain("getTodayContext={getMonterreyTodayContext}");
  });

  it("passes a STABLE function (a module export, never an inline arrow), so the Builder does not re-publish on every render", () => {
    expect(experience).not.toMatch(/onBoxShortcutChange=\{\(/);
    expect(experience).not.toMatch(/getTodayContext=\{\(/);
  });
});
