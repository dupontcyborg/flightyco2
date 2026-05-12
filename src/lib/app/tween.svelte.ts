/**
 * Reactive number-tween rune. Smoothly animates `displayed` toward a
 * moving target, using a manual rAF loop (no svelte/motion dep).
 *
 * On first run, animates from 0 over `firstDuration` (used as the
 * dashboard-reveal moment). On subsequent target changes, uses the
 * shorter `duration` so navigation feels responsive.
 *
 *   const headline = createTween(() => headlineT, { firstDuration: 900 });
 *   ...
 *   {headline.value.toFixed(1)}
 */
export function createTween(
  target: () => number,
  opts: { duration?: number; firstDuration?: number; delay?: number } = {},
) {
  let displayed = $state(0);
  let firstRun = true;
  const { duration = 380, firstDuration = 900, delay = 0 } = opts;

  $effect(() => {
    const t = target();
    const start = displayed;
    const dur = firstRun ? firstDuration : duration;
    const startTime = performance.now() + (firstRun ? delay : 0);
    firstRun = false;

    let raf = 0;
    const step = (now: number) => {
      const elapsed = Math.max(0, now - startTime);
      const p = Math.min(1, elapsed / dur);
      const eased = 1 - Math.pow(1 - p, 3); // cubicOut
      displayed = start + (t - start) * eased;
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  });

  return {
    get value() {
      return displayed;
    },
  };
}
