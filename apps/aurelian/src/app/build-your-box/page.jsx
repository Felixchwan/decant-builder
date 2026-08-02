import { BuilderMount } from "../../components/BuilderMount.jsx";

export const metadata = { title: "Build Your Box", description: "Selecciona entre 6 y 14 fragancias para crear tu Discovery Box Aurelian.", alternates: { canonical: "/build-your-box" } };

export default function BuilderPage() {
  return <section className="builder-page"><header className="page-shell page-intro page-intro--compact"><p className="eyebrow">Build Your Box</p><h1>Diseña tu Discovery Box.</h1><p>La finalización en línea aún no está disponible. Tu selección permanecerá guardada en este dispositivo.</p></header><BuilderMount isDevelopment={process.env.NODE_ENV === "development"} /></section>;
}
