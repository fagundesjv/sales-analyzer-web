"use client";
import { IconAction, IconLink } from "../src/ui/os/icon-action";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, } from "@content-ventures/design-system/v3";
import { ResponsiveDialog } from "../src/ui/os/responsive-dialog";
import { Pause, Play, SkipForward, Square } from "lucide-react";
import { focusClock, focusWindow } from "../lib/official/focus";
import { currentModel, focusUpdate, focusReceipt } from "../lib/focus-round";
import { nextFocusHref, recoveryQueue } from "../lib/recovery-queue";
import { channels } from "../lib/inbox";
import { contactsOf, money } from "../lib/operation";
import st from "./focus.module.css";

const duration = (ms) =>
  !Number.isFinite(ms)
    ? "Sem medição"
    : Math.floor(ms / 60000) + " min " + Math.floor((ms % 60000) / 1000) + " s";

export function FocusControls({
  ops,
  change,
  setup,
  onClose,
  source,
  current,
  onStart,
  queueSlot,
  threadSlot,
  selected,
}) {
  const round = ops.focus;
  const [owner, setOwner] = useState(round?.owner || "");
  const [dialog, setDialog] = useState("");
  const [now, setNow] = useState(Date.now);
  const [minute, setMinute] = useState(ops.focusMinute ?? 0);
  const [barHost, setBarHost] = useState(null);
  const last = ops.focusHistory?.[0];
  const wasActive = useRef(!!round);
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 700px)");
    function place() {
      setBarHost(
        threadSlot && mobile.matches && selected ? threadSlot : queueSlot,
      );
    }
    place();
    mobile.addEventListener("change", place);
    return () => {
      mobile.removeEventListener("change", place);
    };
  }, [queueSlot, threadSlot, selected]);
  useEffect(() => {
    if (wasActive.current && !round && last) setDialog("receipt");
    wasActive.current = !!round;
  }, [round, last]);
  useEffect(() => {
    if (!round || round.paused) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [!!round, round?.paused]);
  const list = recoveryQueue(ops).filter((r) => !owner || r.owner === owner);
  const first =
    source && (!owner || source.contact.owner === owner) ? source : list[0];
  const nextHref =
    current && round ? nextFocusHref(ops, current.thread.id) : "#entrada";
  const model = round && currentModel(round);
  const elapsed = model
    ? Math.min(
        600000,
        model.elapsedMs +
          (round.paused ? 0 : Math.max(0, now - model.lastTick)),
      )
    : 0;
  function start() {
    if (!first || round) return;
    const time = Date.now();
    const begun = focusUpdate(
      { owner, handled: [] },
      { type: "start", now: time },
    );
    change({
      focus: focusUpdate(begun, {
        type: "action",
        kind: "opened",
        id: first.thread.id,
        now: time,
      }),
    });
    setNow(time);
    onStart(first.thread.id);
  }
  function act(type) {
    if (!round) return;
    const time = Date.now();
    setNow(time);
    const next = focusUpdate(round, { type, now: time });
    if (type === "end") {
      change(
        {
          focus: null,
          focusHistory: [focusReceipt(next), ...(ops.focusHistory || [])],
        },
        { kind: "Rodada encerrada", detail: round.owner || "Toda a equipe" },
      );
      setDialog("receipt");
    } else change({ focus: next });
  }
  return (
    <>
      {round &&
        barHost &&
        createPortal(
          <section
            className={st.inlineBar}
            data-docked={barHost === queueSlot}
            aria-label="Rodada de foco"
            data-paused={!!round.paused}
          >
            <div className={st.roundTitle}>
              <span
                className={st.roundDial}
                style={{ "--remaining": 100 - elapsed / 6000 + "%" }}
              >
                <img
                  src="/assets/idle_thumbnail.png"
                  width="20"
                  height="20"
                  alt=""
                />
              </span>
              <span>
                <strong>Foco da Zoe</strong>
                <small>
                  {round.paused ? "Pausado" : round.owner || "Em andamento"}
                </small>
              </span>
            </div>
            <b
              className={st.timer}
              role="timer"
              aria-label="Tempo restante na rodada"
            >
              {focusClock(elapsed)}
            </b>
            <div className={st.roundTools}>
              <IconAction
                aria-label={round.paused ? "Retomar rodada" : "Pausar rodada"}
                title={round.paused ? "Retomar rodada" : "Pausar rodada"}
                onClick={() => act(round.paused ? "resume" : "pause")}
              >
                {round.paused ? <Play size={14} /> : <Pause size={14} />}
              </IconAction>
              {nextHref !== "#entrada" && !round.paused && (
                <IconLink
                  href={nextHref}
                  title="Próxima conversa da rodada"
                  aria-label="Próxima conversa da rodada"
                >
                  <SkipForward size={14} />
                </IconLink>
              )}
              <IconAction
                onClick={() => setDialog("end")}
                aria-label="Encerrar rodada de foco"
                title="Encerrar rodada de foco"
              >
                <Square size={12} />
              </IconAction>
            </div>
          </section>,
          barHost,
        )}
      {setup && !round && !dialog && (
        <ResponsiveDialog open size="sm" title="Foco da Zoe" onClose={onClose}>
          <div className="op-form">
            <div className={st.setup}>
              <img
                src="/assets/idle_thumbnail.png"
                alt=""
                width="50"
                height="50"
              />
              <span>
                <strong>Rodada de recuperação</strong>
                <small>10 minutos nas conversas que pedem atenção.</small>
              </span>
            </div>
            <label className="op-field">
              Fila de atendimento
              <select value={owner} onChange={(e) => setOwner(e.target.value)}>
                <option value="">Toda a equipe</option>
                {[...new Set(contactsOf(ops).map((c) => c.owner))].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            {first ? (
              <div className={st.first}>
                <small>Primeira conversa</small>
                <strong>{first.contact.name}</strong>
                <span>
                  {channels[first.thread.channel]} ·{" "}
                  {first.reason || first.contact.product}
                </span>
              </div>
            ) : (
              <p>A fila está em dia.</p>
            )}
            <div className="actions">
              <Button
                variant="primary"
                icon={Play}
                onClick={start}
                disabled={!first}
              >
                Iniciar rodada
              </Button>
              <Button variant="ghost" onClick={() => setDialog("routine")}>
                Rotina
              </Button>
              {last && (
                <Button variant="ghost" onClick={() => setDialog("receipt")}>
                  Última rodada
                </Button>
              )}
            </div>
          </div>
        </ResponsiveDialog>
      )}
      {dialog === "end" && (
        <ResponsiveDialog
          open
          size="sm"
          title="Encerrar a rodada?"
          onClose={() => setDialog("")}
        >
          <div className="op-form">
            <p>
              O resumo guarda o tempo, as mensagens e os resultados desta
              rodada.
            </p>
            <div className="actions">
              <Button onClick={() => setDialog("")}>Continuar no foco</Button>
              <Button variant="primary" onClick={() => act("end")}>
                Encerrar rodada
              </Button>
            </div>
          </div>
        </ResponsiveDialog>
      )}
      {dialog === "routine" && (
        <ResponsiveDialog
          open
          size="sm"
          title="Sua rotina de foco"
          onClose={() => setDialog("")}
        >
          <div className="op-form">
            <label className="op-field">
              Minuto de início a cada hora
              <select
                value={minute}
                onChange={(e) => setMinute(Number(e.target.value))}
              >
                {[0, 10, 20, 30, 40, 50].map((n) => (
                  <option key={n} value={n}>
                    :{String(n).padStart(2, "0")}
                  </option>
                ))}
              </select>
            </label>
            <p>
              Janela desta hora · {focusWindow(new Date().getHours(), minute)}
            </p>
            <Button
              variant="primary"
              onClick={() => {
                change({ focusMinute: minute });
                setDialog("");
              }}
            >
              Salvar rotina
            </Button>
          </div>
        </ResponsiveDialog>
      )}
      {dialog === "receipt" && last && (
        <ResponsiveDialog
          open
          title={
            "Última rodada · " +
            (last.phase === "completed" ? "Completa" : "Encerrada")
          }
          onClose={() => {
            setDialog("");
            onClose();
          }}
        >
          <div className="op-form">
            <p>
              {last.owner} · {new Date(last.at).toLocaleString("pt-BR")}
            </p>
            <dl className={st.stats}>
              {[
                ["Tempo em foco", duration(last.elapsedMs)],
                ["Com atividade", duration(last.activeMs)],
                ["Conversas abertas", last.opened.length],
                ["Mensagens enviadas", last.replies.length],
                ["Desfechos", last.concluded.length],
                [
                  "Ganhos na rodada",
                  money(Object.values(last.wins).reduce((a, b) => a + b, 0)),
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <Button
              onClick={() => {
                setDialog("");
                onClose();
              }}
            >
              Voltar às conversas
            </Button>
          </div>
        </ResponsiveDialog>
      )}
    </>
  );
}
