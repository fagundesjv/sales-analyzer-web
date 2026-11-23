import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {EmptyPreview, type PreviewKind} from "./empty-preview";
import styles from "./empty-state.module.css";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  size?: "page" | "section" | "compact";
  className?: string;
  preview?: PreviewKind;
  headingId?: string;
};

/** A quiet, useful destination when a list or section has no items. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = "section",
  className,
  preview,
  headingId,
}: EmptyStateProps) {
  const Heading = headingId ? "h1" : "strong";
  return (
    <div className={[styles.state, styles[size], preview && styles.illustrated, className].filter(Boolean).join(" ")}>
      {preview ? <EmptyPreview kind={preview} /> : <div className={styles.art} aria-hidden="true">
        <span className={styles.orbit} />
        <span className={styles.signal} />
        <span className={styles.tile}><Icon size={22} strokeWidth={1.7} /></span>
      </div>}
      <div className={styles.copy} role="status">
        <Heading id={headingId} className={styles.title}>{title}</Heading>
        <p className={styles.description}>{description}</p>
      </div>
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
