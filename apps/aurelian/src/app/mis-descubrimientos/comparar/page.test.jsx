import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CompararPage, { metadata } from "./page.jsx";

describe("CompararPage", () => {
  it("renders without throwing", () => {
    expect(() => renderToStaticMarkup(<CompararPage />)).not.toThrow();
  });

  it("declares noindex metadata", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
