import { BuilderIntroHeader } from "../../components/BuilderIntroHeader.jsx";
import { BuilderMount } from "../../components/BuilderMount.jsx";
import { IntroPreferenceProvider } from "../../components/IntroPreferenceProvider.jsx";
import { aurelianConfig } from "../../merchant/config.js";
import { FRAGRANCE_QUERY_PARAM, FRAGRANCE_ID_PATTERN } from "../../lib/parseFragranceIntent.js";

export const metadata = { title: "Construye tu Discovery Box", description: "Selecciona 6–14 fragancias para crear tu Discovery Box Aurelian.", alternates: { canonical: "/build-your-box" } };

// WHY THIS MUST RUN INLINE, DURING PARSING (not as a normal client component):
// the header below is static server-rendered HTML, painted before any client
// JS runs. Whether it should stay visible depends on client-only localStorage
// state that only BuilderExperience can read — but BuilderExperience lives in
// a code-split, ssr:false chunk that only starts loading after first paint
// (measured on a warm production build: ~60ms after the document itself is
// already paintable). A normal React effect, or the .discovery-intent CSS
// rule in globals.css alone, can only react once that chunk has loaded,
// parsed, and rendered — which is exactly the gap that produces the flash.
// Running as a blocking inline <script> positioned right after the header
// means it executes synchronously as the browser parses that point in the
// document, before layout/paint, closing the gap entirely.
//
// WHY THE CSS RULE IN globals.css STILL EXISTS TOO: this script only decides
// the header's *first-paint* state. Once BuilderExperience actually mounts
// and (for a first-time visitor) renders .discovery-intent, the CSS rule
// `body:has(.discovery-intent) #builder-entry-header { display:none }` is
// what keeps the header hidden for the rest of that view — including if the
// visitor later navigates back to it client-side, where this script (parsed
// only once, on the original HTML load) would never re-run. The two are
// complementary, not redundant: this script closes the pre-hydration gap,
// the CSS rule governs everything from hydration onward.
//
// This performs the exact same shallow existence check BuilderExperience
// performs — not persistence validation, just "does a value exist under this
// key" — using the same storage key and the same fragrance-param identity
// (FRAGRANCE_QUERY_PARAM / FRAGRANCE_ID_PATTERN) so the two can't drift
// apart silently. See entryHeaderVisibility test coverage in
// BuilderExperience.test.jsx, which executes this exact script text against
// BuilderExperience's real gate to catch any future disagreement. If this
// script fails for any reason, the header simply stays visible — never worse
// than before this existed.
//
// FUTURE CONSTRAINT (documented only, nothing implemented here): this is a
// literal inline <script> with no nonce or hash. If a Content-Security-Policy
// disallowing inline scripts is ever introduced for this app, this script
// will need a nonce or a hashed-source CSP allowance to keep running — no CSP
// exists in this app today (see apps/aurelian/next.config.js), so no such
// machinery is added now.
export const ENTRY_HEADER_VISIBILITY_SCRIPT = `
try {
  var params = new URLSearchParams(window.location.search);
  var values = params.getAll(${JSON.stringify(FRAGRANCE_QUERY_PARAM)});
  var hasFragranceLink = values.length === 1 && new RegExp(${JSON.stringify(FRAGRANCE_ID_PATTERN.source)}).test(values[0]);
  var hasBox = window.localStorage.getItem(${JSON.stringify(aurelianConfig.persistence.storageKey)}) !== null;
  if (!hasFragranceLink && !hasBox) {
    var header = document.getElementById('builder-entry-header');
    if (header) header.style.display = 'none';
  }
} catch (e) {}
`;

export default function BuilderPage() {
  // Analytics environment lookup happens here, not inside BuilderExperience
  // (the client Builder boundary) -- same rule this app already follows for
  // isDevelopment (see hostEnvironmentBoundary.test.js): the host page reads
  // its own environment once and passes plain props down, so the client
  // Builder component itself never needs to know it's running in Next.js.
  // No production provider config is read here: analyticsDebugEnabled only
  // ever turns on the console-only development logger (never a network
  // call) -- see apps/aurelian/src/analytics/README.md.
  return <section className="builder-page"><IntroPreferenceProvider><BuilderIntroHeader /><script dangerouslySetInnerHTML={{ __html: ENTRY_HEADER_VISIBILITY_SCRIPT }} /><BuilderMount isDevelopment={process.env.NODE_ENV === "development"} analyticsDebugEnabled={process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true"} /></IntroPreferenceProvider></section>;
}
