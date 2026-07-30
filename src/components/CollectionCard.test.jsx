import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import CollectionCard from "./CollectionCard.jsx";

describe("CollectionCard fragrance artwork", () => {
  it("renders resolved bottle URLs supplied by the presentation model", () => {
    const markup = renderToStaticMarkup(
      <CollectionCard
        perfumes={[
          {
            id: 1,
            name: "Example Fragrance",
            shortName: "Example",
            image: "/images/perfumes/bronze/example.png",
          },
        ]}
      />,
    );

    expect(markup).toContain('class="collection-card-vial-image"');
    expect(markup).toContain('src="/images/perfumes/bronze/example.png"');
    expect(markup).not.toContain('src="perfumes/bronze/example.png"');
  });
});
