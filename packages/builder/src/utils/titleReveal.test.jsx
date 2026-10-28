import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { aurelianConfig } from "../../../../apps/aurelian/src/merchant/config.js";
import { discoveryDecantsConfig } from "../../../../src/merchants/discoveryDecants/config.js";
import { createBuilderConfig } from "../builder/config/index.js";
import PerfumeCard from "../components/PerfumeCard.jsx";
import { REVEALING_CLASS, TITLE_REVEAL_TUNING, createTitleReveal, titleRevealHandlers } from "./titleReveal.js";

// ---- a deterministic clock, frame loop and element: the whole sequence runs without a browser ----------------
function createHarness({ scrollWidth = 300, clientWidth = 180, text = "Bad Boy Cobalt Parfum Electrique", reducedMotion = false, fineHover = true } = {}) {
  let time = 0;
  let nextId = 1;
  const timers = new Map();
  const frames = new Map();
  const writes = [];
  const classes = new Set();
  let scrollLeft = 0;
  const element = {
    scrollWidth,
    clientWidth,
    textContent: text,
    title: "",
    isConnected: true,
    classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name), contains: (name) => classes.has(name) },
    get scrollLeft() {
      return scrollLeft;
    },
    set scrollLeft(value) {
      scrollLeft = value;
      writes.push(value);
    },
  };
  const env = {
    now: () => time,
    setTimeout: (callback, ms) => {
      const id = nextId++;
      timers.set(id, { at: time + ms, callback });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    requestAnimationFrame: (callback) => {
      const id = nextId++;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
    matchMedia: (query) => ({ matches: query.includes("prefers-reduced-motion") ? reducedMotion : fineHover }),
  };
  // advance the virtual clock in 16 ms frames, firing due timers and one frame callback per tick
  function advance(ms) {
    const end = time + ms;
    while (time < end) {
      time = Math.min(end, time + 16);
      for (const [id, timer] of [...timers]) {
        if (timer.at <= time) {
          timers.delete(id);
          timer.callback();
        }
      }
      for (const [id, callback] of [...frames]) {
        frames.delete(id);
        callback();
      }
    }
  }
  return { element, env, advance, writes, classes, pending: () => timers.size + frames.size, offset: () => scrollLeft, now: () => time };
}

function reveal(harnessOptions) {
  const harness = createHarness(harnessOptions);
  const controller = createTitleReveal({ element: harness.element, env: harness.env });
  return { ...harness, controller };
}

const { startDelayMs, holdMs, outboundPxPerSecond } = TITLE_REVEAL_TUNING;

describe("title reveal sequence", () => {
  it("does nothing for a title that fits: no timers, no scrolling, no state", () => {
    const { controller, advance, writes, pending, classes } = reveal({ scrollWidth: 180, clientWidth: 180, text: "Le Male" });

    controller.enter("pointer");
    advance(10_000);

    expect(controller.phase).toBe("idle");
    expect(writes).toEqual([]);
    expect(pending()).toBe(0);
    expect(classes.size).toBe(0);
  });

  it("starts the reveal after a short beat on hover, and the ellipsis steps aside while it moves", () => {
    const { controller, advance, offset, classes } = reveal();

    controller.enter("pointer");
    expect(controller.phase).toBe("waiting");
    advance(startDelayMs - 20);
    expect(offset()).toBe(0);
    advance(300);
    expect(controller.phase).toBe("out");
    expect(offset()).toBeGreaterThan(0);
    expect(classes.has(REVEALING_CLASS)).toBe(true);
  });

  it("slides by the MEASURED overflow (content width - visible width), landing exactly on the last character", () => {
    const first = reveal({ scrollWidth: 300, clientWidth: 180 });
    first.controller.enter("pointer");
    first.advance(startDelayMs + 9000);
    expect(Math.max(...first.writes)).toBe(120);

    // a different measurement gives a different travel -- nothing is derived from the text
    const second = reveal({ scrollWidth: 521, clientWidth: 180, text: "x" });
    second.controller.enter("pointer");
    second.advance(startDelayMs + 15_000);
    expect(Math.max(...second.writes)).toBe(341);
  });

  it("scales its duration with the distance, around a calm 35-50 px/s", () => {
    expect(outboundPxPerSecond).toBeGreaterThanOrEqual(35);
    expect(outboundPxPerSecond).toBeLessThanOrEqual(50);

    const timeToReach = (overflow) => {
      const { controller, advance, offset, now } = reveal({ scrollWidth: 180 + overflow, clientWidth: 180 });
      controller.enter("pointer");
      let guard = 0;
      while (offset() < overflow && guard++ < 2000) advance(16);
      return now() - startDelayMs;
    };
    const short = timeToReach(60);
    const long = timeToReach(200);

    expect(long).toBeGreaterThan(short);
    expect(long / 1000).toBeGreaterThan(200 / 60); // 200px at <=60px/s average
    expect(long / 1000).toBeLessThan(200 / 30); // and not slower than ~30px/s
  });

  it("rests on the full name for about two seconds before heading back", () => {
    const { controller, advance, offset } = reveal({ scrollWidth: 300, clientWidth: 180 });

    controller.enter("pointer");
    advance(startDelayMs + 120 / outboundPxPerSecond * 1000 + 100); // just arrived
    expect(controller.phase).toBe("hold");
    expect(offset()).toBe(120);
    advance(holdMs - 150);
    expect(controller.phase).toBe("hold");
    expect(offset()).toBe(120);
    advance(400);
    expect(controller.phase).toBe("back");
    expect(offset()).toBeLessThan(120);
  });

  it("returns smoothly to the start and stays there; it never loops while the pointer remains", () => {
    const { controller, advance, offset, writes, pending, classes } = reveal({ scrollWidth: 300, clientWidth: 180 });

    controller.enter("pointer"); // and the pointer never leaves
    advance(30_000);

    expect(controller.phase).toBe("idle");
    expect(offset()).toBe(0);
    expect(classes.has(REVEALING_CLASS)).toBe(false);
    expect(pending()).toBe(0);
    // exactly one out-and-back: the scroll position rises to the peak once, then falls once
    const peakIndex = writes.indexOf(Math.max(...writes));
    expect(writes.slice(0, peakIndex + 1).every((value, index, list) => index === 0 || value >= list[index - 1])).toBe(true);
    const afterPeak = writes.slice(peakIndex);
    expect(afterPeak.every((value, index, list) => index === 0 || value <= list[index - 1])).toBe(true);
    // a second sequence needs the pointer to leave and come back
    controller.leave("pointer");
    controller.enter("pointer");
    expect(controller.phase).toBe("waiting");
  });

  it("cancels cleanly when the pointer leaves before it moves", () => {
    const { controller, advance, offset, pending, writes } = reveal();

    controller.enter("pointer");
    advance(120);
    controller.leave("pointer");

    expect(controller.phase).toBe("idle");
    expect(pending()).toBe(0);
    expect(offset()).toBe(0);
    advance(5000);
    expect(writes.every((value) => value === 0)).toBe(true);
  });

  it("glides home, with no jump, when the pointer leaves mid-way or while holding", () => {
    const { controller, advance, offset, writes, pending } = reveal({ scrollWidth: 400, clientWidth: 180 });

    controller.enter("pointer");
    advance(startDelayMs + 2500); // part-way out
    const leftAt = offset();
    expect(leftAt).toBeGreaterThan(20);
    expect(leftAt).toBeLessThan(220);
    controller.leave("pointer");
    const writesBefore = writes.length;
    advance(5000);

    const returning = writes.slice(writesBefore);
    expect(returning[0]).toBeLessThanOrEqual(leftAt); // continues from where it was, no jump
    expect(returning.every((value, index, list) => index === 0 || value <= list[index - 1])).toBe(true);
    expect(offset()).toBe(0);
    expect(controller.phase).toBe("idle");
    expect(pending()).toBe(0);
  });

  it("survives rapid hover in/out without stacking timers or leaking state", () => {
    const { controller, advance, offset, pending, classes } = reveal({ scrollWidth: 420, clientWidth: 180 });

    for (let index = 0; index < 40; index += 1) {
      controller.enter("pointer");
      advance(60 + (index % 5) * 110);
      controller.leave("pointer");
      advance(40);
      expect(pending()).toBeLessThanOrEqual(2); // never more than the one timer + one frame it owns
    }
    advance(6000);

    expect(controller.phase).toBe("idle");
    expect(offset()).toBe(0);
    expect(pending()).toBe(0);
    expect(classes.size).toBe(0);
  });

  it("re-entering while it is still gliding home resumes from where it is", () => {
    const { controller, advance, offset, writes } = reveal({ scrollWidth: 400, clientWidth: 180 });

    controller.enter("pointer");
    advance(startDelayMs + 3000);
    controller.leave("pointer");
    advance(150);
    const resumedFrom = offset();
    expect(resumedFrom).toBeGreaterThan(0);
    controller.enter("pointer");
    const writesBefore = writes.length;
    advance(startDelayMs + 400);

    expect(writes.slice(writesBefore).every((value) => Math.abs(value - resumedFrom) < 80)).toBe(true); // no snap to 0 or to the end
    controller.leave("pointer");
    advance(6000);
    expect(offset()).toBe(0);
  });

  it("gives keyboard focus the same reveal, even on a device without fine hover", () => {
    const { controller, advance, offset, writes } = reveal({ scrollWidth: 300, clientWidth: 180, fineHover: false });

    controller.enter("focus");
    advance(startDelayMs + 9000);
    expect(Math.max(...writes)).toBe(120); // reached the last character, exactly like a hover would
    expect(controller.phase).toBe("idle"); // and came home

    const pointerOnly = reveal({ scrollWidth: 300, clientWidth: 180, fineHover: false });
    pointerOnly.controller.enter("pointer");
    pointerOnly.advance(startDelayMs + 9000);
    expect(pointerOnly.offset()).toBe(0); // a coarse/no-hover device never gets a hover reveal
    expect(offset()).toBe(0); // ...and the keyboard run above has already returned home
  });

  it("holds the reveal while either hover or focus remains, and starts only one cycle", () => {
    const { controller, advance, pending } = reveal({ scrollWidth: 300, clientWidth: 180 });

    controller.enter("pointer");
    controller.enter("focus"); // second source: no second cycle
    advance(startDelayMs + 400);
    controller.leave("pointer");
    expect(controller.phase).toBe("out"); // focus still holds the card
    controller.leave("focus");
    advance(8000);
    expect(controller.phase).toBe("idle");
    expect(pending()).toBe(0);
  });

  it("does not animate under prefers-reduced-motion, and exposes the complete name natively instead", () => {
    const { controller, advance, writes, pending, element } = reveal({ reducedMotion: true, text: "Bad Boy Cobalt Parfum Electrique" });

    controller.enter("pointer");
    controller.enter("focus");
    advance(20_000);

    expect(writes).toEqual([]);
    expect(pending()).toBe(0);
    expect(controller.phase).toBe("idle");
    expect(element.title).toBe("Bad Boy Cobalt Parfum Electrique");
  });

  it("stops quietly when the card is removed mid-sequence", () => {
    const { controller, advance, element, pending } = reveal({ scrollWidth: 400, clientWidth: 180 });

    controller.enter("pointer");
    advance(startDelayMs + 1500);
    element.isConnected = false;
    advance(2000);

    expect(pending()).toBeLessThanOrEqual(1);
    advance(12_000);
    expect(pending()).toBe(0);
  });
});

describe("title reveal event glue", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function fakeCard(title) {
    return { querySelector: (selector) => (selector === ".perfume-card-name" ? title : null), contains: () => false };
  }

  it("ignores touch pointers entirely and reacts to mouse and pen", () => {
    const title = { scrollWidth: 400, clientWidth: 180, scrollLeft: 0, textContent: "x", title: "", isConnected: true, classList: { add() {}, remove() {} } };
    const matchMedia = vi.fn((query) => ({ matches: !query.includes("reduced") }));
    vi.stubGlobal("window", { matchMedia, setTimeout: (callback, ms) => setTimeout(callback, ms), clearTimeout, requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
    const card = fakeCard(title);

    titleRevealHandlers.onPointerEnter({ currentTarget: card, pointerType: "touch" });
    expect(matchMedia).not.toHaveBeenCalled();
    titleRevealHandlers.onPointerEnter({ currentTarget: card, pointerType: "mouse" });
    expect(matchMedia).toHaveBeenCalled();
    titleRevealHandlers.onPointerLeave({ currentTarget: card, pointerType: "mouse" });
  });

  it("only treats keyboard-visible focus as a reveal request, not a mouse click on a button inside the card", () => {
    const title = { scrollWidth: 400, clientWidth: 180, scrollLeft: 0, textContent: "x", title: "", isConnected: true, classList: { add() {}, remove() {} } };
    const matchMedia = vi.fn(() => ({ matches: false }));
    vi.stubGlobal("window", { matchMedia, setTimeout, clearTimeout, requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
    const card = fakeCard(title);

    titleRevealHandlers.onFocus({ currentTarget: card, target: { matches: () => false } });
    expect(matchMedia).not.toHaveBeenCalled();
    titleRevealHandlers.onFocus({ currentTarget: card, target: { matches: (selector) => selector === ":focus-visible" } });
    expect(matchMedia).toHaveBeenCalled();
  });
});

describe("single-line titles on the card", () => {
  const tierData = { color: "#cbd5e1", background: "rgba(203,213,225,0.12)", emoji: "⚪", name: "Silver" };
  const perfume = { id: 108, name: "Bad Boy Cobalt Parfum Electrique", brand: "Carolina Herrera", points: 1.5, image: "/x.png", imageFallback: "/y.svg" };
  const render = (extra = {}) =>
    renderToStaticMarkup(
      <PerfumeCard perfume={perfume} tierData={tierData} assetResolver={(key) => `/images/${key}`} onAddToBox={() => {}} onOpenDetails={() => {}} isDisabled={false} {...extra} />
    );

  it("keeps the complete name in the DOM for assistive technology, never a truncated copy", () => {
    const markup = render({ titleReveal: true });

    expect(markup).toContain('<h3 class="perfume-card-name">Bad Boy Cobalt Parfum Electrique</h3>');
    expect(markup).not.toMatch(/aria-hidden="true"[^>]*>Bad Boy/);
    expect(markup).not.toContain("…");
    expect(markup).toContain("perfume-card perfume-card--single-line-title");
  });

  it("leaves the card byte-for-byte unchanged for hosts that do not opt in (Discovery Decants)", () => {
    const markup = render();

    expect(markup).toContain('<article class="perfume-card">');
    expect(markup).toContain("<h3>Bad Boy Cobalt Parfum Electrique</h3>");
    expect(markup).not.toContain("single-line-title");
    expect(markup).not.toContain("perfume-card-name");
    expect(render({ titleReveal: false })).toBe(markup);
  });

  it("is opt-in per host: Aurelian turns it on, Discovery Decants and the package default do not", () => {
    expect(aurelianConfig.features.singleLineCardTitles).toBe(true);
    expect(discoveryDecantsConfig.features.singleLineCardTitles).toBe(false);
    expect(createBuilderConfig({ brand: { businessName: "Test" }, finalization: { whatsappNumber: "5210000000000" } }).features.singleLineCardTitles).toBe(false);
  });
});

describe("Aurelian single-line title styling (host-owned CSS)", () => {
  const css = readFileSync(new URL("../../../../apps/aurelian/src/app/builder-card-titles.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [...code.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({ selector: selector.replace(/\s+/g, " ").trim(), body: body.replace(/\s+/g, " ").trim() }));
  const titleRule = rules.find(({ selector }) => selector === ".builder-page .perfume-card--single-line-title .perfume-card-name");

  it("is loaded by Aurelian's layout after the catalog grid sheet", () => {
    const layout = readFileSync(new URL("../../../../apps/aurelian/src/app/layout.jsx", import.meta.url), "utf8");

    expect(layout).toContain('import "./builder-card-titles.css";');
    expect(layout.indexOf('import "./builder-card-titles.css";')).toBeGreaterThan(layout.indexOf('import "./builder-catalog-grid.css";'));
  });

  it("constrains a long name to exactly one clipped, ellipsized line in a title box of one fixed line height", () => {
    expect(titleRule.body).toContain("white-space: nowrap");
    expect(titleRule.body).toContain("overflow: hidden");
    expect(titleRule.body).toContain("text-overflow: ellipsis");
    expect(titleRule.body).toContain("line-height: 1.25");
    expect(titleRule.body).toContain("height: 1.25em");
    // one line only: nothing reserves two lines or centres the name vertically in a taller box
    expect(code).not.toMatch(/min-height|-webkit-line-clamp|line-clamp|display:\s*(?:flex|grid)/);
  });

  it("switches the ellipsis off only while the name is moving, and never changes the font size", () => {
    expect(rules.find(({ selector }) => selector.endsWith(".perfume-card-name--revealing")).body).toBe("text-overflow: clip;");
    expect(code).not.toMatch(/font-size|font-weight|letter-spacing|font-family/);
  });

  it("lets the wrappers shrink so a long nowrap name is cut instead of widening its grid column", () => {
    const shrink = rules.find(({ selector }) => selector.includes(".perfume-info-copy"));

    expect(shrink.body).toContain("min-width: 0");
    expect(shrink.body).toContain("max-width: 100%");
  });

  it("is scoped to the Builder route and to the opt-in class, with no !important and no animation of its own", () => {
    rules.forEach(({ selector }) => selector.split(",").forEach((part) => expect(part.trim()).toMatch(/^\.builder-page \.perfume-card--single-line-title /)));
    expect(code).not.toContain("!important");
    expect(code).not.toMatch(/@keyframes|animation|transition/);
  });
});
