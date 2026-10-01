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

  it("releasing a quick tap (before the long-press timer fires) only opens early when showOnTap is true -- every other trigger keeps today's touch behavior", () => {
    const handlerIndex = metadataPreviewSource.indexOf("function handlePointerEnd(");
    const handlerEnd = metadataPreviewSource.indexOf("function handleFocus(");
    const handlerSource = metadataPreviewSource.slice(handlerIndex, handlerEnd);
    expect(handlerSource).toContain("const wasQuickTap = longPressTimeoutRef.current !== null;");
    expect(handlerSource).toContain("if (wasQuickTap && showOnTap) {");
    expect(handlerSource).toContain("showPreview();");
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
