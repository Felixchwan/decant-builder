import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getBuilderSummarySlot,
  registerBuilderSummarySlot,
  subscribeToBuilderSummarySlot,
  useBuilderSummarySlot,
} from "./builderSummarySlot.js";

const APP_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const read = (...segments) => readFileSync(join(APP_ROOT, ...segments), "utf8").replace(/\r\n/g, "\n");

afterEach(() => registerBuilderSummarySlot(null));

describe("builderSummarySlot: the Builder gets the header slot whichever of the two mounts first", () => {
  // The failure: on a client-side navigation to /build-your-box, SiteHeader (which renders the slot only on
  // that route) and the Builder render in the same commit, so while the Builder renders the slot is not in
  // the DOM yet. The old code read the DOM once at that moment (null) and kept it for the whole visit.
  it("replays the failing timing: a one-time read made before the slot is attached stays null; the store delivers the slot when it attaches", () => {
    const slot = { id: "aurelian-builder-summary-slot" };
    let slotInDom = null;
    const getElementById = () => slotInDom;

    // old behavior: read once while rendering
    const capturedOnce = getElementById("aurelian-builder-summary-slot");

    // new behavior: subscribe, read the current value, then be told when it changes
    const seen = [];
    const unsubscribe = subscribeToBuilderSummarySlot(() => seen.push(getBuilderSummarySlot()));
    expect(getBuilderSummarySlot()).toBeNull();

    // the commit lands: the header attaches the slot
    slotInDom = slot;
    registerBuilderSummarySlot(slot);

    expect(capturedOnce).toBeNull();
    expect(getBuilderSummarySlot()).toBe(slot);
    expect(seen).toEqual([slot]);
    unsubscribe();
  });

  it("hands over a slot that was already attached before the Builder subscribed (a direct load)", () => {
    const slot = { id: "slot" };
    registerBuilderSummarySlot(slot);

    expect(getBuilderSummarySlot()).toBe(slot);
  });

  it("notifies on change only: re-registering the same element is silent, and a different or removed one is announced", () => {
    const first = { id: "first" };
    const second = { id: "second" };
    const listener = vi.fn();
    const unsubscribe = subscribeToBuilderSummarySlot(listener);

    registerBuilderSummarySlot(first);
    registerBuilderSummarySlot(first);
    registerBuilderSummarySlot(second);
    registerBuilderSummarySlot(null);
    registerBuilderSummarySlot(undefined);

    expect(listener).toHaveBeenCalledTimes(3);
    expect(getBuilderSummarySlot()).toBeNull();
    unsubscribe();
  });

  it("stops notifying an unsubscribed listener", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToBuilderSummarySlot(listener);
    unsubscribe();

    registerBuilderSummarySlot({ id: "slot" });

    expect(listener).not.toHaveBeenCalled();
  });

  it("renders null on the server even when a slot is registered, so there is no hydration mismatch", () => {
    registerBuilderSummarySlot({ id: "slot" });
    function Probe() {
      return <span data-slot={String(useBuilderSummarySlot())} />;
    }

    expect(renderToStaticMarkup(<Probe />)).toContain('data-slot="null"');
  });
});

describe("builderSummarySlot: wiring", () => {
  const header = read("src", "components", "SiteHeader.jsx");
  const experience = read("src", "components", "BuilderExperience.jsx");

  it("the header registers its slot through a callback ref, on the one element the Builder route renders", () => {
    expect(header).toContain('import { registerBuilderSummarySlot } from "../lib/builderSummarySlot.js";');
    expect(header).toContain(
      '<div id="aurelian-builder-summary-slot" className="site-header__builder-slot" ref={registerBuilderSummarySlot} />'
    );
    expect(header.match(/aurelian-builder-summary-slot/g)).toHaveLength(1);
  });

  it("the Builder host subscribes to the slot and never reads it from the DOM once", () => {
    expect(experience).toContain("const stickySummaryPortalTarget = useBuilderSummarySlot();");
    expect(experience).toContain("stickySummaryPortalTarget={stickySummaryPortalTarget}");
    expect(experience).not.toMatch(/getElementById\("aurelian-builder-summary-slot"\)/);
    expect(experience).not.toMatch(/\[stickySummaryPortalTarget\]\s*=\s*useState/);
  });

  it("holds no Builder, merchant or React-tree knowledge beyond the slot itself", () => {
    const source = read("src", "lib", "builderSummarySlot.js");

    expect(source).not.toMatch(/@discovery-box|matchMedia|981|980/);
  });
});
