import { beforeEach, describe, expect, it, vi } from "vitest";
import { bucketTemperature } from "../../../../../packages/builder/src/builder/internal/recommendations/todayContext.js";
import { deriveTodayContext } from "../../../../../packages/builder/src/builder/internal/recommendations/todayContext.js";
import { getMonterreyTodayContext, resolveMonterreyTodayContext } from "../monterreyContext.js";
import { resetWeatherContextMemory } from "./weatherContextClient.js";
import { WEATHER_ATTRIBUTION, bucketTemperatureC, describePartOfDay, weatherToContextFields } from "./weatherContext.js";

// Saturday 7 November 2026, 21:00 in Monterrey (03:00 UTC on the 8th)
const SAT_NIGHT = new Date("2026-11-08T03:00:00Z");
const weather = (overrides = {}) => ({ available: true, temperatureC: 17.6, condition: "clear", validAt: "x", fetchedAt: "y", stale: false, ...overrides });

describe("bucketTemperatureC: the same edges as the Builder's, kept in step", () => {
  it.each([[40], [32], [31.9], [26], [25.9], [19], [18.9], [12], [11.9], [-3], [0], [28.5]])("%f C", (celsius) => {
    expect(bucketTemperatureC(celsius)).toBe(bucketTemperature(celsius));
  });

  it("is null for anything that is not a finite number", () => {
    for (const value of [undefined, null, NaN, Infinity, "20"]) expect(bucketTemperatureC(value)).toBeNull();
  });

  it("hot >= 32, warm 26-31.9, mild 19-25.9, cool 12-18.9, cold < 12", () => {
    expect([32, 31.9, 26, 25.9, 19, 18.9, 12, 11.9].map(bucketTemperatureC)).toEqual(["hot", "warm", "warm", "mild", "mild", "cool", "cool", "cold"]);
  });
});

describe("weatherToContextFields: the generic fields the Builder understands", () => {
  it("gives a temperature bucket from the ACTUAL temperature and the condition when the Builder knows it", () => {
    expect(weatherToContextFields(weather({ temperatureC: 34, condition: "clear" }))).toEqual({ temperatureBucket: "hot", weatherCondition: "clear" });
    expect(weatherToContextFields(weather({ temperatureC: 9, condition: "rain" }))).toEqual({ temperatureBucket: "cold", weatherCondition: "rain" });
    expect(weatherToContextFields(weather({ condition: "cloudy" }))).toMatchObject({ weatherCondition: "cloudy" });
  });

  it("leaves 'other' (fog, snow, sleet) out instead of passing a guess on", () => {
    expect(weatherToContextFields(weather({ condition: "other" }))).toEqual({ temperatureBucket: "cool" });
  });

  it("is empty for no weather, for unavailable weather, and never invents a feels-like", () => {
    expect(weatherToContextFields(null)).toEqual({});
    expect(weatherToContextFields({ available: false })).toEqual({});
    expect(Object.keys(weatherToContextFields(weather()))).not.toContain("apparentTemperatureC");
  });

  it("produces a context the Builder accepts, and drops nothing it was meant to keep", () => {
    const base = getMonterreyTodayContext(SAT_NIGHT, weather({ temperatureC: 34, condition: "rain" }));
    const derived = deriveTodayContext(base);

    expect(derived).toMatchObject({ temperatureBucket: "hot", weatherCondition: "rain", time: "night", dayContext: "social_night" });
  });
});

describe("the drawer's line", () => {
  it("without weather it is unchanged: the moment alone, no degrees", () => {
    expect(getMonterreyTodayContext(SAT_NIGHT)).toEqual({ season: "fall", hour: 21, weekday: 6, label: "Monterrey · Noche de otoño" });
    expect(getMonterreyTodayContext(SAT_NIGHT, { available: false })).toEqual(getMonterreyTodayContext(SAT_NIGHT));
    expect(getMonterreyTodayContext(SAT_NIGHT, null)).toEqual(getMonterreyTodayContext(SAT_NIGHT));
  });

  it("with weather it reads 'Monterrey · 18 °C · Noche fresca': rounded degrees and the part of the day with the temperature's adjective", () => {
    const context = getMonterreyTodayContext(SAT_NIGHT, weather({ temperatureC: 17.6 }));

    expect(context.label).toBe("Monterrey · 18 °C · Noche fresca");
    expect(context).toMatchObject({ season: "fall", hour: 21, weekday: 6, temperatureBucket: "cool", weatherCondition: "clear", attribution: WEATHER_ATTRIBUTION });
  });

  it("agrees in gender: 'Día' is masculine", () => {
    const noon = new Date("2026-07-14T18:00:00Z"); // 12:00 Monterrey, summer

    expect(getMonterreyTodayContext(noon, weather({ temperatureC: 37 })).label).toBe("Monterrey · 37 °C · Día caluroso");
    expect(describePartOfDay({ partLabel: "Tarde", temperatureBucket: "warm" })).toBe("Tarde cálida");
    expect(describePartOfDay({ partLabel: "Mañana", temperatureBucket: "mild" })).toBe("Mañana templada");
    expect(describePartOfDay({ partLabel: "Noche", temperatureBucket: "cold" })).toBe("Noche fría");
    expect(describePartOfDay({ partLabel: "Día", temperatureBucket: "cool" })).toBe("Día fresco");
    expect(describePartOfDay({ partLabel: "Noche", temperatureBucket: null })).toBe("Noche");
  });

  it("with STALE weather it shows the bucket's adjective but not the hours-old number", () => {
    expect(getMonterreyTodayContext(SAT_NIGHT, weather({ stale: true })).label).toBe("Monterrey · Noche fresca");
  });

  it("is a concise line, not a dashboard: no humidity, wind, pressure, provider name or feels-like in it", () => {
    for (const celsius of [3, 15, 22, 28, 38]) {
      expect(getMonterreyTodayContext(SAT_NIGHT, weather({ temperatureC: celsius })).label).not.toMatch(/humedad|viento|presión|met|norway|sensación/i);
    }
  });

  it("carries the credit line the data's licence asks for, only when weather is in use", () => {
    expect(WEATHER_ATTRIBUTION.text).toContain("MET Norway");
    expect(WEATHER_ATTRIBUTION.href).toBe("https://api.met.no/");
    expect(getMonterreyTodayContext(SAT_NIGHT)).not.toHaveProperty("attribution");
    expect(getMonterreyTodayContext(SAT_NIGHT, weather())).toHaveProperty("attribution");
  });
});

describe("resolveMonterreyTodayContext: the drawer's background request", () => {
  beforeEach(() => {
    resetWeatherContextMemory();
    vi.unstubAllGlobals();
  });

  it("is the moment WITH the weather the endpoint returned", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ available: true, temperatureC: 12.4, condition: "rain", validAt: "2026-11-04T07:00:00.000Z", fetchedAt: "2026-11-04T07:47:00.000Z", stale: false }), { status: 200 })));

    expect(await resolveMonterreyTodayContext()).toMatchObject({ temperatureBucket: "cool", weatherCondition: "rain", attribution: WEATHER_ATTRIBUTION });
  });

  it("is null when there is no weather, so the drawer keeps what it had", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ available: false }), { status: 200 })));

    expect(await resolveMonterreyTodayContext()).toBeNull();
  });

  it("is null, never a throw, when the endpoint is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("offline");
    }));

    expect(await resolveMonterreyTodayContext()).toBeNull();
  });
});
