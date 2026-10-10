import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { getShareActionsPlacement } from "./shareActionsPlacement.js";
import { getSummaryDockedState } from "./summaryDocking.js";

describe("getSummaryDockedState", () => {
  it("docks only with both a portal target and a desktop viewport", () => {
    const target = { nodeType: 1 };

    expect(getSummaryDockedState({ hasTarget: target, isDesktop: true })).toBe(true);
    expect(getSummaryDockedState({ hasTarget: target, isDesktop: false })).toBe(false);
    expect(getSummaryDockedState({ hasTarget: null, isDesktop: true })).toBe(false);
    expect(getSummaryDockedState({ hasTarget: undefined, isDesktop: true })).toBe(false);
    expect(getSummaryDockedState({ hasTarget: null, isDesktop: false })).toBe(false);
  });

  // The sequence that broke: the host renders the Builder before its portal target exists (a client-side
  // navigation commits the header and the Builder together), then supplies the target. Re-deriving on
  // every change of either input gives the right answer at each step; capturing the first answer does not.
  it("follows a target that arrives after the first render on a desktop viewport", () => {
    const target = { nodeType: 1 };
    const isDesktop = true;

    const first = getSummaryDockedState({ hasTarget: null, isDesktop });
    const afterTargetArrives = getSummaryDockedState({ hasTarget: target, isDesktop });
    const afterTargetGoes = getSummaryDockedState({ hasTarget: null, isDesktop });

    expect([first, afterTargetArrives, afterTargetGoes]).toEqual([false, true, false]);
    // a one-time capture of the first render's answer is exactly the bug: it stays false once the target exists
    const capturedOnce = first;
    expect(capturedOnce).not.toBe(afterTargetArrives);
  });

  it("follows the viewport crossing the breakpoint both ways with the target present", () => {
    const target = { nodeType: 1 };

    expect(
      [true, false, true].map((isDesktop) => getSummaryDockedState({ hasTarget: target, isDesktop }))
    ).toEqual([true, false, true]);
  });

  it("is a pure function of its two inputs, with no host vocabulary", () => {
    expect(getSummaryDockedState.length).toBe(1);
    expect(getSummaryDockedState.toString()).not.toMatch(/aurelian|discovery.?decants|document|window/i);
  });
});

describe("desktop invariants (docked state drives the minimize control, the accessory rail and the inline header)", () => {
  // The Builder renders the minimize/expand control only while docked, and puts the share actions in the
  // docked card (the host's rail) only while docked AND expanded. So, with a target present:
  const target = { nodeType: 1 };
  const state = ({ isDesktop, collapsed }) => {
    const docked = getSummaryDockedState({ hasTarget: target, isDesktop });
    return {
      docked,
      minimizeOrExpandControl: docked,
      shareActionsPlacement: getShareActionsPlacement({
        dockShareActions: true,
        isSummaryDocked: docked,
        isSummaryCollapsed: collapsed,
      }),
    };
  };

  it(">=981px, box expanded: docked, minimize control present, share actions go to the docked accessory", () => {
    expect(state({ isDesktop: true, collapsed: false })).toEqual({
      docked: true,
      minimizeOrExpandControl: true,
      shareActionsPlacement: "summary",
    });
  });

  it(">=981px, box collapsed: still docked, expand control present, no accessory (the actions stay out of sight in the panel flow)", () => {
    expect(state({ isDesktop: true, collapsed: true })).toEqual({
      docked: true,
      minimizeOrExpandControl: true,
      shareActionsPlacement: "panel",
    });
  });

  it("<=980px: inline, no docked portal, no minimize control, no accessory -- whatever the collapsed preference", () => {
    for (const collapsed of [false, true]) {
      expect(state({ isDesktop: false, collapsed })).toEqual({
        docked: false,
        minimizeOrExpandControl: false,
        shareActionsPlacement: "panel",
      });
    }
  });

  it("with no portal target the summary is never docked, at any width", () => {
    expect(getSummaryDockedState({ hasTarget: null, isDesktop: true })).toBe(false);
  });

  it("the Builder wires the control and the placement to exactly this docked state", () => {
    const panel = readFileSync(new URL("../../../components/BuilderPanel.jsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");

    expect(panel).toContain("{isSummaryDocked && (");
    expect(panel).toContain('className="summary-collapse-toggle summary-collapse-toggle--strip"');
    expect(panel).toContain("const isDockedAndCollapsed = isSummaryDocked && isSummaryCollapsed;");
    expect(panel).toContain("isSummaryDocked,\n    isSummaryCollapsed,\n  });");
  });
});
