import { PerceptualLearningMount } from "../../../components/PerceptualLearningMount.jsx";

// Reached only by a direct/QR link (Phase 4, not implemented yet) -- never
// organically discovered, and it captures personal reflective data, so it
// must not be indexable. No sitemap.js entry either, for the same reason.
export const metadata = {
  title: "Registra lo que notaste — Aurelian",
  robots: { index: false, follow: false },
};

export default function ObservarPage() {
  return (
    <section className="observar-page">
      <PerceptualLearningMount />
    </section>
  );
}
