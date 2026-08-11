"use client";

import dynamic from "next/dynamic";

// Same client-only mount pattern as BuilderMount.jsx: ObservationCaptureFlow
// depends on window.location/window.localStorage, so it must never attempt
// to render on the server.
const ObservationCaptureFlow = dynamic(
  () => import("./ObservationCaptureFlow.jsx").then((module) => module.ObservationCaptureFlow),
  { ssr: false, loading: () => <p className="observation-capture-loading">Cargando…</p> },
);

export function PerceptualLearningMount() {
  return <ObservationCaptureFlow />;
}
