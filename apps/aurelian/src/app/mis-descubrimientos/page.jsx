import { LearnerRecordMount } from "../../components/LearnerRecordMount.jsx";

// The first learner-facing read surface for Perceptual Learning evidence
// (Phase 3.1). Not yet linked from anywhere in the app -- discoverability is
// Phase 3.2 -- and this page writes nothing itself, but it still displays
// personal reflective evidence, so it stays unindexed like its sibling
// capture routes (observar/comparar). No sitemap.js entry either, same reason.
export const metadata = {
  title: "Lo que has estado notando — Aurelian",
  robots: { index: false, follow: false },
};

export default function MisDescubrimientosPage() {
  return (
    <section className="page-shell page-intro learner-record-page">
      <LearnerRecordMount />
    </section>
  );
}
