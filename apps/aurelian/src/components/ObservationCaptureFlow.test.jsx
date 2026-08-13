import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import {
  ObservationCaptureFlow,
  ObservationConfirmation,
  ObservationConfirmedPhase,
  ObservationDoneState,
  ObservationForm,
  ObservationPicker,
  canSubmitObservation,
  formatObservationTimestamp,
  resolveInitialFragrance,
  resolvePriorEvidence,
} from "./ObservationCaptureFlow.jsx";
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
import { createEncounterWithObservation } from "../perceptualLearning/createEncounterWithObservation.js";
import { createObservation } from "../perceptualLearning/observation.js";
import { createComparison } from "../perceptualLearning/comparison.js";

const originalWindow = globalThis.window;

function mockWindow({ search = "", storage } = {}) {
  const spyableStorage = storage ?? {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };

  globalThis.window = {
    location: { href: `https://aurelianperfumes.com/mis-descubrimientos/observar${search}`, search },
    localStorage: spyableStorage,
  };

  return spyableStorage;
}

afterEach(() => {
  globalThis.window = originalWindow;
});

describe("resolveInitialFragrance", () => {
  // Pure function of its argument (Phase 5.1 bugfix) -- no window access,
  // so these pass explicit strings directly rather than mocking window.
  // Callers feed it useSearchParams()'s own reactive value; see the
  // "source-of-truth" describe block below for that wiring.
  it("resolves the fragrance for a valid ?fragrance= id", () => {
    const fragrance = resolveInitialFragrance("?fragrance=1");

    expect(fragrance).not.toBeNull();
    expect(fragrance.id).toBe(1);
    expect(fragrance).toBe(aurelianCatalog.find((item) => item.id === 1));
  });

  it("accepts a bare query string with no leading '?', matching useSearchParams().toString()'s form", () => {
    expect(resolveInitialFragrance("fragrance=1")?.id).toBe(1);
  });

  it("returns null when the query param is missing", () => {
    expect(resolveInitialFragrance("")).toBeNull();
    expect(resolveInitialFragrance(undefined)).toBeNull();
  });

  it("returns null when the query param is malformed or unresolvable", () => {
    expect(resolveInitialFragrance("?fragrance=abc")).toBeNull();
    expect(resolveInitialFragrance("?fragrance=999999999")).toBeNull();
  });
});

describe("canSubmitObservation", () => {
  it("requires both a valid moment and non-blank freeText", () => {
    expect(canSubmitObservation({ moment: "initial", freeText: "algo" })).toBe(true);
    expect(canSubmitObservation({ moment: "later", freeText: "algo" })).toBe(true);
    expect(canSubmitObservation({ moment: null, freeText: "algo" })).toBe(false);
    expect(canSubmitObservation({ moment: "initial", freeText: "" })).toBe(false);
    expect(canSubmitObservation({ moment: "initial", freeText: "   " })).toBe(false);
    expect(canSubmitObservation({ moment: "drydown", freeText: "algo" })).toBe(false);
  });
});

describe("formatObservationTimestamp", () => {
  it("formats a valid ISO timestamp without throwing", () => {
    expect(() => formatObservationTimestamp("2026-08-10T12:30:00.000Z")).not.toThrow();
    expect(typeof formatObservationTimestamp("2026-08-10T12:30:00.000Z")).toBe("string");
  });
});

describe("ObservationPicker", () => {
  it("renders a search input and the given results", () => {
    const markup = renderToStaticMarkup(
      <ObservationPicker
        query=""
        onQueryChange={() => {}}
        results={[{ id: 1, brand: "Aurelian", name: "No. 1" }]}
        onSelect={() => {}}
      />
    );

    expect(markup).toContain("observation-picker");
    expect(markup).toContain("Aurelian");
    expect(markup).toContain("No. 1");
    expect(markup).not.toContain("Ver lo que he notado");
  });
});

describe("ObservationForm", () => {
  it("renders the fragrance name and both moment options with Spanish copy", () => {
    const markup = renderToStaticMarkup(
      <ObservationForm
        fragranceName="Aurelian No. 1"
        moment={null}
        onMomentChange={() => {}}
        freeText=""
        onFreeTextChange={() => {}}
        submitError={null}
        canSubmit={false}
        isSubmitting={false}
        onSubmit={() => {}}
      />
    );

    expect(markup).toContain("Aurelian No. 1");
    expect(markup).toContain("Al aplicarlo");
    expect(markup).toContain("Más tarde");
    expect(markup).not.toMatch(/opening|heart|drydown/i);
  });

  it("disables submit when canSubmit is false and enables it when true", () => {
    const disabledMarkup = renderToStaticMarkup(
      <ObservationForm
        fragranceName="X"
        moment={null}
        onMomentChange={() => {}}
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
      <ObservationForm
        fragranceName="X"
        moment="initial"
        onMomentChange={() => {}}
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

  it("shows the submit error banner only when submitError is set", () => {
    const withError = renderToStaticMarkup(
      <ObservationForm
        fragranceName="X"
        moment="initial"
        onMomentChange={() => {}}
        freeText="algo"
        onFreeTextChange={() => {}}
        submitError="No pudimos guardar tu observación. Intenta de nuevo."
        canSubmit
        isSubmitting={false}
        onSubmit={() => {}}
      />
    );
    expect(withError).toContain("No pudimos guardar tu observación");

    const withoutError = renderToStaticMarkup(
      <ObservationForm
        fragranceName="X"
        moment="initial"
        onMomentChange={() => {}}
        freeText="algo"
        onFreeTextChange={() => {}}
        submitError={null}
        canSubmit
        isSubmitting={false}
        onSubmit={() => {}}
      />
    );
    expect(withoutError).not.toContain("No pudimos guardar tu observación");
  });

  it("never renders the learner-record link in the pre-submit form, including a failed-submit state (Phase 3.2)", () => {
    const withError = renderToStaticMarkup(
      <ObservationForm
        fragranceName="X"
        moment="initial"
        onMomentChange={() => {}}
        freeText="algo"
        onFreeTextChange={() => {}}
        submitError="No pudimos guardar tu observación. Intenta de nuevo."
        canSubmit
        isSubmitting={false}
        onSubmit={() => {}}
      />
    );
    expect(withError).not.toContain("Ver lo que he notado");
    expect(withError).not.toContain('href="/mis-descubrimientos"');

    const withoutError = renderToStaticMarkup(
      <ObservationForm
        fragranceName="X"
        moment={null}
        onMomentChange={() => {}}
        freeText=""
        onFreeTextChange={() => {}}
        submitError={null}
        canSubmit={false}
        isSubmitting={false}
        onSubmit={() => {}}
      />
    );
    expect(withoutError).not.toContain("Ver lo que he notado");
  });
});

describe("ObservationConfirmation", () => {
  it("quotes the exact freeText, moment copy, and fragrance name, with no history list", () => {
    const markup = renderToStaticMarkup(
      <ObservationConfirmation
        fragranceName="Aurelian No. 1"
        observation={{
          moment: "initial",
          freeText: "Huele a cítrico y un poco a madera.",
          createdAt: "2026-08-10T12:30:00.000Z",
        }}
        onRegisterAnotherMoment={() => {}}
        onDone={() => {}}
      />
    );

    expect(markup).toContain("Aurelian No. 1");
    expect(markup).toContain("Al aplicarlo");
    expect(markup).toContain("Huele a cítrico y un poco a madera.");
    expect(markup).toContain("Registrar otro momento");
    expect(markup).toContain("Listo");
    // No history/list/older-observations affordance of any kind.
    expect(markup).not.toMatch(/<ul|<ol|historial|anteriores/i);
  });

  it("links back to the learner record at exactly /mis-descubrimientos (Phase 3.2)", () => {
    const markup = renderToStaticMarkup(
      <ObservationConfirmation
        fragranceName="Aurelian No. 1"
        observation={{
          moment: "initial",
          freeText: "x",
          createdAt: "2026-08-10T12:30:00.000Z",
        }}
        onRegisterAnotherMoment={() => {}}
        onDone={() => {}}
      />
    );

    expect(markup).toContain("Ver lo que he notado");
    expect(markup).toContain('href="/mis-descubrimientos"');
  });
});

describe("ObservationDoneState", () => {
  it("renders a static terminal state with no link to a nonexistent history route", () => {
    const markup = renderToStaticMarkup(<ObservationDoneState />);

    expect(markup).toContain("Gracias por registrar lo que notaste.");
    expect(markup).not.toContain("mis-descubrimientos\"");
    expect(markup).not.toMatch(/<a\s/);
  });
});

describe("ObservationCaptureFlow", () => {
  // useSearchParams() reads from Next.js's own App Router context
  // (SearchParamsContext), which this repo's bare renderToStaticMarkup
  // harness never provides -- so it always returns null here, regardless of
  // window.location.search. That is precisely correct per the Phase 5.1
  // bugfix: resolveInitialFragrance must have exactly one source of truth,
  // useSearchParams()'s own value, and must never fall back to reading
  // window independently. One consequence is that ObservationCaptureFlow
  // can only be exercised in its picker (unresolved) state through this
  // harness -- mocking window.location.search no longer has any effect on
  // it, by design. Deep-link resolution itself remains fully covered by
  // resolveInitialFragrance's own pure-function tests above; the reactive
  // re-resolution and overwrite-guard behavior are covered by the
  // structural regression tests below.
  it("renders the picker (the only state reachable under this harness, useSearchParams() has no App Router context to read)", () => {
    mockWindow({ search: "" });

    const markup = renderToStaticMarkup(<ObservationCaptureFlow />);

    expect(markup).toContain("observation-picker");
  });

  it("still renders the picker even when window.location.search carries a valid deep link, since the resolver no longer reads window at all", () => {
    mockWindow({ search: "?fragrance=1" });

    const markup = renderToStaticMarkup(<ObservationCaptureFlow />);

    expect(markup).toContain("observation-picker");
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

    renderToStaticMarkup(<ObservationCaptureFlow />);

    expect(storage.getItem).toBeDefined();
    expect(getItemCalls).toBe(0);
    expect(setItemCalls).toBe(0);
    expect(removeItemCalls).toBe(0);
  });

  it("never renders prior-evidence content in the pre-submit picker state (Phase 4.1)", () => {
    mockWindow({ search: "" });
    const pickerMarkup = renderToStaticMarkup(<ObservationCaptureFlow />);
    expect(pickerMarkup).not.toContain("Revisar lo que había percibido antes");
  });
});

describe("ObservationCaptureFlow URL source-of-truth (Phase 5.1 bugfix)", () => {
  // Real-browser defect: /observar was already mounted (picker, no query);
  // a same-pathname client-side navigation changed the URL to
  // /observar?fragrance=1; the URL was correct but the flow stayed on the
  // picker instead of moving to the preselected form. F5/full remount made
  // it work. This is the same failure class as LearnerRecordView's Phase
  // 5.0 defect: a `useState(() => resolveInitialFragrance())` lazy
  // initializer only ever runs on true first mount, so Next's client
  // router reusing an already-mounted instance across a same-pathname
  // query change left it frozen.
  //
  // renderToStaticMarkup cannot reproduce the client-router race itself (it
  // always performs a single, fresh render, and useSearchParams() has no
  // App Router context under this harness regardless). This asserts the
  // structural property that prevents the regression, the same
  // source-inspection technique already used for LearnerRecordView.jsx's
  // equivalent fix.
  const source = readFileSync(
    fileURLToPath(new URL("./ObservationCaptureFlow.jsx", import.meta.url)),
    "utf8"
  );

  it("does not cache pickedFragrance exclusively in a mount-only useState lazy initializer", () => {
    expect(source).toMatch(/useSearchParams\s*\(\s*\)/);
    expect(source).not.toMatch(/useState\(\s*\(\s*\)\s*=>\s*resolveInitialFragrance\(\s*\)\s*\)/);
  });

  it("resolveInitialFragrance is a pure function of its argument -- no independent window.location access", () => {
    const resolverMatch = source.match(
      /export function resolveInitialFragrance\([^)]*\)\s*\{([\s\S]*?)\n\}/
    );

    expect(resolverMatch).not.toBeNull();
    expect(resolverMatch[1]).not.toMatch(/window\.location/);
  });

  it("feeds useSearchParams()'s own return value into resolveInitialFragrance, not a separate window.location read", () => {
    expect(source).toContain('from "next/navigation"');
    expect(source).toMatch(/const\s+searchParams\s*=\s*useSearchParams\(\)/);
    expect(source).toMatch(/const\s+searchParamsValue\s*=\s*searchParams\?\.toString\(\)/);
    expect(source).toMatch(/resolveInitialFragrance\(\s*searchParamsValue\s*\)/);
  });

  it("reactively re-resolves pickedFragrance from the URL after mount, by comparing searchParamsValue against a tracked previous value during render (not inside a useEffect)", () => {
    // React's own guidance: adjusting state in response to a changed
    // prop/value belongs directly in the render body, guarded by a
    // previous-value comparison -- not in a useEffect, which would commit
    // one render late. See https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
    expect(source).not.toMatch(/useEffect\(/);
    expect(source).toMatch(/if\s*\(\s*searchParamsValue\s*!==\s*resolvedSearchParamsValue\s*\)/);
    expect(source).toMatch(/resolveInitialFragrance\(searchParamsValue\)/);
  });

  it("never overwrites an already-established pickedFragrance from a later, unrelated search-param change", () => {
    expect(source).toMatch(/if\s*\(\s*resolved\s*&&\s*!pickedFragrance\s*\)\s*\{\s*setPickedFragrance\(resolved\)/);
  });
});

describe("resolvePriorEvidence (Phase 4.1)", () => {
  function seedStorage(payload) {
    return {
      getItem: (key) => (key === PERCEPTUAL_LEARNING_STORAGE_KEY ? JSON.stringify(payload) : null),
      setItem: () => {},
      removeItem: () => {},
    };
  }

  it("returns hasPriorEvidence false and empty arrays when storage is empty", () => {
    const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

    const result = resolvePriorEvidence({ storage, fragranceId: 1 });

    expect(result).toEqual({ fragranceId: 1, hasPriorEvidence: false, encounters: [], comparisons: [] });
  });

  it("resolves real prior Observation evidence for the requested fragrance, through LearnerRecord -> EvidenceRevisit", () => {
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

    const result = resolvePriorEvidence({ storage, fragranceId: 1 });

    expect(result.hasPriorEvidence).toBe(true);
    expect(result.encounters[0].observations[0].freeText).toBe("Huele muy fresco.");
  });

  it("excludes evidence belonging to a different fragranceId", () => {
    const learnerId = createLearnerId();
    const encounter = createEncounterInstance({ learnerId, fragranceId: 1 });
    const observation = createObservation({
      encounterInstanceId: encounter.encounterInstanceId,
      learnerId,
      moment: "initial",
      freeText: "x",
    });
    const storage = seedStorage({
      schemaVersion: PERCEPTUAL_LEARNING_SCHEMA_VERSION,
      learnerId,
      learnerCreatedAt: null,
      encounterInstances: [encounter],
      observations: [observation],
      comparisons: [],
    });

    const result = resolvePriorEvidence({ storage, fragranceId: 999 });

    expect(result).toEqual({ fragranceId: 999, hasPriorEvidence: false, encounters: [], comparisons: [] });
  });

  it("resolves Comparison-only prior evidence, enabling revisit even with zero prior Observations", () => {
    const learnerId = createLearnerId();
    const encounterA = createEncounterInstance({ learnerId, fragranceId: 1 });
    const encounterB = createEncounterInstance({ learnerId, fragranceId: 2 });
    const comparison = createComparison({
      learnerId,
      firstEncounterInstanceId: encounterA.encounterInstanceId,
      secondEncounterInstanceId: encounterB.encounterInstanceId,
      freeText: "A is softer.",
    });
    const storage = seedStorage({
      schemaVersion: PERCEPTUAL_LEARNING_SCHEMA_VERSION,
      learnerId,
      learnerCreatedAt: null,
      encounterInstances: [encounterA, encounterB],
      observations: [],
      comparisons: [comparison],
    });

    const result = resolvePriorEvidence({ storage, fragranceId: 1 });

    expect(result.hasPriorEvidence).toBe(true);
    expect(result.comparisons).toHaveLength(1);
    expect(result.encounters[0].observations).toEqual([]);
  });

  it("naturally treats evidence written by a completed earlier session as prior evidence for a later session (item 12)", () => {
    // Simulates: session 1 already wrote and persisted an Observation; this
    // call represents session 2 resolving prior evidence at ITS OWN
    // pre-write boundary -- it should see everything session 1 completed.
    const learnerId = createLearnerId();
    const firstSessionEncounter = createEncounterInstance({
      learnerId,
      fragranceId: 1,
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    const firstSessionObservation = createObservation({
      encounterInstanceId: firstSessionEncounter.encounterInstanceId,
      learnerId,
      moment: "initial",
      freeText: "From the first session.",
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    const storage = seedStorage({
      schemaVersion: PERCEPTUAL_LEARNING_SCHEMA_VERSION,
      learnerId,
      learnerCreatedAt: firstSessionEncounter.createdAt,
      encounterInstances: [firstSessionEncounter],
      observations: [firstSessionObservation],
      comparisons: [],
    });

    const result = resolvePriorEvidence({ storage, fragranceId: 1 });

    expect(result.hasPriorEvidence).toBe(true);
    expect(result.encounters[0].observations.map((o) => o.freeText)).toEqual(["From the first session."]);
  });

  function createMutableStorage(initial = {}) {
    const store = new Map(Object.entries(initial));
    return {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, value),
      removeItem: (key) => store.delete(key),
    };
  }

  // Regression test for the exact browser-acceptance defect report: an
  // existing fragrance with prior Observation AND Comparison evidence, a
  // brand-new "later" Observation submitted in a fresh capture session, and
  // the captured prior-evidence snapshot must exclude that new Observation
  // entirely while preserving the old evidence verbatim, separately, and in
  // its original orientation. Uses a genuinely mutable storage (unlike
  // seedStorage's read-only fake above) so the real write use case actually
  // mutates it after the capture, proving the capture-then-write ordering
  // holds against the real persistence layer, not just a hand-built fixture.
  it("does not include the newly-submitted Observation in the captured prior-evidence projection (regression: browser-acceptance defect, Acqua di Gio EDT)", () => {
    const learnerId = createLearnerId();
    const priorEncounter = createEncounterInstance({
      learnerId,
      fragranceId: 1,
      fragranceDisplaySnapshot: { fragranceId: 1, name: "Acqua di Gio EDT", brand: "Giorgio Armani" },
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    const priorObservation = createObservation({
      encounterInstanceId: priorEncounter.encounterInstanceId,
      learnerId,
      moment: "initial",
      freeText: "primera observación prueba 4.1",
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    const otherEncounter = createEncounterInstance({ learnerId, fragranceId: 2 });
    const priorComparison = createComparison({
      learnerId,
      firstEncounterInstanceId: priorEncounter.encounterInstanceId,
      secondEncounterInstanceId: otherEncounter.encounterInstanceId,
      freeText: "Comparación previa entre ambas.",
      createdAt: "2026-08-02T00:00:00.000Z",
    });
    const storage = createMutableStorage({
      [PERCEPTUAL_LEARNING_STORAGE_KEY]: JSON.stringify({
        schemaVersion: PERCEPTUAL_LEARNING_SCHEMA_VERSION,
        learnerId,
        learnerCreatedAt: priorEncounter.createdAt,
        encounterInstances: [priorEncounter, otherEncounter],
        observations: [priorObservation],
        comparisons: [priorComparison],
      }),
    });

    // Step 1: exactly what handleSubmit does -- capture prior evidence
    // strictly before the write.
    const capturedPriorEvidence = resolvePriorEvidence({ storage, fragranceId: 1 });

    // Step 2: the real write use case, with the exact reported repro data.
    const writeResult = createEncounterWithObservation({
      storage,
      fragranceId: 1,
      fragranceDisplaySnapshot: { fragranceId: 1, name: "Acqua di Gio EDT", brand: "Giorgio Armani" },
      moment: "later",
      freeText: "segunda observación prueba 4.1",
    });
    expect(writeResult.persisted).toBe(true);

    // The newly-created encounter/observation must not appear anywhere in
    // the captured projection.
    expect(capturedPriorEvidence.hasPriorEvidence).toBe(true);
    const capturedText = capturedPriorEvidence.encounters.flatMap((e) =>
      e.observations.map((o) => o.freeText)
    );
    expect(capturedText).not.toContain("segunda observación prueba 4.1");
    expect(capturedPriorEvidence.encounters.map((e) => e.encounterInstanceId)).not.toContain(
      writeResult.encounterInstance.encounterInstanceId
    );

    // Existing prior Observation evidence remains verbatim and present.
    expect(capturedText).toEqual(["primera observación prueba 4.1"]);
    expect(capturedPriorEvidence.encounters).toHaveLength(1);
    expect(capturedPriorEvidence.encounters[0].encounterInstanceId).toBe(priorEncounter.encounterInstanceId);

    // Existing prior Comparison remains verbatim, in original first/second
    // orientation.
    expect(capturedPriorEvidence.comparisons).toHaveLength(1);
    expect(capturedPriorEvidence.comparisons[0].freeText).toBe("Comparación previa entre ambas.");
    expect(capturedPriorEvidence.comparisons[0].firstEncounter.encounterInstanceId).toBe(
      priorEncounter.encounterInstanceId
    );
    expect(capturedPriorEvidence.comparisons[0].secondEncounter.encounterInstanceId).toBe(
      otherEncounter.encounterInstanceId
    );

    // Independently confirm storage now genuinely contains the new
    // Observation (proving this test isn't passing merely because the write
    // silently failed) -- re-reading storage fresh must show both.
    const postWriteLearnerRecord = buildLearnerRecord(loadPerceptualLearningState({ storage }));
    const postWriteEvidence = buildEvidenceRevisit({ learnerRecord: postWriteLearnerRecord, fragranceId: 1 });
    const postWriteText = postWriteEvidence.encounters.flatMap((e) => e.observations.map((o) => o.freeText));
    expect(postWriteText).toEqual(
      expect.arrayContaining(["primera observación prueba 4.1", "segunda observación prueba 4.1"])
    );
  });

  it("the no-prior-evidence case remains unchanged: a brand-new fragrance yields hasPriorEvidence false even after its first write lands in the same storage", () => {
    const storage = createMutableStorage();

    const capturedPriorEvidence = resolvePriorEvidence({ storage, fragranceId: 42 });

    const writeResult = createEncounterWithObservation({
      storage,
      fragranceId: 42,
      fragranceDisplaySnapshot: { fragranceId: 42, name: "Brand New Fragrance", brand: "Aurelian" },
      moment: "initial",
      freeText: "primera vez que la percibo.",
    });
    expect(writeResult.persisted).toBe(true);

    expect(capturedPriorEvidence).toEqual({
      fragranceId: 42,
      hasPriorEvidence: false,
      encounters: [],
      comparisons: [],
    });
  });
});

describe("ObservationConfirmedPhase (Phase 4.1)", () => {
  const baseObservation = {
    moment: "initial",
    freeText: "Ahora noto más madera.",
    createdAt: "2026-08-10T12:30:00.000Z",
  };

  it("preserves the existing confirmation content unchanged", () => {
    const markup = renderToStaticMarkup(
      <ObservationConfirmedPhase
        fragranceName="Aurelian No. 1"
        observation={baseObservation}
        priorEvidence={null}
        onRegisterAnotherMoment={() => {}}
        onDone={() => {}}
      />
    );

    expect(markup).toContain("Aurelian No. 1");
    expect(markup).toContain("Ahora noto más madera.");
    expect(markup).toContain("Registrar otro momento");
    expect(markup).toContain("Listo");
  });

  it("shows no revisit disclosure when priorEvidence is null (e.g. this fragrance had no prior evidence)", () => {
    const markup = renderToStaticMarkup(
      <ObservationConfirmedPhase
        fragranceName="Aurelian No. 1"
        observation={baseObservation}
        priorEvidence={null}
        onRegisterAnotherMoment={() => {}}
        onDone={() => {}}
      />
    );

    expect(markup).not.toContain("Revisar lo que había percibido antes");
    expect(markup).not.toMatch(/<details/);
  });

  it("shows no revisit disclosure when priorEvidence.hasPriorEvidence is false", () => {
    const markup = renderToStaticMarkup(
      <ObservationConfirmedPhase
        fragranceName="Aurelian No. 1"
        observation={baseObservation}
        priorEvidence={{ fragranceId: 1, hasPriorEvidence: false, encounters: [], comparisons: [] }}
        onRegisterAnotherMoment={() => {}}
        onDone={() => {}}
      />
    );

    expect(markup).not.toContain("Revisar lo que había percibido antes");
  });

  it("shows the collapsed revisit disclosure when priorEvidence.hasPriorEvidence is true, without duplicating the new Observation's text inside it (temporal correctness, item 10)", () => {
    const priorEvidence = {
      fragranceId: 1,
      hasPriorEvidence: true,
      encounters: [
        {
          encounterInstanceId: "enc-prior",
          fragranceId: 1,
          fragranceDisplaySnapshot: { fragranceId: 1, name: "Fico di Amalfi", brand: "Aurelian" },
          createdAt: "2026-08-01T00:00:00.000Z",
          observations: [
            {
              observationId: "obs-prior",
              moment: "initial",
              freeText: "Me parece muy cítrico.",
              createdAt: "2026-08-01T00:00:00.000Z",
            },
          ],
        },
      ],
      comparisons: [],
    };

    const markup = renderToStaticMarkup(
      <ObservationConfirmedPhase
        fragranceName="Fico di Amalfi"
        observation={baseObservation}
        priorEvidence={priorEvidence}
        onRegisterAnotherMoment={() => {}}
        onDone={() => {}}
      />
    );

    expect(markup).toContain("Revisar lo que había percibido antes");
    expect(markup).toContain("Me parece muy cítrico.");
    expect(markup).toContain("Ahora noto más madera.");
    // The new Observation's own text appears exactly once (inside the fresh
    // confirmation), not a second time inside the historical section --
    // proves the two are rendered as genuinely separate evidence, never
    // merged or duplicated.
    expect(markup.match(/Ahora noto más madera\./g)?.length).toBe(1);
  });
});
