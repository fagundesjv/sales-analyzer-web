"use client";

import { IconAction } from "../icon-action";
import { Avatar, BrandMark, Menu, type MenuSection } from "@content-ventures/design-system/v3";
import { ChevronsUpDown, type LucideIcon, Plus } from "@content-ventures/design-system/v3/icons";
import type { ReactNode } from "react";
import styles from "./column.module.css";

/** One screen of an area, as its menu lists it. */
export type AreaItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  /** How many things the screen holds that are worth saying. */
  count?: number;
  /** The count is of things that wait for the person. */
  waiting?: boolean;
  /** The screen waits for the backend: it is listed, says so, and holds no data. */
  soon?: boolean;
};

/** A group of screens of an area; the ones after the first carry a name. */
export type AreaGroup = { id: string; label?: string; items: AreaItem[] };

/** The top of a column: the name of the area and, beside it, its few controls. */
export function ColumnHead({
  title,
  actions,
  field,
}: {
  title: string;
  actions?: ReactNode;
  /** A field that takes the place of the name while it is in use: the search of the list. */
  field?: ReactNode;
}) {
  return (
    <div className={styles.head}>
      {field ? (
        <div className={styles.headField}>{field}</div>
      ) : (
        <h2 className={styles.title}>{title}</h2>
      )}
      {actions}
    </div>
  );
}

/** The part of a column that scrolls. */
export function ColumnScroll({ children }: { children: ReactNode }) {
  return <div className={styles.scroll}>{children}</div>;
}

/**
 * The menu of an area: its screens, in groups. The screen the person is in is marked, and a
 * screen says how much it holds when that helps to decide where to go.
 */
export function AreaMenu({
  title,
  groups,
  active,
}: {
  title: string;
  groups: AreaGroup[];
  active: string | undefined;
}) {
  return (
    <>
      <ColumnHead title={title} />
      <ColumnScroll>
        <nav className={styles.menu} aria-label={title}>
          {groups.map((group) => (
            <div key={group.id}>
              {group.label ? <p className={styles.groupLabel}>{group.label}</p> : null}
              <ul className={styles.group}>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.id}>
                      <a
                        href={item.href}
                        className={styles.item}
                        aria-current={item.id === active ? "page" : undefined}
                        data-soon={item.soon ? "" : undefined}
                      >
                        <Icon aria-hidden="true" />
                        <span className={styles.itemLabel}>{item.label}</span>
                        {item.soon ? (
                          <span className={styles.soon}>em breve</span>
                        ) : item.count ? (
                          <span
                            className={styles.count}
                            data-waiting={item.waiting ? "" : undefined}
                          >
                            {item.count}
                          </span>
                        ) : null}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </ColumnScroll>
    </>
  );
}

/** The button that starts something new from a list: "Nova conversa". */
export function ColumnNew({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className={styles.new}>
      <Plus aria-hidden="true" />
      {label}
    </a>
  );
}

/** The shelves of a list, right under the button that starts something. */
export function ColumnPills({ children }: { children: ReactNode }) {
  return <div className={styles.pills}>{children}</div>;
}

/**
 * The coverage being worked on, at the foot of the column (João, 17/11: the fairs, congresses and
 * meetups are coverages inside the client's brain); the brain and the other coverages are here.
 */
export function FairSwitch({
  name,
  detail,
  sections,
}: {
  name: string;
  detail: string;
  sections: MenuSection[];
}) {
  return (
    <Menu
      label="Opções da empresa"
      side="top"
      width={300}
      sections={sections}
      trigger={(trigger) => (
        <button type="button" className={styles.switch} {...trigger}>
          <BrandMark name={name} size="sm" decorative />
          <span className={styles.switchText}>
            <span className={styles.switchName}>{name}</span>
            <span className={styles.switchDetail}>{detail}</span>
          </span>
          <ChevronsUpDown aria-hidden="true" />
        </button>
      )}
    />
  );
}

/** The person, at the end of the rail: who is in, and the way out. */
export function AccountButton({ name, sections }: { name: string; sections: MenuSection[] }) {
  return (
    <Menu
      label={`Conta de ${name}`}
      side="top"
      width={224}
      sections={sections}
      trigger={(trigger) => (
        <IconAction
          type="button"
          className={styles.avatar}
          aria-label={`Conta de ${name}`}
          title={name}
          {...trigger}
        >
          <Avatar name={name} size="sm" decorative />
        </IconAction>
      )}
    />
  );
}
