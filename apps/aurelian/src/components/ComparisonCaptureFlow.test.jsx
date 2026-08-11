import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import {
  ComparisonCaptureFlow,
  ComparisonConfirmation,
  ComparisonDoneState,
  ComparisonFragrancePicker,
  ComparisonPromptForm,
  canSubmitComparison,
  getComparisonCandidates,
  resolveInitialFirstFragrance,
} from "./ComparisonCaptureFlow.jsx";
import { COMPARISON_PROMPT_LABEL } from "../perceptualLearning/comparisonPromptCopy.js";
import { aurelianCatalog } from "../merchant/catalog.js";

const originalWindow = globalThis.window;

function mockWindow({ search = "", storage } = {}) {
  const spyableStorage = storage ?? {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };

  globalThis.window = {
    location: { href: `https://aurelianperfumes.com/mis-descubrimientos/comparar${search}`, search },
    localStorage: spyableStorage,
  };

  return spyableStorage;
}

afterEach(() => {
  globalThis.window = originalWindow;
});

describe("comparisonPromptCopy", () => {
  it("stays neutral, with no note-identification, rating, or right/wrong language", () => {
    expect(COMPARISON_PROMPT_LABEL).not.toMatch(
      /\bnotas?\b|acorde|calificaci|puntaj|correcto|incorrecto|mejor que|peor que|preferenc/i
    );
  });
});

describe("resolveInitialFirstFragrance", () => {
  it("resolves the fragrance for a valid ?fragrance= id", () => {
    mockWindow({ search: "?fragrance=1" });

    const fragrance = resolveInitialFirstFragrance();

    expect(fragrance).not.toBeNull();
    expect(fragrance.id).toBe(1);
    expect(fragrance).toBe(aurelianCatalog.find((item) => item.id === 1));
  });

  it("returns null when the query param is missing or unresolvable", () => {
    mockWindow({ search: "" });
    expect(resolveInitialFirstFragrance()).toBeNull();

    mockWindow({ search: "?fragrance=abc" });
    expect(resolveInitialFirstFragrance()).toBeNull();

    mockWindow({ search: "?fragrance=999999999" });
    expect(resolveInitialFirstFragrance()).toBeNull();
  });
});

describe("getComparisonCandidates", () => {
  it("returns the full catalog (filtered by query) when nothing is excluded", () => {
    const results = getComparisonCandidates({ query: "" });

    expect(results.length).toBe(aurelianCatalog.length);
  });

  it("excludes the given fragrance id from the results", () => {
    const excludedId = aurelianCatalog[0].id;

    const results = getComparisonCandidates({ query: "", excludedFragranceId: excludedId });

    expect(results.some((item) => item.id === excludedId)).toBe(false);
    expect(results.length).toBe(aurelianCatalog.length - 1);
  });
});

describe("canSubmitComparison", () => {
  it("requires non-blank freeText", () => {
    expect(canSubmitComparison({ freeText: "algo" })).toBe(true);
    expect(canSubmitComparison({ freeText: "" })).toBe(false);
    expect(canSubmitComparison({ freeText: "   " })).toBe(false);
    expect(canSubmitComparison({ freeText: undefined })).toBe(false);
  });
});

describe("ComparisonFragrancePicker", () => {
  it("renders without context for the first-fragrance step", () => {
    const markup = renderToStaticMarkup(
      <ComparisonFragrancePicker
        label="Elige la primera fragancia."
        query=""
        onQueryChange={() => {}}
        results={[{ id: 1, brand: "Aurelian", name: "No. 1" }]}
        onSelect={() => {}}
      />
    );

    expect(markup).toContain("comparison-picker");
    expect(markup).toContain("Elige la primera fragancia.");
    expect(markup).toContain("Aurelian");
    expect(markup).not.toContain("Primera:");
    expect(markup).not.toContain("Ver lo que he notado");
  });

  it("renders with first-fragrance context for the second-fragrance step", () => {
    const markup = renderToStaticMarkup(
      <ComparisonFragrancePicker
        label="Elige la segunda fragancia."
        contextFragranceName="Aurelian No. 1"
        query=""
        onQueryChange={() => {}}
        results={[]}
        onSelect={() => {}}
      />
    );

    expect(markup).toContain("Aurelian No. 1");
    expect(markup).toContain("Elige la segunda fragancia.");
  });
});

describe("ComparisonPromptForm", () => {
  it("shows the first fragrance before the second, in order", () => {
    const markup = renderToStaticMarkup(
      <ComparisonPromptForm
        firstFragranceName="Aurelian Primera"
        secondFragranceName="Aurelian Segunda"
        freeText=""
        onFreeTextChange={() => {}}
        submitError={null}
        canSubmit={false}
        isSubmitting={false}
        onSubmit={() => {}}
      />
    );

    expect(markup.indexOf("Aurelian Primera")).toBeGreaterThanOrEqual(0);
    expect(markup.indexOf("Aurelian Segunda")).toBeGreaterThan(markup.indexOf("Aurelian Primera"));
    expect(markup).toContain(COMPARISON_PROMPT_LABEL);
  });

  it("disables submit when canSubmit is false and enables it when true", () => {
    const disabledMarkup = renderToStaticMarkup(
      <ComparisonPromptForm
        firstFragranceName="A"
        secondFragranceName="B"
        freeText=""
        onFreeTextChange={() => {}}
        submitError={null}
        canSubmit={false}
        isSubmitting={false}
        onSubmit={() => {}}
      />
    );
    expect(disabledMarkup).toMatch(/<button[^>]*disabled/);

    const enabledMarkup = renderToStaticMarkup(
      <ComparisonPromptForm
        firstFragranceName="A"
        secondFragranceName="B"
        freeText="algo"
        onFreeTextChange={() => {}}
        submitError={null}
        canSubmit
        isSubmitting={false}
        onSubmit={() => {}}
      />
    );
    expect(enabledMarkup).not.toMatch(/<button[^>]*disabled/);
  });

  it("shows no rating, preference, or note checkboxes", () => {
    const markup = renderToStaticMarkup(
      <ComparisonPromptForm
        firstFragranceName="A"
        secondFragranceName="B"
        freeText=""
        onFreeTextChange={() => {}}
        submitError={null}
        canSubmit={false}
        isSubmitting={false}
        onSubmit={() => {}}
      />
    );

    expect(markup).not.toMatch(/type="checkbox"|type="radio"|type="range"/);
  });

  it("never renders the learner-record link in the pre-submit prompt, including a failed-submit state (Phase 3.2)", () => {
    const withError = renderToStaticMarkup(
      <ComparisonPromptForm
        firstFragranceName="A"
        secondFragranceName="B"
        freeText="algo"
        onFreeTextChange={() => {}}
        submitError="No pudimos guardar tu comparación. Intenta de nuevo."
        canSubmit
        isSubmitting={false}
        onSubmit={() => {}}
      />
    );
    expect(withError).not.toContain("Ver lo que he notado");
    expect(withError).not.toContain('href="/mis-descubrimientos"');
  });
});

describe("ComparisonConfirmation", () => {
  it("quotes the exact freeText and preserves first/second order", () => {
    const markup = renderToStaticMarkup(
      <ComparisonConfirmation
        firstFragranceName="Aurelian Primera"
        secondFragranceName="Aurelian Segunda"
        comparison={{ freeText: "Esta se siente más fría; la otra más suave." }}
        onCompareAnother={() => {}}
        onDone={() => {}}
      />
    );

    expect(markup).toContain("Esta se siente más fría; la otra más suave.");
    expect(markup.indexOf("Aurelian Primera")).toBeLessThan(markup.indexOf("Aurelian Segunda"));
    expect(markup).toContain("Comparar otras dos");
    expect(markup).toContain("Listo");
    expect(markup).not.toMatch(/<ul|<ol|historial|anteriores/i);
  });

  it("links back to the learner record at exactly /mis-descubrimientos (Phase 3.2)", () => {
    const markup = renderToStaticMarkup(
      <ComparisonConfirmation
        firstFragranceName="Aurelian Primera"
        secondFragranceName="Aurelian Segunda"
        comparison={{ freeText: "x" }}
        onCompareAnother={() => {}}
        onDone={() => {}}
      />
    );

    expect(markup).toContain("Ver lo que he notado");
    expect(markup).toContain('href="/mis-descubrimientos"');
  });
});

describe("ComparisonDoneState", () => {
  it("renders a static terminal state with no link to a nonexistent history route", () => {
    const markup = renderToStaticMarkup(<ComparisonDoneState />);

    expect(markup).toContain("Gracias por comparar");
    expect(markup).not.toContain("mis-descubrimientos\"");
    expect(markup).not.toMatch(/<a\s/);
  });
});

describe("ComparisonCaptureFlow", () => {
  it("renders the first-fragrance picker when no deep link is present", () => {
    mockWindow({ search: "" });

    const markup = renderToStaticMarkup(<ComparisonCaptureFlow />);

    expect(markup).toContain("comparison-picker");
    expect(markup).toContain("Elige la primera fragancia.");
  });

  it("skips straight to the second-fragrance picker when a valid deep link resolves fragrance A", () => {
    mockWindow({ search: "?fragrance=1" });

    const markup = renderToStaticMarkup(<ComparisonCaptureFlow />);

    expect(markup).toContain("comparison-picker");
    expect(markup).toContain("Elige la segunda fragancia.");
  });

  it("never touches storage on a plain render (mount/abandon invariant)", () => {
    let getItemCalls = 0;
    let setItemCalls = 0;
    let removeItemCalls = 0;
    const storage = mockWindow({
      search: "?fragrance=1",
      storage: {
        getItem: () => {
          getItemCalls += 1;
          return null;
        },
        setItem: () => {
          setItemCalls += 1;
        },
        removeItem: () => {
          removeItemCalls += 1;
        },
      },
    });

    renderToStaticMarkup(<ComparisonCaptureFlow />);

    expect(storage.getItem).toBeDefined();
    expect(getItemCalls).toBe(0);
    expect(setItemCalls).toBe(0);
    expect(removeItemCalls).toBe(0);
  });
});
