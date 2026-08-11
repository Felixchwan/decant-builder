import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import {
  ComparisonEvidenceCard,
  EncounterEvidenceCard,
  LearnerRecordContainer,
  LearnerRecordDeleteControl,
  LearnerRecordView,
  requestLearnerRecordReset,
} from "./LearnerRecordView.jsx";
import {
  PERCEPTUAL_LEARNING_SCHEMA_VERSION,
  PERCEPTUAL_LEARNING_STORAGE_KEY,
} from "../perceptualLearning/perceptualLearningPersistence.js";
import { createLearnerId } from "../perceptualLearning/learnerIdentity.js";
import { createEncounterInstance } from "../perceptualLearning/encounterInstance.js";
import { createObservation } from "../perceptualLearning/observation.js";

const originalWindow = globalThis.window;

function mockWindow({ storage } = {}) {
  const spyableStorage = storage ?? {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };

  globalThis.window = {
    location: { href: "https://aurelianperfumes.com/mis-descubrimientos", search: "" },
    localStorage: spyableStorage,
  };

  return spyableStorage;
}

afterEach(() => {
  globalThis.window = originalWindow;
});

function emptyRecord() {
  return { learnerId: null, hasEvidence: false, encounters: [], comparisons: [] };
}

const FORBIDDEN_COPY = [
  "Tu perfil",
  "Tus preferencias",
  "Lo que te gusta",
  "Aurelian ha aprendido que",
  "Tu evolución",
  "Tus patrones",
];

describe("LearnerRecordView — empty state", () => {
  it("renders an honest empty state when hasEvidence is false", () => {
    const markup = renderToStaticMarkup(<LearnerRecordView learnerRecord={emptyRecord()} />);

    expect(markup).toContain("learner-record-empty");
    expect(markup).toContain("Todavía no has registrado observaciones o comparaciones.");
  });

  it("renders Observe / Compare / Catalog actions in the empty state", () => {
    const markup = renderToStaticMarkup(<LearnerRecordView learnerRecord={emptyRecord()} />);

    expect(markup).toContain('href="/mis-descubrimientos/observar"');
    expect(markup).toContain('href="/mis-descubrimientos/comparar"');
    expect(markup).toContain('href="/catalogo"');
  });

  it("contains no inference/profile/taste copy anywhere", () => {
    const markup = renderToStaticMarkup(<LearnerRecordView learnerRecord={emptyRecord()} />);

    for (const phrase of FORBIDDEN_COPY) {
      expect(markup).not.toContain(phrase);
    }
  });

  it("does not show the delete-all-data control when there is no evidence (Phase 3.2)", () => {
    const markup = renderToStaticMarkup(<LearnerRecordView learnerRecord={emptyRecord()} />);

    expect(markup).not.toContain("Eliminar mis datos de aprendizaje");
    expect(markup).not.toMatch(/<button/);
  });
});

describe("EncounterEvidenceCard", () => {
  function baseEncounter(overrides = {}) {
    return {
      encounterInstanceId: "enc-1",
      fragranceId: 7,
      fragranceDisplaySnapshot: { fragranceId: 7, name: "Fico di Amalfi", brand: "Aurelian" },
      createdAt: "2026-08-01T00:00:00.000Z",
      observations: [],
      ...overrides,
    };
  }

  it("renders the fragrance snapshot's name and brand", () => {
    const markup = renderToStaticMarkup(<EncounterEvidenceCard encounter={baseEncounter()} />);

    expect(markup).toContain("Fico di Amalfi");
    expect(markup).toContain("Aurelian");
  });

  it("falls back safely when fragranceDisplaySnapshot is null", () => {
    const markup = renderToStaticMarkup(
      <EncounterEvidenceCard encounter={baseEncounter({ fragranceDisplaySnapshot: null })} />
    );

    expect(markup).toContain("Una fragancia");
  });

  it("renders the Observation moment label using the existing vocabulary", () => {
    const markup = renderToStaticMarkup(
      <EncounterEvidenceCard
        encounter={baseEncounter({
          observations: [
            {
              observationId: "obs-1",
              moment: "initial",
              freeText: "Muy fresco.",
              createdAt: "2026-08-01T00:00:00.000Z",
            },
          ],
        })}
      />
    );

    expect(markup).toContain("Al aplicarlo");
  });

  it("renders Observation freeText verbatim", () => {
    const markup = renderToStaticMarkup(
      <EncounterEvidenceCard
        encounter={baseEncounter({
          observations: [
            {
              observationId: "obs-1",
              moment: "later",
              freeText: "Huele a cítrico y un poco a madera después de una hora.",
              createdAt: "2026-08-01T00:00:00.000Z",
            },
          ],
        })}
      />
    );

    expect(markup).toContain("Huele a cítrico y un poco a madera después de una hora.");
  });

  it("does not invent Observation text for a zero-Observation encounter", () => {
    const markup = renderToStaticMarkup(<EncounterEvidenceCard encounter={baseEncounter()} />);

    expect(markup).not.toMatch(/<ul/);
    expect(markup).not.toMatch(/sin observaciones|no hay observaciones/i);
  });

  it("builds the scoped Observe-again href from the encounter's own fragranceId", () => {
    const markup = renderToStaticMarkup(<EncounterEvidenceCard encounter={baseEncounter({ fragranceId: 42 })} />);

    expect(markup).toContain('href="/mis-descubrimientos/observar?fragrance=42"');
    expect(markup).toContain("Registrar otra observación");
  });

  it("builds the scoped Compare-again href from the encounter's own fragranceId", () => {
    const markup = renderToStaticMarkup(<EncounterEvidenceCard encounter={baseEncounter({ fragranceId: 42 })} />);

    expect(markup).toContain('href="/mis-descubrimientos/comparar?fragrance=42"');
    expect(markup).toContain("Comparar con otra");
  });
});

describe("two encounters of the same fragrance", () => {
  it("render as two separate, un-merged cards", () => {
    const encounterA = {
      encounterInstanceId: "enc-a",
      fragranceId: 7,
      fragranceDisplaySnapshot: { fragranceId: 7, name: "Fico di Amalfi", brand: "Aurelian" },
      createdAt: "2026-08-05T00:00:00.000Z",
      observations: [
        { observationId: "obs-a", moment: "initial", freeText: "Very bright.", createdAt: "2026-08-05T00:00:00.000Z" },
      ],
    };
    const encounterB = {
      encounterInstanceId: "enc-b",
      fragranceId: 7,
      fragranceDisplaySnapshot: { fragranceId: 7, name: "Fico di Amalfi", brand: "Aurelian" },
      createdAt: "2026-08-01T00:00:00.000Z",
      observations: [
        { observationId: "obs-b", moment: "initial", freeText: "Greener than I remembered.", createdAt: "2026-08-01T00:00:00.000Z" },
      ],
    };
    const learnerRecord = {
      learnerId: "learner-1",
      hasEvidence: true,
      encounters: [encounterA, encounterB],
      comparisons: [],
    };

    const markup = renderToStaticMarkup(<LearnerRecordView learnerRecord={learnerRecord} />);

    expect(markup.match(/<article class="encounter-evidence-card"/g)?.length).toBe(2);
    expect(markup).toContain("Very bright.");
    expect(markup).toContain("Greener than I remembered.");
  });
});

describe("Encuentros section presentation filtering (browser-acceptance correction)", () => {
  function observedEncounter(overrides = {}) {
    return {
      encounterInstanceId: "enc-observed",
      fragranceId: 1,
      fragranceDisplaySnapshot: { fragranceId: 1, name: "Fico di Amalfi", brand: "Aurelian" },
      createdAt: "2026-08-05T00:00:00.000Z",
      observations: [
        { observationId: "obs-1", moment: "initial", freeText: "Very bright.", createdAt: "2026-08-05T00:00:00.000Z" },
      ],
      ...overrides,
    };
  }

  function unobservedEncounter(overrides = {}) {
    return {
      encounterInstanceId: "enc-unobserved",
      fragranceId: 2,
      fragranceDisplaySnapshot: { fragranceId: 2, name: "Acqua di Gio EDT", brand: "Giorgio Armani" },
      createdAt: "2026-08-01T00:00:00.000Z",
      observations: [],
      ...overrides,
    };
  }

  it("renders an encounter that has at least one Observation", () => {
    const learnerRecord = {
      learnerId: "learner-1",
      hasEvidence: true,
      encounters: [observedEncounter()],
      comparisons: [],
    };

    const markup = renderToStaticMarkup(<LearnerRecordView learnerRecord={learnerRecord} />);

    expect(markup).toContain("learner-record-encounters");
    expect(markup).toContain("Fico di Amalfi");
    expect(markup).toContain("Very bright.");
  });

  it("does not render a zero-Observation encounter as an Encounter card", () => {
    const learnerRecord = {
      learnerId: "learner-1",
      hasEvidence: true,
      // hasEvidence is true here via a Comparison, per the read model's own
      // semantics -- an encounter-only, zero-Observation record must still
      // be excluded from the Encuentros list even so.
      encounters: [
        unobservedEncounter(),
        { ...unobservedEncounter({ encounterInstanceId: "enc-unobserved-2", fragranceId: 3 }) },
      ],
      comparisons: [
        {
          comparisonId: "cmp-1",
          freeText: "x",
          createdAt: "2026-08-01T00:00:00.000Z",
          firstEncounter: null,
          secondEncounter: null,
        },
      ],
    };

    const markup = renderToStaticMarkup(<LearnerRecordView learnerRecord={learnerRecord} />);

    expect(markup).not.toContain("Acqua di Gio EDT");
    expect(markup).not.toMatch(/<article class="encounter-evidence-card"/);
  });

  it("omits the Encuentros heading entirely when there are zero observed encounters", () => {
    const learnerRecord = {
      learnerId: "learner-1",
      hasEvidence: true,
      encounters: [unobservedEncounter()],
      comparisons: [
        {
          comparisonId: "cmp-1",
          freeText: "x",
          createdAt: "2026-08-01T00:00:00.000Z",
          firstEncounter: null,
          secondEncounter: null,
        },
      ],
    };

    const markup = renderToStaticMarkup(<LearnerRecordView learnerRecord={learnerRecord} />);

    expect(markup).not.toContain("learner-record-encounters");
    expect(markup).not.toContain("Encuentros");
  });

  it("still renders the Comparisons section normally when both underlying encounters have zero Observations", () => {
    const learnerRecord = {
      learnerId: "learner-1",
      hasEvidence: true,
      encounters: [unobservedEncounter(), unobservedEncounter({ encounterInstanceId: "enc-unobserved-2", fragranceId: 3 })],
      comparisons: [
        {
          comparisonId: "cmp-1",
          freeText: "Fico feels softer.",
          createdAt: "2026-08-01T00:00:00.000Z",
          firstEncounter: {
            encounterInstanceId: "enc-unobserved",
            fragranceId: 2,
            fragranceDisplaySnapshot: { fragranceId: 2, name: "Acqua di Gio EDT", brand: "Giorgio Armani" },
          },
          secondEncounter: {
            encounterInstanceId: "enc-unobserved-2",
            fragranceId: 3,
            fragranceDisplaySnapshot: { fragranceId: 3, name: "Third Fragrance", brand: "Aurelian" },
          },
        },
      ],
    };

    const markup = renderToStaticMarkup(<LearnerRecordView learnerRecord={learnerRecord} />);

    expect(markup).not.toContain("learner-record-encounters");
    expect(markup).toContain("learner-record-comparisons");
    expect(markup).toContain("Acqua di Gio EDT");
    expect(markup).toContain("Third Fragrance");
    expect(markup).toContain("Fico feels softer.");
  });

  it("keeps repeated observed encounters of the same fragrance as separate cards alongside filtering", () => {
    const learnerRecord = {
      learnerId: "learner-1",
      hasEvidence: true,
      encounters: [
        observedEncounter({ encounterInstanceId: "enc-obs-a", createdAt: "2026-08-05T00:00:00.000Z" }),
        observedEncounter({
          encounterInstanceId: "enc-obs-b",
          createdAt: "2026-08-01T00:00:00.000Z",
          observations: [
            { observationId: "obs-2", moment: "initial", freeText: "Greener than I remembered.", createdAt: "2026-08-01T00:00:00.000Z" },
          ],
        }),
        unobservedEncounter({ encounterInstanceId: "enc-unobserved-3", fragranceId: 9 }),
      ],
      comparisons: [],
    };

    const markup = renderToStaticMarkup(<LearnerRecordView learnerRecord={learnerRecord} />);

    expect(markup.match(/<article class="encounter-evidence-card"/g)?.length).toBe(2);
    expect(markup).toContain("Very bright.");
    expect(markup).toContain("Greener than I remembered.");
  });

  it("does not deduplicate repeated Comparison evidence", () => {
    const encounterRef = (id, fragranceId, name) => ({
      encounterInstanceId: id,
      fragranceId,
      fragranceDisplaySnapshot: { fragranceId, name, brand: "Aurelian" },
    });
    const learnerRecord = {
      learnerId: "learner-1",
      hasEvidence: true,
      encounters: [unobservedEncounter(), unobservedEncounter({ encounterInstanceId: "enc-unobserved-2", fragranceId: 3 })],
      comparisons: [
        {
          comparisonId: "cmp-1",
          freeText: "First comparison.",
          createdAt: "2026-08-01T00:00:00.000Z",
          firstEncounter: encounterRef("enc-unobserved", 2, "Acqua di Gio EDT"),
          secondEncounter: encounterRef("enc-unobserved-2", 3, "Third Fragrance"),
        },
        {
          comparisonId: "cmp-2",
          freeText: "Second comparison, same pair.",
          createdAt: "2026-08-02T00:00:00.000Z",
          firstEncounter: encounterRef("enc-unobserved", 2, "Acqua di Gio EDT"),
          secondEncounter: encounterRef("enc-unobserved-2", 3, "Third Fragrance"),
        },
      ],
    };

    const markup = renderToStaticMarkup(<LearnerRecordView learnerRecord={learnerRecord} />);

    expect(markup.match(/<article class="comparison-evidence-card"/g)?.length).toBe(2);
    expect(markup).toContain("First comparison.");
    expect(markup).toContain("Second comparison, same pair.");
  });
});

describe("ComparisonEvidenceCard", () => {
  it("preserves first/second order", () => {
    const comparison = {
      comparisonId: "cmp-1",
      freeText: "Fico feels softer; ADG feels sharper.",
      createdAt: "2026-08-01T00:00:00.000Z",
      firstEncounter: {
        encounterInstanceId: "enc-a",
        fragranceId: 1,
        fragranceDisplaySnapshot: { fragranceId: 1, name: "Fico di Amalfi", brand: "Aurelian" },
      },
      secondEncounter: {
        encounterInstanceId: "enc-b",
        fragranceId: 2,
        fragranceDisplaySnapshot: { fragranceId: 2, name: "Acqua di Gio EDT", brand: "Giorgio Armani" },
      },
    };

    const markup = renderToStaticMarkup(<ComparisonEvidenceCard comparison={comparison} />);

    expect(markup.indexOf("Fico di Amalfi")).toBeLessThan(markup.indexOf("Acqua di Gio EDT"));
  });

  it("renders comparison freeText verbatim", () => {
    const comparison = {
      comparisonId: "cmp-1",
      freeText: "Una se siente más fría y afilada; la otra más suave.",
      createdAt: "2026-08-01T00:00:00.000Z",
      firstEncounter: null,
      secondEncounter: null,
    };

    const markup = renderToStaticMarkup(<ComparisonEvidenceCard comparison={comparison} />);

    expect(markup).toContain("Una se siente más fría y afilada; la otra más suave.");
  });

  it("falls back safely when a referenced encounter is null or has no snapshot", () => {
    const comparison = {
      comparisonId: "cmp-1",
      freeText: "x",
      createdAt: "2026-08-01T00:00:00.000Z",
      firstEncounter: null,
      secondEncounter: {
        encounterInstanceId: "enc-b",
        fragranceId: 2,
        fragranceDisplaySnapshot: null,
      },
    };

    const markup = renderToStaticMarkup(<ComparisonEvidenceCard comparison={comparison} />);

    expect(markup.match(/Una fragancia/g)?.length).toBe(2);
  });
});

describe("comparisons section", () => {
  const encounter = {
    encounterInstanceId: "enc-1",
    fragranceId: 1,
    fragranceDisplaySnapshot: { fragranceId: 1, name: "Fico di Amalfi", brand: "Aurelian" },
    createdAt: "2026-08-01T00:00:00.000Z",
    observations: [
      { observationId: "obs-1", moment: "initial", freeText: "x", createdAt: "2026-08-01T00:00:00.000Z" },
    ],
  };

  it("is omitted entirely when there are zero comparisons", () => {
    const learnerRecord = { learnerId: "learner-1", hasEvidence: true, encounters: [encounter], comparisons: [] };

    const markup = renderToStaticMarkup(<LearnerRecordView learnerRecord={learnerRecord} />);

    expect(markup).not.toContain("learner-record-comparisons");
    expect(markup).not.toContain("Comparaciones");
    expect(markup).not.toMatch(/todavía no has comparado/i);
  });

  it("is shown when comparison evidence exists", () => {
    const comparison = {
      comparisonId: "cmp-1",
      freeText: "x",
      createdAt: "2026-08-01T00:00:00.000Z",
      firstEncounter: null,
      secondEncounter: null,
    };
    const learnerRecord = {
      learnerId: "learner-1",
      hasEvidence: true,
      encounters: [encounter],
      comparisons: [comparison],
    };

    const markup = renderToStaticMarkup(<LearnerRecordView learnerRecord={learnerRecord} />);

    expect(markup).toContain("learner-record-comparisons");
    expect(markup).toContain("Comparaciones");
  });
});

describe("general presentation invariants", () => {
  const encounter = {
    encounterInstanceId: "ENCOUNTER_SECRET_ID_123",
    fragranceId: 1,
    fragranceDisplaySnapshot: { fragranceId: 1, name: "Fico di Amalfi", brand: "Aurelian" },
    createdAt: "2026-08-01T00:00:00.000Z",
    observations: [
      { observationId: "OBSERVATION_SECRET_ID_456", moment: "initial", freeText: "x", createdAt: "2026-08-01T00:00:00.000Z" },
    ],
  };
  const comparison = {
    comparisonId: "COMPARISON_SECRET_ID_789",
    freeText: "y",
    createdAt: "2026-08-01T00:00:00.000Z",
    firstEncounter: null,
    secondEncounter: null,
  };
  const learnerRecord = {
    learnerId: "learner-1",
    hasEvidence: true,
    encounters: [encounter],
    comparisons: [comparison],
  };

  it("never renders raw internal ids as visible text", () => {
    const markup = renderToStaticMarkup(<LearnerRecordView learnerRecord={learnerRecord} />);

    expect(markup).not.toContain("ENCOUNTER_SECRET_ID_123");
    expect(markup).not.toContain("OBSERVATION_SECRET_ID_456");
    expect(markup).not.toContain("COMPARISON_SECRET_ID_789");
  });

  it("contains no taste/profile/preference/capability copy in the populated state", () => {
    const markup = renderToStaticMarkup(<LearnerRecordView learnerRecord={learnerRecord} />);

    for (const phrase of FORBIDDEN_COPY) {
      expect(markup).not.toContain(phrase);
    }
  });

  it("renders no form controls, and the only buttons present are the approved delete-all trigger -- no individual-delete action exists per encounter/observation/comparison", () => {
    const markup = renderToStaticMarkup(<LearnerRecordView learnerRecord={learnerRecord} />);

    expect(markup).not.toMatch(/<form/);
    // Exactly one button: the delete-all trigger (idle phase, default prop).
    expect(markup.match(/<button/g)?.length).toBe(1);
    expect(markup).toContain("Eliminar mis datos de aprendizaje");
  });
});

describe("delete-all learning data (Phase 3.2)", () => {
  const populatedLearnerRecord = {
    learnerId: "learner-1",
    hasEvidence: true,
    encounters: [
      {
        encounterInstanceId: "enc-1",
        fragranceId: 1,
        fragranceDisplaySnapshot: { fragranceId: 1, name: "Fico di Amalfi", brand: "Aurelian" },
        createdAt: "2026-08-01T00:00:00.000Z",
        observations: [
          { observationId: "obs-1", moment: "initial", freeText: "Muy fresco.", createdAt: "2026-08-01T00:00:00.000Z" },
        ],
      },
    ],
    comparisons: [],
  };

  function createTrackingStorage(initial = {}) {
    const store = new Map(Object.entries(initial));
    const removedKeys = [];
    let setItemCalls = 0;

    return {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => {
        setItemCalls += 1;
        store.set(key, value);
      },
      removeItem: (key) => {
        removedKeys.push(key);
        store.delete(key);
      },
      get setItemCalls() {
        return setItemCalls;
      },
      get removedKeys() {
        return removedKeys;
      },
      has: (key) => store.has(key),
    };
  }

  describe("visibility (item 1, 2)", () => {
    it("is visible (idle trigger) when learnerRecord.hasEvidence is true", () => {
      const markup = renderToStaticMarkup(<LearnerRecordView learnerRecord={populatedLearnerRecord} />);

      expect(markup).toContain("Eliminar mis datos de aprendizaje");
    });

    it("is entirely absent when learnerRecord.hasEvidence is false, regardless of resetPhase", () => {
      const markup = renderToStaticMarkup(
        <LearnerRecordView learnerRecord={emptyRecord()} resetPhase="confirming" />
      );

      expect(markup).not.toContain("Eliminar mis datos de aprendizaje");
      expect(markup).not.toContain("Esto eliminará todas tus observaciones y comparaciones");
    });
  });

  describe("LearnerRecordDeleteControl phases", () => {
    it("shows only the trigger in the idle phase", () => {
      const markup = renderToStaticMarkup(
        <LearnerRecordDeleteControl phase="idle" onActivate={() => {}} onCancel={() => {}} onConfirm={() => {}} />
      );

      expect(markup).toContain("Eliminar mis datos de aprendizaje");
      expect(markup).not.toContain("Esto eliminará");
    });

    it("shows the explanation and Cancelar/Eliminar definitivamente before any destructive execution occurs (item 3)", () => {
      const markup = renderToStaticMarkup(
        <LearnerRecordDeleteControl phase="confirming" onActivate={() => {}} onCancel={() => {}} onConfirm={() => {}} />
      );

      expect(markup).toContain(
        "Esto eliminará todas tus observaciones y comparaciones guardadas en este navegador."
      );
      expect(markup).toContain("Cancelar");
      expect(markup).toContain("Eliminar definitivamente");
      expect(markup).not.toMatch(/<button[^>]*disabled/);
    });

    it("disables both actions while deleting", () => {
      const markup = renderToStaticMarkup(
        <LearnerRecordDeleteControl phase="deleting" onActivate={() => {}} onCancel={() => {}} onConfirm={() => {}} />
      );

      expect(markup.match(/<button[^>]*disabled/g)?.length).toBe(2);
    });

    it("shows a retryable inline error, with both actions still enabled, in the error phase (item 9)", () => {
      const markup = renderToStaticMarkup(
        <LearnerRecordDeleteControl phase="error" onActivate={() => {}} onCancel={() => {}} onConfirm={() => {}} />
      );

      expect(markup).toContain("No pudimos eliminar tus datos. Intenta de nuevo.");
      expect(markup).not.toMatch(/<button[^>]*disabled/);
    });
  });

  it("cancelling (resetPhase back to idle) preserves the populated evidence -- resetPhase and learnerRecord are fully independent props (item 4)", () => {
    const idleMarkup = renderToStaticMarkup(
      <LearnerRecordView learnerRecord={populatedLearnerRecord} resetPhase="idle" />
    );
    const confirmingMarkup = renderToStaticMarkup(
      <LearnerRecordView learnerRecord={populatedLearnerRecord} resetPhase="confirming" />
    );

    for (const markup of [idleMarkup, confirmingMarkup]) {
      expect(markup).toContain("Fico di Amalfi");
      expect(markup).toContain("Muy fresco.");
    }
  });

  it("failed reset (error phase) preserves the populated evidence view (item 8)", () => {
    const markup = renderToStaticMarkup(
      <LearnerRecordView learnerRecord={populatedLearnerRecord} resetPhase="error" />
    );

    expect(markup).toContain("Fico di Amalfi");
    expect(markup).toContain("Muy fresco.");
    expect(markup).toContain("No pudimos eliminar tus datos. Intenta de nuevo.");
  });

  describe("requestLearnerRecordReset (pure)", () => {
    it("delegates to resetLearningData exactly once, via a single storage.removeItem call (item 5)", () => {
      const storage = createTrackingStorage({ [PERCEPTUAL_LEARNING_STORAGE_KEY]: "{}" });

      requestLearnerRecordReset({ storage });

      expect(storage.removedKeys).toEqual([PERCEPTUAL_LEARNING_STORAGE_KEY]);
    });

    it("returns a safe, correctly-shaped empty LearnerRecord on success (item 6)", () => {
      const storage = createTrackingStorage({ [PERCEPTUAL_LEARNING_STORAGE_KEY]: "{}" });

      const result = requestLearnerRecordReset({ storage });

      expect(result).toEqual({
        succeeded: true,
        learnerRecord: { learnerId: null, hasEvidence: false, encounters: [], comparisons: [] },
      });
    });

    it("never calls setItem -- no replacement state is written and no new learner id is created (item 7)", () => {
      const storage = createTrackingStorage({ [PERCEPTUAL_LEARNING_STORAGE_KEY]: "{}" });

      requestLearnerRecordReset({ storage });

      expect(storage.setItemCalls).toBe(0);
    });

    it("leaves unrelated localStorage keys untouched (item 10)", () => {
      const storage = createTrackingStorage({
        [PERCEPTUAL_LEARNING_STORAGE_KEY]: "{}",
        "aurelian-builder-v1": "some-unrelated-collection-state",
        "some-other-app-key": "untouched",
      });

      requestLearnerRecordReset({ storage });

      expect(storage.removedKeys).toEqual([PERCEPTUAL_LEARNING_STORAGE_KEY]);
      expect(storage.has("aurelian-builder-v1")).toBe(true);
      expect(storage.getItem("aurelian-builder-v1")).toBe("some-unrelated-collection-state");
      expect(storage.has("some-other-app-key")).toBe(true);
    });

    it("returns { succeeded: false } and touches nothing else when storage access throws", () => {
      const throwingStorage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {
          throw new Error("blocked");
        },
      };

      const result = requestLearnerRecordReset({ storage: throwingStorage });

      expect(result).toEqual({ succeeded: false });
    });
  });

  it("exposes no delete action anywhere in the catalog learning disclosure or Observation/Comparison confirmation copy (item 12)", () => {
    // The three surfaces Phase 3.2 also touches for discoverability must
    // never gain a delete affordance of their own -- delete-all is
    // /mis-descubrimientos-only, per the locked product decision.
    const catalogSource = readFileSync(
      fileURLToPath(new URL("./CatalogExplorer.jsx", import.meta.url)),
      "utf8"
    );
    const observationSource = readFileSync(
      fileURLToPath(new URL("./ObservationCaptureFlow.jsx", import.meta.url)),
      "utf8"
    );
    const comparisonSource = readFileSync(
      fileURLToPath(new URL("./ComparisonCaptureFlow.jsx", import.meta.url)),
      "utf8"
    );

    for (const source of [catalogSource, observationSource, comparisonSource]) {
      expect(source).not.toMatch(/eliminar|resetLearningData/i);
    }
  });
});

describe("LearnerRecordContainer", () => {
  it("reads storage exactly once via getItem, and never calls setItem/removeItem, merely by rendering", () => {
    let getItemCalls = 0;
    let setItemCalls = 0;
    let removeItemCalls = 0;
    mockWindow({
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

    renderToStaticMarkup(<LearnerRecordContainer />);

    expect(getItemCalls).toBe(1);
    expect(setItemCalls).toBe(0);
    expect(removeItemCalls).toBe(0);
  });

  it("passes the storage-loaded state through buildLearnerRecord and renders real evidence", () => {
    const learnerId = createLearnerId();
    const encounter = createEncounterInstance({
      learnerId,
      fragranceId: 5,
      fragranceDisplaySnapshot: { fragranceId: 5, name: "Fico di Amalfi", brand: "Aurelian" },
    });
    const observation = createObservation({
      encounterInstanceId: encounter.encounterInstanceId,
      learnerId,
      moment: "initial",
      freeText: "Huele muy fresco.",
    });
    const payload = JSON.stringify({
      schemaVersion: PERCEPTUAL_LEARNING_SCHEMA_VERSION,
      learnerId,
      learnerCreatedAt: encounter.createdAt,
      encounterInstances: [encounter],
      observations: [observation],
      comparisons: [],
    });

    mockWindow({
      storage: {
        getItem: (key) => (key === PERCEPTUAL_LEARNING_STORAGE_KEY ? payload : null),
        setItem: () => {},
        removeItem: () => {},
      },
    });

    const markup = renderToStaticMarkup(<LearnerRecordContainer />);

    expect(markup).toContain("Fico di Amalfi");
    expect(markup).toContain("Huele muy fresco.");
  });

  it("degrades to the empty state when storage access throws, without crashing", () => {
    mockWindow({
      storage: {
        getItem: () => {
          throw new Error("boom");
        },
        setItem: () => {},
        removeItem: () => {},
      },
    });

    expect(() => renderToStaticMarkup(<LearnerRecordContainer />)).not.toThrow();

    const markup = renderToStaticMarkup(<LearnerRecordContainer />);
    expect(markup).toContain("Todavía no has registrado observaciones o comparaciones.");
  });
});

describe("architecture boundary", () => {
  const learnerRecordSource = readFileSync(
    fileURLToPath(new URL("../perceptualLearning/learnerRecord.js", import.meta.url)),
    "utf8"
  );
  const viewSource = readFileSync(fileURLToPath(new URL("./LearnerRecordView.jsx", import.meta.url)), "utf8");
  const mountSource = readFileSync(fileURLToPath(new URL("./LearnerRecordMount.jsx", import.meta.url)), "utf8");

  it("keeps the LearnerRecord domain read model free of any import at all -- no catalog, no anything", () => {
    // learnerRecord.js is pure and self-contained by design (see
    // learnerRecord.test.js's own snapshot/catalog-independence tests) --
    // asserting zero import statements is the strongest possible guarantee
    // that it never reaches into aurelianCatalog or any other module.
    expect(learnerRecordSource).not.toMatch(/^import /m);
  });

  it("introduces no Builder/Composer/AI coupling in the new Phase 3.1 files", () => {
    const combined = [learnerRecordSource, viewSource, mountSource].join("\n");
    expect(combined).not.toMatch(/@discovery-box\/builder|packages\/builder|composer|openai|anthropic/i);
  });
});
