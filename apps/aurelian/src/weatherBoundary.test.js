import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8").replace(/\r\n/g, "\n");
const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function sourceFiles(directory, include = /\.(js|jsx)$/, skip = /\.test\.|node_modules|\.next|dist/) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);

    if (skip.test(path)) return [];

    return statSync(path).isDirectory() ? sourceFiles(path, include, skip) : include.test(name) ? [path] : [];
  });
}

const WEATHER_DIR = join(APP_ROOT, "src", "lib", "weather");
const weatherFiles = sourceFiles(WEATHER_DIR);

describe("the shared packages know nothing of the weather provider, the city, the host or the cache", () => {
  const shared = [...sourceFiles(join(REPOSITORY_ROOT, "packages", "builder", "src")), ...sourceFiles(join(REPOSITORY_ROOT, "packages", "catalog", "src"))];

  it("scans a real set of files", () => {
    expect(shared.length).toBeGreaterThan(100);
  });

  it("no shared source (comments included) names MET Norway, a forecast endpoint, Monterrey, Aurelian, a route, the Vercel SDK or a cache implementation", () => {
    const offenders = shared
      .filter((file) => /met\.no|met norway|locationforecast|monterrey|aurelian|api\/context|@vercel|getCache|runtime cache|open-meteo/i.test(readFileSync(file, "utf8")))
      .map((file) => relative(REPOSITORY_ROOT, file));

    expect(offenders).toEqual([]);
  });

  it("no shared source makes a network request or opens a connection", () => {
    const offenders = shared.filter((file) => /\bfetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/.test(strip(readFileSync(file, "utf8")))).map((file) => relative(REPOSITORY_ROOT, file));

    expect(offenders).toEqual([]);
  });

  it("the Today engine, its context helper and its words take generic fields only", () => {
    const engine = read(REPOSITORY_ROOT, "packages", "builder", "src", "builder", "internal", "recommendations", "buildTodayRecommendations.js");
    const context = read(REPOSITORY_ROOT, "packages", "builder", "src", "builder", "internal", "recommendations", "todayContext.js");

    expect(strip(engine) + strip(context)).not.toMatch(/symbol|temperatureC|apparent|precipitation|\bmm\b/i);
  });
});

describe("Discovery Decants has no weather execution path", () => {
  it("its host source, config and styles carry nothing of it", () => {
    for (const file of sourceFiles(join(REPOSITORY_ROOT, "src"), /\.(js|jsx|css)$/)) {
      expect(readFileSync(file, "utf8"), relative(REPOSITORY_ROOT, file)).not.toMatch(/weather|met\.no|monterrey|getTodayContext|resolveTodayContext|api\/context|suggestionsDrawer: true/i);
    }
  });

  it("its configuration leaves the Suggestions feature (and so every context callback) off", async () => {
    const { discoveryDecantsConfig } = await import("../../../src/merchants/discoveryDecants/config.js");

    expect(discoveryDecantsConfig.features.suggestionsDrawer).toBe(false);
  });

  it("the Vercel SDK is a dependency of Aurelian alone", () => {
    const manifest = (...segments) => JSON.parse(read(REPOSITORY_ROOT, ...segments, "package.json"));

    expect(manifest("apps", "aurelian").dependencies["@vercel/functions"]).toBe("3.10.6");
    expect(manifest().dependencies?.["@vercel/functions"]).toBeUndefined();
    expect(manifest("packages", "builder").dependencies?.["@vercel/functions"]).toBeUndefined();
    expect(manifest("packages", "catalog").dependencies?.["@vercel/functions"]).toBeUndefined();
  });

  it("the weather route lives in Aurelian only", () => {
    expect(existsSync(join(APP_ROOT, "src", "app", "api", "context", "weather", "route.js"))).toBe(true);
    expect(existsSync(join(REPOSITORY_ROOT, "src", "app", "api"))).toBe(false);
    expect(existsSync(join(REPOSITORY_ROOT, "src", "api"))).toBe(false);
    expect(existsSync(join(REPOSITORY_ROOT, "api"))).toBe(false);
  });
});

describe("the weather code does only what was decided", () => {
  const code = weatherFiles.map((file) => ({ file: relative(APP_ROOT, file), source: strip(readFileSync(file, "utf8")) }));

  it("scans the weather modules", () => {
    expect(code.map(({ file }) => file.replace(/\\/g, "/")).sort()).toEqual([
      "src/lib/weather/metNorway.js",
      "src/lib/weather/monterreyLocation.js",
      "src/lib/weather/weatherContext.js",
      "src/lib/weather/weatherContextClient.js",
      "src/lib/weather/weatherService.js",
      "src/lib/weather/weatherSnapshot.js",
    ]);
  });

  it("no timer, schedule, polling or cron anywhere: weather is read only when somebody asks", () => {
    for (const { file, source } of code) {
      expect(source, file).not.toMatch(/setInterval|setTimeout|cron|schedule|requestIdleCallback|addEventListener/i);
    }

    expect(existsSync(join(REPOSITORY_ROOT, "vercel.json"))).toBe(false);
    expect(existsSync(join(APP_ROOT, "vercel.json"))).toBe(false);
    expect(readFileSync(join(APP_ROOT, "next.config.js"), "utf8")).not.toMatch(/cron/i);
  });

  it("the provider is contacted from exactly one place (the adapter), and only server-side (never from a client module)", () => {
    const callers = code.filter(({ source }) => /api\.met\.no/.test(source)).map(({ file }) => file.replace(/\\/g, "/"));

    expect(callers).toEqual(["src/lib/weather/metNorway.js", "src/lib/weather/weatherContext.js"]);
    // weatherContext.js only HOLDS the credit link; it makes no request
    expect(code.find(({ file }) => file.endsWith("weatherContext.js")).source).not.toMatch(/fetch/);

    for (const file of sourceFiles(join(APP_ROOT, "src", "components"))) {
      expect(readFileSync(file, "utf8"), relative(APP_ROOT, file)).not.toMatch(/met\.no|metNorway|weatherService|weatherSnapshot/);
    }
  });

  it("the browser-side modules never import the server-side ones", () => {
    const client = code.find(({ file }) => file.endsWith("weatherContextClient.js")).source;
    const hostContext = strip(read(APP_ROOT, "src", "lib", "monterreyContext.js"));

    expect(client).not.toMatch(/import /);
    expect(hostContext).not.toMatch(/metNorway|weatherService|weatherSnapshot|@vercel/);
  });

  it("holds no personal address, no key and no secret", () => {
    for (const { file, source } of code) {
      expect(source, file).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
      expect(source, file).not.toMatch(/api[_-]?key|apikey|secret|token|process\.env/i);
    }
  });

  it("sends nothing of the visitor to the provider: the route does not read the request, cookies or headers", () => {
    const route = strip(read(APP_ROOT, "src", "app", "api", "context", "weather", "route.js"));

    expect(route).not.toMatch(/request|cookies|headers\(|searchParams|geolocation|x-forwarded|ip\b/i);
    expect(route).toContain("export async function GET()");
  });

  it("the snapshot service keeps no module-level cache, and never names the Vercel SDK", () => {
    const snapshot = code.find(({ file }) => file.endsWith("weatherSnapshot.js")).source;

    expect(snapshot).not.toMatch(/@vercel|getCache/);
    expect(code.filter(({ source }) => /@vercel\/functions/.test(source)).map(({ file }) => file.replace(/\\/g, "/"))).toEqual(["src/lib/weather/weatherService.js"]);
  });

  it("uses the platform's shared cache for the production wiring, in a namespace of its own", () => {
    const wiring = code.find(({ file }) => file.endsWith("weatherService.js")).source;

    expect(wiring).toContain('getCache({ namespace: "aurelian-weather" })');
    expect(wiring).not.toMatch(/new Map|globalThis|process\./);
  });
});

describe("documentation", () => {
  it("ADR-0001 records the one server route, its shared-cache rationale, and that the decision stands", () => {
    const adr = read(REPOSITORY_ROOT, "docs", "adr", "0001-fully-client-side-architecture.md");

    expect(adr).toContain("## Amendment (2026-11-04): Aurelian's weather context route");
    expect(adr).toContain("GET /api/context/weather");
    expect(adr).toMatch(/first server-side call to an external service/);
    expect(adr).toMatch(/Runtime Cache/);
    expect(adr).toMatch(/no schedule, no polling and no database/);
    expect(adr).toMatch(/Discovery Decants makes no such call/);
    expect(adr).toMatch(/not an application backend in the sense of this ADR/);
    expect(adr).not.toContain("no `fetch`/`axios` call in `src`, `packages/builder/src`, or `apps/aurelian/src`;");
  });

  it("no other ADR was changed to make room for it", () => {
    const readme = read(REPOSITORY_ROOT, "docs", "adr", "README.md");

    expect(readme).toContain("| [0001](0001-fully-client-side-architecture.md) | No application backend or shared server tier |");
  });
});
