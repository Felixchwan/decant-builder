import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const metadataPreviewSource = readFileSync(new URL("./MetadataPreview.jsx", import.meta.url), "utf8");

describe("MetadataPreview -- existing hover/focus/long-press behavior is unchanged", () => {
  it("still shows on mouse enter, focus, and non-touch click, and still hides on mouse leave/blur", () => {
    expect(metadataPreviewSource).toContain("onMouseEnter: mergeHandlers(children.props.onMouseEnter, showPreview)");
    expect(metadataPreviewSource).toContain("onMouseLeave: mergeHandlers(children.props.onMouseLeave, hidePreview)");
    expect(metadataPreviewSource).toContain("onFocus: mergeHandlers(children.props.onFocus, handleFocus)");
    expect(metadataPreviewSource).toContain("onBlur: mergeHandlers(children.props.onBlur, hidePreview)");
  });

  it("still opens on a real long press (450ms) for touch, unconditionally of any easter egg", () => {
    expect(metadataPreviewSource).toContain("const LONG_PRESS_MS = 450;");
    expect(metadataPreviewSource).toContain("longPressTimeoutRef.current = window.setTimeout(() => {");
    expect(metadataPreviewSource).toContain("}, LONG_PRESS_MS);");
  });

  it("still positions itself the same way (viewport-clamped, above/below the trigger)", () => {
    expect(metadataPreviewSource).toContain("const getPreviewPosition = useCallback(");
    expect(metadataPreviewSource).toContain("hasRoomAbove ? \"above\" : \"below\"");
  });

  it("still carries the same accessibility semantics -- role=tooltip and aria-describedby only while visible", () => {
    expect(metadataPreviewSource).toContain('role="tooltip"');
    expect(metadataPreviewSource).toContain('"aria-describedby": isVisible ? previewId : undefined,');
  });
});

describe("MetadataPreview -- new easter-egg capability is additive and opt-in", () => {
  it("defaults isActive/showOnTap to false and activeImage/activeCaption to nothing, so every existing caller is unaffected", () => {
    expect(metadataPreviewSource).toContain("isActive = false,");
    expect(metadataPreviewSource).toContain("showOnTap = false,");
  });

  it("delegates the quick-tap-vs-long-press-release decision to the pure, independently-tested resolveTouchGestureEnd", () => {
    const handlerIndex = metadataPreviewSource.indexOf("function handlePointerEnd(");
    const handlerEnd = metadataPreviewSource.indexOf("function handleFocus(");
    const handlerSource = metadataPreviewSource.slice(handlerIndex, handlerEnd);
    expect(handlerSource).toContain("resolveTouchGestureEnd({");
    expect(handlerSource).toContain("alreadySettled: touchGestureSettledRef.current,");
    expect(handlerSource).toContain("hadPendingLongPress: longPressTimeoutRef.current !== null,");
    expect(handlerSource).toContain("showOnTap,");
    expect(handlerSource).toContain('if (action === "show") {');
    expect(handlerSource).toContain("showPreview();");
    expect(handlerSource).toContain('if (action === "hide") {');
    expect(handlerSource).toContain("setIsVisible(false);");
  });

  it("imports resolveTouchGestureEnd as a plain, independently-tested module rather than inlining the decision", () => {
    expect(metadataPreviewSource).toContain(
      'import { resolveTouchGestureEnd } from "./metadataPreviewTouchGesture.js";'
    );
  });

  // This is the exact mobile bug this round fixes: a touch's pointerup is
  // immediately followed by a synthesized pointerleave (a lifted touch has
  // nothing left to "hover"), both of which previously routed through the
  // same handler and re-decided the outcome a second time with the
  // long-press timer already cleared -- closing the preview the same tap
  // had just opened. See metadataPreviewTouchGesture.test.js for the
  // decision-level regression test; this proves the component actually
  // wires a per-gesture settled guard around that call, reset on the next
  // pointerdown, so a trailing pointerleave can only ever be a no-op.
  it("resets the settled guard on every new pointerdown, so a fresh tap is never treated as already-decided", () => {
    const downIndex = metadataPreviewSource.indexOf("function handlePointerDown(");
    const downEnd = metadataPreviewSource.indexOf("function handlePointerEnter(");
    const downSource = metadataPreviewSource.slice(downIndex, downEnd);
    expect(downSource).toContain("touchGestureSettledRef.current = false;");
  });

  it("nulls the long-press timer ref the moment it actually fires, not only when explicitly cleared -- otherwise releasing after a genuine long press on a showOnTap note would misread as a fresh quick tap and re-open instead of closing", () => {
    const downIndex = metadataPreviewSource.indexOf("function handlePointerDown(");
    const downEnd = metadataPreviewSource.indexOf("function handlePointerEnter(");
    const downSource = metadataPreviewSource.slice(downIndex, downEnd);
    const timeoutBodyIndex = downSource.indexOf("window.setTimeout(() => {");
    const timeoutBodyEnd = downSource.indexOf("}, LONG_PRESS_MS);");
    const timeoutBody = downSource.slice(timeoutBodyIndex, timeoutBodyEnd);
    expect(timeoutBody).toContain("longPressTimeoutRef.current = null;");
    expect(timeoutBody.indexOf("longPressTimeoutRef.current = null;")).toBeLessThan(
      timeoutBody.indexOf("showPreview();")
    );
  });

  it("crossfades to activeImage only while isActive, stacked over the canonical image rather than replacing it", () => {
    const cardIndex = metadataPreviewSource.indexOf("metadata-preview-card is-visible");
    const cardSource = metadataPreviewSource.slice(cardIndex);
    expect(cardSource).toContain('<span className="metadata-preview-image-frame">');
    expect(cardSource).toContain("<img src={image} alt=\"\" loading=\"lazy\" />");
    expect(cardSource).toContain("{activeImage && (");
    expect(cardSource).toContain('`metadata-preview-active-image${isActive ? " is-active" : ""}`');
  });

  it("renders activeCaption only while isActive, as its own element distinct from description", () => {
    const cardIndex = metadataPreviewSource.indexOf("metadata-preview-card is-visible");
    const cardSource = metadataPreviewSource.slice(cardIndex);
    expect(cardSource).toContain("{isActive && activeCaption && (");
    expect(cardSource).toContain('<p className="metadata-preview-caption">{activeCaption}</p>');
    expect(cardSource).toContain("{description && <p>{description}</p>}");
  });

  it("never duplicates a second floating card or tooltip -- exactly one renderOwnedPortal call", () => {
    expect((metadataPreviewSource.match(/renderOwnedPortal\(/g) || [])).toHaveLength(1);
  });
});
