"use client";
import { useEffect, useRef, useState } from "react";

/** A short burst after a confirmed change. Nothing is replayed when reopening a conversation. */
export function OutcomeCelebration({ outcome }) {
  const canvas = useRef(null);
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    const surface = canvas.current;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) {
      setFinished(true);
      return;
    }
    const ctx = surface.getContext("2d");
    if (!ctx) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    surface.width = width * dpr;
    surface.height = height * dpr;
    ctx.scale(dpr, dpr);
    const won = outcome === "won";
    const palette = won
      ? ["#f6bd57", "#9dd694", "#f09d74", "#ffe7a2", "#89a1ec"]
      : ["#97d0a3", "#9fb5ec", "#debbef", "#f4d18f"];
    const chips = Array.from({ length: won ? 65 : 36 }, (_, i) => ({
      dx: (Math.random() - 0.5) * Math.min(870, width * 1.7),
      dy: -180 - Math.random() * 240,
      spin: (Math.random() - 0.5) * 13,
      size: 3 + Math.random() * 4,
      color: palette[i % palette.length],
    }));
    let frame;
    const start = performance.now();
    function draw(time) {
      const t = (time - start) / 1000;
      ctx.clearRect(0, 0, width, height);
      if (t >= 1.5 || motion.matches) {
        setFinished(true);
        return;
      }
      ctx.globalAlpha = Math.min(1, (1.5 - t) * 2.8);
      for (const c of chips) {
        ctx.save();
        ctx.translate(
          width * 0.52 + c.dx * t,
          height * 0.56 + c.dy * t + 260 * t * t,
        );
        ctx.rotate(c.spin * t);
        ctx.fillStyle = c.color;
        ctx.fillRect(
          -c.size / 2,
          0,
          c.size * 1.5,
          c.size * (0.3 + Math.abs(Math.sin(c.spin * t)) * 0.6),
        );
        ctx.restore();
      }
      frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [outcome]);
  return finished ? null : (
    <canvas
      ref={canvas}
      aria-hidden="true"
      data-celebration={outcome}
      className="sales-confetti"
    />
  );
}
