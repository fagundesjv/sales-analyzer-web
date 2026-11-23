"use client";

import { IconLink, IconAction } from "../icon-action";
import { AppShell, Badge, IconButton, VisuallyHidden } from "@content-ventures/design-system/v3";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
  Menu as MenuIcon,
  PanelLeftClose,
  PanelLeftOpen,
  PenLine,
  Search,
  X,
} from "@content-ventures/design-system/v3/icons";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import styles from "./os-shell.module.css";

/** One area of the product, as the rail shows it: an icon that opens the area. */
export type RailArea = {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  /** Something in the area waits for the person. */
  waiting?: boolean;
  /** The whole area waits for the backend: it is shown, dimmed, and says so. */
  soon?: boolean;
};

type Slots = {
  title: HTMLElement | null;
  actions: HTMLElement | null;
  setFocus: (on: boolean) => void;
};
const SlotContext = createContext<Slots>({ title: null, actions: null, setFocus: () => {} });

/**
 * Asks the frame for room: while the open screen works on something wide, the column of the
 * area steps aside. The button at the top still brings it back, and it comes back by itself
 * when the screen stops asking.
 */
export function useShellFocus(on: boolean) {
  const { setFocus } = useContext(SlotContext);
  useEffect(() => {
    setFocus(on);
    return () => setFocus(false);
  }, [on, setFocus]);
}

/** Puts something in the middle of the bar at the top: the name of what is open, with its menu. */
export function BarTitle({ children }: { children: ReactNode }) {
  const { title } = useContext(SlotContext);
  return title ? createPortal(children, title) : null;
}

/** Puts controls of the open screen at the end of the bar at the top, before the search. */
export function BarActions({ children }: { children: ReactNode }) {
  const { actions } = useContext(SlotContext);
  return actions ? createPortal(children, actions) : null;
}

type Props = {
  /** The name of the product, read on the mark at the top of the rail. */
  product: string;
  mark: ReactNode;
  /** Where the mark leads. */
  home: string;
  areas: RailArea[];
  /** The areas that stand at the bottom of the rail. */
  lower: RailArea[];
  /** The area the open screen belongs to. */
  active: string | undefined;
  /** What stands at the very end of the rail: the person. */
  account: ReactNode;
  /** The column of the area: its menu, or the list of what it holds. */
  column?: ReactNode;
  columnLabel?: string;
  /** What closes the column: the fair being worked on. */
  columnFoot?: ReactNode;
  /** A wider column, for a list of things with a name. */
  wide?: boolean;
  /** The way up from a screen that lives inside another: "← Pautas". */
  back?: { label: string; href: string; mobileOnly?: boolean; onClick?: React.MouseEventHandler<HTMLAnchorElement> };
  /** Starts a new conversation from the bar, where the column does not offer it. */
  newHref?: string;
  /** A short notice at the end of the bar; in a narrow window it shrinks to a dot. */
  notice?: string;
  /** The address on screen: a new one closes what was opened over the page. */
  location: string;
  phoneAreas?: RailArea[];
  onSearch: () => void;
  onBack: () => void;
  onForward: () => void;
  children: ReactNode;
};

/** The width under which the rail and the column open over the page, as the stylesheet has it. */
const NARROW = "(max-width: 860px)";

function AreaLink({ area, active }: { area: RailArea; active: boolean }) {
  const Icon = area.icon;
  return (
    <IconLink
      href={area.href}
      className={styles.area}
      aria-current={active ? "page" : undefined}
      aria-label={
        area.soon
          ? `${area.label}, em breve`
          : area.waiting
            ? `${area.label}, com pendências`
            : area.label
      }
      title={area.soon ? `${area.label} · em breve` : area.label}
      data-soon={area.soon ? "" : undefined}
    >
      <Icon aria-hidden="true" />
      <span className={styles.areaLabel} aria-hidden="true">
        {area.label}
      </span>
      {area.waiting && !area.soon ? <span className={styles.dot} aria-hidden="true" /> : null}
    </IconLink>
  );
}

/**
 * The frame every screen of a fair opens in. On the left a rail with the areas; beside it, inside
 * the sheet, the column of the area the person is in; then the page. The bar at the top holds
 * the ways around: hide the column, go back, start a conversation, search.
 */
export function OsShell(props: Props) {
  const { column, location } = props;
  /** The person put the column away or brought it back; until then the open screen decides. */
  const [choice, setChoice] = useState<boolean | null>(null);
  /** The open screen asked for room: the column steps aside. */
  const [focus, setFocusOn] = useState(false);
  const setFocus = useCallback((on: boolean) => {
    setFocusOn(on);
    // What the screen asks is where the column starts from; the person can still change it.
    setChoice(null);
  }, []);
  const hidden = choice ?? focus;
  /** In a narrow window the rail and the column open over the page. */
  const [navOpen, setNavOpen] = useState(false);
  const [title, setTitle] = useState<HTMLElement | null>(null);
  const [actions, setActions] = useState<HTMLElement | null>(null);
  const slots = useMemo(() => ({ title, actions, setFocus }), [title, actions, setFocus]);

  const toggle = () => setChoice(!hidden);

  const rail = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const sync = () => {
      // Some mobile browsers resize only the visual viewport when a keyboard opens.
      const gap = viewport.scale === 1 ? Math.max(0, innerHeight - viewport.height - viewport.offsetTop) : 0;
      document.documentElement.style.setProperty("--sales-keyboard", Math.round(gap) + "px");
    };
    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      document.documentElement.style.removeProperty("--sales-keyboard");
    };
  }, []);
  const controls = useRef<HTMLDivElement | null>(null);
  // Going somewhere closes what was open over the page.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the address is the signal
  useEffect(() => setNavOpen(false), [location]);
  // The menu opens over the page only in a narrow window: a window that grows closes it.
  useEffect(() => {
    const narrow = window.matchMedia(NARROW);
    const onChange = () => {
      if (!narrow.matches) setNavOpen(false);
    };
    narrow.addEventListener("change", onChange);
    return () => narrow.removeEventListener("change", onChange);
  }, []);
  // Open over the page, the menu takes the focus, Escape closes it and the focus goes back to
  // the button that opened it.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (!navOpen) {
      if (wasOpen.current) controls.current?.querySelector("button")?.focus();
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    const here = rail.current?.querySelector<HTMLElement>("a[aria-current]");
    (here ?? rail.current?.querySelector<HTMLElement>("a"))?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  const state = column ? (hidden ? "closed" : "open") : "none";
  return (
    <SlotContext.Provider value={slots}>
      <div
        className={styles.shell}
        data-column={state}
        data-wide={props.wide ? "" : undefined}
        data-nav-open={navOpen ? "" : undefined}
        data-phone-tabs={props.phoneAreas ? "" : undefined}
      >
        <a href="#os-page" className={styles.skip} onClick={(event) => { event.preventDefault(); document.getElementById("os-page")?.focus(); }}>
          Pular para o conteúdo
        </a>
        <header className={styles.bar} inert={navOpen || undefined}>
          <div className={styles.barStart}>
            <div className={styles.controls} ref={controls}>
              <IconButton
                className={styles.menuButton}
                label="Abrir o menu"
                icon={MenuIcon}
                variant="ghost"
                size="sm"
                aria-expanded={navOpen}
                onClick={() => setNavOpen(true)}
              />
              {column ? (
                <IconButton
                  className={styles.desktop}
                  label={hidden ? "Mostrar a coluna" : "Esconder a coluna"}
                  icon={hidden ? PanelLeftOpen : PanelLeftClose}
                  variant="ghost"
                  size="sm"
                  aria-pressed={!hidden}
                  onClick={toggle}
                />
              ) : null}
              <IconButton
                className={styles.desktop}
                label="Voltar"
                icon={ChevronLeft}
                variant="ghost"
                size="sm"
                onClick={props.onBack}
              />
              <IconButton
                className={styles.desktop}
                label="Avançar"
                icon={ChevronRight}
                variant="ghost"
                size="sm"
                onClick={props.onForward}
              />
              {props.newHref ? (
                <IconLink
                  href={props.newHref}
                  className={styles.back}
                  aria-label="Nova conversa"
                  title="Nova conversa"
                >
                  <PenLine aria-hidden="true" />
                </IconLink>
              ) : null}
            </div>
            {props.back ? (
              <a href={props.back.href} onClick={props.back.onClick} className={styles.back} data-settings-back={props.back.mobileOnly || undefined} aria-label={"Voltar para " + props.back.label}>
                <ArrowLeft aria-hidden="true" />
                <span>{props.back.label}</span>
              </a>
            ) : null}
          </div>
          <div className={styles.barCenter} ref={setTitle} />
          <div className={styles.barEnd}>
            {props.notice ? (
              <span className={styles.notice} title={props.notice}>
                <Badge tone="amber" dot>
                  {props.notice}
                </Badge>
              </span>
            ) : null}
            <div className={styles.slot} ref={setActions} />
            <IconAction
              type="button"
              className={styles.search}
              aria-label="Pedir ou buscar"
              title="Pedir ou buscar"
              onClick={props.onSearch}
            >
              <Search aria-hidden="true" />
              <span className={styles.searchLabel}>Buscar na operação</span>
              <kbd>⌘K</kbd>
            </IconAction>
          </div>
        </header>
        <nav onClick={(event) => { if ((event.target as Element).closest("a")) setNavOpen(false); }} className={styles.rail} aria-label="Áreas" ref={rail}>
          {navOpen && <IconButton label="Fechar navegação" icon={X} variant="ghost" onClick={() => setNavOpen(false)} />}
          <IconLink href={props.home} className={styles.mark} title={props.product}>
            {props.mark}
            <VisuallyHidden>{props.product}: início</VisuallyHidden>
          </IconLink>
          <ul className={styles.areas}>
            {props.areas.map((area) => (
              <li key={area.id}>
                <AreaLink area={area} active={area.id === props.active} />
              </li>
            ))}
          </ul>
          <div className={styles.railEnd}>
            {props.lower.map((area) => (
              <AreaLink key={area.id} area={area} active={area.id === props.active} />
            ))}
            <div className={styles.account}>{props.account}</div>
          </div>
        </nav>
        <div className={styles.sheet}>
          {column ? (
            <aside className={styles.column} aria-label={props.columnLabel} onClick={(event) => { if ((event.target as Element).closest("a")) setNavOpen(false); }}>
              <div className={styles.columnBody}>{column}</div>
              {props.columnFoot ? (
                <div className={styles.columnFoot}>{props.columnFoot}</div>
              ) : null}
            </aside>
          ) : null}
          {/* With the menu open over the page, the page waits behind it. */}
          <div
            id="os-page"
            className={styles.main}
            data-part="page"
            tabIndex={-1}
            inert={navOpen || undefined}
          >
            {props.children}
          </div>
        </div>
        {props.phoneAreas && (
          <nav className={styles.phoneTabs} aria-label="Navegação principal" inert={navOpen || undefined}>
            {props.phoneAreas.map(({ id, href, icon: Icon, label }) => (
              <a key={id} href={href} aria-current={id === props.active ? "page" : undefined}>
                <Icon size={19} aria-hidden="true" /><span>{label}</span>
              </a>
            ))}
          </nav>
        )}
        <button
          type="button"
          className={styles.veil}
          aria-label="Fechar o menu"
          tabIndex={-1}
          onClick={() => setNavOpen(false)}
        />
      </div>
    </SlotContext.Provider>
  );
}

/**
 * The page inside the sheet, with the margins and the scroll every screen of the Design System
 * expects. A work area that fills the sheet edge to edge (`docked`) takes no margin; it measures
 * its own height from the window, so the page tells it how much the frame takes.
 */
export function SheetPage({ docked, children }: { docked: boolean; children: ReactNode }) {
  return (
    <AppShell layout="immersive" fill bleed={docked} sidebar={null} className={styles.page}>
      {docked ? children : <div className="sales-page">{children}</div>}
    </AppShell>
  );
}
