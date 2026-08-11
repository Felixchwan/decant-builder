import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ObservarPage, { metadata } from "./page.jsx";

describe("ObservarPage", () => {
  it("renders without throwing", () => {
    expect(() => renderToStaticMarkup(<ObservarPage />)).not.toThrow();
  });

  it("declares noindex metadata", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
