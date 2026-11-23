"use client";
import {useEffect, useRef, useState} from "react";
import {Badge, Button, ButtonLink} from "@content-ventures/design-system/v3";
import {Plug, QrCode, Smartphone} from "lucide-react";
import {ResponsiveDialog} from "../../src/ui/os/responsive-dialog";
import {DetailPage,DetailSection,DetailText} from "../../src/ui/os/detail";
import {useV2Action,useV2Read} from "../../lib/v2-client";
import {ReadState,CursorNav} from "./read-state";
import {DailySchedule} from "./diagnostic-schedule";
import s from "./channels.module.css";

const stateLabel = {connected:"Conectado",connecting:"Aguardando conexão",disconnected:"Desconectado",unknown:"Estado a verificar"};
function isQr(value) {
  return typeof value === "string" && value.length < 500000 && /^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(value);
}
function ConnectionDialog({line, session, context, onClose, update}) {
  const path = "connections/" + line.id;
  const read = useV2Read(path + "/status",context);
  const action = useV2Action(context);
  const [pair,setPair] = useState(null);
  const [requested,setRequested] = useState(false);
  const status = read.data?.status;
  const latest = useRef({retry:read.retry,update});
  latest.current = {retry:read.retry,update};
  useEffect(() => {
    if (status === "connected") {setPair(null);setRequested(false);latest.current.update();}
  }, [status]);
  useEffect(() => {
    if (!requested || read.error || status === "connected") return;
    const interval = setInterval(() => latest.current.retry(),5000);
    return () => clearInterval(interval);
  }, [requested,read.error,status]);
  function requestQr() {
    setPair(null);
    action.run(path + "/pairing","POST",{}, result => {
      if (result.connectionId === line.id && result.source === "evolution") {
        setPair(result);setRequested(result.status !== "connected");
      }
      read.retry();
    });
  }
  return <ResponsiveDialog open size="md" title={line.name} description={line.source === "evolution" ? "WhatsApp · Evolution API" : "Fonte sintética de diagnóstico"}
    onClose={onClose}>
    <ReadState read={read}>{state => {
      const evolution = state.source === "evolution";
      const ready = state.status === "connected";
      const code = !ready && isQr(pair?.qrDataUrl) ? pair.qrDataUrl : null;
      return <div className="flow"><p role="status"><Badge>{stateLabel[state.status]}</Badge></p>
        {evolution && !ready && session.workspace.role === "manager" && <>
          {code && <figure className={s.code}><img alt="QR Code de pareamento do WhatsApp" src={code} width="216" height="216" />
            <figcaption>No WhatsApp, abra Aparelhos conectados e escaneie este código.</figcaption></figure>}
          {requested && !code && <p role="status">A instância ainda não disponibilizou um QR Code.</p>}
          <Button disabled={action.pending} icon={QrCode} onClick={requestQr}>{action.pending ? "Solicitando…" : code ? "Renovar QR Code" : "Gerar QR Code"}</Button>
        </>}
        {!evolution && <p>Esta fonte usa conversas de exemplo para testar diagnósticos.</p>}
        {action.error && <p role="alert">{action.error}</p>}
        <Button disabled={read.refreshing || action.pending} variant="ghost" onClick={read.retry}>Atualizar estado</Button>
      </div>;
    }}</ReadState>
    <DailySchedule connectionId={line.id} context={context} manager={session.workspace.role === "manager"} />
  </ResponsiveDialog>;
}

export function ConnectedChannels({catalog,session,context,connections}) {
  const [line,setLine] = useState(null);
  if (catalog) return <DetailPage title="Conectores" icon={Plug} description="Integrações de canais da operação.">
    <section className={s.connector}><img width="32" height="32" src="/assets/whatsapp.svg" alt="" />
      <div><h2>Evolution API</h2><p>Conexão e pareamento dos WhatsApps da equipe.</p></div>
      <ButtonLink href="#whatsapps" variant="secondary">Gerenciar WhatsApps</ButtonLink>
    </section></DetailPage>;
  return <DetailPage title="WhatsApps" icon={Smartphone} description="Acompanhe as linhas da empresa e o estado de cada conexão.">
    <ReadState read={connections}>{({items}) => {
      const lines = items.filter(c => c.source === "evolution");
      const samples = items.filter(c => c.source === "synthetic");
      function row(c) {return <li key={c.id}><span><strong>{c.name}</strong><small>{stateLabel[c.status]}</small></span>
        <Button variant="secondary" size="sm" aria-label={"Ver conexão de " + c.name} onClick={() => setLine(c)}>Ver conexão</Button></li>;}
      return <><DetailSection title="WhatsApp · Evolution API">{lines.length ?
        <ul className={s.lines}>{lines.map(row)}</ul> : <DetailText>{connections.number > 1 || connections.next ?
          "Nenhuma linha Evolution nesta página." : "Nenhuma linha Evolution disponível para o seu perfil."}</DetailText>}</DetailSection>
        {samples.length > 0 && <DetailSection title="Fontes de teste"><ul className={s.lines}>{samples.map(row)}</ul></DetailSection>}
      </>;
    }}</ReadState>
    <CursorNav page={connections} label="Páginas de conexões" />
    {line && <ConnectionDialog key={line.id} line={line} session={session} context={context} update={connections.retry} onClose={() => setLine(null)} />}
  </DetailPage>;
}
