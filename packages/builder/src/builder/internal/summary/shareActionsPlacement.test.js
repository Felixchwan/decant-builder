import { describe, expect, it } from "vitest";
import { getShareActionsPlacement } from "./shareActionsPlacement.js";

describe("getShareActionsPlacement", () => {
  it("is 'panel' by default and for every host that does not opt in, whatever the dock state", () => {
    expect(getShareActionsPlacement()).toBe("panel");
    expect(getShareActionsPlacement({})).toBe("panel");

    [true, false].forEach((isSummaryDocked) =>
      [true, false].forEach((isSummaryCollapsed) => {
        expect(getShareActionsPlacement({ isSummaryDocked, isSummaryCollapsed })).toBe("panel");
        expect(getShareActionsPlacement({ dockShareActions: false, isSummaryDocked, isSummaryCollapsed })).toBe("panel");
      })
    );
  });

  it("moves into the summary only when opted in, docked and expanded", () => {
    expect(getShareActionsPlacement({ dockShareActions: true, isSummaryDocked: true, isSummaryCollapsed: false })).toBe("summary");
    expect(getShareActionsPlacement({ dockShareActions: true, isSummaryDocked: true })).toBe("summary");
  });

  it("stays in the panel when opted in but the summary is inline (below the docking breakpoint) or collapsed", () => {
    expect(getShareActionsPlacement({ dockShareActions: true, isSummaryDocked: false })).toBe("panel");
    expect(getShareActionsPlacement({ dockShareActions: true, isSummaryDocked: true, isSummaryCollapsed: true })).toBe("panel");
  });

  it("only honors a literal true, so a stray truthy value can never opt a host in by accident", () => {
    expect(getShareActionsPlacement({ dockShareActions: "yes", isSummaryDocked: true })).toBe("panel");
    expect(getShareActionsPlacement({ dockShareActions: 1, isSummaryDocked: true })).toBe("panel");
  });
});
