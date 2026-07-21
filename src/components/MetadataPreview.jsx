import { cloneElement, useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

const LONG_PRESS_MS = 450;
const VIEWPORT_GUTTER = 12;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function MetadataPreview({ title, image, description, children }) {
  const previewId = useId();
  const triggerRef = useRef(null);
  const previewRef = useRef(null);
  const longPressTimeoutRef = useRef(null);
  const lastPointerTypeRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState(null);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimeoutRef.current) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }, []);

  const getPreviewPosition = useCallback(() => {
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
  }, []);

  const showPreview = useCallback(() => {
    const nextPosition = getPreviewPosition();

    if (!nextPosition) {
      return;
    }

    setPosition(nextPosition);
    setIsVisible(true);
  }, [getPreviewPosition]);

  const hidePreview = useCallback(() => {
    clearLongPressTimer();
    setIsVisible(false);
  }, [clearLongPressTimer]);

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
  }, [getPreviewPosition, hidePreview, isVisible]);

  useEffect(() => {
    return () => {
      clearLongPressTimer();
    };
  }, [clearLongPressTimer]);

  function mergeHandlers(childHandler, previewHandler) {
    return (event) => {
      childHandler?.(event);

      if (!event.defaultPrevented) {
        previewHandler(event);
      }
    };
  }

  /* eslint-disable react-hooks/refs -- MetadataPreview composes a trigger ref through cloneElement; ref.current is only read later in handlers/effects. */
  const trigger = cloneElement(children, {
    ref: triggerRef,
    tabIndex: 0,
    "aria-describedby": isVisible ? previewId : undefined,
    onMouseEnter: mergeHandlers(children.props.onMouseEnter, showPreview),
    onMouseLeave: mergeHandlers(children.props.onMouseLeave, hidePreview),
    onFocus: mergeHandlers(children.props.onFocus, handleFocus),
    onBlur: mergeHandlers(children.props.onBlur, hidePreview),
    onClick: mergeHandlers(children.props.onClick, handleClick),
    onPointerEnter: mergeHandlers(children.props.onPointerEnter, handlePointerEnter),
    onPointerDown: mergeHandlers(children.props.onPointerDown, handlePointerDown),
    onPointerUp: mergeHandlers(children.props.onPointerUp, handlePointerEnd),
    onPointerCancel: mergeHandlers(children.props.onPointerCancel, handlePointerEnd),
    onPointerLeave: mergeHandlers(children.props.onPointerLeave, handlePointerEnd),
  });
  /* eslint-enable react-hooks/refs */

  return (
    <>
      {trigger}
      {isVisible &&
        position &&
        createPortal(
          <div
            id={previewId}
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
