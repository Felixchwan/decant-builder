import { describe, expect, it, vi } from "vitest";

import { discoveryDecantsConfig } from "../merchants/discoveryDecants/config.js";
import {
  buildWhatsAppUrl,
  createWhatsAppFinalizationAdapter,
} from "./createWhatsAppFinalizationAdapter.js";

const finalizationModel = Object.freeze({
  customer: {
    name: "Ana",
    city: "Monterrey",
    notes: "Prefer citrus & woods",
  },
  order: {
    totalSlots: 6,
    totalPoints: 12,
    monetaryTotal: 1200,
  },
  message: "Hello Discovery Decants\nCustomer: Ana\nNotes: citrus & woods",
});

function createAdapter(overrides = {}) {
  return createWhatsAppFinalizationAdapter({
    phoneNumber: discoveryDecantsConfig.finalization.whatsappNumber,
    openWindow: vi.fn(() => ({ opener: "host" })),
    copyText: vi.fn(async () => true),
    ...overrides,
  });
}

describe("createWhatsAppFinalizationAdapter", () => {
  it("opens the correctly encoded Discovery Decants WhatsApp URL and copies the message", async () => {
    const openedWindow = { opener: "host" };
    const openWindow = vi.fn(() => openedWindow);
    const copyText = vi.fn(async () => true);
    const adapter = createAdapter({ openWindow, copyText });

    await expect(adapter.finalize(finalizationModel)).resolves.toEqual({
      status: "opened",
      copied: true,
      manualUrl: "",
    });
    expect(openWindow).toHaveBeenCalledWith(
      buildWhatsAppUrl({
        phoneNumber: "528129800010",
        message: finalizationModel.message,
      }),
      "_blank"
    );
    expect(openWindow.mock.calls[0][0]).toBe(
      "https://wa.me/528129800010?text=Hello%20Discovery%20Decants%0ACustomer%3A%20Ana%0ANotes%3A%20citrus%20%26%20woods"
    );
    expect(copyText).toHaveBeenCalledWith(finalizationModel.message);
    expect(openedWindow.opener).toBe(null);
  });

  it("returns a manual link when the popup is blocked and clipboard fallback succeeds", async () => {
    const adapter = createAdapter({
      openWindow: vi.fn(() => null),
      copyText: vi.fn(async () => true),
    });

    await expect(adapter.finalize(finalizationModel)).resolves.toEqual({
      status: "manual_required",
      copied: true,
      manualUrl: buildWhatsAppUrl({
        phoneNumber: "528129800010",
        message: finalizationModel.message,
      }),
    });
  });

  it.each([
    ["unavailable", vi.fn(async () => false)],
    ["rejected", vi.fn(async () => Promise.reject(new Error("denied")))],
  ])("keeps a successful open when clipboard is %s", async (_label, copyText) => {
    const adapter = createAdapter({ copyText });

    await expect(adapter.finalize(finalizationModel)).resolves.toEqual({
      status: "opened",
      copied: false,
      manualUrl: "",
    });
  });

  it("returns the manual-link fallback when opening and copying are unavailable", async () => {
    const adapter = createAdapter({
      openWindow: vi.fn(() => null),
      copyText: vi.fn(async () => false),
    });

    const result = await adapter.finalize(finalizationModel);

    expect(result.status).toBe("manual_required");
    expect(result.copied).toBe(false);
    expect(result.manualUrl).toContain("https://wa.me/528129800010?text=");
  });

  it("converts browser adapter failures into a structured result without rejection", async () => {
    const adapter = createAdapter({
      openWindow: vi.fn(() => {
        throw new Error("browser unavailable");
      }),
    });

    await expect(adapter.finalize(finalizationModel)).resolves.toEqual({
      status: "failed",
      copied: false,
      manualUrl: buildWhatsAppUrl({
        phoneNumber: "528129800010",
        message: finalizationModel.message,
      }),
    });
  });

  it("passes customer order data only to delivery capabilities and does not log it", async () => {
    const logger = vi.spyOn(console, "log").mockImplementation(() => {});
    const openWindow = vi.fn(() => ({ opener: null }));
    const copyText = vi.fn(async () => true);
    const adapter = createAdapter({ openWindow, copyText });

    await adapter.finalize(finalizationModel);

    expect(copyText).toHaveBeenCalledWith(finalizationModel.message);
    expect(logger).not.toHaveBeenCalled();
    logger.mockRestore();
  });
});
