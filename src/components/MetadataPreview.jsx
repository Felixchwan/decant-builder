import { cloneElement, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const LONG_PRESS_MS = 450;
const VIEWPORT_GUTTER = 12;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function MetadataPreview({ title, image, description, children }) {
  const triggerRef = useRef(null);
  const previewRef = useRef(null);
  const longPressTimeoutRef = useRef(null);
  const lastPointerTypeRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState(null);

  function clearLongPressTimer() {
    if (longPressTimeoutRef.current) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }

  function getPreviewPosition() {
    const trigger = triggerRef.current;

    if (!trigger) {
      return null;
    }

    const triggerRect = trigger.getBoundingClientRect();
    const previewRect = previewRef.current?.getBoundingClientRect();
    const width = previewRect?.width || 168;
    const height = previewRect?.height || 178;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const hasRoomAbove = triggerRect.top >= height + 14;
    const top = hasRoomAbove
      ? triggerRect.top - height - 10
      : Math.min(triggerRect.bottom + 10, viewportHeight - height - VIEWPORT_GUTTER);
    const left = clamp(
      triggerRect.left + triggerRect.width / 2 - width / 2,
      VIEWPORT_GUTTER,
      viewportWidth - width - VIEWPORT_GUTTER
    );

    return {
      left,
      top: Math.max(VIEWPORT_GUTTER, top),
      placement: hasRoomAbove ? "above" : "below",
    };
  }

  function showPreview() {
    const nextPosition = getPreviewPosition();

    if (!nextPosition) {
      return;
    }

    setPosition(nextPosition);
    setIsVisible(true);
  }

  function hidePreview() {
    clearLongPressTimer();
    setIsVisible(false);
  }

  function handlePointerDown(event) {
    lastPointerTypeRef.current = event.pointerType;

    if (event.pointerType !== "touch") {
      return;
    }

    clearLongPressTimer();
    longPressTimeoutRef.current = window.setTimeout(() => {
      showPreview();
    }, LONG_PRESS_MS);
  }

  function handlePointerEnter(event) {
    if (event.pointerType === "touch") {
      return;
    }

    lastPointerTypeRef.current = event.pointerType;
    showPreview();
  }

  function handlePointerEnd(event) {
    if (event.pointerType !== "touch") {
      return;
    }

    hidePreview();
  }

  function handleFocus() {
    if (lastPointerTypeRef.current === "touch") {
      return;
    }

    showPreview();
  }

  function handleClick() {
    if (lastPointerTypeRef.current === "touch") {
      return;
    }

    showPreview();
  }

  useEffect(() => {
    if (!isVisible) {
      return undefined;
    }

    const updatePosition = () => {
      setPosition(getPreviewPosition());
    };
    const dismissPreview = () => {
      hidePreview();
    };

    window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    document.addEventListener("scroll", dismissPreview, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      document.removeEventListener("scroll", dismissPreview, true);
    };
  }, [isVisible]);

  useEffect(() => {
    return () => {
      clearLongPressTimer();
    };
  }, []);

  const trigger = cloneElement(children, {
    ref: triggerRef,
    tabIndex: 0,
    "aria-describedby": isVisible ? "metadata-preview-card" : undefined,
    onMouseEnter: showPreview,
    onMouseLeave: hidePreview,
    onFocus: handleFocus,
    onBlur: hidePreview,
    onClick: handleClick,
    onPointerEnter: handlePointerEnter,
    onPointerDown: handlePointerDown,
    onPointerUp: handlePointerEnd,
    onPointerCancel: handlePointerEnd,
    onPointerLeave: handlePointerEnd,
  });

  return (
    <>
      {trigger}
      {isVisible &&
        position &&
        createPortal(
          <div
            id="metadata-preview-card"
            ref={previewRef}
            className={`metadata-preview-card is-visible is-${position.placement}`}
            style={{
              left: `${position.left}px`,
              top: `${position.top}px`,
            }}
            role="tooltip"
          >
            {image && <img src={image} alt="" loading="lazy" />}
            <strong>{title}</strong>
            {description && <p>{description}</p>}
          </div>,
          document.body
        )}
    </>
  );
}
