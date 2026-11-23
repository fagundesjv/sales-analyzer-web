import type { LucideIcon } from "@content-ventures/design-system/v3/icons";
import type { ReactNode } from "react";
import styles from "./rows.module.css";

/** The groups of a list, one under the other, with a line between them. */
export function RowGroups({ children }: { children: ReactNode }) {
  return <div className={styles.groups}>{children}</div>;
}

type GroupProps = {
  /** The name of the group; without one the rows stand alone. */
  title?: string;
  /** How many things the group holds. */
  count?: number;
  /** A way to see the whole group, at the end of its name. */
  action?: ReactNode;
  /** The name of the list for a screen reader. */
  label: string;
  columns?: 1 | 2;
  /** The group holds cards side by side, each with its miniature, instead of rows. */
  cards?: boolean;
  children: ReactNode;
};

/**
 * One group of a list: its name, how many it holds, and its things as rows two by two or as
 * cards side by side.
 */
export function RowGroup({
  title,
  count,
  action,
  label,
  columns = 2,
  cards,
  children,
}: GroupProps) {
  return (
    <section className={styles.group} aria-label={label} data-cards={cards ? "" : undefined}>
      {title ? (
        <div className={styles.head}>
          <h2 className={styles.title}>{title}</h2>
          <span className={styles.count}>{count}</span>
          {action}
        </div>
      ) : null}
      <ul className={styles.grid} data-columns={cards ? undefined : columns}>
        {children}
      </ul>
    </section>
  );
}

type RowProps = {
  icon: LucideIcon;
  /** A miniature of the thing in the place of the icon, when it has one. */
  leading?: ReactNode;
  title: string;
  /** One line about the thing: what it is, where it goes, when. */
  detail?: ReactNode;
  /** What stands at the end of the row: where the thing stands, a box to mark it. */
  end?: ReactNode;
  /** Opens the thing; the whole row answers the click. */
  href?: string;
  onOpen?: () => void;
  selected?: boolean;
};

/** One thing of a list: a tile with its icon, its name and a line about it. */
export function TileRow({
  icon: Icon,
  leading,
  title,
  detail,
  end,
  href,
  onOpen,
  selected,
}: RowProps) {
  const body = (
    <>
      {leading ?? (
        <span className={styles.tile} aria-hidden="true">
          <Icon />
        </span>
      )}
      <span className={styles.text}>
        <span className={styles.name}>{title}</span>
        {detail ? <span className={styles.detail}>{detail}</span> : null}
      </span>
    </>
  );
  return (
    <li className={styles.row} data-selected={selected ? "" : undefined}>
      {href ? (
        <a href={href} className={styles.open}>
          {body}
        </a>
      ) : (
        <button type="button" className={styles.open} onClick={onOpen}>
          {body}
        </button>
      )}
      {end ? <span className={styles.end}>{end}</span> : null}
    </li>
  );
}
