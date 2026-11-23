"use client";

import {
  ChevronRight,
  CircleCheck,
  CircleDashed,
  History,
  LoaderCircle,
} from "@content-ventures/design-system/v3/icons";
import { type ReactNode, useEffect, useId, useState } from "react";
import styles from "./turns.module.css";

/** What the person asked: a bubble at the end of the line, with what rode along under it. */
export function Ask({
  children,
  attached,
}: {
  /** Read by the conversation, which follows the end when the person sends something. */
  role: "user";
  children: ReactNode;
  /** The sources that came with the request. */
  attached?: ReactNode;
}) {
  return (
    <div className={styles.ask}>
      <p className={styles.bubble}>{children}</p>
      {attached ? <div className={styles.askAttached}>{attached}</div> : null}
    </div>
  );
}

/** One step of the work of the AI, as the line above the answer lists it. */
export type AnswerStep = {
  id: string;
  label: string;
  /** What the step used or made: "Regras da feira, a memória e 1 fonte anexada". */
  detail?: string;
  state: "done" | "current" | "upcoming";
};

type AnswerProps = {
  role: "assistant";
  /** Who answers, for a screen reader: "Content OS". */
  name: string;
  /** The answer is still being made: its steps show as they go, and the card waits. */
  working: boolean;
  /** How the work went, in one line: "Feito em 4 passos". */
  summary?: string;
  steps?: AnswerStep[];
  /** The steps start in sight: the answer has just arrived. */
  open?: boolean;
  /**
   * While the AI works, one live line in plain words that follows where the work really stands
   * ("Escrevendo a matéria…"), in place of a list of steps (João, 17/11: the thinking "não tá bom").
   */
  activity?: string;
  /** How long the work has taken so far, said quietly beside the line. */
  elapsed?: string;
  /** When it was answered and what it cost, at the foot of the card. */
  meta?: string;
  /** The few things to do with the answer, at the foot of the card. */
  actions?: ReactNode;
  children?: ReactNode;
};

/**
 * What the AI answered. One line says how the work went and opens its steps; the answer itself
 * is a card, with what to do with it at the foot. While the AI works the line shows the step it
 * is in and the card is not there yet.
 */
export function Answer({
  name,
  working,
  summary,
  steps = [],
  open = false,
  activity,
  elapsed,
  meta,
  actions,
  children,
}: AnswerProps) {
  const id = useId();
  const [expanded, setExpanded] = useState(open);
  // The steps fold away by themselves once, when the work ends.
  useEffect(() => {
    if (!working) setExpanded(false);
  }, [working]);
  const current = steps.find((step) => step.state === "current");
  const said = working ? (activity ?? current?.label ?? "Trabalhando no pedido") : summary;
  const shown = working || expanded;
  return (
    <article className={styles.answer} aria-label={`Resposta do ${name}`} aria-busy={working}>
      {said ? (
        <div className={styles.activity}>
          <button
            type="button"
            className={styles.line}
            data-plain={steps.length === 0 ? "" : undefined}
            aria-expanded={steps.length > 0 ? shown : undefined}
            aria-controls={steps.length > 0 ? id : undefined}
            onClick={() => setExpanded((value) => !value)}
          >
            {working ? (
              <LoaderCircle className={styles.state} data-working="" aria-hidden="true" />
            ) : (
              <CircleCheck className={styles.state} aria-hidden="true" />
            )}
            {/* A new phrase comes in softly: the line never jumps from one to the next. */}
            <span key={said} className={styles.summary} data-working={working ? "" : undefined}>
              {said}
            </span>
            {working && elapsed ? <span className={styles.elapsed}>{elapsed}</span> : null}
            {steps.length > 0 ? (
              <ChevronRight className={styles.chevron} aria-hidden="true" />
            ) : null}
          </button>
          {steps.length > 0 ? (
            // The steps keep their place and give or take their height: no cut either way.
            <div className={styles.reveal} data-open={shown ? "" : undefined}>
              <div className={styles.revealed}>
                <ol
                  id={id}
                  className={styles.steps}
                  aria-label="Passos da IA"
                  inert={shown ? undefined : true}
                >
                  {steps.map((step) => {
                    const Mark =
                      step.state === "done"
                        ? CircleCheck
                        : step.state === "current"
                          ? LoaderCircle
                          : CircleDashed;
                    return (
                      <li key={step.id} className={styles.step} data-state={step.state}>
                        <Mark className={styles.stepMark} aria-hidden="true" />
                        <span className={styles.stepLabel}>{step.label}</span>
                        {step.detail ? (
                          <span className={styles.stepDetail}>{step.detail}</span>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {working || !children ? null : (
        <div className={styles.card}>
          <div className={styles.body}>{children}</div>
          {actions || meta ? (
            <div className={styles.foot}>
              {actions}
              {meta ? <span className={styles.meta}>{meta}</span> : null}
            </div>
          ) : null}
        </div>
      )}
    </article>
  );
}

/** A paragraph of the answer, as the AI wrote it. */
export function AnswerText({ children }: { children: string }) {
  return <p className={styles.text}>{children}</p>;
}

/**
 * What became of a change the AI made, under its card: where the content stands because of it,
 * and the way back to how it was before.
 */
export function AnswerChange({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className={styles.change}>
      <History className={styles.changeIcon} aria-hidden="true" />
      <span className={styles.changeText}>{children}</span>
      {action}
    </div>
  );
}

type ContentProps = {
  /** The miniature of the content, as it goes out. */
  thumb: ReactNode;
  title: string;
  /** One line about the content: what it is, how long. */
  meta?: ReactNode;
  /** What to do with it, at the end of the card; it stays above the click of the card. */
  actions?: ReactNode;
  /** Opens the content; the whole card answers the click. */
  href?: string;
  onOpen?: () => void;
};

/**
 * A content the AI made, inside its answer: the miniature of the content as it goes out, its
 * name and a line about it. The whole card opens it.
 */
export function AnswerContent({ thumb, title, meta, actions, href, onOpen }: ContentProps) {
  const name = <span className={styles.madeName}>{title}</span>;
  return (
    <div className={styles.made}>
      {thumb}
      <div className={styles.madeText}>
        {href ? (
          <a className={styles.madeOpen} href={href}>
            {name}
          </a>
        ) : (
          <button type="button" className={styles.madeOpen} onClick={onOpen}>
            {name}
          </button>
        )}
        {meta ? <span className={styles.madeMeta}>{meta}</span> : null}
      </div>
      {actions ? <div className={styles.madeActions}>{actions}</div> : null}
    </div>
  );
}

/** The requests the last answer offers next, in one line above the request box. */
export function NextRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a group of buttons, not a form fieldset
    <div className={styles.next} role="group" aria-label={label}>
      {children}
    </div>
  );
}
