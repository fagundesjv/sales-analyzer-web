import type { ReactNode } from "react";
import styles from "./list-bar.module.css";

type Props = {
  /** The search of the list. */
  search: ReactNode;
  /** The few controls at the end: how to see the list, one more cut. */
  end?: ReactNode;
  /** The pills that cut the list, one row for each way of cutting it. */
  children?: ReactNode;
};

/** The top of a list: its search, its controls and the pills that cut it. */
export function ListBar({ search, end, children }: Props) {
  return (
    <div className={styles.bar}>
      <div className={styles.top}>
        <div className={styles.search}>{search}</div>
        {end ? <div className={styles.end}>{end}</div> : null}
      </div>
      {children ? <div className={styles.cuts}>{children}</div> : null}
    </div>
  );
}
