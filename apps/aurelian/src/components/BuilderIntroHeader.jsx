"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useIntroPreference } from "./IntroPreferenceProvider.jsx";

// Aurelian-owned presentation, not shared Builder UI: this is the static
// intro block above the catalog/Builder (id="builder-entry-header"), a
// plain Next.js page section with no relationship to packages/builder.
// The dismiss toggle is lifted to IntroPreferenceProvider (see
// app/build-your-box/page.jsx, which wraps this component and BuilderMount
// in that same provider) -- restoring is handled elsewhere entirely, by a
// compact info button integrated into the Builder's own catalog heading
// row once dismissed (a generic, opt-in presentation hook the Builder
// exposes), not by this component. This component itself still never
// touches storage or Builder/domain state directly.
// Orthogonal to the existing pre-hydration visibility mechanism in
// app/build-your-box/page.jsx (which hides this same #builder-entry-header
// element before hydration for genuine first-time visitors, so it doesn't
// compete with the Discovery Intent screen): that mechanism runs once,
// synchronously, before this component ever hydrates; this toggle only
// ever acts afterward, on a user click or the provider's post-mount sync,
// so the two never race.
export function BuilderIntroHeader() {
  const { isIntroDismissed, dismissIntro } = useIntroPreference();
  const measureRef = useRef(null);

  // On desktop, the right-side box panel (packages/builder styles.css's
  // .builder-panel-collapsible-row) pulls itself up by exactly this much,
  // so its start position stays independent of this header's own height --
  // it should read as beginning directly beneath the site's own permanent
  // header, not shifted around by whichever intro state (visible vs.
  // dismissed) currently renders here. Once dismissed this component
  // renders nothing at all (see below), so there is no element left to
  // measure -- the offset explicitly resets to 0px in that branch, rather
  // than silently keeping whatever value was last measured before
  // dismissal (a real, previously-caught bug: ResizeObserver never fires
  // again for an element that no longer exists, so without this explicit
  // reset the property would stay stuck at the expanded intro's height).
  useEffect(() => {
    const element = measureRef.current;
    if (!element || typeof ResizeObserver === "undefined") {
      document.documentElement.style.setProperty("--builder-intro-header-offset", "0px");
      return undefined;
    }

    function recomputeOffset() {
      document.documentElement.style.setProperty(
        "--builder-intro-header-offset",
        `${element.getBoundingClientRect().height}px`
      );
    }

    recomputeOffset();
    const observer = new ResizeObserver(recomputeOffset);
    observer.observe(element);
    return () => observer.disconnect();
  }, [isIntroDismissed]);

  if (isIntroDismissed) {
    return null;
  }

  return (
    <header
      id="builder-entry-header"
      className="page-shell page-intro page-intro--compact"
      ref={measureRef}
    >
      <button
        type="button"
        className="builder-intro-dismiss"
        aria-label="Ocultar introducción de Tu Discovery Box"
        onClick={dismissIntro}
      >
        <span aria-hidden="true">✕</span>
      </button>
      <p className="eyebrow">Tu Discovery Box</p>
      <h1>Elige 6–14 fragancias.</h1>
      <p className="lede">
        Explora el catálogo con calma: no hay una lista de más vendidos, solo lo que quieras
        comparar. Alcanza un mínimo de 12 puntos y solicita por WhatsApp una revisión de
        disponibilidad. Aurelian confirmará antes de compartir instrucciones de pago.
      </p>
      <Link className="text-link" href="/como-funciona">
        Revisar cómo funciona
      </Link>
    </header>
  );
}
