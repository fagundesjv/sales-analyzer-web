"use client";

import {
  ChevronRight,
  CircleCheck,
  CircleDashed,
  ListChecks,
  Minus,
  Pause,
} from "@content-ventures/design-system/v3/icons";
import { type ReactNode, useId, useState } from "react";
import styles from "./panel.module.css";

/** Everything the panel shows, one thing under the other. */
export function PanelStack({ children }: { children: ReactNode }) {
  return <div className={styles.stack}>{children}</div>;
}

/** One step of a plan: made, the one that comes next, still to come, or left out. */
export type PlanStep = {
  id: string;
  label: string;
  state: "done" | "next" | "upcoming" | "skipped";
  /** What the step waits for, or what it made. */
  detail?: string;
  /** What to do with the step: open what it made. */
  action?: ReactNode;
};

type PlanProps = {
  /** Where the plan stands: "Plano em pausa". */
  title: string;
  done: number;
  total: number;
  /** The plan waits for the person to go on. */
  waiting: boolean;
  steps: PlanStep[];
  /** The way to go on, at the end of the head. */
  action?: ReactNode;
};

const MARKS = { done: CircleCheck, next: Pause, upcoming: CircleDashed, skipped: Minus };

/**
 * The plan of the AI, step by step: how far it went, which step comes next and what each one
 * made. While it waits for the person it stands out from the rest of the panel.
 */
export function PanelPlan({ title, done, total, waiting, steps, action }: PlanProps) {
  const Icon = waiting ? Pause : ListChecks;
  return (
    <section
      className={styles.plan}
      data-waiting={waiting ? "" : undefined}
      aria-label={`${title}, ${done} de ${total}`}
    >
      <div className={styles.planHead}>
        <Icon className={styles.planIcon} aria-hidden="true" />
        <h3 className={styles.planTitle}>{title}</h3>
        <span className={styles.planCount}>
          {done} de {total}
        </span>
        {action}
      </div>
      <div className={styles.planBody}>
        <div className={styles.track} aria-hidden="true">
          <div
            className={styles.fill}
            style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }}
          />
        </div>
        <ol className={styles.steps}>
          {steps.map((step) => {
            const Mark = MARKS[step.state];
            return (
              <li key={step.id} className={styles.step} data-state={step.state}>
                <Mark className={styles.mark} aria-hidden="true" />
                <span className={styles.stepText}>
                  <span className={styles.stepLabel}>{step.label}</span>
                  {step.detail ? <span className={styles.stepDetail}>{step.detail}</span> : null}
                </span>
                {step.action ? <span className={styles.stepEnd}>{step.action}</span> : null}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

type SectionProps = {
  title: string;
  /** How much the section holds, beside its name. */
  meta?: string;
  /** A way to see more, at the end of the head. */
  action?: ReactNode;
  /** The section folds: its name opens and closes it. */
  folds?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
};

/** A plain section of the panel: a quiet name and what it holds, with no box around it. */
export function PanelSection({
  title,
  meta,
  action,
  folds = false,
  defaultOpen = true,
  children,
}: SectionProps) {
  const id = useId();
  const [open, setOpen] = useState(defaultOpen);
  if (folds) {
    return (
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpen((value) => !value)}
          >
            {title}
            <ChevronRight aria-hidden="true" />
          </button>
        </h3>
        {open ? <div id={id}>{children}</div> : null}
      </section>
    );
  }
  return (
    <section className={styles.section} aria-labelledby={id}>
      <div className={styles.sectionHead}>
        <h3 id={id} className={styles.sectionTitle}>
          {title}
        </h3>
        {meta ? <span className={styles.sectionMeta}>{meta}</span> : null}
        {action}
      </div>
      {children}
    </section>
  );
}

/** Facts about what is open: a name at the start of the line and its value at the end. */
export function PanelFacts({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className={styles.facts}>
      {items.map((item) => (
        <div key={item.label} className={styles.fact}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
