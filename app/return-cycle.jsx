"use client";
import { useState } from "react";
import { Button, } from "@content-ventures/design-system/v3";
import { ResponsiveDialog } from "../src/ui/os/responsive-dialog";
import { CalendarClock } from "lucide-react";
import {
  cyclePresets,
  followupAfterOutcome,
  validDays,
} from "../lib/follow-up";

export function ReturnCycle({ ops, change }) {
  const [open, setOpen] = useState(false);
  const [sector, setSector] = useState("loja");
  const [schedule, setSchedule] = useState("");
  const [later, setLater] = useState({});
  const days = schedule.split(",").map(part => /^\d{1,2}$/.test(part.trim()) ? Number(part.trim()) : NaN);
  return (
    <>
      <Button
        size="sm"
        icon={CalendarClock}
        onClick={() => {
          setLater(ops.returnCycle?.later || {});
          setSector(ops.returnCycle?.sector || "loja");
          setSchedule(
            (ops.returnCycle?.days || cyclePresets.loja.days).join(", "),
          );
          setOpen(true);
        }}
      >
        Configurar ciclo de retornos
      </Button>
      <ResponsiveDialog
        footer={
          <Button
            form="ciclo-retornos"
            type="submit"
            variant="primary"
            disabled={!validDays(days)}
          >
            {" "}
            Salvar ciclo{" "}
          </Button>
        }
        open={open}
        title="Ciclo de retornos"
        onClose={() => setOpen(false)}
      >
        <form
          id="ciclo-retornos"
          className="op-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!validDays(days)) return;
            change(
              { returnCycle: { sector, days, later } },
              {
                kind: "Ciclo de retornos atualizado",
                detail: days.map((n) => "D+" + n).join(" · "),
              },
            );
            setOpen(false);
          }}
        >
          <p>
            Escolha quando a equipe deve retomar uma proposta. O ciclo fica
            disponível ao agendar um follow-up na conversa.
          </p>
          <label className="op-field">
            Modelo por setor
            <select
              value={sector}
              onChange={(e) => {
                setSector(e.target.value);
                setSchedule(cyclePresets[e.target.value].days.join(", "));
              }}
            >
              {Object.entries(cyclePresets).map(([key, p]) => (
                <option value={key} key={key}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="op-field">
            Dias após a data de referência
            <input
              required
              autoComplete="off" spellCheck={false} placeholder="1, 3, 7"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              aria-describedby="cycle-hint" aria-invalid={!validDays(days)}
            />
          </label>
          <small id="cycle-hint" className={validDays(days) ? undefined : "field-error"}>
            Informe até seis dias em ordem crescente, de 1 a 90, separados por
            vírgula.
          </small>
          <details className="fold">
            <summary>Retornos após o desfecho</summary>
            {followupAfterOutcome.map((rule) => (
              <div key={rule.id}>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={!!later[rule.id]}
                    onChange={(e) =>
                      setLater({
                        ...later,
                        [rule.id]: e.target.checked
                          ? { days: rule.days }
                          : null,
                      })
                    }
                  />
                  {rule.label}
                </label>
                {later[rule.id] && (
                  <label className="op-field">
                    Dias até {rule.label.toLowerCase()}
                    <input
                      type="number" inputMode="numeric"
                      required
                      min={rule.min}
                      max={rule.max}
                      step="1"
                      value={later[rule.id].days}
                      onChange={(e) =>
                        setLater({
                          ...later,
                          [rule.id]: {
                            days:
                              e.target.value === ""
                                ? ""
                                : Number(e.target.value),
                          },
                        })
                      }
                    />
                  </label>
                )}
              </div>
            ))}
          </details>
        </form>
      </ResponsiveDialog>
    </>
  );
}
