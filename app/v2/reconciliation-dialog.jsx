"use client";
import {useState} from "react";
import {Button, Segmented} from "@content-ventures/design-system/v3";
import {ResponsiveDialog} from "../../src/ui/os/responsive-dialog";

const periods = [1,6,24].map(hours => ({value:String(hours),label:hours === 1 ? "1 hora" : hours + " horas"}));

export function ReconciliationDialog({line, initialHours, pending, error, blocked, disabled, close, confirm}) {
  const [hours,setHours] = useState(initialHours);
  return <ResponsiveDialog open size="sm" title="Conciliar histórico" description={line.name || line.id}
    dismissible={!pending} onClose={close} footer={blocked ?
      <Button onClick={close}>Voltar ao diagnóstico</Button> :
      <Button variant="primary" disabled={pending || disabled} onClick={() => confirm(hours)}>
        {pending ? "Enfileirando…" : "Confirmar conciliação"}
      </Button>}>
    <div className="flow">
      <p>Busque mensagens atrasadas em até 40 páginas do histórico desta linha. A rotina diária continua com a leitura incremental.</p>
      <div className="op-field"><span>Período anterior à execução</span>
        <Segmented full size="lg" label="Período da conciliação" options={periods} value={String(hours)}
          disabled={pending || blocked} onChange={value => setHours(Number(value))} />
      </div>
      <p>Mensagens e análises existentes são reaproveitadas. Conversas que mudaram podem consumir créditos de análise.</p>
      {error && <p role="alert">{error}</p>}
    </div>
  </ResponsiveDialog>;
}
