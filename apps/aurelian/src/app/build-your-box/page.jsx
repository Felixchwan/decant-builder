import { BuilderIntroHeader } from "../../components/BuilderIntroHeader.jsx";
import { BuilderMount } from "../../components/BuilderMount.jsx";
import { IntroPreferenceProvider } from "../../components/IntroPreferenceProvider.jsx";

export const metadata = { title: "Construye tu Discovery Box", description: "Selecciona 6–14 fragancias para crear tu Discovery Box Aurelian.", alternates: { canonical: "/build-your-box" } };

// Every visitor enters the Builder directly, at every width: there is no "what are you looking for today"
// screen in front of it (the Composer and the proposal tools do that job from inside the Builder). The entry
// header above it is therefore always part of the first paint, with nothing that has to hide it before
// hydration; whether it stays visible after that is the visitor's own dismissal (IntroPreferenceProvider).
export default function BuilderPage() {
  // Analytics environment lookup happens here, not inside BuilderExperience
  // (the client Builder boundary) -- same rule this app already follows for
  // isDevelopment (see hostEnvironmentBoundary.test.js): the host page reads
  // its own environment once and passes plain props down, so the client
  // Builder component itself never needs to know it's running in Next.js.
  // No production provider config is read here: analyticsDebugEnabled only
  // ever turns on the console-only development logger (never a network
  // call) -- see apps/aurelian/src/analytics/README.md.
  return <section className="builder-page"><IntroPreferenceProvider><BuilderIntroHeader /><BuilderMount isDevelopment={process.env.NODE_ENV === "development"} analyticsDebugEnabled={process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true"} /></IntroPreferenceProvider></section>;
}
