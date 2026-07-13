/** Step arithmetic shared by scene functions and the Stepper island. */

/**
 * Clamp an arbitrary step value into [0, totalSteps - 1]; NaN clamps to 0. Clamping
 * (rather than rejecting) is the documented policy: scrub inputs and URL params may
 * produce out-of-range values, and every one of them must still map to a complete,
 * renderable scene.
 */
export function clampStep(step: number, totalSteps: number): number {
  if (totalSteps <= 0) return 0;
  if (Number.isNaN(step)) return 0;
  return Math.min(Math.max(Math.trunc(step), 0), totalSteps - 1);
}
