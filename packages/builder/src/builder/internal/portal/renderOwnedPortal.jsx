import { createPortal } from "react-dom";

export function renderOwnedPortal(content, portalRoot, createPortalLike = createPortal) {
  if (!portalRoot) {
    return null;
  }

  return createPortalLike(content, portalRoot);
}
