import styles from "./stat-tiles.module.css";

/** One number that says where something stands. */
export type StatTile = {
  id: string;
  label: string;
  value: string | number;
  /** What the number counts, beside it: "aprovadas". */
  unit?: string;
  /** One line under the number. */
  caption?: string;
  /** Where the tile leads, when it leads somewhere. */
  href?: string;
  /** The number is of something that waits for a person. */
  warn?: boolean;
};

type Props = {
  /** What the numbers are about, for a screen reader. */
  label: string;
  items: StatTile[];
  /** How many tiles go side by side where there is room; without it, as many as fit. */
  columns?: 4 | 5;
};

/** A few numbers side by side, each in its tile. */
export function StatTiles({ label, items, columns }: Props) {
  return (
    <ul className={styles.tiles} aria-label={label} data-columns={columns}>
      {items.map((item) => {
        const body = (
          <>
            <span className={styles.label}>{item.label}</span>
            <span className={styles.value} data-warn={item.warn ? "" : undefined}>
              {item.value}
              {item.unit ? <span className={styles.unit}>{item.unit}</span> : null}
            </span>
            {item.caption ? <span className={styles.caption}>{item.caption}</span> : null}
          </>
        );
        return (
          <li key={item.id}>
            {item.href ? (
              <a href={item.href} className={styles.tile}>
                {body}
              </a>
            ) : (
              <div className={styles.tile}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
