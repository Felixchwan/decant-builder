import { describe, expect, it } from "vitest";
import {
  TEMPERATURE_BUCKETS,
  TODAY_SEASONS,
  WEATHER_CONDITIONS,
  bucketHour,
  bucketTemperature,
  deriveDayContext,
  deriveTodayContext,
} from "./todayContext.js";

describe("bucketHour: morning 05-10, daytime 11-16, evening 17-20, night 21-04", () => {
  const expected = [
    ...Array(5).fill("night"), // 0-4
    ...Array(6).fill("morning"), // 5-10
    ...Array(6).fill("daytime"), // 11-16
    ...Array(4).fill("evening"), // 17-20
    ...Array(3).fill("night"), // 21-23
  ];

  it.each(expected.map((bucket, hour) => [hour, bucket]))("hour %i is %s", (hour, bucket) => {
    expect(bucketHour(hour)).toBe(bucket);
  });

  it("covers all 24 hours", () => {
    expect(expected).toHaveLength(24);
  });
});

describe("deriveDayContext (weekday: Sunday = 0)", () => {
  it("a social night is Friday or Saturday from 18:00, and Saturday or Sunday before 05:00", () => {
    expect(deriveDayContext({ weekday: 5, hour: 17 })).toBeNull(); // Friday just before
    expect(deriveDayContext({ weekday: 5, hour: 18 })).toBe("social_night");
    expect(deriveDayContext({ weekday: 5, hour: 23 })).toBe("social_night");
    expect(deriveDayContext({ weekday: 6, hour: 0 })).toBe("social_night"); // the small hours of Saturday: Friday night
    expect(deriveDayContext({ weekday: 6, hour: 4 })).toBe("social_night");
    expect(deriveDayContext({ weekday: 6, hour: 5 })).toBe("weekend_daytime"); // Saturday morning
    expect(deriveDayContext({ weekday: 6, hour: 18 })).toBe("social_night");
    expect(deriveDayContext({ weekday: 6, hour: 23 })).toBe("social_night");
    expect(deriveDayContext({ weekday: 0, hour: 0 })).toBe("social_night"); // the small hours of Sunday: Saturday night
    expect(deriveDayContext({ weekday: 0, hour: 4 })).toBe("social_night");
    expect(deriveDayContext({ weekday: 0, hour: 5 })).toBe("weekend_daytime");
  });

  it("a workday daytime is Monday to Friday, morning or daytime", () => {
    for (const weekday of [1, 2, 3, 4, 5]) {
      expect(deriveDayContext({ weekday, hour: 5 })).toBe("workday_daytime");
      expect(deriveDayContext({ weekday, hour: 10 })).toBe("workday_daytime");
      expect(deriveDayContext({ weekday, hour: 16 })).toBe("workday_daytime");
    }
  });

  it("a weekday evening or night, and the small hours of Monday to Friday, have NO day context", () => {
    for (const weekday of [1, 2, 3, 4]) {
      expect(deriveDayContext({ weekday, hour: 17 })).toBeNull();
      expect(deriveDayContext({ weekday, hour: 20 })).toBeNull();
      expect(deriveDayContext({ weekday, hour: 21 })).toBeNull();
      expect(deriveDayContext({ weekday, hour: 23 })).toBeNull();
      expect(deriveDayContext({ weekday, hour: 0 })).toBeNull();
      expect(deriveDayContext({ weekday, hour: 4 })).toBeNull();
    }
    expect(deriveDayContext({ weekday: 5, hour: 17 })).toBeNull(); // Friday before the social night starts
  });

  it("a weekend daytime runs to 20:00; a Sunday night from 21:00 is ordinary", () => {
    expect(deriveDayContext({ weekday: 6, hour: 17 })).toBe("weekend_daytime");
    expect(deriveDayContext({ weekday: 0, hour: 17 })).toBe("weekend_daytime");
    expect(deriveDayContext({ weekday: 0, hour: 20 })).toBe("weekend_daytime");
    expect(deriveDayContext({ weekday: 0, hour: 21 })).toBeNull();
    expect(deriveDayContext({ weekday: 0, hour: 23 })).toBeNull();
  });

  it("every one of the 168 weekday/hour slots resolves without throwing, to one of the known contexts or null", () => {
    for (let weekday = 0; weekday < 7; weekday++) {
      for (let hour = 0; hour < 24; hour++) {
        expect([null, "social_night", "workday_daytime", "weekend_daytime"]).toContain(deriveDayContext({ weekday, hour }));
      }
    }
  });
});

describe("deriveTodayContext", () => {
  it("returns the buckets for a valid moment", () => {
    expect(deriveTodayContext({ season: "fall", hour: 21, weekday: 6 })).toEqual({
      season: "fall",
      hour: 21,
      weekday: 6,
      time: "night",
      dayContext: "social_night",
    });
  });

  it.each([
    [{ season: "autumn", hour: 10, weekday: 1 }],
    [{ season: "fall", hour: 24, weekday: 1 }],
    [{ season: "fall", hour: -1, weekday: 1 }],
    [{ season: "fall", hour: 10.5, weekday: 1 }],
    [{ season: "fall", hour: 10, weekday: 7 }],
    [{ season: "fall", hour: "10", weekday: 1 }],
    [{ hour: 10, weekday: 1 }],
    [undefined],
    [null],
  ])("is null for an unusable moment (%j), so scoring never runs on a guess", (input) => {
    expect(deriveTodayContext(input)).toBeNull();
  });

  it("knows exactly the four catalog seasons", () => {
    expect(TODAY_SEASONS).toEqual(["spring", "summer", "fall", "winter"]);
  });

  it("carries the optional future fields only when they are valid, and invents neither", () => {
    const base = { season: "summer", hour: 12, weekday: 2 };

    expect(deriveTodayContext(base)).not.toHaveProperty("temperatureBucket");
    expect(deriveTodayContext(base)).not.toHaveProperty("weatherCondition");
    expect(deriveTodayContext({ ...base, temperatureBucket: "hot", weatherCondition: "clear" })).toMatchObject({
      temperatureBucket: "hot",
      weatherCondition: "clear",
    });
    expect(deriveTodayContext({ ...base, temperatureBucket: "scorching", weatherCondition: "tornado" })).not.toHaveProperty("temperatureBucket");
    expect(deriveTodayContext({ ...base, temperatureBucket: "scorching", weatherCondition: "tornado" })).not.toHaveProperty("weatherCondition");
    expect(TEMPERATURE_BUCKETS).toEqual(["hot", "warm", "mild", "cool", "cold"]);
    expect(WEATHER_CONDITIONS).toEqual(["clear", "cloudy", "rain"]);
  });

  it("returns an immutable context", () => {
    expect(Object.isFrozen(deriveTodayContext({ season: "fall", hour: 1, weekday: 1 }))).toBe(true);
  });
});

describe("bucketTemperature (the contract a host will use later; nothing populates it today)", () => {
  it.each([
    [40, "hot"],
    [32, "hot"],
    [31.9, "warm"],
    [26, "warm"],
    [25.9, "mild"],
    [19, "mild"],
    [18.9, "cool"],
    [12, "cool"],
    [11.9, "cold"],
    [-3, "cold"],
  ])("%f C is %s", (celsius, bucket) => {
    expect(bucketTemperature(celsius)).toBe(bucket);
  });

  it.each([[undefined], [null], [NaN], [Infinity], ["20"]])("is null for %j, so a missing reading never becomes a bucket", (value) => {
    expect(bucketTemperature(value)).toBeNull();
  });
});
