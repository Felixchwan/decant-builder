import { useCallback, useEffect, useId, useRef, useState } from "react";
import { BUILDER_THEME_STYLE_PROPERTIES } from "../../theme/builderTheme.js";

const PORTAL_ROOT_CLASS = "builder-portal-root builder-scope";
const CUSTOM_THEME_CLASS = "builder-theme-root--custom";

export function applyBuilderPortalTheme(portalRoot, themeStyle, isCustomTheme) {
  if (!portalRoot) {
    return;
  }

  portalRoot.className = isCustomTheme
    ? `${PORTAL_ROOT_CLASS} ${CUSTOM_THEME_CLASS}`
    : PORTAL_ROOT_CLASS;

  BUILDER_THEME_STYLE_PROPERTIES.forEach((property) => {
    portalRoot.style.removeProperty(property);
  });

  Object.entries(themeStyle || {}).forEach(([property, value]) => {
    portalRoot.style.setProperty(property, value);
  });
}

export function createBuilderPortalRoot({
  documentLike,
  instanceId,
  themeStyle,
  isCustomTheme,
}) {
  if (!documentLike?.body || typeof documentLike.createElement !== "function") {
    return null;
  }

  const portalRoot = documentLike.createElement("div");
  portalRoot.setAttribute("data-builder-portal-instance", instanceId);
  applyBuilderPortalTheme(portalRoot, themeStyle, isCustomTheme);
  documentLike.body.appendChild(portalRoot);
  return portalRoot;
}

export function removeBuilderPortalRoot(portalRoot) {
  BUILDER_THEME_STYLE_PROPERTIES.forEach((property) => {
    portalRoot?.style?.removeProperty(property);
  });

  if (portalRoot?.parentNode) {
    portalRoot.parentNode.removeChild(portalRoot);
  }
}

export function useBuilderPortalRoot({ themeStyle, isCustomTheme }) {
  const instanceId = useId();
  const [portalRoot, setPortalRoot] = useState(null);
  const ownedPortalRootRef = useRef(null);

  const builderRootRef = useCallback((builderRoot) => {
    if (!builderRoot) {
      const ownedRoot = ownedPortalRootRef.current;
      ownedPortalRootRef.current = null;
      removeBuilderPortalRoot(ownedRoot);
      setPortalRoot((currentRoot) => (currentRoot === ownedRoot ? null : currentRoot));
      return;
    }

    if (ownedPortalRootRef.current) {
      return;
    }

    const mountedThemeStyle = Object.fromEntries(
      BUILDER_THEME_STYLE_PROPERTIES.map((property) => [
        property,
        builderRoot.style.getPropertyValue(property),
      ]),
    );
    const root = createBuilderPortalRoot({
      documentLike: builderRoot.ownerDocument,
      instanceId,
      themeStyle: mountedThemeStyle,
      isCustomTheme: builderRoot.classList.contains(CUSTOM_THEME_CLASS),
    });

    ownedPortalRootRef.current = root;
    setPortalRoot(root);
  }, [instanceId]);

  useEffect(() => {
    applyBuilderPortalTheme(portalRoot, themeStyle, isCustomTheme);
  }, [isCustomTheme, portalRoot, themeStyle]);

  return { builderRootRef, instanceId, portalRoot };
}
