"use client";

import { CornerDownLeft, type LucideIcon, Search, X } from "@content-ventures/design-system/v3/icons";
import { IconButton } from "@content-ventures/design-system/v3";
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import styles from "./palette.module.css";
import { Pills } from "./pills";

/** One thing the search finds: a conversation, a content, a screen, something to do. */
export type PaletteItem = {
  id: string;
  /** The kind of thing, to cut the search to it. */
  scope: string;
  /** The name of the group it is listed under. */
  group: string;
  label: string;
  /** One line under the name. */
  detail?: string;
  /** A short fact at the end of the line: when, a key. */
  meta?: string;
  icon: LucideIcon;
  /** A miniature of the thing in the place of the icon, when it has one. */
  leading?: ReactNode;
  /** A larger miniature of the thing, shown beside the results while it is in hand. */
  picture?: ReactNode;
  /** Other words it answers to. */
  keywords?: string;
  /** Shown before anything is typed. */
  first?: boolean;
  /** What the side of the search says about it. */
  facts?: { label: string; value: string }[];
  note?: { label: string; text: string };
  onSelect: () => void;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** The name of the search for a screen reader. */
  label: string;
  placeholder: string;
  /** The kinds of thing the search can be cut to, after "everything". */
  scopes: { id: string; label: string }[];
  items: PaletteItem[];
  /** What whatever was typed can become, ahead of every result: a request to the AI. */
  typed?: (text: string) => PaletteItem | undefined;
};

const ALL = "all";
/** How many results of one group the search of everything shows. */
const PER_GROUP = 6;

const plain = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

function Key({ children }: { children: ReactNode }) {
  return <kbd className={styles.key}>{children}</kbd>;
}

/**
 * The search of the whole product. Typing finds conversations, contents, stories and screens at
 * once; the pills cut it to one kind; the arrows move through the results and Enter opens the
 * one in hand, which the side shows before it is opened.
 */
export function Palette({ open, onClose, label, placeholder, scopes, items, typed }: Props) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement | null>(null);
  const field = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState(ALL);
  const [hand, setHand] = useState(0);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      setQuery("");
      setScope(ALL);
      setHand(0);
      element.showModal();
      field.current?.focus();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  const wanted = plain(query.trim());
  const groups = useMemo(() => {
    const asked = wanted ? typed?.(query.trim()) : undefined;
    const found = items
      .filter((item) => scope === ALL || item.scope === scope)
      .filter((item) =>
        wanted
          ? plain(`${item.label} ${item.detail ?? ""} ${item.keywords ?? ""}`).includes(wanted)
          : scope !== ALL || item.first,
      );
    const names = [...new Set(found.map((item) => item.group))];
    const listed = names.map((name) => ({
      name,
      items: found
        .filter((item) => item.group === name)
        .slice(0, scope === ALL ? PER_GROUP : undefined),
    }));
    return asked ? [{ name: asked.group, items: [asked] }, ...listed] : listed;
  }, [items, scope, wanted, query, typed]);
  const flat = groups.flatMap((group) => group.items);
  const inHand = flat[Math.min(hand, flat.length - 1)];
  // The result in hand stays in sight while the arrows move through a long list.
  const inHandId = inHand ? `${id}-${inHand.id}` : undefined;
  useEffect(() => {
    if (inHandId) document.getElementById(inHandId)?.scrollIntoView({ block: "nearest" });
  }, [inHandId]);

  const choose = (item: PaletteItem) => {
    onClose();
    item.onSelect();
  };
  const cut = (next: string) => {
    setScope(next);
    setHand(0);
  };
  const tabs = [
    { value: ALL, label: "Tudo" },
    ...scopes.map((entry) => ({ value: entry.id, label: entry.label })),
  ];

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes the dialog by itself
    <dialog
      ref={dialog}
      className={styles.veil}
      aria-label={label}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.panel}>
        <div className={styles.ask}>
          <Search aria-hidden="true" />
          <input
            ref={field}
            className={styles.field}
            type="text"
            inputMode="search"
            enterKeyHint="go"
            role="combobox"
            aria-label={label}
            aria-expanded="true"
            aria-controls={`${id}-results`}
            aria-activedescendant={inHandId}
            autoComplete="off"
            spellCheck={false}
            placeholder={placeholder}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setHand(0);
            }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                const step = event.key === "ArrowDown" ? 1 : -1;
                setHand((current) => (current + step + flat.length) % Math.max(flat.length, 1));
              } else if (event.key === "Enter" && inHand) {
                event.preventDefault();
                choose(inHand);
              }
            }}
          />
          <IconButton label="Fechar busca" icon={X} variant="ghost" onClick={onClose} />
        </div>
        <div className={styles.scopes}>
          <Pills label="O que buscar" size="sm" items={tabs} value={scope} onChange={cut} />
        </div>
        <div className={styles.body}>
          <div
            id={`${id}-results`}
            className={styles.results}
            role="listbox"
            aria-label="Resultados"
          >
            {flat.length === 0 ? (
              <p className={styles.none}>
                {wanted ? "Nada encontrado com essas palavras." : "Nada por aqui ainda."}
              </p>
            ) : (
              groups.map((group) => (
                // biome-ignore lint/a11y/useSemanticElements: a group of options inside a listbox
                <div key={group.name} role="group" aria-label={group.name}>
                  <p className={styles.groupLabel} aria-hidden="true">
                    {group.name}
                  </p>
                  <div className={styles.list}>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const selected = item.id === inHand?.id;
                      return (
                        <button
                          key={item.id}
                          id={`${id}-${item.id}`}
                          type="button"
                          role="option"
                          tabIndex={-1}
                          aria-selected={selected}
                          className={styles.item}
                          onMouseMove={() => setHand(flat.indexOf(item))}
                          onClick={() => choose(item)}
                        >
                          {item.leading ? (
                            <span className={styles.leading} aria-hidden="true">
                              {item.leading}
                            </span>
                          ) : (
                            <span className={styles.tile} aria-hidden="true">
                              <Icon />
                            </span>
                          )}
                          <span className={styles.text}>
                            <span className={styles.label}>{item.label}</span>
                            {item.detail ? (
                              <span className={styles.detail}>{item.detail}</span>
                            ) : null}
                          </span>
                          {item.meta ? <span className={styles.meta}>{item.meta}</span> : null}
                          <CornerDownLeft className={styles.enter} aria-hidden="true" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
          <aside className={styles.preview} aria-label="O resultado em mãos">
            {inHand ? (
              <>
                {inHand.picture ? (
                  <div className={styles.picture} aria-hidden="true">
                    {inHand.picture}
                  </div>
                ) : null}
                <div className={styles.previewHead}>
                  <span className={styles.tile} aria-hidden="true">
                    <inHand.icon />
                  </span>
                  <h2 className={styles.previewTitle}>{inHand.label}</h2>
                </div>
                {inHand.facts && inHand.facts.length > 0 ? (
                  <dl className={styles.facts}>
                    {inHand.facts.map((fact) => (
                      <div key={fact.label} className={styles.fact}>
                        <dt>{fact.label}</dt>
                        <dd>{fact.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                {inHand.note ? (
                  <div>
                    <p className={styles.noteLabel}>{inHand.note.label}</p>
                    <p className={styles.note}>{inHand.note.text}</p>
                  </div>
                ) : inHand.detail ? (
                  <p className={styles.note}>{inHand.detail}</p>
                ) : null}
                <span className={styles.open}>
                  <Key>↵</Key> Abrir
                </span>
              </>
            ) : null}
          </aside>
        </div>
        <div className={styles.foot}>
          <span className={styles.hint}>
            <Key>↑</Key>
            <Key>↓</Key> navegar
          </span>
          <span className={styles.hint}>
            <Key>↵</Key> abrir
          </span>
          <span className={styles.hint}>
            <Key>Tab</Key> percorrer controles
          </span>
          <span className={styles.hint} data-end="">
            <Key>Esc</Key> fechar
          </span>
        </div>
      </div>
    </dialog>
  );
}
