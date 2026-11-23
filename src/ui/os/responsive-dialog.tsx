"use client";

import { ResponsiveDialog as ContentDialog } from "@content-ventures/design-system/v3";
import { X } from "lucide-react";
import {
  useCallback,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

function SheetTitle({
  children,
  close,
}: {
  children: ReactNode;
  close: () => void;
}) {
  const [sheet, setSheet] = useState<HTMLDialogElement | null>(null);
  const anchor = useCallback((node: HTMLSpanElement | null) => {
    setSheet(node?.closest<HTMLDialogElement>("dialog[data-snap]") ?? null);
  }, []);
  return (
    <>
      <span ref={anchor} className="sales-dialog-title">
        {children}
      </span>
      {sheet &&
        createPortal(
          <button
            type="button"
            className="sales-sheet-close"
            aria-label="Fechar painel"
            title="Fechar painel"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={close}
          >
            <X size={17} aria-hidden="true" />
          </button>,
          sheet,
        )}
    </>
  );
}

export function ResponsiveDialog(props: ComponentProps<typeof ContentDialog>) {
  const title =
    props.title && props.dismissible !== false && !props.dirty ? (
      <SheetTitle close={props.onClose}>{props.title}</SheetTitle>
    ) : (
      props.title
    );
  return (
    <ContentDialog {...props} title={title}>
      {props.children == null || props.children === false ? (
        props.children
      ) : (
        <div className="sales-sheet-content">{props.children}</div>
      )}
    </ContentDialog>
  );
}
