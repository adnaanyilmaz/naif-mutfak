/** Splits minutes into hours/minutes for localized display (`Recipe.durationHM` etc.). */
export function splitDuration(totalMinutes: number): { h: number; m: number } {
  const total = Math.max(0, Math.round(totalMinutes));
  return { h: Math.floor(total / 60), m: total % 60 };
}
