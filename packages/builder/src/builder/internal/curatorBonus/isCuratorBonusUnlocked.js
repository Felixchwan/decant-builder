export function isCuratorBonusUnlocked({
  totalPoints,
  totalSlots,
  targetPoints,
  minSlots,
}) {
  return totalPoints >= targetPoints && totalSlots >= minSlots;
}
