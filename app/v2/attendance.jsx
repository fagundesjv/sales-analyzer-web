"use client";
import {useEffect, useRef, useState} from "react";
import {Badge, Button, VisuallyHidden} from "@content-ventures/design-system/v3";
import {MessageCircle} from "lucide-react";
import {DetailRows} from "../../src/ui/os/detail";
import {ResponsiveDialog} from "../../src/ui/os/responsive-dialog";
import {Composer} from "../../src/ui/os/chat/composer";
import {useV2Action, v2Request} from "../../lib/v2-client";
import s from "./attendance.module.css";

const limit = 4000;
export function receiptLabel(status, mode) {
  if (status === "uncertain") return "Envio sem confirmação";
  if (status === "sending") return "Em processamento";
  if (mode === "simulated") return "Aceita na simulação";
  return mode === "real" ? "Aceita pelo provedor" : "Envio aceito";
}

export function conversationMessages(evidence, history, posted) {
  const entries = evidence.map(msg => ({key:"e-"+msg.externalId,at:msg.occurredAt,evidence:msg}));
  const imported = new Map(entries.map(entry => [entry.evidence.externalId,entry]));
  const receipts = new Map(history.map(msg => [msg.id,msg]));
  for (const msg of posted) {
    const stored = receipts.get(msg.id);
    if (!stored || (stored.status === "sending" && msg.status !== "sending")) receipts.set(msg.id,msg);
  }
  for (const msg of receipts.values()) {
    const match = msg.providerMessageId && imported.get(msg.providerMessageId);
    if (match) match.receipt = msg;
    else entries.push({key:"m-"+msg.id,at:msg.createdAt,receipt:msg});
  }
  return entries.sort((left,right) => Date.parse(left.at) - Date.parse(right.at));
}

export function AttendanceComposer({path, context, info, refreshing, reload, received, channelLabel = "WhatsApp"}) {
  const [ticket,setTicket] = useState(null);
  const [dialog,setDialog] = useState(false);
  const [draft,setDraft] = useState("");
  const [pending,setPending] = useState(false);
  const [error,setError] = useState("");
  const [ambiguous,setAmbiguous] = useState(null);
  const [lastReceipt,setLastReceipt] = useState(null);
  const busy = useRef(false);
  const intentKey = useRef(null);
  const input = useRef(null);
  const start = useV2Action(context);
  const canStart = info.available && ["real","simulated"].includes(info.mode) &&
    Boolean(info.contactName && info.lineName && info.destination);
  const simulated = info.mode === "simulated";
  const hasPending = info.messages.some(msg => msg.status === "sending" || msg.status === "uncertain");
  const lastStatus = info.messages.find(msg => msg.id === lastReceipt?.id)?.status ?? lastReceipt?.status;

  useEffect(() => {
    if (!ticket) return;
    input.current?.focus();
    const timer = setTimeout(() => {
      setTicket(null);
      setError("A autorização expirou. Confirme o destino para continuar.");
    },Math.max(0,Date.parse(ticket.expiresAt)-Date.now()));
    return () => clearTimeout(timer);
  }, [ticket]);

  function confirm() {
    start.run(path,"POST",{confirm:true,mode:info.mode},value => {
      if (!value.ticket || !(Date.parse(value.expiresAt) > Date.now())) {
        setError("A autorização expirou. Confirme o destino novamente.");
        return;
      }
      setError("");
      setTicket(value);
      setDialog(false);
    });
  }
  async function send(intent) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    setLastReceipt(null);
    try {
      const receipt = await v2Request(path+"/messages",{method:"POST",context,key:intent.key,body:intent.body});
      if (!receipt.id || !["accepted","sending","uncertain"].includes(receipt.status)) throw new Error();
      received(receipt);
      intentKey.current = null;
      setDraft("");
      setAmbiguous(null);
      setLastReceipt(receipt);
      reload();
    } catch (cause) {
      if (!cause.status || cause.status >= 500 || cause.status === 408) {
        setAmbiguous(intent);
        setError("Não foi possível confirmar o envio. Confira o histórico antes de tentar novamente.");
      } else {
        setError(cause.message);
        if ([401,403,404,409,410].includes(cause.status)) {setTicket(null);reload();}
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  function submit(text) {
    if (!canStart || !ticket || ambiguous || busy.current || !text.trim() || text.length > limit) return;
    if (Date.parse(ticket.expiresAt) <= Date.now()) {setTicket(null);return;}
    if (intentKey.current?.text !== text) intentKey.current = {text,key:crypto.randomUUID()};
    send({key:intentKey.current.key,body:{ticket:ticket.ticket,text}});
  }

  return <section className={s.panel} aria-label={"Envio pelo "+channelLabel}>
    <div className={s.bar}><div className={s.channel}><MessageCircle size={16} aria-hidden="true" />
      <strong>{channelLabel}</strong>{info.mode && <Badge>{simulated ? "Simulação" : "Envio real"}</Badge>}
    </div>
      {canStart && !ticket && !ambiguous && <Button size="sm" onClick={() => {setDialog(true);setError("");}}>Ativar atendimento</Button>}
      {(ambiguous || hasPending || ["sending","uncertain"].includes(lastStatus)) && <Button variant="ghost" size="sm" disabled={refreshing} onClick={reload}>Atualizar histórico</Button>}
    </div>
    {!canStart && <p>O envio de texto está indisponível nesta conversa.</p>}
    {ticket && canStart && !ambiguous && <Composer ref={input} value={draft} label="Mensagem de WhatsApp"
      formLabel="Compor mensagem de WhatsApp" placeholder={"Mensagem para "+info.contactName+"…"} minRows={1} maxRows={3}
      submitLabel={simulated ? "Simular envio" : "Enviar mensagem"} submitText={simulated ? "Simular envio" : "Enviar"}
      status={pending ? "submitting" : "idle"} onSubmit={submit}
      maxLength={limit} onChange={setDraft}
      strip={<div className={s.strip}><span>{info.lineName} · {info.destination}</span><span>{draft.length}/4000</span></div>} />}
    <VisuallyHidden><span role="status">{lastStatus && receiptLabel(lastStatus,info.mode)}</span></VisuallyHidden>
    {error && <p role="alert">{error}</p>}
    {ambiguous && <div className={s.actions}>
      {canStart && ticket && <Button size="sm" variant="secondary" disabled={pending} onClick={() => send(ambiguous)}>Tentar o mesmo envio</Button>}
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => {
        intentKey.current = null;
        setAmbiguous(null);setDraft("");setTicket(null);setError("");
      }}>Fechar tentativa</Button>
    </div>}
    {dialog && canStart && <ResponsiveDialog open size="sm" title="Confirmar atendimento"
      onClose={() => {if (!start.pending) setDialog(false);}} dismissible={!start.pending}>
      <div className="flow"><p>{simulated ? "As mensagens deste atendimento serão simuladas." :
        "As mensagens que você enviar aqui irão para este WhatsApp."}</p>
        <DetailRows items={[{label:"Contato",value:info.contactName},{label:"Destino",value:info.destination},{label:"Linha",value:info.lineName}]} />
        {(start.error || error) && <p role="alert">{start.error || error}</p>}
        <Button disabled={start.pending} onClick={confirm}>{start.pending ? "Ativando…" : "Confirmar e ativar"}</Button>
      </div>
    </ResponsiveDialog>}
  </section>;
}
