import { ComparisonMount } from "../../../components/ComparisonMount.jsx";

// Reached only by a direct/QR link (Phase 4, not implemented yet) -- never
// organically discovered, and it captures personal reflective data, so it
// must not be indexable. No sitemap.js entry either, for the same reason.
export const metadata = {
  title: "Compara dos fragancias — Aurelian",
  robots: { index: false, follow: false },
};

export default function CompararPage() {
  return (
    <section className="page-shell page-intro comparar-page">
      <ComparisonMount />
    </section>
  );
}
