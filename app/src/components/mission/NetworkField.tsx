'use client';

import { useEffect, useRef } from 'react';

interface FieldNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  cyan: boolean;
  r: number;
}

const COUNT = 42;
const LINK = 160;
const LINK_SQ = LINK * LINK;
const RENDER_EVERY = 3; // draw every 3rd rAF ≈ 20 fps — the drift is so slow it's imperceptible

/**
 * Ambient network field — a slow-drifting constellation of nodes + proximity links over the aurora,
 * with orange (authority) + electric-blue (data) glints. Renders at ~20fps and pauses when the tab
 * is hidden; renders a single static frame under prefers-reduced-motion.
 */
export function NetworkField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let nodes: FieldNode[] = [];
    let raf = 0;
    let tick = 0;

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const seed = () => {
      nodes = Array.from({ length: COUNT }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.085,
        vy: (Math.random() - 0.5) * 0.085,
        cyan: Math.random() < 0.32,
        r: Math.random() * 1.4 + 0.6,
      }));
    };
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const n of nodes) {
        n.x += n.vx * RENDER_EVERY;
        n.y += n.vy * RENDER_EVERY;
        if (n.x < -20) n.x = w + 20;
        if (n.x > w + 20) n.x = -20;
        if (n.y < -20) n.y = h + 20;
        if (n.y > h + 20) n.y = -20;
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK_SQ) {
            const o = (1 - Math.sqrt(d2) / LINK) * 0.13;
            ctx.strokeStyle = a.cyan || b.cyan ? `rgba(56,224,255,${o})` : `rgba(246,133,27,${o})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      for (const n of nodes) {
        ctx.fillStyle = n.cyan ? 'rgba(56,224,255,0.45)' : 'rgba(246,133,27,0.4)';
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (document.hidden || ++tick % RENDER_EVERY !== 0) return;
      draw();
    };

    const ro = new ResizeObserver(() => {
      resize();
      seed();
      if (reduce) draw();
    });
    ro.observe(canvas);
    resize();
    seed();
    if (reduce) {
      draw();
    } else {
      frame();
    }
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} className="mc-netbg" aria-hidden="true" />;
}
