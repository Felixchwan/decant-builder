import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MisDescubrimientosPage, { metadata } from "./page.jsx";

describe("MisDescubrimientosPage", () => {
  it("renders without throwing", () => {
    expect(() => renderToStaticMarkup(<MisDescubrimientosPage />)).not.toThrow();
  });

  it("declares noindex metadata", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
