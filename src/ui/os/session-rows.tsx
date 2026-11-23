import { Pin } from "@content-ventures/design-system/v3/icons";
import type { ReactNode } from "react";
import styles from "./session-rows.module.css";

/** One conversation in the column: its title, when it last moved, and whether it is kept. */
export type SessionRow = {
  id: string;
  href: string;
  title: string;
  /** When it last moved, at the end of the line. */
  meta: string;
  pinned?: boolean;
};

export type SessionRowGroup = { id: string; label: string; rows: SessionRow[] };

type Props = {
  /** The name of the list for a screen reader. */
  label: string;
  groups: SessionRowGroup[];
  /** The conversation open on the screen. */
  current?: string;
  /** The menu of one line. It takes the place of the time while the line is pointed at. */
  actions?: (row: SessionRow) => ReactNode;
  /** What shows when no group has a line. */
  empty: ReactNode;
};

/**
 * The conversations in a narrow column: one line each, the title and the time, by day. The line
 * is a link; its menu sits beside it and shows when the line is pointed at or holds the focus.
 * New in this project; it goes to the Design System after the interface is approved.
 */
export function SessionRows({ label, groups, current, actions, empty }: Props) {
  const filled = groups.filter((group) => group.rows.length > 0);
  if (filled.length === 0) return <div className={styles.empty}>{empty}</div>;
  return (
    <nav aria-label={label} className={styles.rows}>
      {filled.map((group) => (
        <section key={group.id} aria-labelledby={`session-rows-${group.id}`}>
          <h3 id={`session-rows-${group.id}`} className={styles.group}>
            {group.label}
          </h3>
          <ul className={styles.list}>
            {group.rows.map((row) => (
              <li
                key={row.id}
                className={styles.item}
                data-selected={row.id === current ? "" : undefined}
                data-actions={actions ? "" : undefined}
              >
                <a
                  href={row.href}
                  className={styles.link}
                  aria-current={row.id === current ? "page" : undefined}
                  title={row.title}
                >
                  {row.pinned ? <Pin className={styles.pin} aria-label="Guardada" /> : null}
                  <span className={styles.title}>{row.title}</span>
                  <span className={styles.meta}>{row.meta}</span>
                </a>
                {actions ? <span className={styles.actions}>{actions(row)}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}
