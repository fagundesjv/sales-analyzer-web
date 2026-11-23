import type { ReactNode } from "react";
import styles from "./page-column.module.css";

export function PageColumn({ children }: { children: ReactNode }) {
  return <div className={styles.column}>{children}</div>;
}
