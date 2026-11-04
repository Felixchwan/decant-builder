import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bucketHour } from "../../../../packages/builder/src/builder/internal/recommendations/todayContext.js";
import {
  MONTERREY_TIME_ZONE,
  SEASON_BY_MONTH,
  getMonterreyClock,
  getMonterreyTodayContext,
  getPartOfDay,
} from "./monterreyContext.js";

// Monterrey is UTC-6 all year (Mexico abolished daylight saving in 2022), so a Monterrey wall-clock time is the UTC instant + 6h.
const at = (iso) => new Date(iso);

describe("Monterrey's own clock, never the visitor's", () => {
  it("is America/Monterrey", () => {
    expect(MONTERREY_TIME_ZONE).toBe("America/Monterrey");
  });

  it("reads the hour, weekday and month on a Monterrey wall clock", () => {
    // Saturday 7 November 2026, 21:00 in Monterrey = 03:00 UTC on the 8th
    expect(getMonterreyClock(at("2026-11-08T03:00:00Z"))).toEqual({ month: 11, hour: 21, weekday: 6 });
    // Wednesday 4 November 2026, 00:30 in Monterrey = 06:30 UTC
    expect(getMonterreyClock(at("2026-11-04T06:30:00Z"))).toEqual({ month: 11, hour: 0, weekday: 3 });
  });

  it("midnight is hour 0, never 24", () => {
    expect(getMonterreyClock(at("2026-11-04T06:00:00Z")).hour).toBe(0);
    expect(getMonterreyClock(at("2026-11-04T05:59:00Z")).hour).toBe(23);
  });

  it("follows Monterrey across the UTC date boundary: 23:30 in Monterrey is already tomorrow in UTC", () => {
    // 31 May 23:30 in Monterrey is 1 June 05:30 UTC: the UTC month is June (summer) but Monterrey's is still May (spring)
    const instant = at("2026-06-01T05:30:00Z");

    expect(getMonterreyClock(instant)).toEqual({ month: 5, hour: 23, weekday: 0 }); // Sunday 31 May
    expect(getMonterreyTodayContext(instant).season).toBe("spring");
    // ... and 1 June 00:00 Monterrey, a half hour later, is summer
    expect(getMonterreyTodayContext(at("2026-06-01T06:00:00Z")).season).toBe("summer");
  });

  it("follows Monterrey across the weekday boundary", () => {
    // Friday 23:59 Monterrey = Saturday 05:59 UTC; Saturday 00:00 Monterrey = 06:00 UTC
    expect(getMonterreyClock(at("2026-11-07T05:59:00Z")).weekday).toBe(5);
    expect(getMonterreyClock(at("2026-11-07T06:00:00Z")).weekday).toBe(6);
  });

  it("reads the same whatever the machine's own zone is", () => {
    const instant = at("2026-11-08T03:00:00Z");
    const before = getMonterreyClock(instant);
    const original = process.env.TZ;

    process.env.TZ = "Pacific/Auckland";
    const during = getMonterreyClock(instant);

    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;

    expect(during).toEqual(before);
  });

  it("reads every hour of a day correctly", () => {
    for (let hour = 0; hour < 24; hour++) {
      // Monterrey hour h on Wednesday 4 November 2026 = (h + 6) UTC
      const utc = new Date(Date.UTC(2026, 10, 4, hour + 6));

      expect(getMonterreyClock(utc).hour).toBe(hour);
    }
  });
});

describe("month to season: December-February winter, March-May spring, June-September summer, October-November fall", () => {
  it.each([
    [1, "winter"],
    [2, "winter"],
    [3, "spring"],
    [4, "spring"],
    [5, "spring"],
    [6, "summer"],
    [7, "summer"],
    [8, "summer"],
    [9, "summer"],
    [10, "fall"],
    [11, "fall"],
    [12, "winter"],
  ])("month %i is %s", (month, season) => {
    expect(SEASON_BY_MONTH[month]).toBe(season);
  });

  it("covers all twelve months and only the catalog's four season keys", () => {
    expect(Object.keys(SEASON_BY_MONTH)).toHaveLength(12);
    expect(new Set(Object.values(SEASON_BY_MONTH))).toEqual(new Set(["spring", "summer", "fall", "winter"]));
  });

  it("maps a date in each month through the whole pipeline", () => {
    for (let month = 1; month <= 12; month++) {
      expect(getMonterreyTodayContext(new Date(Date.UTC(2026, month - 1, 15, 18))).season).toBe(SEASON_BY_MONTH[month]);
    }
  });
});

describe("part of the day agrees with the Builder's buckets, for all 24 hours", () => {
  it.each(Array.from({ length: 24 }, (_, hour) => [hour]))("hour %i", (hour) => {
    expect(getPartOfDay(hour)).toBe(bucketHour(hour));
  });
});

describe("the context handed to the Builder", () => {
  it("is the moment (season, hour, weekday) plus the line the drawer shows", () => {
    expect(getMonterreyTodayContext(at("2026-11-08T03:00:00Z"))).toEqual({
      season: "fall",
      hour: 21,
      weekday: 6,
      label: "Monterrey · Noche de otoño",
    });
  });

  it.each([
    ["2026-11-04T12:00:00Z", "Monterrey · Mañana de otoño"], // 06:00
    ["2026-07-15T19:00:00Z", "Monterrey · Día de verano"], // 13:00
    ["2026-01-15T00:00:00Z", "Monterrey · Tarde de invierno"], // 18:00 the day before
    ["2026-04-10T05:00:00Z", "Monterrey · Noche de primavera"], // 23:00 the day before
  ])("%s reads %s", (iso, label) => {
    expect(getMonterreyTodayContext(at(iso)).label).toBe(label);
  });

  it("says nothing about weather or degrees: none is known", () => {
    for (let hour = 0; hour < 24; hour++) {
      const { label, ...rest } = getMonterreyTodayContext(new Date(Date.UTC(2026, 10, 4, hour + 6)));

      expect(label).not.toMatch(/°|grados|lluvia|calor|frío|soleado|despejado|nublado/i);
      expect(Object.keys(rest).sort()).toEqual(["hour", "season", "weekday"]);
    }
  });

  it("makes no network request itself and keeps no state: weather arrives only through the weather client, and there is no timer or storage", () => {
    const code = readFileSync(new URL("./monterreyContext.js", import.meta.url), "utf8").replace(/^\s*\/\/.*$/gm, "");

    expect(code).not.toMatch(/fetch\(|XMLHttpRequest|setInterval|setTimeout|localStorage|sessionStorage|navigator\./);
  });
});
