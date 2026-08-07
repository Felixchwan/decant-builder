import { describe, expect, it } from "vitest";

import {
  createBuilderConfig,
  validateBuilderConfig,
} from "@discovery-box/builder/config";
import { aurelianConfig } from "../../apps/aurelian/src/merchant/config.js";
import { discoveryDecantsConfig } from "./discoveryDecants/config.js";

describe("merchant configs", () => {
  it("keeps software identity separate from merchant identity", () => {
    expect(discoveryDecantsConfig.software.name).toBe("Decant Builder");
    expect(aurelianConfig.software.name).toBe("Decant Builder");
    expect(discoveryDecantsConfig.brand.businessName).toBe("Discovery Decants");
    expect(aurelianConfig.brand.businessName).toBe("Aurelian");
  });

  it("declares locale by config instead of merchant-name conditionals", () => {
    expect(discoveryDecantsConfig.locale).toBe("en-US");
    expect(discoveryDecantsConfig.commerce.locale).toBe("en-US");
    expect(aurelianConfig.locale).toBe("es-MX");
    expect(aurelianConfig.commerce.locale).toBe("es-MX");
  });

  it("keeps Discovery Decants as the active order implementation", () => {
    expect(discoveryDecantsConfig.finalization.mode).toBe("whatsapp");
    expect(discoveryDecantsConfig.finalization.whatsappNumber).toBe("528129800010");
    expect(discoveryDecantsConfig.finalization.whatsapp.greeting).toContain("{businessName}");
    expect(discoveryDecantsConfig.finalization.visibleCustomerFields).toEqual(["name", "city", "notes"]);
  });

  it("uses the approved Aurelian availability-request destination", () => {
    expect(aurelianConfig.finalization.mode).toBe("whatsapp");
    expect(aurelianConfig.finalization.whatsappNumber).toBe("528129800010");
    expect(aurelianConfig.features.whatsappFinalization).toBe(true);
    expect(aurelianConfig.finalization.visibleCustomerFields).toEqual(["name", "city"]);
    expect(aurelianConfig.finalization.whatsapp.greeting).toBe(
      "Hola, Aurelian. Esta es una Solicitud de disponibilidad para una Discovery Box."
    );
  });

  it("shows the empty-box discovery intro coachmark for Discovery Decants but not Aurelian", () => {
    expect(discoveryDecantsConfig.features.discoveryCoachmark).toBe(true);
    expect(aurelianConfig.features.discoveryCoachmark).toBe(false);
  });

  it("validates supported locales and rejects malformed locale values", () => {
    expect(() => validateBuilderConfig(discoveryDecantsConfig)).not.toThrow();
    expect(() => validateBuilderConfig(aurelianConfig)).not.toThrow();
    expect(() => createBuilderConfig({ locale: "fr-FR" })).toThrow(
      /Invalid builder config at locale/
    );
  });
});
