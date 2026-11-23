"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { Input } from "@content-ventures/design-system/v3";
import { parseMoney } from "../lib/operation";

// Operators enter reais. Preserve a partially typed decimal until they leave the field.
export function reaisFromCents(cents) {
  const amount = BigInt(cents);
  return (amount / 100n).toLocaleString("pt-BR") + "," + String(amount % 100n).padStart(2, "0");
}

export function ReaisField({value = "", onValueChange, allowZero = false, maxCents, ...props}) {
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const errorId = useId();
  const cents = parseMoney(String(value), {allowZero, maxCents});
  const error = !editing && value !== "" && cents === null;
  const display = !dirty && cents !== null ? reaisFromCents(cents) : value;
  return <>
    <Input {...props} prefix="R$" inputMode="decimal" autoComplete="off" placeholder="0,00"
      value={display} invalid={error} aria-describedby={error ? errorId : undefined}
      onFocus={() => setEditing(true)}
      onBlur={() => {
        setEditing(false);
        setDirty(false);
        if (cents !== null) onValueChange(reaisFromCents(cents));
      }}
      onChange={e => {
        setDirty(true);
        const text = e.target.value.replace(/^\s*R\$\s*/, "");
        e.target.setCustomValidity(text && parseMoney(text, {allowZero, maxCents}) === null ? "Confira o valor em reais." : "");
        onValueChange(text);
      }} />
    {error && <small id={errorId} className="field-error">Informe um valor em reais, como 1.250,50.</small>}
  </>;
}

export function formatLinePhone(text = "") {
  if (!text || !/^\+?[\d\s().-]*$/.test(text)) return text;
  const digits = text.replace(/\D/g, "");
  const plus = text.startsWith("+");
  const br = digits.startsWith("55") && (plus || digits.length === 12 || digits.length === 13);
  if ((plus && !br) || (digits.length > 11 && !br) || digits.length > 13) return (plus ? "+" : "") + digits;
  const number = br ? digits.slice(2) : digits;
  const prefix = br ? "+55 " : "";
  if (number.length <= 2) return (prefix + number).trimEnd();
  const local = number.slice(2);
  const split = local.length > 8 ? 5 : 4;
  return prefix + "(" + number.slice(0, 2) + ") " + local.slice(0, split) + (local.length > split ? "-" + local.slice(split) : "");
}

export function linePhoneKey(value = "") {
  const digits = value.replace(/\D/g, "");
  if (!/^\+?[\d\s().-]+$/.test(value.trim())) return "";
  if (value.trim().startsWith("+") || digits.length > 11) {
    const valid = digits.startsWith("55") ? /^55[1-9]\d{9,10}$/.test(digits) : /^[1-9]\d{7,14}$/.test(digits);
    return valid ? "+" + digits : "";
  }
  return /^[1-9]\d{9,10}$/.test(digits) ? "+55" + digits : "";
}

export function LinePhoneField({value, onValueChange, required = true, name}) {
  const ref = useRef(null);
  const caret = useRef(null);
  const [touched, setTouched] = useState(false);
  const errorId = useId();
  const formatted = formatLinePhone(value);
  useLayoutEffect(() => {
    if (caret.current === null || document.activeElement !== ref.current) return;
    const digitsBeforeCaret = caret.current;
    let pos = 0, seen = 0;
    while (pos < formatted.length && seen < digitsBeforeCaret) {
      if (/\d/.test(formatted[pos++])) seen++;
    }
    ref.current.setSelectionRange(pos, pos);
    caret.current = null;
  }, [formatted]);
  const invalid = touched && value && !linePhoneKey(value);
  return <>
    <input ref={ref} required={required} name={name} type="tel" autoComplete="tel" inputMode="tel" maxLength={32}
      placeholder="(11) 98765-4321" value={formatted} aria-invalid={!!invalid}
      aria-describedby={invalid ? errorId : undefined} onBlur={() => setTouched(true)}
      onChange={e => {
        const el = e.currentTarget;
        el.setCustomValidity("");
        let raw = el.value.trimStart();
        let cursor = el.selectionStart ?? raw.length;
        const kind = e.nativeEvent.inputType;
        // Deleting a separator should also remove the adjacent digit on virtual keyboards.
        if (formatLinePhone(raw) === formatted && raw !== formatted) {
          if (kind === "deleteContentBackward") {
            const match = raw.slice(0, cursor).match(/\d(?=\D*$)/);
            if (match) { raw = raw.slice(0, match.index) + raw.slice(match.index + 1); cursor = match.index; }
          } else if (kind === "deleteContentForward") {
            const index = raw.slice(cursor).search(/\d/);
            if (index >= 0) raw = raw.slice(0, cursor + index) + raw.slice(cursor + index + 1);
          }
        }
        const next = formatLinePhone(raw);
        if (cursor < raw.length) {
          caret.current = raw.slice(0, cursor).replace(/\D/g, "").length;
        } else caret.current = null;
        onValueChange(next);
      }} />
    {invalid && <small id={errorId} className="field-error">Inclua o DDD ou use + e o código do país.</small>}
  </>;
}

// Keep the caret anchored to the edited character as punctuation is inserted or removed.
export function MaskedIdentifier({ format, characters, limit, value, onValueChange, ...props }) {
  const displayed = format(value);
  function change(event) {
    const input = event.currentTarget;
    const raw = input.value;
    const offset = input.selectionStart ?? raw.length;
    const tokens = text => Array.from(text).filter(c => characters.test(c));
    const before = tokens(raw.slice(0, offset));
    const after = tokens(raw.slice(offset));
    if (raw.length < displayed.length && format(raw) === displayed) {
      // A native delete removed just a separator. Also delete the digit on that side.
      if (event.nativeEvent.inputType === "deleteContentBackward") before.pop();
      if (event.nativeEvent.inputType === "deleteContentForward") after.shift();
    }
    before.length = Math.min(before.length, Math.max(0, limit - after.length));
    const formatted = format(before.concat(after).join(""));
    let caret = 0;
    let remaining = before.length;
    while (caret < formatted.length && remaining > 0) {
      if (characters.test(formatted[caret])) remaining--;
      caret++;
    }
    input.value = formatted;
    input.setSelectionRange(caret, caret);
    input.setCustomValidity("");
    onValueChange(formatted);
  }
  return <input {...props} value={displayed} onChange={change} />;
}

const clockRange = /^([01]\d:[0-5]\d|2[0-3]:[0-5]\d)\s*[–-]\s*([01]\d:[0-5]\d|2[0-3]:[0-5]\d)$/;
export function OfficeHours({ value, onChange }) {
  const initial = clockRange.exec(value);
  const [custom, setCustom] = useState(!initial);
  const [hours, setHours] = useState(initial ? initial.slice(1) : ["", ""]);
  const lastDescription = useRef(custom ? value : "");
  function update(next) {
    setHours(next);
    onChange(next.every(Boolean) ? next.join("–") : "");
  }
  return <div className="office-hours">
    <div className="hours-label"><span>Expediente</span>
      <button type="button" onClick={() => {
        if (custom) { lastDescription.current = value; update(hours); }
        else onChange(lastDescription.current || value);
        setCustom(!custom);
      }}>{custom ? "Usar horários" : "Usar descrição"}</button>
    </div>
    {custom ? <input required name="hoursDescription" aria-label="Expediente" value={value} onChange={e => { e.target.setCustomValidity(""); onChange(e.target.value); }}
      placeholder="Dias e horários de atendimento" /> :
      <div className="hours-range">
        <input required type="time" aria-label="Início do expediente" value={hours[0]} onChange={e => update([e.target.value, hours[1]])} />
        <span>às</span><input required type="time" aria-label="Fim do expediente" value={hours[1]} onChange={e => update([hours[0], e.target.value])} />
      </div>}
  </div>;
}

export function Field({ label, children }) {
  return (
    <label className="op-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
