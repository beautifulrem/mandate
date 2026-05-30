// The "kill the chain" wow-moment: a sharp red/orange fracture burst at the
// point where the delegation is severed. canvas-confetti is dynamically imported
// so it never runs during SSR and adds nothing to the initial bundle path.

const COLORS = ['#f87171', '#dc4d4d', '#f6851b', '#ffb15c', '#e6e9ef'];

/** Fire a fracture burst centred on `el` (defaults to mid-screen). */
export async function fireSever(el?: HTMLElement | null): Promise<void> {
  if (typeof window === 'undefined') return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  const confetti = (await import('canvas-confetti')).default;

  let x = 0.5;
  let y = 0.45;
  if (el) {
    const r = el.getBoundingClientRect();
    x = (r.left + r.width / 2) / window.innerWidth;
    y = (r.top + r.height / 2) / window.innerHeight;
  }

  // Tight central crack…
  confetti({ particleCount: 70, spread: 78, startVelocity: 46, origin: { x, y }, colors: COLORS, scalar: 0.95, ticks: 130, gravity: 0.9 });
  // …plus two angled shards splitting left and right for the "snap".
  confetti({ particleCount: 28, angle: 60, spread: 50, startVelocity: 55, origin: { x: Math.max(0, x - 0.12), y }, colors: COLORS, ticks: 110 });
  confetti({ particleCount: 28, angle: 120, spread: 50, startVelocity: 55, origin: { x: Math.min(1, x + 0.12), y }, colors: COLORS, ticks: 110 });
}
