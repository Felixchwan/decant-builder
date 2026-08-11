"use client";

import dynamic from "next/dynamic";

// Same client-only mount pattern as PerceptualLearningMount.jsx/BuilderMount.jsx:
// ComparisonCaptureFlow depends on window.location/window.localStorage, so it
// must never attempt to render on the server. Kept as its own small mount
// rather than generalizing PerceptualLearningMount.jsx, per the approved
// Phase 2.1 plan's preference to leave Phase 1 shipped code untouched.
const ComparisonCaptureFlow = dynamic(
  () => import("./ComparisonCaptureFlow.jsx").then((module) => module.ComparisonCaptureFlow),
  { ssr: false, loading: () => <p className="comparison-capture-loading">Cargando…</p> },
);

export function ComparisonMount() {
  return <ComparisonCaptureFlow />;
}
