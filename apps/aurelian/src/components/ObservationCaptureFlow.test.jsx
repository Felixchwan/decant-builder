import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import {
  ObservationCaptureFlow,
  ObservationConfirmation,
  ObservationDoneState,
  ObservationForm,
  ObservationPicker,
  canSubmitObservation,
  formatObservationTimestamp,
  resolveInitialFragrance,
} from "./ObservationCaptureFlow.jsx";
import { aurelianCatalog } from "../merchant/catalog.js";

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
  it("resolves the fragrance for a valid ?fragrance= id", () => {
    mockWindow({ search: "?fragrance=1" });

    const fragrance = resolveInitialFragrance();

    expect(fragrance).not.toBeNull();
    expect(fragrance.id).toBe(1);
    expect(fragrance).toBe(aurelianCatalog.find((item) => item.id === 1));
  });

  it("returns null when the query param is missing", () => {
    mockWindow({ search: "" });

    expect(resolveInitialFragrance()).toBeNull();
  });

  it("returns null when the query param is malformed or unresolvable", () => {
    mockWindow({ search: "?fragrance=abc" });
    expect(resolveInitialFragrance()).toBeNull();

    mockWindow({ search: "?fragrance=999999999" });
    expect(resolveInitialFragrance()).toBeNull();
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
  it("renders the picker when no valid fragrance query param is present", () => {
    mockWindow({ search: "" });

    const markup = renderToStaticMarkup(<ObservationCaptureFlow />);

    expect(markup).toContain("observation-picker");
  });

  it("renders the form directly when a valid fragrance query param resolves", () => {
    mockWindow({ search: "?fragrance=1" });

    const markup = renderToStaticMarkup(<ObservationCaptureFlow />);

    expect(markup).toContain("observation-form");
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
});
