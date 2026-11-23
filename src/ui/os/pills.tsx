import styles from "./pills.module.css";

export type PillItem<T extends string> = { value: T; label: string; ariaLabel?: string; count?: number };

type Props<T extends string> = {
  /** What the pills choose, for a screen reader: "Prateleiras das conversas". */
  label: string;
  items: PillItem<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
};

/**
 * Pills that choose one view of a list. One is always chosen; each can say how much it holds.
 */
export function Pills<T extends string>({ label, items, value, onChange, size = "md" }: Props<T>) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a group of toggle buttons, not a form fieldset
    <div className={styles.pills} role="group" aria-label={label} data-size={size}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          className={styles.pill}
          aria-label={item.ariaLabel}
          aria-pressed={item.value === value}
          onClick={() => onChange(item.value)}
        >
          {item.label}
          {item.count === undefined ? null : <span className={styles.count}>{item.count}</span>}
        </button>
      ))}
    </div>
  );
}
