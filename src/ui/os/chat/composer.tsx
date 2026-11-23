"use client";

import { IconAction } from "../icon-action";
import {
  useAnnouncer,
  VisuallyHidden,
} from "@content-ventures/design-system/v3";
import {
  ArrowUp,
  LoaderCircle,
  type LucideIcon,
} from "@content-ventures/design-system/v3/icons";
import {
  type ReactNode,
  type Ref,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "react";
import {
  blankAfter,
  blankBefore,
  blanksIn,
  blanksLeft,
} from "@/domain/recipes";
import styles from "./composer.module.css";

export type ComposerStatus = "idle" | "submitting" | "error";

export type ComposerHandle = {
  focus: () => void;
  insert: (snippet: string) => void;
  /** Selects the first blank of a recipe, to be typed over; without one, the end of the text. */
  focusBlank: () => void;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Sends what is in the box. */
  onSubmit: (text: string) => void;
  status: ComposerStatus;
  /** What went wrong with the last request, in plain words. */
  error?: string;
  onRetry?: () => void;
  /** The name of the box for a screen reader. */
  label: string;
  placeholder: string;
  formLabel?: string;
  submitLabel?: string;
  submitText?: string;
  allowEmpty?: boolean;
  disabled?: boolean;
  maxLength?: number;
  minRows?: number;
  maxRows?: number;
  /** What rides with the request, above the text: the content in focus, the sources attached. */
  attached?: ReactNode;
  /** One line under what rides with the request, about it: how a news item attached is used. */
  attachedNote?: ReactNode;
  /** The tools at the start of the row: attach a source, pick a format. */
  tools?: ReactNode;
  /** How the request is taken, right after the tools. */
  mode?: ReactNode;
  /** What the AI works from, in the strip at the foot. */
  strip?: ReactNode;
  /** A line under the box. */
  note?: string;
  /**
   * The words between braces are the blanks of a recipe: the request goes only once every one is
   * filled, and Tab goes from one to the next.
   */
  fillIn?: boolean;
  /**
   * What the request still needs before it goes, in one sentence: the source of a prompt that
   * speaks of an episode. While there is one, nothing is sent and the line under the box says it.
   */
  requires?: string | null;
  ref?: Ref<ComposerHandle>;
};

/** The height of one line of the text, as the stylesheet sets it. */
const LINE = 22;
/** The room above and under the text inside its field. */
const PADDING = 18;

/**
 * The request box. Enter sends and Shift+Enter breaks the line; the box grows with the text up
 * to a limit and then scrolls. While a request is on its way nothing else is sent.
 */
export function Composer({
  value,
  onChange,
  onSubmit,
  status,
  error,
  onRetry,
  label,
  placeholder,
  formLabel,
  submitLabel,
  submitText,
  allowEmpty = false,
  disabled = false,
  maxLength,
  minRows = 1,
  maxRows = 8,
  attached,
  attachedNote,
  tools,
  mode,
  strip,
  note,
  fillIn = false,
  requires = null,
  ref,
}: Props) {
  const id = useId();
  const text = useRef<HTMLTextAreaElement | null>(null);
  const { announce, region } = useAnnouncer();
  const busy = status === "submitting";
  const empty = value.trim() === "";
  const blanks = fillIn ? blanksIn(value) : [];
  const left = blanksLeft(blanks);
  const blocked =
    busy ||
    disabled ||
    (empty && !allowEmpty) ||
    blanks.length > 0 ||
    Boolean(requires);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        const element = text.current;
        if (!element) return;
        element.focus();
        element.setSelectionRange(element.value.length, element.value.length);
      },
      insert: (snippet: string) => {
        const element = text.current;
        if (!element) return;
        const start = element.selectionStart;
        const end = element.selectionEnd;
        const budget =
          maxLength === undefined
            ? snippet.length
            : Math.max(0, maxLength - element.value.length + end - start);
        const addition = snippet.slice(0, budget);
        onChange(
          element.value.slice(0, start) + addition + element.value.slice(end),
        );
        requestAnimationFrame(() => {
          element.focus();
          element.setSelectionRange(
            start + addition.length,
            start + addition.length,
          );
        });
      },
      focusBlank: () => {
        const element = text.current;
        if (!element) return;
        element.focus();
        const [first] = blanksIn(element.value);
        if (first) element.setSelectionRange(first.from, first.to);
        else
          element.setSelectionRange(element.value.length, element.value.length);
      },
    }),
    [onChange, maxLength],
  );

  // The box takes the height of its text, between the fewest and the most lines it may show.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the text is what changes the height
  useLayoutEffect(() => {
    const element = text.current;
    if (!element) return;
    element.style.height = "auto";
    const most = maxRows * LINE + PADDING;
    element.style.height = `${Math.min(element.scrollHeight, most)}px`;
    element.style.overflowY = element.scrollHeight > most ? "auto" : "hidden";
  }, [value, maxRows, minRows]);

  const before = useRef(status);
  useEffect(() => {
    const from = before.current;
    before.current = status;
    if (from === status) return;
    if (status === "submitting") announce("Pedido enviado");
    else if (status === "idle" && from === "submitting")
      announce("Resposta concluída");
  }, [status, announce]);

  const submit = () => {
    const [first] = blanks;
    // A recipe with a blank still in it does not go: the first blank is shown to be filled.
    if (first && !busy) {
      text.current?.focus();
      text.current?.setSelectionRange(first.from, first.to);
      if (left) announce(left);
      return;
    }
    if (requires && !busy) {
      announce(requires);
      return;
    }
    if (!blocked) onSubmit(value);
  };

  return (
    <form
      className={styles.composer}
      aria-label={formLabel}
      data-status={status}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {/* The same box before and after: when the screen changes around it, it travels to its
          place (the name is the one `globals.css` gives the movement its pace by). */}
      <div
        className={styles.card}
        style={{ viewTransitionName: "os-composer" }}
      >
        <div className={styles.attached}>{attached}</div>
        {attachedNote ? (
          <p className={styles.attachedNote}>{attachedNote}</p>
        ) : null}
        <label htmlFor={id}>
          <VisuallyHidden>{label}</VisuallyHidden>
        </label>
        <textarea
          id={id}
          ref={text}
          className={styles.text}
          rows={minRows}
          enterKeyHint="send"
          disabled={disabled || busy}
          maxLength={maxLength}
          value={value}
          placeholder={placeholder}
          aria-invalid={status === "error" || undefined}
          aria-describedby={
            [error ? `${id}-error` : "", left || requires ? `${id}-blanks` : ""]
              .filter(Boolean)
              .join(" ") || undefined
          }
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            const element = event.currentTarget;
            // While a recipe has blanks, Tab goes to the next one (Shift+Tab, the one before);
            // past the last one it leaves the box, as it always does.
            if (
              event.key === "Tab" &&
              blanks.length > 0 &&
              !event.altKey &&
              !event.metaKey
            ) {
              const next = event.shiftKey
                ? blankBefore(element.value, element.selectionStart)
                : blankAfter(element.value, element.selectionEnd);
              if (!next) return;
              event.preventDefault();
              element.setSelectionRange(next.from, next.to);
              return;
            }
            if (
              event.key !== "Enter" ||
              event.shiftKey ||
              event.nativeEvent.isComposing
            )
              return;
            event.preventDefault();
            submit();
          }}
        />
        <div className={styles.tools}>
          <div className={styles.start}>
            {tools}
            {mode}
          </div>
          <div className={styles.end}>
            <IconAction
              type="submit"
              className={styles.send}
              aria-label={
                submitLabel || (busy ? "Aguarde a resposta" : "Enviar o pedido")
              }
              data-text={submitText ? "" : undefined}
              aria-disabled={blocked}
              title={
                submitLabel ||
                (busy
                  ? "Aguarde a resposta"
                  : empty
                    ? "Escreva um pedido"
                    : blanks.length > 0
                      ? "Complete os campos entre chaves"
                      : requires
                        ? "Escolha a fonte antes de enviar"
                        : "Enviar")
              }
            >
              {busy ? (
                <LoaderCircle className={styles.spin} aria-hidden="true" />
              ) : (
                <ArrowUp aria-hidden="true" />
              )}
              {submitText && <span>{submitText}</span>}
            </IconAction>
          </div>
        </div>
        <div className={styles.strip}>{strip}</div>
      </div>
      {error ? (
        <p id={`${id}-error`} className={styles.error} role="alert">
          {error}
          {onRetry ? (
            <button type="button" className={styles.retry} onClick={onRetry}>
              Tentar de novo
            </button>
          ) : null}
        </p>
      ) : null}
      {left || requires ? (
        <p id={`${id}-blanks`} className={styles.blanks}>
          {[left, requires].filter(Boolean).join(" ")}
        </p>
      ) : note ? (
        <p className={styles.note}>{note}</p>
      ) : null}
      {region}
    </form>
  );
}

/** One thing the strip at the foot says: what the AI works from, or how it is running. */
export function StripItem({
  icon: Icon,
  end = false,
  children,
}: {
  icon?: LucideIcon;
  /** Pushed to the end of the strip. */
  end?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={styles.stripItem} data-end={end ? "" : undefined}>
      {Icon ? <Icon aria-hidden="true" /> : null}
      <span className={styles.stripText}>{children}</span>
    </span>
  );
}
