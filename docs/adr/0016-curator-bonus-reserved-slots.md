# ADR-0016: Curator Bonus Modeled as Reserved Physical Slots, Config-Driven

**Status:** Accepted (retroactive)
**Related:** An instance of ADR-0004's merchant-configuration mechanism, applied specifically to the bonus-slot mechanic.
**Evidence:** `defaultBuilderConfig.box`: `maxSelectableSlots: 14`, `totalPhysicalSlots: 16`, `bonusSlotCount: 2`, `minPoints: 12`; `packages/builder/src/builder/internal/curatorBonus/isCuratorBonusUnlocked.js` — `totalPoints >= targetPoints && totalSlots >= minSlots`; two named reward preferences (`complement`, `similar`) with distinct copy per preference.

## Context
The physical box has 16 slots, but the product deliberately doesn't let the customer choose all 16 themselves — 2 are reserved for a business-selected "bonus" reveal, unlocked once the customer crosses a spend/selection threshold.

## Decision
Model this explicitly in config as a gap between `maxSelectableSlots` (14, customer-controlled) and `totalPhysicalSlots` (16, physical capacity), with `bonusSlotCount` (2) and an independent unlock rule (`isCuratorBonusUnlocked`) requiring both a points threshold and a minimum item count. The customer additionally chooses a reward *preference* (`complement` vs. `similar`) that steers, but doesn't fully determine, which items fill the bonus slots.

## Alternatives Considered
- **Let the customer select all 16 slots themselves** — rejected; would remove the "curated surprise" mechanic and the spend-threshold incentive entirely.
- **A flat discount instead of bonus items** — not implemented; the config models a bonus *inventory allocation* (reserved slots), not a price adjustment, keeping the mechanic inventory-shaped rather than pricing-shaped.
- **Hardcode the unlock threshold** rather than making it config-driven — rejected; `targetPoints`/`minSlots` are read from config specifically so a future merchant could tune or disable the mechanic (`curatorBonus.enabled`) without a code change.

## Trade-offs
**Gains**
- The entire mechanic — slot counts, unlock thresholds, reward preferences, and all associated copy — is expressible per merchant purely through config, consistent with ADR-0004's config-driven merchant model.
- `validateBuilderConfig` enforces internal consistency (e.g., `maxSelectableSlots <= totalPhysicalSlots`), preventing an impossible configuration from ever reaching the UI.

**Costs**
- The mechanic adds real conceptual surface (two preference modes, an unlock rule, dedicated copy for locked/unlocked states) that every new merchant config must account for, even one that might not want this mechanic (mitigated by `curatorBonus.enabled: false` being a supported off-switch).

## Consequences
- Both live merchants currently use the same threshold values (`targetPoints: 12`, `bonusSlotCount: 2`) inherited from defaults rather than overridden — the mechanism for divergence exists and is validated, but hasn't yet been exercised for a real per-merchant difference.

## Revisit Criteria
Revisit if a merchant states a need for a different unlock threshold, slot count, or wants the mechanic disabled entirely — already supported via config today, so this is a configuration action, not a design question, when it happens.

*(Whether the mechanic is actually effective at driving larger baskets is a product/business-performance question, not an architectural one, and is deliberately out of scope for this ADR's revisit criteria.)*
