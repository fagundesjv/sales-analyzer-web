"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./signals.module.css";

export function ZoeAvatar({ expression = "idle" }) {
  const root = useRef(null);
  const canvas = useRef(null);
  const live = useRef(null);
  const pose = useRef(expression);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    pose.current = expression;
    live.current?.setState(expression);
  }, [expression]);
  useEffect(() => {
    let disposed = false;
    let inView = false;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (!live.current) return;
      live.current.setMotionEnabled(!motion.matches);
      if (inView && !document.hidden && !motion.matches) live.current.play();
      else live.current.pause();
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    });
    observer.observe(root.current);
    document.addEventListener("visibilitychange", sync);
    motion.addEventListener("change", sync);
    import("../src/vendor/zoe-avatar/zoe-avatar.js")
      .then(async () => {
        if (disposed) return;
        const avatar = await window.ZoeAvatar.create(canvas.current, {
          assetsUrl: "/zoe-avatar/manifest.json",
          autoplay: false,
        });
        if (disposed) {
          avatar.destroy();
          return;
        }
        live.current = avatar;
        avatar.setState(pose.current);
        setReady(true);
        sync();
      })
      .catch(() => {});
    return () => {
      disposed = true;
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      motion.removeEventListener("change", sync);
      live.current?.destroy();
      live.current = null;
    };
  }, []);
  return (
    <span
      className={styles.avatar}
      ref={root}
      aria-hidden="true"
      onPointerMove={(e) => live.current?.lookAtClient(e.clientX, e.clientY)}
      onPointerLeave={() => live.current?.resetLook()}
    >
      {!ready && <img src="/assets/idle_thumbnail.png" alt="" />}
      <canvas ref={canvas} style={{ opacity: ready ? 1 : 0 }} />
    </span>
  );
}
