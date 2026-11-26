"use client";
import {useState} from "react";
import {Button, Checkbox, Input, Select} from "@content-ventures/design-system/v3";
import {DetailRows} from "../../src/ui/os/detail";
import {ResponsiveDialog} from "../../src/ui/os/responsive-dialog";
import {useV2Action, useV2Page, useV2Read} from "../../lib/v2-client";
import {parseMoney} from "../../lib/operation";
import {ReaisField} from "../operation-fields";
import {CursorNav, ReadState} from "./read-state";
import {exactReais} from "./work-queue";
import css from "../customer-inbox.module.css";
import {OpportunityWork} from "./opportunity-work";

const statuses = {open:"Em aberto", won:"Ganho", lost:"Perdido", resolved:"Resolvido"};
const credits = {team:"Equipe", zoe:"Zoe", unknown:"Crédito ainda sem base suficiente"};

function NewOpportunity({path, context, close, saved}) {
  const [title, setTitle] = useState("");
  const action = useV2Action(context);
  return <ResponsiveDialog open title="Novo pedido" size="sm" onClose={close} dismissible={!action.pending}>
    <form className="flow" onSubmit={event => {
      event.preventDefault();
      action.run(path, "POST", {title:title.trim() || "Novo pedido"}, saved);
    }}>
      <label>Nome do pedido<Input value={title} maxLength={160} disabled={action.pending}
        placeholder="Ex.: Recompra de três caixas" onChange={event => setTitle(event.target.value)} /></label>
      <p>O novo pedido terá seu próprio desfecho nesta conversa.</p>
      {action.error && <p role="alert">{action.error}</p>}
      <Button type="submit" disabled={action.pending}>{action.pending ? "Criando…" : "Criar pedido"}</Button>
    </form>
  </ResponsiveDialog>;
}

function OpportunityOutcome({item, status, context, close, saved, reload}) {
  const unknownBefore = item.outcome?.amountCents == null;
  const [unknown, setUnknown] = useState(unknownBefore);
  const [amount, setAmount] = useState(unknownBefore ? "" : String(item.outcome.amountCents / 100).replace(".", ","));
  const [reason, setReason] = useState(item.outcome?.lossReason || "");
  const action = useV2Action(context);
  const cents = parseMoney(amount);
  const won = status === "won";
  const ready = won ? unknown || cents !== null : Boolean(reason.trim());
  const conflict = action.errorCode === "opportunity_version_conflict";
  return <ResponsiveDialog open size="sm" title={won ? "Registrar ganho do pedido" : "Registrar perda do pedido"}
    description={item.title} onClose={close} dismissible={!action.pending}>
    <form className="flow" onSubmit={event => {
      event.preventDefault();
      if (!ready || conflict) return;
      const outcome = won ? {amountCents:unknown ? null : cents} : {lossReason:reason.trim()};
      action.run("opportunities/" + item.id + "/outcome", "PUT", {status, expectedVersion:item.version, ...outcome}, saved);
    }}>
      {won ? <>
        <Checkbox label="Valor ainda desconhecido" checked={unknown} disabled={action.pending}
          onChange={event => setUnknown(event.target.checked)} />
        {!unknown && <label>Valor da venda<ReaisField aria-label="Valor da venda do pedido" required value={amount}
          disabled={action.pending} onValueChange={setAmount} /></label>}
        <p>{unknown ? "O ganho conta como venda e fica fora da soma dos valores conhecidos."
          : "A marcação do operador confirma este ganho."}</p>
      </> : <label>Motivo da perda<Input required maxLength={500} value={reason} disabled={action.pending}
        onChange={event => setReason(event.target.value)} /></label>}
      {action.error && <div role="alert"><p>{action.error}</p>
        {conflict && <Button type="button" variant="ghost" onClick={reload}>Reler pedido</Button>}
      </div>}
      <Button type="submit" disabled={!ready || conflict || action.pending}>{action.pending ? "Salvando…" :
        won ? "Confirmar ganho do pedido" : "Confirmar perda do pedido"}</Button>
    </form>
  </ResponsiveDialog>;
}

function OpportunitySummary({context, revision}) {
  const summary = useV2Read("opportunities/summary", context, revision);
  if (summary.error?.status === 404) return null;
  return <section aria-label="Ganhos dos pedidos autorizados">
    <h3>Ganhos dos pedidos autorizados</h3><p>Todo o histórico · Linhas disponíveis para seu acesso</p>
    <ReadState read={summary}>{data => <DetailRows items={[
      {label:"Vendas confirmadas", value:data.sales + (data.sales === 1 ? " venda" : " vendas")},
      {label:"Valor conhecido", value:exactReais(data.amountCents)},
      {label:"Vendas sem valor informado", value:data.salesWithoutAmount},
    ]} />}</ReadState>
  </section>;
}

export function ConversationOpportunities({conversationId, context, commercialEngine = false, conversation}) {
  const path = "conversations/" + conversationId + "/opportunities";
  const [revision, setRevision] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [modal, setModal] = useState(null);
  const list = useV2Page(path, context, revision);
  const currentId = selectedId || list.data?.items[0]?.id;
  const detail = useV2Read(currentId ? "opportunities/" + currentId : null, context, revision);
  const items = list.data?.items || [];
  const options = [...items];
  if (detail.data && !items.some(item => item.id === detail.data.id)) options.unshift(detail.data);
  const select = id => {setSelectedId(id); setModal(null);};
  const refresh = () => {setModal(null); setRevision(value => value + 1);};
  const saved = item => {setSelectedId(item.id); refresh();};
  if (list.error?.status === 404) return null;

  return <section className={css.brief} aria-label="Pedidos desta conversa">
    <h3>Pedidos desta conversa</h3>
    <Button size="sm" onClick={() => setModal("create")}>Novo pedido</Button>
    <ReadState read={list}>{data => <>
      {data.items.length > 0 ? <Select label="Pedido selecionado" value={currentId || ""} onChange={select}
        options={options.map(item => ({value:item.id, label:item.title + " · " + (statuses[item.status] || item.status)
          + (item.legacy ? " · Legado" : "")}))} /> : <p>Nenhum pedido nesta página.</p>}
      <CursorNav page={list} label="Páginas de pedidos" />
    </>}</ReadState>
    {currentId && <ReadState read={detail}>{item => <section aria-label="Pedido selecionado">
      <DetailRows items={[
        {label:"Pedido", value:item.title},
        {label:"Situação", value:statuses[item.status] || item.status},
        ...(item.status === "won" ? [{label:"Valor", value:item.outcome?.amountCents == null
          ? "Ainda desconhecido" : exactReais(String(item.outcome.amountCents))}] : []),
        ...(item.status === "lost" ? [{label:"Motivo", value:item.outcome.lossReason}] : []),
        ...(item.outcome?.origin === "manual" ? [{label:"Registro", value:"Marcado manualmente por operador autorizado"}] : []),
        ...(item.outcome?.credit ? [{label:"Crédito pelo ponto de corte", value:credits[item.outcome.credit.by] || credits.unknown}] : []),
      ]} />
      {item.legacy ? <p>Pedido legado. As correções continuam pelo fluxo anterior da conversa.</p> : <>
        <Button size="sm" onClick={() => setModal("won")}>Registrar ganho</Button>
        <Button size="sm" variant="ghost" onClick={() => setModal("lost")}>Registrar perda</Button>
      </>}
      {commercialEngine && !item.legacy && <OpportunityWork key={item.id} item={item} conversation={conversation} context={context} revision={revision} />}
    </section>}</ReadState>}
    <OpportunitySummary context={context} revision={revision} />
    {modal === "create" && <NewOpportunity path={path} context={context} close={() => setModal(null)} saved={saved} />}
    {["won", "lost"].includes(modal) && detail.data && !detail.data.legacy && <OpportunityOutcome
      key={detail.data.id + "/" + detail.data.version + "/" + modal} item={detail.data} status={modal} context={context}
      close={() => setModal(null)} saved={saved} reload={refresh} />}
  </section>;
}
