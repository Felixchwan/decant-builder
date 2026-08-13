import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import {
  ComparisonCaptureFlow,
  ComparisonConfirmation,
  ComparisonConfirmedPhase,
  ComparisonDoneState,
  ComparisonFragrancePicker,
  ComparisonPromptForm,
  canSubmitComparison,
  getComparisonCandidates,
  resolveInitialFirstFragrance,
  resolvePriorEvidenceForComparison,
} from "./ComparisonCaptureFlow.jsx";
import { COMPARISON_PROMPT_LABEL } from "../perceptualLearning/comparisonPromptCopy.js";
import { aurelianCatalog } from "../merchant/catalog.js";
import {
  PERCEPTUAL_LEARNING_SCHEMA_VERSION,
  PERCEPTUAL_LEARNING_STORAGE_KEY,
  loadPerceptualLearningState,
} from "../perceptualLearning/perceptualLearningPersistence.js";
import { buildLearnerRecord } from "../perceptualLearning/learnerRecord.js";
import { buildEvidenceRevisit } from "../perceptualLearning/evidenceRevisit.js";
import { createLearnerId } from "../perceptualLearning/learnerIdentity.js";
import { createEncounterInstance } from "../perceptualLearning/encounterInstance.js";
import { createObservation } from "../perceptualLearning/observation.js";
import { createComparison } from "../perceptualLearning/comparison.js";
import { createComparisonWithEncounters } from "../perceptualLearning/createComparisonWithEncounters.js";

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
  // Pure function of its argument (Phase 5.1 bugfix) -- no window access,
  // so these pass explicit strings directly rather than mocking window.
  // Callers feed it useSearchParams()'s own reactive value; see the
  // "source-of-truth" describe block below for that wiring.
  it("resolves the fragrance for a valid ?fragrance= id", () => {
    const fragrance = resolveInitialFirstFragrance("?fragrance=1");

    expect(fragrance).not.toBeNull();
    expect(fragrance.id).toBe(1);
    expect(fragrance).toBe(aurelianCatalog.find((item) => item.id === 1));
  });

  it("accepts a bare query string with no leading '?', matching useSearchParams().toString()'s form", () => {
    expect(resolveInitialFirstFragrance("fragrance=1")?.id).toBe(1);
  });

  it("returns null when the query param is missing or unresolvable", () => {
    expect(resolveInitialFirstFragrance("")).toBeNull();
    expect(resolveInitialFirstFragrance(undefined)).toBeNull();
    expect(resolveInitialFirstFragrance("?fragrance=abc")).toBeNull();
    expect(resolveInitialFirstFragrance("?fragrance=999999999")).toBeNull();
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
  // useSearchParams() reads from Next.js's own App Router context
  // (SearchParamsContext), which this repo's bare renderToStaticMarkup
  // harness never provides -- so it always returns null here, regardless of
  // window.location.search. That is precisely correct per the Phase 5.1
  // bugfix: resolveInitialFirstFragrance must have exactly one source of
  // truth, useSearchParams()'s own value, and must never fall back to
  // reading window independently. One consequence is that
  // ComparisonCaptureFlow can only be exercised in its first-fragrance
  // picker (unresolved) state through this harness -- mocking
  // window.location.search no longer has any effect on it, by design. Deep
  // link resolution itself remains fully covered by
  // resolveInitialFirstFragrance's own pure-function tests above; the
  // reactive re-resolution and overwrite-guard behavior are covered by the
  // structural regression tests below.
  it("renders the first-fragrance picker (the only state reachable under this harness, useSearchParams() has no App Router context to read)", () => {
    mockWindow({ search: "" });

    const markup = renderToStaticMarkup(<ComparisonCaptureFlow />);

    expect(markup).toContain("comparison-picker");
    expect(markup).toContain("Elige la primera fragancia.");
  });

  it("still shows the first-fragrance picker even when window.location.search carries a valid deep link, since the resolver no longer reads window at all", () => {
    mockWindow({ search: "?fragrance=1" });

    const markup = renderToStaticMarkup(<ComparisonCaptureFlow />);

    expect(markup).toContain("Elige la primera fragancia.");
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

  it("never renders prior-evidence content in the pre-submit first-fragrance picker (Phase 4.2)", () => {
    mockWindow({ search: "" });
    const pickerMarkup = renderToStaticMarkup(<ComparisonCaptureFlow />);
    expect(pickerMarkup).not.toContain("Revisar lo que había percibido antes");
  });
});

describe("ComparisonCaptureFlow URL source-of-truth (Phase 5.1 bugfix)", () => {
  // Same failure class as ObservationCaptureFlow's and LearnerRecordView's
  // Phase 5.0/5.1 defects: a `useState(() => resolveInitialFirstFragrance())`
  // lazy initializer only ever runs on true first mount, so Next's client
  // router reusing an already-mounted /comparar instance across a
  // same-pathname query change would leave it frozen on the first-fragrance
  // picker.
  //
  // renderToStaticMarkup cannot reproduce the client-router race itself (it
  // always performs a single, fresh render, and useSearchParams() has no
  // App Router context under this harness regardless). This asserts the
  // structural property that prevents the regression, the same
  // source-inspection technique already used for
  // ObservationCaptureFlow.jsx's and LearnerRecordView.jsx's equivalent
  // fixes.
  const source = readFileSync(
    fileURLToPath(new URL("./ComparisonCaptureFlow.jsx", import.meta.url)),
    "utf8"
  );

  it("does not cache firstFragrance exclusively in a mount-only useState lazy initializer", () => {
    expect(source).toMatch(/useSearchParams\s*\(\s*\)/);
    expect(source).not.toMatch(/useState\(\s*\(\s*\)\s*=>\s*resolveInitialFirstFragrance\(\s*\)\s*\)/);
  });

  it("resolveInitialFirstFragrance is a pure function of its argument -- no independent window.location access", () => {
    const resolverMatch = source.match(
      /export function resolveInitialFirstFragrance\([^)]*\)\s*\{([\s\S]*?)\n\}/
    );

    expect(resolverMatch).not.toBeNull();
    expect(resolverMatch[1]).not.toMatch(/window\.location/);
  });

  it("feeds useSearchParams()'s own return value into resolveInitialFirstFragrance, not a separate window.location read", () => {
    expect(source).toContain('from "next/navigation"');
    expect(source).toMatch(/const\s+searchParams\s*=\s*useSearchParams\(\)/);
    expect(source).toMatch(/const\s+searchParamsValue\s*=\s*searchParams\?\.toString\(\)/);
    expect(source).toMatch(/resolveInitialFirstFragrance\(\s*searchParamsValue\s*\)/);
  });

  it("reactively re-resolves firstFragrance from the URL after mount, by comparing searchParamsValue against a tracked previous value during render (not inside a useEffect)", () => {
    // React's own guidance: adjusting state in response to a changed
    // prop/value belongs directly in the render body, guarded by a
    // previous-value comparison -- not in a useEffect, which would commit
    // one render late. See https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
    expect(source).not.toMatch(/useEffect\(/);
    expect(source).toMatch(/if\s*\(\s*searchParamsValue\s*!==\s*resolvedSearchParamsValue\s*\)/);
    expect(source).toMatch(/resolveInitialFirstFragrance\(searchParamsValue\)/);
  });

  it("never overwrites an already-established firstFragrance from a later, unrelated search-param change (e.g. Comparar otras dos leaving the old deep link in the URL)", () => {
    expect(source).toMatch(/if\s*\(\s*resolved\s*&&\s*!firstFragrance\s*\)\s*\{\s*setFirstFragrance\(resolved\)/);
  });
});

describe("resolvePriorEvidenceForComparison (Phase 4.2)", () => {
  function seedStorage(payload) {
    return {
      getItem: (key) => (key === PERCEPTUAL_LEARNING_STORAGE_KEY ? JSON.stringify(payload) : null),
      setItem: () => {},
      removeItem: () => {},
    };
  }

  function createMutableStorage(initial = {}) {
    const store = new Map(Object.entries(initial));
    return {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, value),
      removeItem: (key) => store.delete(key),
    };
  }

  it("returns hasPriorEvidence false for both sides when storage is empty", () => {
    const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

    const result = resolvePriorEvidenceForComparison({ storage, firstFragranceId: 1, secondFragranceId: 2 });

    expect(result.first).toEqual({ fragranceId: 1, hasPriorEvidence: false, encounters: [], comparisons: [] });
    expect(result.second).toEqual({ fragranceId: 2, hasPriorEvidence: false, encounters: [], comparisons: [] });
  });

  it("resolves prior evidence only for the first fragrance when only it has history (unrelated evidence excluded from the other side)", () => {
    const learnerId = createLearnerId();
    const encounter = createEncounterInstance({
      learnerId,
      fragranceId: 1,
      fragranceDisplaySnapshot: { fragranceId: 1, name: "Fico di Amalfi", brand: "Aurelian" },
    });
    const observation = createObservation({
      encounterInstanceId: encounter.encounterInstanceId,
      learnerId,
      moment: "initial",
      freeText: "Huele muy fresco.",
    });
    const storage = seedStorage({
      schemaVersion: PERCEPTUAL_LEARNING_SCHEMA_VERSION,
      learnerId,
      learnerCreatedAt: encounter.createdAt,
      encounterInstances: [encounter],
      observations: [observation],
      comparisons: [],
    });

    const result = resolvePriorEvidenceForComparison({ storage, firstFragranceId: 1, secondFragranceId: 999 });

    expect(result.first.hasPriorEvidence).toBe(true);
    expect(result.first.encounters[0].observations[0].freeText).toBe("Huele muy fresco.");
    expect(result.second).toEqual({ fragranceId: 999, hasPriorEvidence: false, encounters: [], comparisons: [] });
  });

  it("resolves prior evidence only for the second fragrance when only it has history", () => {
    const learnerId = createLearnerId();
    const encounter = createEncounterInstance({
      learnerId,
      fragranceId: 2,
      fragranceDisplaySnapshot: { fragranceId: 2, name: "Acqua di Gio EDT", brand: "Giorgio Armani" },
    });
    const observation = createObservation({
      encounterInstanceId: encounter.encounterInstanceId,
      learnerId,
      moment: "initial",
      freeText: "Muy acuático.",
    });
    const storage = seedStorage({
      schemaVersion: PERCEPTUAL_LEARNING_SCHEMA_VERSION,
      learnerId,
      learnerCreatedAt: encounter.createdAt,
      encounterInstances: [encounter],
      observations: [observation],
      comparisons: [],
    });

    const result = resolvePriorEvidenceForComparison({ storage, firstFragranceId: 999, secondFragranceId: 2 });

    expect(result.first).toEqual({ fragranceId: 999, hasPriorEvidence: false, encounters: [], comparisons: [] });
    expect(result.second.hasPriorEvidence).toBe(true);
    expect(result.second.encounters[0].observations[0].freeText).toBe("Muy acuático.");
  });

  it("resolves prior evidence independently for both fragrances when both have history", () => {
    const learnerId = createLearnerId();
    const encounterA = createEncounterInstance({
      learnerId,
      fragranceId: 1,
      fragranceDisplaySnapshot: { fragranceId: 1, name: "Fico di Amalfi", brand: "Aurelian" },
    });
    const encounterB = createEncounterInstance({
      learnerId,
      fragranceId: 2,
      fragranceDisplaySnapshot: { fragranceId: 2, name: "Acqua di Gio EDT", brand: "Giorgio Armani" },
    });
    const observationA = createObservation({
      encounterInstanceId: encounterA.encounterInstanceId,
      learnerId,
      moment: "initial",
      freeText: "A: cítrico.",
    });
    const observationB = createObservation({
      encounterInstanceId: encounterB.encounterInstanceId,
      learnerId,
      moment: "initial",
      freeText: "B: acuático.",
    });
    const storage = seedStorage({
      schemaVersion: PERCEPTUAL_LEARNING_SCHEMA_VERSION,
      learnerId,
      learnerCreatedAt: encounterA.createdAt,
      encounterInstances: [encounterA, encounterB],
      observations: [observationA, observationB],
      comparisons: [],
    });

    const result = resolvePriorEvidenceForComparison({ storage, firstFragranceId: 1, secondFragranceId: 2 });

    expect(result.first.hasPriorEvidence).toBe(true);
    expect(result.first.encounters[0].observations.map((o) => o.freeText)).toEqual(["A: cítrico."]);
    expect(result.second.hasPriorEvidence).toBe(true);
    expect(result.second.encounters[0].observations.map((o) => o.freeText)).toEqual(["B: acuático."]);
  });

  it("preserves repeated evidence for a fragrance without deduplication", () => {
    const learnerId = createLearnerId();
    const encounterA1 = createEncounterInstance({
      learnerId,
      fragranceId: 1,
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    const encounterA2 = createEncounterInstance({
      learnerId,
      fragranceId: 1,
      createdAt: "2026-08-05T00:00:00.000Z",
    });
    const observationA1 = createObservation({
      encounterInstanceId: encounterA1.encounterInstanceId,
      learnerId,
      moment: "initial",
      freeText: "First visit.",
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    const observationA2 = createObservation({
      encounterInstanceId: encounterA2.encounterInstanceId,
      learnerId,
      moment: "initial",
      freeText: "Second visit.",
      createdAt: "2026-08-05T00:00:00.000Z",
    });
    const storage = seedStorage({
      schemaVersion: PERCEPTUAL_LEARNING_SCHEMA_VERSION,
      learnerId,
      learnerCreatedAt: encounterA1.createdAt,
      encounterInstances: [encounterA1, encounterA2],
      observations: [observationA1, observationA2],
      comparisons: [],
    });

    const result = resolvePriorEvidenceForComparison({ storage, firstFragranceId: 1, secondFragranceId: 999 });

    expect(result.first.encounters).toHaveLength(2);
    expect(result.first.encounters.map((e) => e.observations[0].freeText)).toEqual(
      expect.arrayContaining(["First visit.", "Second visit."])
    );
  });

  it("resolves a prior Comparison where the queried fragrance was the first side, preserving orientation", () => {
    const learnerId = createLearnerId();
    const encounterA = createEncounterInstance({
      learnerId,
      fragranceId: 1,
      fragranceDisplaySnapshot: { fragranceId: 1, name: "Fico di Amalfi", brand: "Aurelian" },
    });
    const encounterB = createEncounterInstance({
      learnerId,
      fragranceId: 2,
      fragranceDisplaySnapshot: { fragranceId: 2, name: "Acqua di Gio EDT", brand: "Giorgio Armani" },
    });
    const priorComparison = createComparison({
      learnerId,
      firstEncounterInstanceId: encounterA.encounterInstanceId,
      secondEncounterInstanceId: encounterB.encounterInstanceId,
      freeText: "A es más ligera.",
    });
    const storage = seedStorage({
      schemaVersion: PERCEPTUAL_LEARNING_SCHEMA_VERSION,
      learnerId,
      learnerCreatedAt: encounterA.createdAt,
      encounterInstances: [encounterA, encounterB],
      observations: [],
      comparisons: [priorComparison],
    });

    const result = resolvePriorEvidenceForComparison({ storage, firstFragranceId: 1, secondFragranceId: 999 });

    expect(result.first.hasPriorEvidence).toBe(true);
    expect(result.first.comparisons).toHaveLength(1);
    expect(result.first.comparisons[0].firstEncounter.fragranceId).toBe(1);
    expect(result.first.comparisons[0].secondEncounter.fragranceId).toBe(2);
  });

  it("resolves a prior Comparison where the queried fragrance was the second side, preserving orientation", () => {
    const learnerId = createLearnerId();
    const encounterA = createEncounterInstance({
      learnerId,
      fragranceId: 1,
      fragranceDisplaySnapshot: { fragranceId: 1, name: "Fico di Amalfi", brand: "Aurelian" },
    });
    const encounterB = createEncounterInstance({
      learnerId,
      fragranceId: 2,
      fragranceDisplaySnapshot: { fragranceId: 2, name: "Acqua di Gio EDT", brand: "Giorgio Armani" },
    });
    const priorComparison = createComparison({
      learnerId,
      firstEncounterInstanceId: encounterA.encounterInstanceId,
      secondEncounterInstanceId: encounterB.encounterInstanceId,
      freeText: "A es más ligera.",
    });
    const storage = seedStorage({
      schemaVersion: PERCEPTUAL_LEARNING_SCHEMA_VERSION,
      learnerId,
      learnerCreatedAt: encounterA.createdAt,
      encounterInstances: [encounterA, encounterB],
      observations: [],
      comparisons: [priorComparison],
    });

    const result = resolvePriorEvidenceForComparison({ storage, firstFragranceId: 999, secondFragranceId: 2 });

    expect(result.second.hasPriorEvidence).toBe(true);
    expect(result.second.comparisons).toHaveLength(1);
    expect(result.second.comparisons[0].firstEncounter.fragranceId).toBe(1);
    expect(result.second.comparisons[0].secondEncounter.fragranceId).toBe(2);
  });

  it("does not throw and returns independent, non-deduplicated projections when both fragranceIds are equal (same-fragrance edge case)", () => {
    const learnerId = createLearnerId();
    const encounter = createEncounterInstance({
      learnerId,
      fragranceId: 7,
      fragranceDisplaySnapshot: { fragranceId: 7, name: "Repeat Fragrance", brand: "Aurelian" },
    });
    const observation = createObservation({
      encounterInstanceId: encounter.encounterInstanceId,
      learnerId,
      moment: "initial",
      freeText: "Notado antes.",
    });
    const storage = seedStorage({
      schemaVersion: PERCEPTUAL_LEARNING_SCHEMA_VERSION,
      learnerId,
      learnerCreatedAt: encounter.createdAt,
      encounterInstances: [encounter],
      observations: [observation],
      comparisons: [],
    });

    expect(() =>
      resolvePriorEvidenceForComparison({ storage, firstFragranceId: 7, secondFragranceId: 7 })
    ).not.toThrow();

    const result = resolvePriorEvidenceForComparison({ storage, firstFragranceId: 7, secondFragranceId: 7 });

    expect(result.first).toEqual(result.second);
    expect(result.first.hasPriorEvidence).toBe(true);
    expect(result.first.encounters).toHaveLength(1);
  });

  // Regression test mirroring Phase 4.1's exact temporal-boundary defect
  // report, adapted to Comparison's two-sided capture. Uses genuinely
  // mutable storage and the real createComparisonWithEncounters use case, so
  // the capture-then-write ordering is proven against the real persistence
  // layer, not just a hand-built fixture.
  it("does not include the newly-created Comparison, its EncounterInstances, or its freeText in either captured prior-evidence projection (temporal regression)", () => {
    const learnerId = createLearnerId();
    const priorEncounterA = createEncounterInstance({
      learnerId,
      fragranceId: 1,
      fragranceDisplaySnapshot: { fragranceId: 1, name: "Fico di Amalfi", brand: "Aurelian" },
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    const priorObservationA = createObservation({
      encounterInstanceId: priorEncounterA.encounterInstanceId,
      learnerId,
      moment: "initial",
      freeText: "primera evidencia previa A",
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    const priorEncounterB = createEncounterInstance({
      learnerId,
      fragranceId: 2,
      fragranceDisplaySnapshot: { fragranceId: 2, name: "Acqua di Gio EDT", brand: "Giorgio Armani" },
      createdAt: "2026-08-02T00:00:00.000Z",
    });
    const priorObservationB = createObservation({
      encounterInstanceId: priorEncounterB.encounterInstanceId,
      learnerId,
      moment: "initial",
      freeText: "primera evidencia previa B",
      createdAt: "2026-08-02T00:00:00.000Z",
    });
    const storage = createMutableStorage({
      [PERCEPTUAL_LEARNING_STORAGE_KEY]: JSON.stringify({
        schemaVersion: PERCEPTUAL_LEARNING_SCHEMA_VERSION,
        learnerId,
        learnerCreatedAt: priorEncounterA.createdAt,
        encounterInstances: [priorEncounterA, priorEncounterB],
        observations: [priorObservationA, priorObservationB],
        comparisons: [],
      }),
    });

    // Step 1: exactly what handleSubmit does -- capture prior evidence for
    // both sides strictly before the write.
    const capturedPriorEvidence = resolvePriorEvidenceForComparison({
      storage,
      firstFragranceId: 1,
      secondFragranceId: 2,
    });

    // Step 2: the real write use case, with fresh repro-shaped data.
    const writeResult = createComparisonWithEncounters({
      storage,
      firstFragranceId: 1,
      firstFragranceDisplaySnapshot: { fragranceId: 1, name: "Fico di Amalfi", brand: "Aurelian" },
      secondFragranceId: 2,
      secondFragranceDisplaySnapshot: { fragranceId: 2, name: "Acqua di Gio EDT", brand: "Giorgio Armani" },
      freeText: "comparación nueva prueba 4.2",
    });
    expect(writeResult.persisted).toBe(true);

    // The newly-created encounters/comparison must not appear anywhere in
    // either captured projection.
    const firstComparisonTexts = capturedPriorEvidence.first.comparisons.map((c) => c.freeText);
    const secondComparisonTexts = capturedPriorEvidence.second.comparisons.map((c) => c.freeText);
    expect(firstComparisonTexts).not.toContain("comparación nueva prueba 4.2");
    expect(secondComparisonTexts).not.toContain("comparación nueva prueba 4.2");
    expect(capturedPriorEvidence.first.encounters.map((e) => e.encounterInstanceId)).not.toContain(
      writeResult.firstEncounterInstance.encounterInstanceId
    );
    expect(capturedPriorEvidence.second.encounters.map((e) => e.encounterInstanceId)).not.toContain(
      writeResult.secondEncounterInstance.encounterInstanceId
    );

    // Existing prior evidence remains verbatim and present on both sides.
    expect(capturedPriorEvidence.first.hasPriorEvidence).toBe(true);
    expect(capturedPriorEvidence.first.encounters[0].observations[0].freeText).toBe(
      "primera evidencia previa A"
    );
    expect(capturedPriorEvidence.second.hasPriorEvidence).toBe(true);
    expect(capturedPriorEvidence.second.encounters[0].observations[0].freeText).toBe(
      "primera evidencia previa B"
    );

    // Independently confirm storage now genuinely contains the new
    // Comparison (proving this test isn't passing merely because the write
    // silently failed) -- re-reading storage fresh must show it.
    const postWriteLearnerRecord = buildLearnerRecord(loadPerceptualLearningState({ storage }));
    const postWriteEvidence = buildEvidenceRevisit({ learnerRecord: postWriteLearnerRecord, fragranceId: 1 });
    const postWriteComparisonTexts = postWriteEvidence.comparisons.map((c) => c.freeText);
    expect(postWriteComparisonTexts).toContain("comparación nueva prueba 4.2");
  });
});

describe("ComparisonConfirmedPhase (Phase 4.2)", () => {
  const baseComparison = { freeText: "Esta es más cítrica que la otra." };

  function evidenceWith(fragranceId, name, freeText) {
    return {
      fragranceId,
      hasPriorEvidence: true,
      encounters: [
        {
          encounterInstanceId: `enc-${fragranceId}`,
          fragranceId,
          fragranceDisplaySnapshot: { fragranceId, name, brand: "Aurelian" },
          createdAt: "2026-08-01T00:00:00.000Z",
          observations: [
            {
              observationId: `obs-${fragranceId}`,
              moment: "initial",
              freeText,
              createdAt: "2026-08-01T00:00:00.000Z",
            },
          ],
        },
      ],
      comparisons: [],
    };
  }

  function emptyEvidence(fragranceId) {
    return { fragranceId, hasPriorEvidence: false, encounters: [], comparisons: [] };
  }

  it("preserves the existing confirmation content unchanged", () => {
    const markup = renderToStaticMarkup(
      <ComparisonConfirmedPhase
        firstFragranceName="Aurelian Primera"
        secondFragranceName="Aurelian Segunda"
        comparison={baseComparison}
        priorEvidence={null}
        onCompareAnother={() => {}}
        onDone={() => {}}
      />
    );

    expect(markup).toContain("Aurelian Primera");
    expect(markup).toContain("Aurelian Segunda");
    expect(markup).toContain("Esta es más cítrica que la otra.");
    expect(markup).toContain("Comparar otras dos");
    expect(markup).toContain("Listo");
  });

  it("shows zero disclosures when priorEvidence is null (e.g. this pair had no prior evidence)", () => {
    const markup = renderToStaticMarkup(
      <ComparisonConfirmedPhase
        firstFragranceName="A"
        secondFragranceName="B"
        comparison={baseComparison}
        priorEvidence={null}
        onCompareAnother={() => {}}
        onDone={() => {}}
      />
    );

    expect(markup).not.toContain("Revisar lo que había percibido antes");
    expect(markup).not.toMatch(/<details/);
  });

  it("shows zero disclosures when neither side has prior evidence", () => {
    const markup = renderToStaticMarkup(
      <ComparisonConfirmedPhase
        firstFragranceName="A"
        secondFragranceName="B"
        comparison={baseComparison}
        priorEvidence={{ first: emptyEvidence(1), second: emptyEvidence(2) }}
        onCompareAnother={() => {}}
        onDone={() => {}}
      />
    );

    expect(markup).not.toContain("Revisar lo que había percibido antes");
    expect(markup).not.toMatch(/<details/);
  });

  it("shows only the first disclosure when only the first fragrance has prior evidence", () => {
    const markup = renderToStaticMarkup(
      <ComparisonConfirmedPhase
        firstFragranceName="Fico di Amalfi"
        secondFragranceName="Acqua di Gio EDT"
        comparison={baseComparison}
        priorEvidence={{
          first: evidenceWith(1, "Fico di Amalfi", "Antes noté cítrico."),
          second: emptyEvidence(2),
        }}
        onCompareAnother={() => {}}
        onDone={() => {}}
      />
    );

    expect(markup.match(/Revisar lo que había percibido antes/g)?.length).toBe(1);
    expect(markup).toContain("Antes noté cítrico.");
    expect(markup).toContain("Primera: Fico di Amalfi");
  });

  it("shows only the second disclosure when only the second fragrance has prior evidence", () => {
    const markup = renderToStaticMarkup(
      <ComparisonConfirmedPhase
        firstFragranceName="Fico di Amalfi"
        secondFragranceName="Acqua di Gio EDT"
        comparison={baseComparison}
        priorEvidence={{
          first: emptyEvidence(1),
          second: evidenceWith(2, "Acqua di Gio EDT", "Antes noté acuático."),
        }}
        onCompareAnother={() => {}}
        onDone={() => {}}
      />
    );

    expect(markup.match(/Revisar lo que había percibido antes/g)?.length).toBe(1);
    expect(markup).toContain("Antes noté acuático.");
    expect(markup).toContain("Segunda: Acqua di Gio EDT");
  });

  it("shows both disclosures, independently, when both fragrances have prior evidence, without merging or comparing their histories", () => {
    const markup = renderToStaticMarkup(
      <ComparisonConfirmedPhase
        firstFragranceName="Fico di Amalfi"
        secondFragranceName="Acqua di Gio EDT"
        comparison={baseComparison}
        priorEvidence={{
          first: evidenceWith(1, "Fico di Amalfi", "Antes noté cítrico."),
          second: evidenceWith(2, "Acqua di Gio EDT", "Antes noté acuático."),
        }}
        onCompareAnother={() => {}}
        onDone={() => {}}
      />
    );

    expect(markup.match(/Revisar lo que había percibido antes/g)?.length).toBe(2);
    expect(markup).toContain("Antes noté cítrico.");
    expect(markup).toContain("Antes noté acuático.");
    expect(markup).toContain("Primera: Fico di Amalfi");
    expect(markup).toContain("Segunda: Acqua di Gio EDT");
    // Collapsed by default -- never auto-opened.
    expect(markup).not.toMatch(/<details[^>]*\bopen\b/);
    // Two genuinely independent disclosures, not one merged/synthetic block.
    expect(markup.match(/<details class="evidence-revisit"/g)?.length).toBe(2);
  });

  it("never renders the new Comparison's own freeText inside a prior-evidence disclosure (no duplication)", () => {
    const markup = renderToStaticMarkup(
      <ComparisonConfirmedPhase
        firstFragranceName="Fico di Amalfi"
        secondFragranceName="Acqua di Gio EDT"
        comparison={{ freeText: "Comparación recién enviada." }}
        priorEvidence={{
          first: evidenceWith(1, "Fico di Amalfi", "Evidencia previa distinta."),
          second: emptyEvidence(2),
        }}
        onCompareAnother={() => {}}
        onDone={() => {}}
      />
    );

    expect(markup.match(/Comparación recién enviada\./g)?.length).toBe(1);
  });
});
