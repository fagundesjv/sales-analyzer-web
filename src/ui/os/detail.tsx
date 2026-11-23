import type { LucideIcon } from "@content-ventures/design-system/v3/icons";
import type { ReactNode } from "react";
import styles from "./detail.module.css";

type PageProps = {
  /** The icon of what the page is about, in a tile before its name. */
  icon?: LucideIcon;
  /** Something in the place of the tile: the face of a person. */
  leading?: ReactNode;
  title: string;
  /** Where the thing stands, beside its name. */
  status?: ReactNode;
  description?: ReactNode;
  /** The few things to do with it, the main one first. */
  actions?: ReactNode;
  /** The views of the thing, when it has more than one. */
  tabs?: ReactNode;
  /** The short facts, in cards beside what there is to read. */
  aside?: ReactNode;
  children: ReactNode;
};

/** How long a name may be before the page writes it smaller: a quote is a name too. */
const LONG_TITLE = 70;

/**
 * The page of one thing of a list: its name and what to do with it at the top, what there is to
 * read in sections, and the short facts beside them.
 */
export function DetailPage({
  icon: Icon,
  leading,
  title,
  status,
  description,
  actions,
  tabs,
  aside,
  children,
}: PageProps) {
  return (
    <div className={styles.page}>
      <header className={styles.head} data-line={tabs ? undefined : ""}>
        <div className={styles.titleRow}>
          {leading ? (
            <span className={styles.lead}>{leading}</span>
          ) : Icon ? (
            <span className={styles.tile} aria-hidden="true">
              <Icon />
            </span>
          ) : null}
          <h1 className={styles.title} data-long={title.length > LONG_TITLE ? "" : undefined}>
            {title}
          </h1>
          {status ? <span className={styles.status}>{status}</span> : null}
        </div>
        {description ? <p className={styles.description}>{description}</p> : null}
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </header>
      {tabs}
      <div className={styles.columns} data-aside={aside ? "" : undefined}>
        <div className={styles.main}>{children}</div>
        {aside ? <aside className={styles.aside}>{aside}</aside> : null}
      </div>
    </div>
  );
}

type SectionProps = {
  title: string;
  /** A few quiet words beside the name. */
  meta?: string;
  /** A way to see more, at the end of the name. */
  action?: ReactNode;
  children: ReactNode;
};

/** One section of what there is to read about the thing. */
export function DetailSection({ title, meta, action, children }: SectionProps) {
  return (
    <section className={styles.section} aria-label={title}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        <span className={styles.sectionMeta}>{meta}</span>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A paragraph of a section. */
export function DetailText({ children }: { children: ReactNode }) {
  return <p className={styles.sectionText}>{children}</p>;
}

/** Rows of a name and what it holds, one under the other. */
export function DetailRows({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className={styles.rows}>
      {items.map((item) => (
        <div key={item.label} className={styles.row}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A card of the side column: "Uso", "Detalhes". */
export function DetailCard({
  title,
  note,
  children,
}: {
  title: string;
  /** One quiet line under the name of the card. */
  note?: string;
  children?: ReactNode;
}) {
  return (
    <section className={styles.card} aria-label={title}>
      <h2 className={styles.cardTitle}>{title}</h2>
      {note ? <p className={styles.cardText}>{note}</p> : null}
      {children}
    </section>
  );
}
