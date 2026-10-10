// Whether the Curator Bonus has just been unlocked by the visitor, as opposed to simply being unlocked.
//
// `previous` is what the panel last saw: null before it has seen anything (its first look), then the
// last unlocked / locked value. Only a real locked -> unlocked change counts. The first look is not a
// change: a box restored from storage that is already unlocked is unlocked, not newly unlocked, and must
// not celebrate or scroll. (Treating "nothing seen yet" as "locked" is what made a restored unlocked box
// celebrate on every visit, scroll the page to the Curator Bonus, and -- under React StrictMode's second
// effect run on mount -- leave the unlock pill stuck.)
export function isCuratorBonusUnlockTransition({ previous, current }) {
  return previous === false && current === true;
}
