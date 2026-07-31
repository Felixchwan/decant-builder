import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  AppErrorBoundary,
  AppErrorFallback,
} from "./AppErrorBoundary.jsx";
import { ANALYTICS_EVENTS } from "@discovery-box/builder/analytics";
import { clearSavedBuilderState } from "../utils/appRecovery.js";
import { buildLocalizedConfigOverrides } from "@discovery-box/builder/config";

describe("AppErrorBoundary", () => {
  it("shows customer-facing fallback UI after a child render failure state", () => {
    const boundary = new AppErrorBoundary({
      platformName: "Decant Builder",
      productName: "Decant Builder",
      storageKey: "decant-builder-v1",
      children: <p>Builder content</p>,
    });
    boundary.state = AppErrorBoundary.getDerivedStateFromError(
      new Error("technical secret")
    );

    const markup = renderToStaticMarkup(boundary.render());

    expect(markup).toContain("Something unexpected happened.");
    expect(markup).toContain("Your saved box may still be available.");
    expect(markup).toContain("Reload Builder");
    expect(markup).toContain("Clear Saved Box and Reload");
    expect(markup).not.toContain("technical secret");
    expect(markup).not.toContain("stack");
  });

  it("renders accessible recovery actions without technical details", () => {
    const markup = renderToStaticMarkup(
      <AppErrorFallback
        platformName="Decant Builder"
        productName="Decant Builder"
        onReload={() => {}}
        onClearSavedBox={() => {}}
      />
    );

    expect(markup).toContain('aria-labelledby="app-error-title"');
    expect(markup).toContain("Decant Builder");
    expect(markup).not.toContain("Error:");
    expect(markup).not.toContain("undefined");
  });

  it("localizes runtime recovery copy through merchant config", () => {
    const localized = buildLocalizedConfigOverrides("es-MX");
    const markup = renderToStaticMarkup(
      <AppErrorFallback
        platformName="Decant Builder"
        productName="Decant Builder"
        recoveryCopy={localized.recovery}
        onReload={() => {}}
        onClearSavedBox={() => {}}
      />
    );

    expect(markup).toContain("Ocurrió un error inesperado.");
    expect(markup).toContain("Recargar builder");
    expect(markup).toContain("Borrar caja guardada y recargar");
  });

  it("tracks runtime recovery without exposing technical details", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const trackedEvents = [];
    const boundary = new AppErrorBoundary({
      analytics: {
        track(eventName, payload) {
          trackedEvents.push({ eventName, payload });
        },
      },
    });

    try {
      boundary.componentDidCatch(new Error("secret failure"), {
        componentStack: "private stack",
      });

      expect(trackedEvents).toEqual([
        {
          eventName: ANALYTICS_EVENTS.RUNTIME_ERROR_BOUNDARY_SHOWN,
          payload: {
            errorCategory: "render_error",
            source: "system",
          },
        },
      ]);
      expect(JSON.stringify(trackedEvents)).not.toContain("secret failure");
      expect(JSON.stringify(trackedEvents)).not.toContain("private stack");
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("keeps recovery safe if analytics tracking fails", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const boundary = new AppErrorBoundary({
      analytics: {
        track() {
          throw new Error("provider unavailable");
        },
      },
    });

    try {
      expect(() =>
        boundary.componentDidCatch(new Error("render failure"), {})
      ).not.toThrow();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("clears only the configured Builder storage key", () => {
    const removedKeys = [];
    const previousWindow = globalThis.window;
    globalThis.window = {
      localStorage: {
        removeItem(key) {
          removedKeys.push(key);
        },
      },
    };

    try {
      expect(clearSavedBuilderState("decant-builder-v1")).toBe(true);
      expect(removedKeys).toEqual(["decant-builder-v1"]);
    } finally {
      globalThis.window = previousWindow;
    }
  });

  it("handles unavailable storage without throwing", () => {
    const previousWindow = globalThis.window;
    globalThis.window = {
      localStorage: {
        removeItem() {
          throw new Error("blocked");
        },
      },
    };

    try {
      expect(() => clearSavedBuilderState("decant-builder-v1")).not.toThrow();
      expect(clearSavedBuilderState("decant-builder-v1")).toBe(false);
    } finally {
      globalThis.window = previousWindow;
    }
  });
});
