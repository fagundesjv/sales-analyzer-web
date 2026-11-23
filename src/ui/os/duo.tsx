"use client";

import { Tabs } from "@content-ventures/design-system/v3";
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import styles from "./duo.module.css";

/** Which of the two regions is in front where only one shows at a time. */
export type DuoRegion = "start" | "end";

type Props = {
  /** The name of the region that is always there: "Conversa". */
  startLabel: string;
  /** The name of the region that comes and goes: "Painel". */
  endLabel: string;
  start: ReactNode;
  /** What the second region holds; nothing puts it away. */
  end: ReactNode | null;
  /** Narrower than this, in px of the layout itself, one region shows at a time. */
  narrowBelow?: number;
  region: DuoRegion;
  onRegion: (region: DuoRegion) => void;
  /** The width of the first region beside the second one, in px, and how far it goes. */
  defaultSize?: number;
  min?: number;
  max?: number;
  /** The least room the second region keeps. */
  endMin?: number;
  /** Remembers the width in this browser. */
  storageKey?: string;
};

/** How long the regions take to trade their room, as the stylesheet has it (`--dur-3`). */
const TRADE_MS = 320;
const STEP = 16;

function remembered(key: string | undefined): number | null {
  if (!key) return null;
  try {
    const value = Number(window.localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/**
 * Two regions side by side that trade their room without a cut. The first one is always there;
 * alone, it takes everything. When the second one comes, the first narrows down to its own
 * width while the second grows from nothing, and the way back is the same. The line between
 * them is dragged, or moved with the arrows, to change that width. In a narrow window one region
 * shows at a time, with a tab for each. New in this project; it goes to the Design System after
 * the interface is approved.
 */
export function Duo({
  startLabel,
  endLabel,
  start,
  end,
  narrowBelow = 820,
  region,
  onRegion,
  defaultSize = 440,
  min = 360,
  max = 640,
  endMin = 440,
  storageKey,
}: Props) {
  const root = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number>();
  const [size, setSize] = useState(defaultSize);
  const [dragging, setDragging] = useState(false);
  /** What the second region held last: it stays in sight while the region gives its room back. */
  const [kept, setKept] = useState(end);
  const open = end !== null;

  useEffect(() => {
    if (end !== null) return setKept(end);
    const timer = window.setTimeout(() => setKept(null), TRADE_MS);
    return () => window.clearTimeout(timer);
  }, [end]);

  // The layout measures itself: the width decides if both regions fit side by side.
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const measure = () => setWidth(element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const saved = remembered(storageKey);
    if (saved) setSize(saved);
  }, [storageKey]);

  const narrow = width !== undefined && width <= narrowBelow;
  // The first region never squeezes the second one under the room it needs.
  const ceiling = Math.max(min, Math.min(max, (width ?? Number.POSITIVE_INFINITY) - endMin));
  const shown = Math.round(Math.min(Math.max(size, min), ceiling));
  const front: DuoRegion = open ? region : "start";

  const commit = (next: number) => {
    const value = Math.round(Math.min(Math.max(next, min), ceiling));
    setSize(value);
    if (!storageKey) return;
    try {
      window.localStorage.setItem(storageKey, String(value));
    } catch {
      // No storage: the width is kept for this visit only.
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging || !root.current) return;
    const left = root.current.getBoundingClientRect().left;
    setSize(Math.min(Math.max(event.clientX - left, min), ceiling));
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
    commit(size);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const by = event.shiftKey ? STEP * 4 : STEP;
    const to =
      event.key === "ArrowLeft"
        ? shown - by
        : event.key === "ArrowRight"
          ? shown + by
          : event.key === "Home"
            ? min
            : event.key === "End"
              ? ceiling
              : null;
    if (to === null) return;
    event.preventDefault();
    commit(to);
  };

  const held = end ?? kept;
  return (
    <div
      ref={root}
      className={styles.duo}
      data-open={open ? "" : undefined}
      data-narrow={narrow ? "" : undefined}
      data-front={front}
      data-dragging={dragging ? "" : undefined}
      // Before the first measure nothing moves: the regions open where they stand.
      data-ready={width === undefined ? undefined : ""}
      style={
        {
          "--duo-start": `${shown}px`,
          "--duo-width": width === undefined ? undefined : `${width}px`,
        } as CSSProperties
      }
    >
      {narrow && open ? (
        <div className={styles.switch}>
          <Tabs
            label="Regiões da tela"
            size="sm"
            value={front}
            onChange={onRegion}
            items={[
              { value: "start" as DuoRegion, label: startLabel },
              { value: "end" as DuoRegion, label: endLabel },
            ]}
          />
        </div>
      ) : null}
      <section
        className={styles.start}
        aria-label={startLabel}
        inert={narrow && front !== "start" ? true : undefined}
      >
        {start}
      </section>
      {narrow ? null : (
        // biome-ignore lint/a11y/useSemanticElements: a draggable divider between two regions, not a rule
        <div
          className={styles.handle}
          role="separator"
          aria-orientation="vertical"
          aria-label={`Largura de ${startLabel.toLowerCase()}`}
          aria-valuenow={shown}
          aria-valuemin={min}
          aria-valuemax={ceiling}
          tabIndex={open ? 0 : -1}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onDoubleClick={() => commit(defaultSize)}
          onKeyDown={onKeyDown}
        />
      )}
      <section
        className={styles.end}
        aria-label={endLabel}
        inert={!open || (narrow && front !== "end") ? true : undefined}
      >
        <div className={styles.endInner}>{held}</div>
      </section>
    </div>
  );
}
