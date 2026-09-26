'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { hashUnit } from '@/lib/flashcards/memory';

export type StarState = 'pending' | 'current' | 'recalled' | 'lapsed';

export interface StudySpaceStar {
  id: string;
  /** 0-1 memory strength - how bright the star burns. */
  strength: number;
  state: StarState;
}

export interface StudySpaceHandle {
  /** A recalled card streams light from (x, y) into its own star, which
   * ignites on arrival. `big` for a called-it or combo milestone. */
  celebrate(x: number, y: number, starId: string, big: boolean): void;
  /** A gentle drift of embers for a lapse - never punishing. */
  fizzle(x: number, y: number): void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  rgb: string;
  /** Homing particles travel a curve from (sx, sy) to their star. */
  home?: { sx: number; sy: number; cx: number; cy: number; starId: string };
}

interface Dust {
  x: number;
  y: number;
  r: number;
  a: number;
  speed: number;
  phase: number;
}

const RGB = {
  violet: '140,110,255',
  indigo: '91,61,245',
  teal: '0,191,160',
  white: '236,233,255',
  ember: '255,138,122',
  slate: '148,146,176',
};
const BG = '#07060d';
const DUST_COUNT = 170;
const MAX_PARTICLES = 420;
const IGNITE_MS = 900;

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

/** Deterministic PRNG so the dust field doesn't reshuffle on resize. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stars ring the card on a wide ellipse, each at a fixed angle per card
 * id so the constellation is the same shape every time this deck opens. */
function starPosition(id: string, w: number, h: number) {
  const angle = hashUnit(id) * Math.PI * 2;
  const band = 0.72 + hashUnit(id, 7) * 0.28;
  return {
    x: w / 2 + Math.cos(angle) * w * 0.46 * band,
    y: h / 2 + Math.sin(angle) * h * 0.34 * band,
  };
}

/**
 * The immersive backdrop of a review session: a slow brand-gradient nebula
 * that brightens as the student's combo builds, a field of twinkling dust,
 * and one star per card in the session. As cards are reviewed, their stars
 * are linked in review order so the session literally draws a
 * constellation. Honors prefers-reduced-motion by painting a single still
 * frame (no loop, no particles).
 */
export const StudySpaceCanvas = forwardRef<
  StudySpaceHandle,
  { stars: StudySpaceStar[]; flow: number }
>(function StudySpaceCanvas({ stars, flow }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef(stars);
  starsRef.current = stars;
  const flowRef = useRef(flow);
  flowRef.current = flow;
  const particlesRef = useRef<Particle[]>([]);
  const ignitedRef = useRef(new Map<string, number>());
  const sizeRef = useRef({ w: 0, h: 0 });
  const dustRef = useRef<Dust[]>([]);
  const paintRef = useRef<(t: number) => void>(() => {});
  const reducedRef = useRef(false);

  useImperativeHandle(ref, () => ({
    celebrate(x, y, starId, big) {
      if (reducedRef.current) return;
      const { w, h } = sizeRef.current;
      const target = starPosition(starId, w, h);
      const particles = particlesRef.current;
      const count = big ? 46 : 26;
      for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
        const spread = (Math.random() - 0.5) * 260;
        particles.push({
          x,
          y,
          vx: 0,
          vy: 0,
          life: 0,
          max: 55 + Math.random() * 35,
          size: 1.2 + Math.random() * (big ? 2.6 : 1.8),
          rgb: i % 3 === 0 ? RGB.teal : i % 3 === 1 ? RGB.violet : RGB.white,
          home: {
            sx: x + (Math.random() - 0.5) * 60,
            sy: y + (Math.random() - 0.5) * 40,
            cx: (x + target.x) / 2 + spread,
            cy: (y + target.y) / 2 - 80 - Math.random() * 120,
            starId,
          },
        });
      }
      // A radial flash at the card itself, so the success reads instantly.
      const flash = big ? 40 : 22;
      for (let i = 0; i < flash && particles.length < MAX_PARTICLES; i++) {
        const a = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * (big ? 5 : 3);
        particles.push({
          x,
          y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          life: 0,
          max: 30 + Math.random() * 25,
          size: 0.8 + Math.random() * 2,
          rgb: i % 2 ? RGB.teal : RGB.violet,
        });
      }
    },
    fizzle(x, y) {
      if (reducedRef.current) return;
      const particles = particlesRef.current;
      for (let i = 0; i < 18 && particles.length < MAX_PARTICLES; i++) {
        particles.push({
          x: x + (Math.random() - 0.5) * 120,
          y: y + (Math.random() - 0.5) * 40,
          vx: (Math.random() - 0.5) * 0.8,
          vy: 0.6 + Math.random() * 1.2,
          life: 0,
          max: 45 + Math.random() * 30,
          size: 0.8 + Math.random() * 1.6,
          rgb: i % 2 ? RGB.ember : RGB.slate,
        });
      }
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    reducedRef.current = prefersReducedMotion();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      sizeRef.current = { w, h };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const rand = mulberry32(1337);
      dustRef.current = Array.from({ length: DUST_COUNT }, () => ({
        x: rand() * w,
        y: rand() * h,
        r: 0.3 + rand() * 1.1,
        a: 0.15 + rand() * 0.55,
        speed: 0.0006 + rand() * 0.002,
        phase: rand() * Math.PI * 2,
      }));
      paintRef.current(performance.now());
    };

    const nebula = (x: number, y: number, radius: number, rgb: string, alpha: number) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
      g.addColorStop(0, `rgba(${rgb},${alpha})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    };

    const glowDot = (x: number, y: number, r: number, rgb: string, alpha: number) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
      g.addColorStop(0, `rgba(${rgb},${alpha})`);
      g.addColorStop(0.25, `rgba(${rgb},${alpha * 0.35})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r * 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${Math.min(1, alpha + 0.2)})`;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    };

    let shootingAt = 0;
    let shooting: { x: number; y: number; vx: number; vy: number; life: number } | null = null;

    paintRef.current = (t: number) => {
      const { w, h } = sizeRef.current;
      const f = flowRef.current;
      const big = Math.max(w, h);

      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = 'lighter';
      nebula(
        w * (0.22 + 0.03 * Math.sin(t / 9000)),
        h * 0.28,
        big * 0.55,
        RGB.indigo,
        0.1 + 0.16 * f,
      );
      nebula(
        w * (0.8 + 0.03 * Math.cos(t / 11000)),
        h * 0.74,
        big * 0.5,
        RGB.teal,
        0.05 + 0.13 * f,
      );
      nebula(
        w * 0.55,
        h * (0.12 + 0.04 * Math.sin(t / 13000)),
        big * 0.38,
        RGB.violet,
        0.06 + 0.12 * f,
      );

      for (const d of dustRef.current) {
        const a = d.a * (0.55 + 0.45 * Math.sin(t * d.speed + d.phase));
        ctx.fillStyle = `rgba(${RGB.white},${a})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }

      const list = starsRef.current;
      const positions = new Map(list.map((s) => [s.id, starPosition(s.id, w, h)]));

      const reviewed = list.filter((s) => s.state === 'recalled' || s.state === 'lapsed');
      if (reviewed.length > 1) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(${RGB.violet},${0.22 + 0.25 * f})`;
        ctx.beginPath();
        reviewed.forEach((s, i) => {
          const p = positions.get(s.id)!;
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
      }

      for (const s of list) {
        const p = positions.get(s.id)!;
        const ignitedAt = ignitedRef.current.get(s.id);
        const boost = ignitedAt ? Math.max(0, 1 - (t - ignitedAt) / IGNITE_MS) : 0;
        const r = 1.6 + s.strength * 2.6 + boost * 4;
        if (s.state === 'current') {
          const pulse = 0.5 + 0.5 * Math.sin(t / 280);
          glowDot(p.x, p.y, r + 1, RGB.violet, 0.75 + 0.25 * pulse);
          ctx.strokeStyle = `rgba(${RGB.violet},${0.35 + 0.35 * pulse})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 10 + pulse * 6, 0, Math.PI * 2);
          ctx.stroke();
        } else if (s.state === 'recalled') {
          glowDot(p.x, p.y, r, RGB.teal, 0.7 + 0.3 * boost);
        } else if (s.state === 'lapsed') {
          glowDot(p.x, p.y, r * 0.8, RGB.ember, 0.45);
        } else {
          glowDot(p.x, p.y, r * 0.8, RGB.white, 0.2 + s.strength * 0.45);
        }
      }

      if (f >= 0.75 && !reducedRef.current) {
        if (!shooting && t - shootingAt > 2600) {
          shootingAt = t;
          shooting = {
            x: Math.random() * w * 0.6,
            y: Math.random() * h * 0.3,
            vx: 9,
            vy: 3.4,
            life: 1,
          };
        }
      }
      if (shooting) {
        const tail = ctx.createLinearGradient(
          shooting.x,
          shooting.y,
          shooting.x - shooting.vx * 14,
          shooting.y - shooting.vy * 14,
        );
        tail.addColorStop(0, `rgba(${RGB.white},${0.9 * shooting.life})`);
        tail.addColorStop(1, `rgba(${RGB.violet},0)`);
        ctx.strokeStyle = tail;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(shooting.x, shooting.y);
        ctx.lineTo(shooting.x - shooting.vx * 14, shooting.y - shooting.vy * 14);
        ctx.stroke();
        shooting.x += shooting.vx;
        shooting.y += shooting.vy;
        shooting.life -= 0.012;
        if (shooting.life <= 0 || shooting.x > w + 200) shooting = null;
      }

      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        pt.life += 1;
        const progress = pt.life / pt.max;
        if (pt.home) {
          const target = positions.get(pt.home.starId) ?? starPosition(pt.home.starId, w, h);
          const e = progress * progress * (3 - 2 * progress);
          const inv = 1 - e;
          pt.x = inv * inv * pt.home.sx + 2 * inv * e * pt.home.cx + e * e * target.x;
          pt.y = inv * inv * pt.home.sy + 2 * inv * e * pt.home.cy + e * e * target.y;
          if (pt.life >= pt.max) ignitedRef.current.set(pt.home.starId, t);
        } else {
          pt.x += pt.vx;
          pt.y += pt.vy;
          pt.vx *= 0.96;
          pt.vy *= 0.96;
        }
        if (pt.life >= pt.max) {
          particles.splice(i, 1);
          continue;
        }
        const alpha = pt.home ? 0.9 * (1 - progress * 0.5) : 1 - progress;
        ctx.fillStyle = `rgba(${pt.rgb},${alpha})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    };

    resize();
    window.addEventListener('resize', resize);

    let raf = 0;
    if (!reducedRef.current) {
      const loop = (t: number) => {
        paintRef.current(t);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // Reduced motion paints a still frame whenever the session state changes.
  useEffect(() => {
    if (reducedRef.current) paintRef.current(0);
  }, [stars, flow]);

  return <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />;
});
