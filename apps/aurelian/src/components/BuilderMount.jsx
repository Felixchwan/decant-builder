"use client";

import dynamic from "next/dynamic";

const BuilderExperience = dynamic(
  () => import("./BuilderExperience.jsx").then((module) => module.BuilderExperience),
  { ssr: false, loading: () => <p className="builder-loading">Preparando tu catálogo…</p> },
);

export function BuilderMount({ isDevelopment = false }) {
  return <BuilderExperience isDevelopment={isDevelopment} />;
}
