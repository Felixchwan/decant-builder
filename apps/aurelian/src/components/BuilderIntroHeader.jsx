"use client";

import { useState } from "react";
import Link from "next/link";

// Aurelian-owned presentation, not shared Builder UI: this is the static
// intro block above the catalog/Builder (id="builder-entry-header"), a
// plain Next.js page section with no relationship to packages/builder.
// The dismiss/restore toggle below is local, session-only React state --
// never written to storage, never read outside this component, and
// orthogonal to the existing pre-hydration
// visibility mechanism in app/build-your-box/page.jsx (which hides this
// same #builder-entry-header element before hydration for genuine
// first-time visitors, so it doesn't compete with the Discovery Intent
// screen). That mechanism runs once, synchronously, before this component
// ever hydrates; this toggle only ever acts afterward, on a user click, so
// the two never race.
export function BuilderIntroHeader() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (isCollapsed) {
    return (
      <div className="builder-intro-restore-row">
        <button
          type="button"
          className="builder-intro-restore"
          aria-label="Mostrar introducción de Tu Discovery Box"
          onClick={() => setIsCollapsed(false)}
        >
          <span aria-hidden="true">˅</span> Tu Discovery Box
        </button>
      </div>
    );
  }

  return (
    <header id="builder-entry-header" className="page-shell page-intro page-intro--compact">
      <button
        type="button"
        className="builder-intro-dismiss"
        aria-label="Ocultar introducción de Tu Discovery Box"
        onClick={() => setIsCollapsed(true)}
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
