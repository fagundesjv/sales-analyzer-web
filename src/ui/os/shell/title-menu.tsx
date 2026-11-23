"use client";

import { Menu, type MenuSection } from "@content-ventures/design-system/v3";
import { ChevronDown } from "@content-ventures/design-system/v3/icons";
import type { ReactNode } from "react";
import styles from "./title-menu.module.css";

type Props = {
  /** The name of what is open: a conversation, a document. */
  title: string;
  /** What the menu is, for a screen reader: "Ações da conversa". */
  label: string;
  sections: MenuSection[];
  /** A word beside the name about where it stands: "Arquivada". */
  status?: ReactNode;
};

/**
 * The name of what is open, in the middle of the bar at the top. It is also the menu of the
 * thing itself: keep it, give it another name, put it away.
 */
export function TitleMenu({ title, label, sections, status }: Props) {
  return (
    <div className={styles.wrap}>
      <Menu
        label={label}
        width={220}
        sections={sections}
        trigger={(trigger) => (
          <button type="button" className={styles.title} title={title} {...trigger}>
            <span className={styles.name}>{title}</span>
            <ChevronDown aria-hidden="true" />
          </button>
        )}
      />
      {status}
    </div>
  );
}
