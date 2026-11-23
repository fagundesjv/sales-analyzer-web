"use client";

import { Minus, Plus } from "lucide-react";
import s from "./seller-count.module.css";

export const maxSeats = 999;

export function validSeats(text) {
  const value = Number(text);
  return /^\d+$/.test(text) && Number.isSafeInteger(value) && value >= 1 && value <= maxSeats;
}

export function SellerCount({ id, inputRef, quantity, onChange, hintId, disabled = false }) {
  const valid = validSeats(quantity);
  const value = Number(quantity);

  function adjust(delta) {
    onChange(String(valid ? Math.min(maxSeats, Math.max(1, value + delta)) : 1));
  }

  return (
    <div className={s.counter}>
      <button type="button" aria-label="Diminuir vendedores" title="Diminuir vendedores"
        disabled={disabled || (valid && value === 1)} onClick={() => adjust(-1)}>
        <Minus size={16} aria-hidden="true" />
      </button>
      <input id={id} ref={inputRef} type="number" inputMode="numeric" min={1} max={maxSeats}
        step={1} value={quantity} disabled={disabled} onChange={event => onChange(event.target.value)}
        aria-invalid={!valid} aria-describedby={valid ? undefined : hintId} />
      <button type="button" aria-label="Aumentar vendedores" title="Aumentar vendedores"
        disabled={disabled || (valid && value === maxSeats)} onClick={() => adjust(1)}>
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
