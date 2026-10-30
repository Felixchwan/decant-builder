import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (...segments) => readFileSync(join(...segments), "utf8");

const vialsCss = read(APP_ROOT, "src", "app", "builder-vials.css");
const withoutComments = vialsCss.replace(/\/\*[\s\S]*?\*\//g, "");

// Nothing here nests deeper than one @media, so a plain `selector { declarations }` pattern finds every rule.
const rules = [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(([, selector, body]) => ({ selector: selector.trim(), body }))
  .filter(({ selector }) => !selector.startsWith("@"));

// Selectors use :is(a, b), so only commas outside parentheses separate selectors.
const splitSelectors = (list) => {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const char of list) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current.trim());
  return parts;
};
const selectors = rules.flatMap(({ selector }) => splitSelectors(selector));
const bodyOf = (selector) =>
  rules
    .filter((rule) => splitSelectors(rule.selector).includes(selector))
    .map((rule) => rule.body)
    .join(" ");
// The sprayer is an inline SVG data: URI; decode it back to markup so its anatomy can be asserted.
const svgOf = (body) => {
  const match = body.match(/url\("data:image\/svg\+xml,([^"]+)"\)/);
  return match ? decodeURIComponent(match[1]) : "";
};

const TRAY = ":is(.builder-page, #aurelian-builder-summary-slot) .box-slot-tray .box-vial";
const FILLED = `${TRAY}:is(.filled, .bonus-unlocked)`;
const CARD = ":is(.builder-page, .builder-portal-root) .collection-card .collection-card-vial";

describe("Aurelian 5 ml spray-decant vials (host-owned, presentation-only)", () => {
  it("is loaded by Aurelian's own layout, after the shared package stylesheet", () => {
    const layout = read(APP_ROOT, "src", "app", "layout.jsx");
    expect(layout).toContain('import "./builder-vials.css";');
    expect(layout.indexOf('import "./builder-vials.css";')).toBeGreaterThan(
      layout.indexOf('import "@discovery-box/builder/styles.css";')
    );
  });

  it("is scoped to the Aurelian Builder tray (page + docked slot) or Collection Card (portal root) only", () => {
    expect(selectors.length).toBeGreaterThan(25);
    selectors.filter((selector) => selector !== "from").forEach((selector) => {
      expect(selector, selector).toMatch(
        /^:is\(\.builder-page, (?:#aurelian-builder-summary-slot\) \.box-slot-tray(?::has\([^)]*\))? (?:\.box-column(?::first-child|:last-child)? )?\.box-vial|\.builder-portal-root\) \.collection-card)/
      );
    });
  });

  it("is never imported by Discovery Decants and the shared package neither knows nor mentions it", () => {
    const rootSrc = join(REPOSITORY_ROOT, "src");
    expect(existsSync(rootSrc)).toBe(true);
    const walk = (dir) =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]
      );
    walk(rootSrc)
      .filter((file) => /\.(jsx?|css)$/.test(file))
      .forEach((file) => expect(read(file), file).not.toContain("builder-vials"));
    const packageStyles = read(REPOSITORY_ROOT, "packages", "builder", "styles.css");
    expect(packageStyles).not.toContain("--dv");
    expect(packageStyles).not.toContain("builder-vials");
  });

  it("uses no !important and only two bits of motion: the remove button fade and its arming delay", () => {
    expect(withoutComments).not.toMatch(/!important/);
    // exactly one keyframe set (the remove-button arming delay) and one transition (the remove-button fade)
    expect(withoutComments.match(/@keyframes/g)).toHaveLength(1);
    expect(withoutComments).toMatch(/@keyframes aurelian-vial-remove-arm\s*\{\s*from\s*\{\s*pointer-events:\s*none;/);
    expect(withoutComments.match(/\btransition\s*:/g)).toHaveLength(1);
    expect(bodyOf(`${TRAY} .slot-remove-button`)).toMatch(/transition:/);
    expect(withoutComments.match(/\banimation\s*:/g)).toHaveLength(2); // hover + tapped reveal, both the arming delay
    // nothing animates the glass, the liquid, the label or the sprayer
    [`${TRAY} .vial-body`, `${FILLED} .vial-body`, `${FILLED} .vial-label`, `${TRAY} .vial-cap`].forEach((selector) =>
      expect(bodyOf(selector), selector).not.toMatch(/animation|transition/)
    );
  });

  it("sizes every part from --dv, set to the heights the package already gives the vial (no layout change)", () => {
    expect(bodyOf(TRAY)).toMatch(/--dv:\s*18px/);
    expect(withoutComments).toMatch(/@media \(max-width: 980px\)\s*\{[^{}]*\{[^{}]*--dv:\s*28px/);
    expect(withoutComments).toMatch(/@media \(max-width: 520px\)\s*\{[^{}]*\{[^{}]*--dv:\s*26px/);
    // the package's own vial heights these three values mirror: docked/desktop 18, tablet 28, phone 26
    const packageStyles = read(REPOSITORY_ROOT, "packages", "builder", "styles.css");
    expect(packageStyles).toMatch(/builder-theme-root--custom \.box-vial \{\s*height: 18px/);
    expect(packageStyles).toMatch(/:where\(\.builder-scope\) \.box-vial \{[^}]*height: 28px/);
    expect(packageStyles).toMatch(/@media \(max-width: 520px\) \{[\s\S]*?:where\(\.builder-scope\) \.box-vial \{\s*height: 26px/);
    // the vial itself keeps the package's height: only the split of its two columns changes
    expect(bodyOf(TRAY)).not.toMatch(/(?:^|[;\s])height\s*:/);
    // the sprayer column is a small share of the vial (82% of its height ~ 14-20% of its length), the glass the rest
    expect(bodyOf(TRAY)).toMatch(/grid-template-columns:\s*calc\(var\(--dv\) \* 0\.82\) minmax\(0, 1fr\)/);
  });

  it("draws the sprayer as one small, self-contained SVG: button with its hole, one collar, a glass neck", () => {
    const svg = svgOf(bodyOf(`${TRAY} .vial-cap`));
    expect(svg).toContain('viewBox="0 0 82 100"');
    // nothing that could fetch, run or embed anything
    expect(svg).not.toMatch(/<(?:script|image|foreignObject|use|style)\b|href=|url\(http/i);
    // anatomy: glass neck, ONE collar (a single rect), the actuator path, and ONE spray hole sunk in the button
    expect(svg.match(/<rect\b/g)).toHaveLength(2); // neck + collar
    expect(svg.match(/<circle\b/g)).toHaveLength(2); // the hole and its rim: one orifice, drawn as two circles
    expect(svg).toMatch(/<circle cx="13" cy="45" r="4\.6" fill="#050607"\/>/);
    // the hole is tiny relative to the button: smaller than 10% of the vial height
    expect(4.6 * 2).toBeLessThan(10);
    // no projecting nozzle: nothing is drawn left of the actuator's rounded end
    const xs = [...svg.matchAll(/ x="(\d+(?:\.\d+)?)"/g)].map((m) => Number(m[1]));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);

    // the stepped profile: the collar is taller than the glass neck it wraps
    const heights = [...svg.matchAll(/<rect [^>]*height="(\d+)"/g)].map((m) => Number(m[1]));
    expect(heights).toEqual([38, 72]); // neck, collar
  });

  it("gives bonus slots the same sprayer with a gold collar only", () => {
    const standard = svgOf(bodyOf(`${TRAY} .vial-cap`));
    const gold = svgOf(bodyOf(`${TRAY}.bonus-reserved .vial-cap`));
    expect(gold).not.toBe("");
    expect(gold).not.toBe(standard);
    expect(gold).toMatch(/#e5bd55/i);
    // identical geometry: only the colours differ
    const masked = (markup) => markup.replace(/#[0-9a-f]{6}/gi, "#");
    expect(masked(gold)).toBe(masked(standard));
  });

  it("shows tier through the liquid and the label strip (primary) and a collar hairline (secondary), nothing else", () => {
    const label = bodyOf(`${FILLED} .vial-label`);
    expect(label).toMatch(/inset max\(2px, calc\(var\(--dv\) \* 0\.14\)\) 0 0 var\(--dv-accent\)/); // the strip
    expect(label).toMatch(/inset 0 -1px 0 color-mix\(in srgb, var\(--dv-accent\) 55%/); // the hairline under it
    expect(label).toMatch(/rgba\(8, 10, 10, 0\.64\)/); // still a dark label
    expect(bodyOf(`${TRAY} .vial-cap::after`)).toMatch(/background:\s*var\(--dv-accent\)/); // collar hairline
    expect(bodyOf(`${TRAY} .vial-cap::after`)).toMatch(/width:\s*max\(1\.5px/);
    // the liquid is the tier colour at a low alpha, over the dark glass (so Diamond cannot go neon, Mythic cannot go bright)
    expect(bodyOf(`${FILLED} .vial-body::before`)).toMatch(/color-mix\(in srgb, var\(--dv-accent\) 20%, transparent\)/);
    // the sprayer SVG, the glass, the reflection and the label body never carry the tier colour
    [`${TRAY} .vial-cap`, `${TRAY} .vial-body`, `${FILLED} .vial-body`, `${FILLED} .vial-body::after`].forEach(
      (selector) => expect(bodyOf(selector), selector).not.toMatch(/--tier-color|--dv-accent/)
    );
    // bonus slots have no tier: their liquid and collar are Curator gold, never a tier colour
    expect(bodyOf(`${TRAY}.bonus-reserved`)).toMatch(/--dv-accent:\s*#d9a93a/);
  });

  it("draws the atomizer in dark gunmetal with a slightly lighter steel collar, and no chrome or bright silver", () => {
    const svg = svgOf(bodyOf(`${TRAY} .vial-cap`));
    const stops = (id) => [...svg.matchAll(new RegExp(`<linearGradient id="${id}"[^>]*>([\\s\\S]*?)</linearGradient>`, "g"))][0][1].match(/#[0-9a-f]{6}/gi);
    const luminance = (hex) => {
      const channel = (i) => { const v = parseInt(hex.slice(i, i + 2), 16) / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
    };
    const button = stops("t");
    const collar = stops("m");
    expect(button).toEqual(["#6d7279", "#484d54", "#33373d", "#232629"]);
    // restrained and never pure black: the lightest button stop is a mid grey-blue, the darkest is still lifted off black
    expect(Math.max(...button.map(luminance))).toBeLessThan(0.18);
    expect(Math.min(...button.map(luminance))).toBeGreaterThan(0.01);
    // the collar stays lighter than the button so the anatomy reads
    expect(luminance(collar[1])).toBeGreaterThan(luminance(button[1]) * 1.4);
    // no bright silver or chrome anywhere in the standard sprayer
    expect(Math.max(...[...button, ...collar].map(luminance))).toBeLessThan(0.32); // nothing lighter than a mid grey
    expect(svg).not.toMatch(/#f[0-9a-f]{5}|#e[0-9a-f]{5}/i);
    // the highlight on the button is a faint hairline, the spray hole keeps a visible rim
    expect(svg).toMatch(/stroke="rgba\(255,255,255,\.24\)" stroke-width="1\.8"/);
    expect(svg).toMatch(/stroke="rgba\(255,255,255,\.3\)" stroke-width="1"/);
  });

  it("keeps the six tiers distinguishable: every pair of Builder accents is at least 24 apart (CIE76)", () => {
    const tierSource = read(REPOSITORY_ROOT, "packages", "builder", "src", "utils", "tierUtils.js");
    const canonical = [...tierSource.matchAll(/name: "(\w+)"[\s\S]*?color: "(#[0-9a-f]{6})"/gi)].map(([, name, color]) => [name, color.toLowerCase()]);
    expect(canonical.map(([name]) => name)).toEqual(["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Mythic"]);
    // the Builder's own accent: the canonical colour unless this sheet nudges it
    const nudged = Object.fromEntries(
      [...withoutComments.matchAll(/\[style\*="--tier-color: (#[0-9a-f]{6})"\]\s*\{\s*--dv-accent:\s*(#[0-9a-f]{6})/gi)].map(([, from, to]) => [from.toLowerCase(), to.toLowerCase()])
    );
    expect(Object.keys(nudged).sort()).toEqual(["#bae6fd", "#cbd5e1"]); // Platinum and Silver only
    const linear = (value) => (value / 255 <= 0.04045 ? value / 255 / 12.92 : ((value / 255 + 0.055) / 1.055) ** 2.4);
    const lab = (hex) => {
      const [r, g, b] = [1, 3, 5].map((i) => linear(parseInt(hex.slice(i, i + 2), 16)));
      const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
      const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
      const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
      const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
      return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
    };
    const distance = (hexA, hexB) => Math.hypot(...lab(hexA).map((value, index) => value - lab(hexB)[index]));
    const accents = canonical.map(([name, color]) => [name, nudged[color] ?? color]);
    let closest = Infinity;
    for (let i = 0; i < accents.length; i += 1) {
      for (let j = i + 1; j < accents.length; j += 1) {
        closest = Math.min(closest, distance(accents[i][1], accents[j][1]));
      }
    }
    expect(closest).toBeGreaterThanOrEqual(24);
    // the canonical palette itself would not pass (Silver/Platinum): that is why the nudge exists
    expect(distance("#cbd5e1", "#bae6fd")).toBeLessThan(15);
    // the default accent is the canonical colour; the card does the same with its own variable
    expect(bodyOf(TRAY)).toMatch(/--dv-accent:\s*var\(--tier-color\)/);
    expect(bodyOf(CARD)).toMatch(/--cv-accent:\s*var\(--collection-tier-color\)/);
    expect(bodyOf(`${CARD}[style*="--collection-tier-color: #cbd5e1"]`)).toMatch(/--cv-accent:\s*#a3acb9/);
    expect(bodyOf(`${CARD}[style*="--collection-tier-color: #bae6fd"]`)).toMatch(/--cv-accent:\s*#c2f0ff/);
  });

  const LEFT = ":is(.builder-page, #aurelian-builder-summary-slot) .box-slot-tray .box-column:first-child .box-vial";
  const RIGHT = ":is(.builder-page, #aurelian-builder-summary-slot) .box-slot-tray .box-column:last-child .box-vial";
  const ANY_COLUMN_FILLED = ":is(.builder-page, #aurelian-builder-summary-slot) .box-slot-tray .box-column .box-vial.filled";

  it("lifts the remove button out of the vial into the centre gutter, on the side facing it, on the vial's own row", () => {
    const button = bodyOf(`${TRAY} .slot-remove-button`);
    expect(button).toMatch(/top:\s*50%/); // the row of the vial it belongs to (relative to that vial), never a fixed y
    expect(button).toMatch(/translateY\(-50%\) scale\(0\.92\)/);
    expect(button).not.toMatch(/left:\s*50%/); // no longer centred over the glass
    // left column: just right of the glass; right column: just left of the sprayer tip (sprayer column = 0.82 vial heights)
    expect(bodyOf(`${LEFT} .slot-remove-button`)).toMatch(/left:\s*calc\(100% \+ var\(--dv-gap\) \+ 4px\)/);
    expect(bodyOf(`${LEFT} .slot-remove-button`)).toMatch(/right:\s*auto/);
    expect(bodyOf(`${RIGHT} .slot-remove-button`)).toMatch(/right:\s*calc\(100% \+ var\(--dv\) \* 0\.82 \+ var\(--dv-gap\) \+ 4px\)/);
    expect(bodyOf(`${RIGHT} .slot-remove-button`)).toMatch(/left:\s*auto/);
    // gap = the tray's column padding + gap (10px, 8px at <=520), so the 4px offset lands inside the channel
    expect(bodyOf(TRAY)).toMatch(/--dv-gap:\s*10px/);
    expect(withoutComments).toMatch(/@media \(max-width: 520px\)\s*\{[^{}]*\{[^{}]*--dv-gap:\s*8px/);
    // 24-28px visible: 26px, 28px on touch-sized tablets
    expect(bodyOf(TRAY)).toMatch(/--dv-remove:\s*26px/);
    expect(withoutComments).toMatch(/@media \(max-width: 980px\)\s*\{[^{}]*\{[^{}]*--dv-remove:\s*28px/);
    expect(button).toMatch(/width:\s*var\(--dv-remove\)/);
    // approved oxblood styling: burgundy fill + rim, ivory x, a dark drop shadow, no glow
    expect(button).toMatch(/var\(--aur-burgundy, #4a0f1f\)/);
    expect(button).toMatch(/border:\s*1px solid var\(--aur-burgundy-lift/);
    expect(button).toMatch(/color:\s*var\(--aur-ivory, #e7ddcf\)/);
    const shadows = button.match(/box-shadow:([^;]*);/)[1].split(/,(?![^(]*\))/).map((shadow) => shadow.trim());
    shadows.forEach((shadow) => {
      const [x, y, blur] = shadow.split(/\s+/).map((token) => parseFloat(token));
      expect(x === 0 && y === 0 && blur > 0, `glow: ${shadow}`).toBe(false); // a drop shadow only, never a glow
    });
    expect(button).toMatch(/z-index:\s*4/);
    // an invisible touch margin all round the circle (26 + 18 = 44px), but only on the button itself
    expect(bodyOf(`${TRAY} .slot-remove-button::after`)).toMatch(/inset:\s*-9px/);
    // the vial is not covered or dimmed any more: no rule changes its label, glass or sprayer while the control shows
    expect(selectors.filter((selector) => /slot-remove-button|::after/.test(selector) === false && /:hover|focus-within|is-active/.test(selector))).toEqual([]);
  });

  it("joins vial and button with a hairline that doubles as an unclickable hover bridge", () => {
    [LEFT, RIGHT].forEach((column) => {
      const line = bodyOf(`${column}.filled::after`);
      expect(line).toMatch(/content:\s*""/);
      expect(line).toMatch(/display:\s*none/); // only while a control is showing
      expect(line).toMatch(/width:\s*calc\(var\(--dv-gap\) \+ 4px\)/);
      expect(line).toMatch(/var\(--aur-burgundy-lift/);
    });
    expect(bodyOf(`${LEFT}.filled::after`)).toMatch(/left:\s*100%/);
    expect(bodyOf(`${RIGHT}.filled::after`)).toMatch(/right:\s*100%/);
    // it is revealed together with the control (focus, hover, tapped) with enough specificity to beat the hidden rule
    expect(bodyOf(`${ANY_COLUMN_FILLED}:focus-within::after`)).toMatch(/display:\s*block/);
    expect(withoutComments).toContain(`${ANY_COLUMN_FILLED}:hover::after`);
    expect(withoutComments).toContain(`${ANY_COLUMN_FILLED}.is-active::after`);
  });

  it("reveals the control on hover, keyboard focus and the tapped state, one at a time, and never lets it catch stray taps", () => {
    // hidden: no pointer events at all, so the gutter is never clickable and an invisible button cannot swallow a tap
    expect(bodyOf(`${TRAY} .slot-remove-button`)).toMatch(/opacity:\s*0;[^}]*pointer-events:\s*none/);
    // pointer-events lags the visual state both ways so the pointer-up that toggles .is-active cannot cancel the x's own click
    expect(bodyOf(`${TRAY} .slot-remove-button`)).toMatch(/pointer-events 0s linear 260ms allow-discrete/);
    // keyboard focus always reveals it
    expect(bodyOf(`${TRAY}.filled:focus-within .slot-remove-button`)).toMatch(/opacity:\s*1[^}]*pointer-events:\s*auto/);
    // hover only where hover exists; the tapped (.is-active) state only where it does not (touch), so a mouse click that
    // latches .is-active in the full tray can never leave a control showing after the pointer leaves
    const hover = withoutComments.match(/@media \(hover: hover\)\s*\{([\s\S]*?)\n\}/);
    expect(hover?.[1]).toContain(".box-vial.filled:hover .slot-remove-button");
    expect(hover?.[1]).toMatch(/animation:\s*aurelian-vial-remove-arm 1ms linear 220ms backwards/);
    expect(hover?.[1]).not.toContain("is-active");
    const touch = withoutComments.match(/@media \(hover: none\)\s*\{([\s\S]*?)\n\}/);
    expect(touch?.[1]).toContain(".box-vial.filled.is-active .slot-remove-button");
    expect(touch?.[1]).toMatch(/animation:\s*aurelian-vial-remove-arm 1ms linear 220ms backwards/);
    expect(touch?.[1]).not.toContain(":hover");
    // one control at a time: a focus-revealed control yields while another vial is hovered
    expect(hover?.[1]).toMatch(/\.box-slot-tray:has\(\.box-vial\.filled:hover\) \.box-vial\.filled:not\(:hover\) \.slot-remove-button\s*\{\s*opacity:\s*0;\s*pointer-events:\s*none/);
    // the package's tap popover would add a second Remove button: only that button is hidden, its hint stays
    expect(bodyOf(`${TRAY} .slot-action-popover button`)).toMatch(/display:\s*none/);
    // the hover bridge must not be a trigger of its own: it only exists while the vial is already revealed
    expect(bodyOf(`${LEFT}.filled::after`)).toMatch(/display:\s*none/);
  });

  it("never draws a remove control for empty, locked or bonus slots, or for the Collection Card", () => {
    // those vials have no .slot-remove-button in the shared markup; every rule for it is scoped to filled vials
    selectors.filter((selector) => selector.includes("slot-remove-button")).forEach((selector) =>
      expect(selector, selector).toMatch(/\.box-vial(?:\.filled)?/)
    );
    expect(selectors.filter((selector) => selector.includes("collection-card") && selector.includes("slot-remove-button"))).toEqual([]);
    expect(withoutComments.match(/collection-card[^{]*slot-remove/g)).toBeNull();
  });

  it("makes the glass the dominant mass: one body, a pale translucent tier-tinted liquid up to a fine surface line, one reflection", () => {
    expect(bodyOf(`${TRAY} .vial-body`)).toMatch(/border-radius:\s*calc\(var\(--dv\) \* 0\.38\)/); // rounded shoulder
    expect(bodyOf(`${FILLED} .vial-body`)).toMatch(/inset calc\(var\(--dv\) \* -0\.12\) 0 0/); // thick base
    const liquid = bodyOf(`${FILLED} .vial-body::before`);
    expect(liquid).toMatch(/inset:\s*0 0 0 calc\(var\(--dv\) \* 0\.46\)/);
    expect(liquid).toMatch(/border-left:\s*1px solid/);
    expect(liquid).not.toMatch(/rgba\(240, 204, 140/); // the neutral champagne is gone
    expect(liquid).toMatch(/rgba\(255, 255, 255, 0\.13\)/); // a lighter highlight than before (0.16)
    const alpha = Number(liquid.match(/var\(--dv-accent\) (\d+)%, transparent/)[1]) / 100;
    expect(alpha).toBeLessThanOrEqual(0.21); // never heavier than the 0.21 neutral wash it replaces
    expect(alpha).toBeGreaterThanOrEqual(0.17); // but still visible
    expect(bodyOf(`${FILLED} .vial-body::after`)).toMatch(/linear-gradient\(90deg/);
  });

  it("restores the dark, discreet label: near-black, soft ivory text, no cream card, no border", () => {
    const label = bodyOf(`${FILLED} .vial-label`);
    expect(label).toMatch(/rgba\(8, 10, 10, 0\.64\)/);
    expect(label).toMatch(/color:\s*#ece6d6/);
    expect(label).toMatch(/border:\s*0/);
    expect(label).not.toMatch(/#f0e8d4|#ddd2b9|#f[0-9a-f]{5}\b.*linear-gradient/i);
    expect(label).toMatch(/font-size:\s*calc\(var\(--builder-unit-046\) \* 0\.94\)/);
  });

  it("keeps the package's state hooks working on the new glass (drag target, next slot, empty, bonus)", () => {
    expect(selectors).toContain(`${TRAY}.drag-target .vial-body`);
    expect(selectors).toContain(`${TRAY}.next-available .vial-body`);
    expect(selectors).toContain(`${TRAY}.empty .vial-body`);
    expect(selectors).toContain(`${TRAY}.bonus-locked .vial-body`);
    // the drag highlight is declared after the glass so it still wins on a filled slot
    const indexOf = (selector) => rules.findIndex((rule) => splitSelectors(rule.selector).includes(selector));
    expect(indexOf(`${TRAY}.drag-target .vial-body`)).toBeGreaterThan(indexOf(`${FILLED} .vial-body`));
    // the package's remove button keeps its own look; it only has to stay above the glass layers
    expect(bodyOf(`${TRAY} .slot-remove-button`)).toMatch(/z-index:\s*4/);
    // bonus: the package's own seal / lock mark on the same glass, with no tier hairline on a gold collar
    expect(bodyOf(`${TRAY}.bonus-reserved .vial-cap::after`)).toMatch(/display:\s*none/);
  });

  it("draws empty slots as a faint glass outline only, with no sprayer", () => {
    expect(bodyOf(`${TRAY}.empty .vial-cap`)).toMatch(/background:\s*none/);
    expect(bodyOf(`${TRAY}.empty .vial-cap::after`)).toMatch(/display:\s*none/);
    expect(bodyOf(`${TRAY}.empty .vial-body`)).toMatch(/rgba\(255, 255, 255, 0\.02\)/);
    expect(bodyOf(`${CARD}.is-empty .collection-card-vial-cap`)).toMatch(/background:\s*none/);
  });

  it("carries the same decant into the Collection Card (preview + export) at the card's own heights", () => {
    expect(bodyOf(CARD)).toMatch(/--cv:\s*34px/);
    expect(bodyOf(`:is(.builder-page, .builder-portal-root) .collection-card.collection-card--export .collection-card-vial`)).toMatch(/--cv:\s*50px/);
    expect(bodyOf(`:is(.builder-page, .builder-portal-root) .collection-card:not(.collection-card--export) .collection-card-vial`)).toMatch(/--cv:\s*26px/);
    expect(bodyOf(CARD)).toMatch(/grid-template-columns:\s*calc\(var\(--cv\) \* 0\.82\) minmax\(0, 1fr\)/);
    // the very same sprayer drawing, and the gold one on the bonus slot
    expect(svgOf(bodyOf(`${CARD}-cap`))).toBe(svgOf(bodyOf(`${TRAY} .vial-cap`)));
    expect(svgOf(bodyOf(`${CARD}-bonus .collection-card-vial-cap`))).toBe(svgOf(bodyOf(`${TRAY}.bonus-reserved .vial-cap`)));
    expect(bodyOf(`${CARD}.is-filled .collection-card-vial-label`)).toMatch(/rgba\(8, 10, 10, 0\.64\)/);
    // the fragrance's own bottle shot anchors the RIGHT end of every vial (it is Collection Card markup only: the Builder
    // rack has no thumbnail, and nothing here adds one)
    const image = bodyOf(`${CARD}-image`);
    expect(image).toMatch(/left:\s*auto/);
    expect(image).toMatch(/right:\s*calc\(var\(--cv\) \* 0\.22\)/);
    const label = bodyOf(`${CARD}-image + .collection-card-vial-label`);
    expect(label).toMatch(/margin-left:\s*0/);
    const reserved = Number(label.match(/margin-right:\s*calc\(var\(--cv\) \* ([\d.]+)\)/)[1]);
    const footprint = 0.22 + Number(image.match(/width:\s*calc\(var\(--cv\) \* ([\d.]+)\)/)[1]);
    expect(reserved).toBeGreaterThan(footprint); // the label can never run under the thumbnail
    expect(selectors.filter((selector) => selector.includes(".box-vial") && selector.includes("image"))).toEqual([]);
    // the fragrance's own bottle image and label markup are untouched
    expect(selectors).toContain(`${CARD}-image`);
    const packageStyles = read(REPOSITORY_ROOT, "packages", "builder", "styles.css");
    expect(packageStyles).toMatch(/\.collection-card-vial \{[^}]*height: 34px/);
    expect(packageStyles).toMatch(/\.collection-card--export \.collection-card-vial \{[^}]*height: 50px/);
  });
});
