"use client";
import {useState} from "react";
import {Badge, Button, ButtonLink, Input, SwitchRow} from "@content-ventures/design-system/v3";
import {useV2Action, useV2Read} from "../../lib/v2-client";
import {ReadState} from "./read-state";
import s from "./channels.module.css";

const decisions = {
  queued:"Diagnóstico na fila",
  covered:"Período já coberto por um diagnóstico",
  skipped_budget:"Execução ignorada por falta de orçamento",
  skipped_connection:"Conexão indisponível no horário agendado",
  missed_slot:"Horário da execução perdido",
};
const commonZones = ["America/Sao_Paulo","America/Manaus","America/Rio_Branco","America/Noronha","UTC"];
const allZones = (Intl.supportedValuesOf?.("timeZone") ?? []).filter(zone => !commonZones.includes(zone));

function dateAtZone(stamp, zone) {
  try {
    return new Intl.DateTimeFormat("pt-BR",{timeZone:zone,dateStyle:"short",timeStyle:"short"}).format(new Date(stamp));
  } catch {
    // The server can support time zone aliases that the browser does not recognize.
    return new Intl.DateTimeFormat("pt-BR",{timeZone:"UTC",dateStyle:"short",timeStyle:"short"}).format(new Date(stamp)) + " UTC";
  }
}

function ScheduleEditor({value, path, context, onSaved, reload}) {
  const [enabled, setEnabled] = useState(value.enabled);
  const [localTime, setTime] = useState(value.localTime);
  const [timeZone, setZone] = useState(value.timeZone);
  const action = useV2Action(context);
  const conflict = action.errorCode === "schedule_version_conflict";
  const changed = enabled !== value.enabled || localTime !== value.localTime || timeZone !== value.timeZone;
  const valid = /^([01]\d|2[0-3]):[0-5]\d$/.test(localTime);
  const canSave = changed && valid && !action.pending && !conflict;
  const button = enabled === value.enabled ? "Salvar alterações" : enabled ? "Ativar agenda" : "Pausar agenda";
  const extraZone = !commonZones.includes(value.timeZone) && !allZones.includes(value.timeZone);
  return <form className={s.editor} onSubmit={event => {
    event.preventDefault();
    if (canSave) action.run(path, "PUT", {enabled,localTime,timeZone,version:value.version}, onSaved);
  }}>
    <SwitchRow label="Agendar diagnóstico" checked={enabled} disabled={action.pending} onCheckedChange={setEnabled} />
    <div className={s.fields}>
      <label className="op-field">Horário local<Input type="time" required step={60} value={localTime}
        disabled={action.pending} onChange={event => setTime(event.target.value)} /></label>
      <label className="op-field">Fuso horário<select value={timeZone} disabled={action.pending} onChange={event => setZone(event.target.value)}>
        {commonZones.map(zone => <option key={zone}>{zone}</option>)}
        {extraZone && <option>{value.timeZone}</option>}
        {allZones.length > 0 && <optgroup label="Outros fusos">{allZones.map(zone => <option key={zone}>{zone}</option>)}</optgroup>}
      </select></label>
    </div>
    {action.error && <div role="alert" className={s.feedback}><p>{conflict ?
      "A agenda mudou desde que você a abriu. Recarregue para conferir o horário salvo." : action.error}</p>
      {conflict && <Button type="button" variant="secondary" onClick={reload}>Recarregar agenda</Button>}</div>}
    <Button type="submit" disabled={!canSave}>{action.pending ? "Salvando…" : button}</Button>
  </form>;
}

export function DailySchedule({connectionId,context,manager}) {
  const path = "connections/" + connectionId + "/diagnostic-schedule";
  const read = useV2Read(path,context);
  const [saved, setSaved] = useState(null);
  function reload() { setSaved(null); read.retry(); }
  return <section className={s.schedule} aria-labelledby="daily-schedule-title">
    <h2 id="daily-schedule-title">Diagnóstico diário</h2>
    <ReadState read={read}>{initial => {
      const value = saved ?? initial;
      if (value?.connectionId !== connectionId) return <div className={s.feedback} role="alert">
        <p>Não foi possível conferir a agenda desta linha.</p>
        <Button onClick={reload} variant="secondary">Recarregar agenda</Button></div>;
      const status = value.enabled ? "Ativo" : value.version ? "Pausado" : "Desativado";
      return <>
        <div className={s.summary}><Badge>{status}</Badge><span>{value.enabled ?
          "Diariamente às " + value.localTime + " · " + value.timeZone : "A execução automática está desligada."}</span></div>
        {manager && <ScheduleEditor key={value.version} value={value} path={path} context={context} onSaved={setSaved} reload={reload} />}
        {saved && <p className={s.saved} role="status">Agenda salva.</p>}
        <dl className={s.activity}>
          {!manager && !value.enabled && <div><dt>Horário configurado</dt><dd>{value.localTime} · {value.timeZone}</dd></div>}
          <div><dt>Próxima execução</dt><dd>{value.nextRunAt ? dateAtZone(value.nextRunAt,value.timeZone) :
            value.enabled ? "Aguardando agendamento" : "Sem execução agendada"}</dd></div>
          <div><dt>Última avaliação</dt><dd>{value.lastEvaluatedAt && <time dateTime={value.lastEvaluatedAt}>{dateAtZone(value.lastEvaluatedAt,value.timeZone)} · </time>}
            {decisions[value.lastDecision] ?? (value.lastEvaluatedAt ? "Sem decisão registrada" : "Nenhuma avaliação ainda")}</dd></div>
        </dl>
        {value.lastDiagnosticId && <ButtonLink href={"#diagnosticos/" + encodeURIComponent(value.lastDiagnosticId)} size="sm" variant="secondary">Abrir diagnóstico</ButtonLink>}
      </>;
    }}</ReadState>
  </section>;
}
