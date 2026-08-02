import { describe, expect, it, vi } from "vitest";
import { createWhatsAppFinalizationAdapter } from "./index.js";

const model = Object.freeze({ message: "Solicitud de disponibilidad\nNombre: Ana\nMunicipio: San Pedro & Santa Catarina" });
const expectedUrl = "https://wa.me/528129800010?text=Solicitud%20de%20disponibilidad%0ANombre%3A%20Ana%0AMunicipio%3A%20San%20Pedro%20%26%20Santa%20Catarina";

function adapter(overrides = {}) {
  return createWhatsAppFinalizationAdapter({
    phoneNumber: "528129800010",
    openWindow: vi.fn(() => ({ opener: "host" })),
    copyText: vi.fn(async () => true),
    ...overrides,
  });
}

describe("createWhatsAppFinalizationAdapter", () => {
  it("opens the exactly encoded URL, copies the message, and isolates opener", async () => {
    const openedWindow = { opener: "host" };
    const openWindow = vi.fn(() => openedWindow);
    const copyText = vi.fn(async () => true);
    await expect(adapter({ openWindow, copyText }).finalize(model)).resolves.toEqual({ status: "opened", copied: true, manualUrl: "" });
    expect(openWindow).toHaveBeenCalledWith(expectedUrl, "_blank");
    expect(copyText).toHaveBeenCalledWith(model.message);
    expect(openedWindow.opener).toBe(null);
  });

  it("returns a copied manual fallback when the popup is blocked", async () => {
    await expect(adapter({ openWindow: vi.fn(() => null) }).finalize(model)).resolves.toEqual({ status: "manual_required", copied: true, manualUrl: expectedUrl });
  });

  it.each([["unavailable", vi.fn(async () => false)], ["rejected", vi.fn(async () => Promise.reject(new Error("denied")))]])(
    "keeps a successful open when clipboard is %s",
    async (_label, copyText) => expect(adapter({ copyText }).finalize(model)).resolves.toEqual({ status: "opened", copied: false, manualUrl: "" })
  );

  it("preserves a manual link when opening and copying are unavailable", async () => {
    await expect(adapter({ openWindow: vi.fn(() => null), copyText: vi.fn(async () => false) }).finalize(model)).resolves.toEqual({ status: "manual_required", copied: false, manualUrl: expectedUrl });
  });

  it("converts thrown browser capabilities into a controlled failure", async () => {
    await expect(adapter({ openWindow: vi.fn(() => { throw new Error("browser unavailable"); }) }).finalize(model)).resolves.toEqual({ status: "failed", copied: false, manualUrl: expectedUrl });
  });

  it("does not log customer data", async () => {
    const logger = vi.spyOn(console, "log").mockImplementation(() => {});
    await adapter().finalize(model);
    expect(logger).not.toHaveBeenCalled();
    logger.mockRestore();
  });
});
