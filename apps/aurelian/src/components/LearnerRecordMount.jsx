"use client";

import dynamic from "next/dynamic";

// Same client-only mount pattern as PerceptualLearningMount.jsx/ComparisonMount.jsx:
// LearnerRecordContainer reads window.localStorage on mount, so it must never
// attempt to render on the server. Kept as its own small mount rather than
// generalizing the existing two, per this codebase's established preference
// to leave shipped Perceptual Learning files untouched.
const LearnerRecordContainer = dynamic(
  () => import("./LearnerRecordView.jsx").then((module) => module.LearnerRecordContainer),
  { ssr: false, loading: () => <p className="learner-record-loading">Cargando…</p> },
);

export function LearnerRecordMount() {
  return <LearnerRecordContainer />;
}
