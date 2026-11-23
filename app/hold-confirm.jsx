"use client";
import { IconAction } from "../src/ui/os/icon-action";
import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";

/** A short activation uses the confirmation dialog. A deliberate hold confirms on release. */
export function HoldConfirm({ onConfirm, onClick }) {
  const started = useRef(null);
  const consumed = useRef(false);
  const [holding, setHolding] = useState(false);
  function reset() {
    started.current = null;
    setHolding(false);
  }
  return (
    <IconAction
      type="button"
      className="sales-hold"
      aria-label="Apagar pergunta"
      title="Clique para revisar ou segure e solte para apagar"
      data-holding={holding}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        consumed.current = false;
        started.current = performance.now();
        setHolding(true);
      }}
      onPointerLeave={reset}
      onPointerCancel={reset}
      onBlur={reset}
      onPointerUp={() => {
        if (
          started.current !== null &&
          performance.now() - started.current >= 800
        ) {
          consumed.current = true;
          onConfirm();
        }
        reset();
      }}
      onClick={() => {
        if (!consumed.current) onClick();
        consumed.current = false;
      }}
    >
      <Trash2 size={13} />
      {holding ? "Solte após preencher" : "Apagar"}
    </IconAction>
  );
}
