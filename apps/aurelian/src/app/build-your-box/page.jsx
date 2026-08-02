import Link from "next/link";
import { BuilderMount } from "../../components/BuilderMount.jsx";

export const metadata = { title: "Construye tu Discovery Box", description: "Selecciona 6–14 fragancias para crear tu Discovery Box Aurelian.", alternates: { canonical: "/build-your-box" } };

export default function BuilderPage() {
  return <section className="builder-page"><header className="page-shell page-intro page-intro--compact"><p className="eyebrow">Tu Discovery Box</p><h1>Elige 6–14 fragancias.</h1><p className="lede">Explora el catálogo, alcanza un mínimo de 12 puntos y guarda tu selección en este dispositivo. La finalización todavía no está habilitada.</p><Link className="text-link" href="/como-funciona">Revisar cómo funciona</Link></header><BuilderMount isDevelopment={process.env.NODE_ENV === "development"} /></section>;
}
