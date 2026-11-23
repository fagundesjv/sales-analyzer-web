"use client";
import {useEffect, useState} from "react";
import {Button, ButtonLink, MeterList, SearchField} from "@content-ventures/design-system/v3";
import {ArrowUpRight, ChartColumn, MessageCircle, Radar, ScanText, SearchX, TrendingUp, Trophy} from "lucide-react";
import {money} from "../../lib/operation";
import {selfServeWhatsApp} from "../../lib/v2-capabilities";
import {inboxHref} from "../../lib/inbox";
import {useV2Action, useV2Page, useV2Read} from "../../lib/v2-client";
import diagnosticStyles from "./diagnostic-actions.module.css";
import {ReconciliationDialog} from "./reconciliation-dialog";
import {useDiagnosticRun} from "./use-diagnostic-run";
import {Pills} from "../../src/ui/os/pills";
import {StatTiles} from "../../src/ui/os/stat-tiles";
import {DetailPage, DetailRows, DetailSection, DetailText} from "../../src/ui/os/detail";
import {EmptyState, FirstAccess} from "../../src/ui/os/empty-state";
import {DashboardVersion} from "../commercial-dashboard";
import {RadarEmpty, useRadarEmpty} from "./radar-empty";
import {RadarBrief} from "../radar-reading";
import {ContactMark} from "../recovery-desk";
import {CursorNav, ReadState} from "./read-state";
import r from "../radar.module.css";
import d from "../commercial-dashboard.module.css";

export const outcomes = {won:"Ganha", lost:"Perdida", resolved:"Resolvida"};
export function initials(title) {
  return title.trim().split(/\s+/).slice(0,2).map(word => word[0]).join("");
}
function Queue({items, title = "Fila de recuperação", pageCount = false, empty}) {
  const [limit, setLimit] = useState(10);
  return <section className={r.queue} aria-label={title}><header className={r.cardHead}><h2>{title}</h2>
    <small>{items.length} {items.length === 1 ? "conversa" : "conversas"}{pageCount && " nesta página"}</small></header>
    {items.slice(0, limit).map(item => <a key={item.id} className={r.queueRow} href={inboxHref(item.id)}>
      <span className={r.face}><ContactMark s={{tone:"sage",initials:initials(item.title)}} /></span>
      <span className={r.person}><strong>{item.title}</strong><small>{item.summary}{item.pendingRevision && " · Atualização em andamento"}</small></span>
      <span className={r.reason} data-urgent={!item.outcome && item.priority === "high"}>
        {item.outcome ? outcomes[item.outcome.status] : item.priority === "high" ? "Alta prioridade" : "Em análise"}</span>
      <span className={r.queueValue}>{item.outcome?.amountCents != null && <strong>{money(item.outcome.amountCents)}</strong>}
        {item.outcome?.status === "won" && <small>{item.outcome.confirmedAt ? "Confirmada" : "A confirmar"}</small>}</span>
      <ArrowUpRight size={16} aria-hidden="true" /></a>)}
    {!items.length && empty}
    {items.length > limit && <Button variant="ghost" size="sm" onClick={() => setLimit(x => x + 10)}>Mostrar mais</Button>}
  </section>;
}
const brlInteger = new Intl.NumberFormat("pt-BR", {style:"currency",currency:"BRL",maximumFractionDigits:0});
export function exactReais(cents) {
  const amount = BigInt(cents);
  const rest = amount % 100n;
  return brlInteger.format(amount / 100n) + (rest ? "," + String(rest).padStart(2,"0") : "");
}
export function ConnectedDashboard({radar, context, session, gains}) {
  const summary = useV2Read("summary",context);
  const sales = useV2Page(gains ? "conversations?outcome=won" : null, context);
  const list = gains ? sales : radar;
  const firstAnalysis = summary.data?.conversations === 0;
  const manager = session.workspace.role === "manager";
  if (summary.error || (!list.confirmed && list.error)) return <ReadState read={summary.error ? summary : list} />;
  if (!summary.data || !list.confirmed) return <ReadState read={!summary.data ? summary : list} />;
  if (firstAnalysis && !summary.data.opportunities && !summary.data.pendingWins.count && !summary.data.confirmedWins.count &&
      !list.previous && list.data?.items.length === 0)
    return <FirstAccess icon={gains ? Trophy : ChartColumn} preview={gains ? "gains" : "dashboard"}
      title={gains ? "Ganhos aparecerão aqui" : "Sua próxima oportunidade começa com uma análise"}
      description={gains ? "Registre a venda na conversa. O valor entra nos ganhos confirmados após a revisão do gestor." :
        manager ? "Confira o WhatsApp da equipe para iniciar a primeira análise." : "Confira a linha atribuída à sua conta para começar."}
      tools={<DashboardVersion integrated />} action={<ButtonLink variant="primary" href={gains ? "#radar" : "#whatsapps"}>
        {gains ? "Abrir Radar" : "Ver WhatsApps"}</ButtonLink>} />;
  return <DetailPage title={gains ? "Ganhos" : "Panorama comercial"} icon={gains ? Trophy : ChartColumn}
    actions={<DashboardVersion integrated />}><div className={d.dashboard}>
    <ReadState read={summary}>{data => <StatTiles label="Operação comercial" columns={4} items={[
        {id:"all",label:"Conversas",value:data.conversations,href:"#entrada"},
        {id:"radar", label:"Oportunidades", value:data.opportunities, href:"#radar"},
        {id:"pending", label:"Ganhos a confirmar", value:exactReais(data.pendingWins.amountCents), caption:data.pendingWins.count + " a confirmar",href:"#resultados"},
        {id:"amount", label:"Valor confirmado", value:exactReais(data.confirmedWins.amountCents), caption:data.confirmedWins.count + (data.confirmedWins.count === 1 ? " venda" : " vendas")},
    ]} />}</ReadState>
    <ReadState retain read={list}>{({items}) => <Queue items={items}
      title={gains ? "Vendas ganhas" : "Oportunidades no Radar"}
      empty={!gains && !list.previous && !summary.data ? null : <EmptyState icon={gains ? Trophy : Radar} preview={list.previous ? undefined : gains ? "gains" : "dashboard"}
        title={list.previous ? "Esta página está vazia" : gains ? "Ganhos aparecerão aqui" :
          firstAnalysis ? "Sua próxima oportunidade começa com uma análise" : "Nenhuma oportunidade no Radar"}
        description={list.previous ? "Volte à página anterior para conferir as negociações." :
          gains ? "Registre o desfecho na conversa quando uma venda for confirmada." :
          !firstAnalysis ? "Confira as conversas da equipe para acompanhar os desfechos registrados." :
          manager ? "Confira a conexão do WhatsApp da equipe para fazer a primeira análise." :
          "Confira suas linhas de WhatsApp. Se faltar uma atribuição, peça ao gestor."}
        action={list.previous ? <Button size="sm" variant="secondary" onClick={list.previous}>Página anterior</Button> :
          gains ? <ButtonLink href="#radar" size="sm" variant="secondary">Abrir Radar</ButtonLink> :
          firstAnalysis ? <ButtonLink href="#whatsapps" size="sm" variant="secondary">Ver WhatsApps</ButtonLink> :
          <ButtonLink href="#entrada" size="sm" variant="secondary">Abrir conversas</ButtonLink>} />} />}</ReadState>
    <CursorNav page={list} label="Páginas de negociações" />
  </div></DetailPage>;
}
const radarChoices = [{value:"all",label:"Todas"},{value:"open",label:"Em aberto"},{value:"won",label:"Ganhas"},
  {value:"lost",label:"Perdidas"},{value:"resolved",label:"Resolvidas"}];

function RadarResults({radar, priorities, clearFilters, pending}) {
  return <ReadState retain read={radar} pending={pending}>{({items}) => {
      if (!items.length) return <EmptyState icon={SearchX}
        title={radar.previous ? "Esta página está vazia" : "Nenhuma oportunidade neste recorte"}
        description={radar.previous ? "Volte à página anterior para conferir as oportunidades." :
          "Tente outro contato ou situação para encontrar a negociação."}
        action={<Button variant="secondary" size="sm" onClick={radar.previous || clearFilters}>
          {radar.previous ? "Página anterior" : "Limpar filtros"}</Button>} />;
      const open = items.filter(x => !x.outcome);
      const counts = radarChoices.slice(1).map(({value,label},i) => {
        const n = items.filter(x => (x.outcome?.status || "open") === value).length;
        return {key:value,label,value:n,share:100*n/(items.length || 1),color:["amber","green","red","teal"][i]};
      });
      return <div className="flow">{priorities && <div className={r.board}>
        <section className={r.exposure}><header className={r.cardHead}><h2>Situação das negociações</h2>
          <small>{items.length} nesta página</small></header><MeterList label="Conversas por situação nesta página"
            items={counts} format={String} shares={false} /></section>
        <RadarBrief sourceLabel="Sinal do diagnóstico nesta página" queue={open.map(x => ({
          thread:{id:x.id},contact:{name:x.title},headline:x.title,quote:x.summary,reason:"Alta prioridade",
        }))} />
      </div>}<Queue key={radar.number} items={items} pageCount /><CursorNav page={radar} label="Páginas do Radar" /></div>;
  }}</ReadState>;
}

export function ConnectedRadar({context,session,title}) {
  const [text,setText] = useState("");
  const [q,setQ] = useState("");
  const [filter,setFilter] = useState("all");
  const term = text.trim();
  const pending = term !== q;
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setQ(term),term ? 180 : 0);
    return () => clearTimeout(timer);
  },[term,pending]);
  const params = new URLSearchParams();
  if (q) params.set("q",q);
  if (filter !== "all") params.set("outcome",filter);
  const path = params.size ? "radar?" + params.toString() : "radar";
  const radar = useV2Page(path,context);
  function clearFilters() {
    setText(""); setQ(""); setFilter("all");
  }
  const priorities = title === "Radar";
  const baselineEmpty = !pending && !params.size && !radar.previous && radar.data?.items.length === 0;
  const empty = useRadarEmpty(baselineEmpty,session,context,priorities ? "radar" : "deals");
  if (!radar.confirmed) return <ReadState read={radar} />;
  if (baselineEmpty && !empty.data) return <ReadState read={empty} />;
  if (baselineEmpty) return <RadarEmpty kind={priorities ? "radar" : "deals"} step={empty.data.step} />;
  return <div className={r.radar} data-stable-phone-tabs><DetailPage
    title={priorities ? "Radar de recuperação" : title} icon={priorities ? Radar : TrendingUp}
    actions={<ButtonLink variant="secondary" href="#diagnosticos">Abrir diagnósticos</ButtonLink>}>
    <div className="flow">
      <SearchField label="Buscar oportunidade" placeholder="Buscar contato ou sinal…" value={text} onValueChange={setText}
        maxLength={80} enterKeyHint="search" />
      <Pills label="Situação da negociação" items={radarChoices} value={filter} onChange={setFilter} />
      <RadarResults radar={radar} priorities={priorities} pending={pending} clearFilters={clearFilters} />
    </div></DetailPage></div>;
}

const runLabels = {queued:"Na fila", running:"Em análise", completed:"Diagnóstico concluído", failed:"Falha no diagnóstico"};
const startErrors = {
  diagnostic_already_active:"Já existe outro diagnóstico em andamento nesta linha. Acompanhe a execução no histórico e tente novamente quando ela terminar.",
  reconciliation_requires_import:"Conclua a primeira importação com o diagnóstico padrão desta linha antes de conciliar o histórico.",
};
const diagnosticErrors = {
  evolution_reconciliation_limit:"A conciliação atingiu o limite de 40 páginas para esta execução.",
  evolution_invalid_response:"O WhatsApp retornou dados que a importação não conseguiu ler. Tente importar a linha novamente.",
  evolution_inconsistent_page:"As páginas do histórico do WhatsApp não conferem entre si. Tente novamente para conferir as mensagens desta linha.",
  evolution_window_limit:"Há mensagens demais no menor intervalo que a integração consegue ler. Peça ao responsável pela integração que revise esta linha.",
  evolution_unavailable:"Não foi possível consultar o WhatsApp. Tente novamente quando a conexão estiver disponível.",
  evolution_instance_mismatch:"A linha recebida difere da conexão selecionada. Confira o vínculo em WhatsApps antes de tentar novamente.",
  evolution_unconfigured:"Confira o vínculo da linha em WhatsApps antes de iniciar outra importação.",
  retry_limit:"O diagnóstico esgotou as tentativas automáticas. Você pode iniciar uma nova leitura desta conexão.",
  monthly_call_limit:"O limite de análise do mês foi atingido. Uma nova leitura depende de disponibilidade.",
  ai_cost_limit:"O orçamento de execução disponível neste mês não cobre esta análise. O gestor pode conferir o saldo e as reservas em Uso.",
  ai_policy_unavailable:"A integração está sem uma política de execução compatível com esta análise. Peça ao responsável pela operação que revise a configuração.",
  ai_input_limit:"O conteúdo a analisar excede o limite de entrada do modelo. Peça ao responsável pela operação que revise o tamanho da leitura.",
  ai_input_count_unavailable:"A análise não iniciou porque o contador de tokens de entrada estava indisponível.",
  ai_cost_indeterminate:"O consumo desta análise ainda está em verificação. Aguarde a conferência da reserva. Os relatórios já publicados continuam no histórico.",
  inconclusive:"A leitura desta conversa foi inconclusiva.",
  invalid_proposal:"A análise não produziu uma leitura válida.",
};
function DiagnosticResult({job, tracking = false}) {
  if (job.status === "failed") {
    const message = Object.hasOwn(diagnosticErrors,job.error) ? diagnosticErrors[job.error] :
      "Não foi possível concluir esta leitura. Você pode tentar novamente.";
    return <div role={tracking ? "alert" : undefined}><DetailText>{message}</DetailText>
      {job.error === "evolution_reconciliation_limit" && job.reconcileHours > 1 &&
        <DetailText>Escolha um período menor para a próxima conciliação.</DetailText>}
      {["evolution_instance_mismatch","evolution_unconfigured"].includes(job.error) &&
        <a href="#whatsapps">Conferir conexão</a>}</div>;
  }
  if (job.status !== "completed") return tracking ?
    <progress aria-label="Progresso" value={job.progress} max={100} /> : <DetailText>Aguardando o resultado.</DetailText>;
  const report = job.report;
  if (!report) return <DetailText>O resultado desta leitura está indisponível.</DetailText>;
  const inconclusive = Number.isInteger(report.inconclusive) ? [{label:"Inconclusivas",value:report.inconclusive}] : [];
  const discarded = Number.isSafeInteger(report.invalidProposals) && report.invalidProposals > 0
    ? [{label:"Respostas descartadas por validação",value:report.invalidProposals}] : [];
  const partial = report.hasBacklog === true;
  const through = partial && report.coveredThrough ? new Date(report.coveredThrough) : null;
  const coverage = partial && <div><strong>Leitura parcial</strong>
    <DetailText>{through && Number.isFinite(through.getTime()) &&
      <>Histórico verificado até <time dateTime={report.coveredThrough}>{through.toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"})}</time>. </>}
      Ainda há um período para analisar nesta linha.</DetailText></div>;
  if (report.conversations === 0 && !discarded.length) return <div>{coverage}
    <strong>{report.source === "evolution" ? "Nenhuma conversa com texto nesta leitura do WhatsApp." : "Nenhuma conversa nesta leitura."}</strong>
    {!partial && <DetailText>{report.source === "evolution" ? "Inicie outro diagnóstico quando houver mensagens de texto na linha." :
      "Inicie outro diagnóstico quando houver conversas na conexão."}</DetailText>}
    {inconclusive.length > 0 && <DetailRows items={inconclusive} />}
  </div>;
  return <>{coverage}<DetailRows items={[
    {label:"Conversas",value:report.conversations},{label:"Analisadas",value:report.analyzed},
    {label:"Leituras reutilizadas",value:report.reused},...inconclusive,...discarded,{label:"Oportunidades",value:report.opportunities},
  ]} />
    {report.inconclusive > 0 && <DetailText>O total de conversas inclui as leituras que ficaram sem conclusão.</DetailText>}
    {discarded.length > 0 && <DetailText>As respostas descartadas ficam fora do relatório comercial.</DetailText>}
    {report.opportunities === 0 ? <DetailText>Nenhuma oportunidade identificada nesta leitura.</DetailText> :
      tracking && <ButtonLink href="#radar">Ver oportunidades no Radar</ButtonLink>}
  </>;
}
export function Diagnostics({connections, context, initialId, manager}) {
  const storageKey = "sa2-diagnostic/" + context;
  const [selection, setSelection] = useState(() => ({id:initialId || sessionStorage.getItem(storageKey),context}));
  const id = selection?.id;
  const [connection, setConnection] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [previousReport, setPreviousReport] = useState(null);
  const run = useDiagnosticRun(selection, context);
  const lines = connections.data?.items || [];
  const activeLine = lines.find(line => line.id === connection) ||
    lines.find(line => line.id === run.data?.connectionId) || lines[0];
  const history = useV2Page(activeLine ? "diagnostics?connectionId=" + activeLine.id : null, context, historyRevision);
  const action = useV2Action(context);
  const completedId = ["completed","failed"].includes(run.data?.status) ? run.data.id : null;
  useEffect(() => {if (completedId) setHistoryRevision(v => v + 1);}, [completedId]);
  const waiting = id && (run.loading || ["queued","running"].includes(run.data?.status));
  const failedHere = run.data?.status === "failed" && run.data.connectionId === activeLine?.id;
  const current = run.data ?? (!history.cursor && history.data?.items[0]);
  const partialHere = current?.connectionId === activeLine?.id && current?.status === "completed" && current.report?.hasBacklog === true;
  const latest = !history.cursor && history.data?.items[0];
  const verifyCost = current?.error === "ai_cost_indeterminate" || latest?.error === "ai_cost_indeterminate";
  const retryHere = failedHere || (partialHere && !!id);
  const formAction = (!retryHere || !!current?.reconcileHours) && !verifyCost;
  const listedRunLine = lines.find(line => line.id === run.data?.connectionId);
  // A link from WhatsApps can refer to a line outside the current page of connections.
  const lookupId = manager && !connections.loading && !listedRunLine && run.data?.reconcileHours ? run.data.connectionId : null;
  const lineStatus = useV2Read(lookupId ? "connections/" + lookupId + "/status" : null,context);
  const retryLine = listedRunLine || (lookupId && lineStatus.data?.connectionId === lookupId ?
    {id:lookupId,source:lineStatus.data.source,name:lineStatus.data.name} : null);
  const startError = startErrors[action.errorCode] ?? action.error;
  const blocked = Object.hasOwn(startErrors,action.errorCode);
  function reviewReconciliation(line, hours = 1) {
    if (manager && line?.source === "evolution" && !waiting && !action.pending && !verifyCost) {
      action.clearError();
      setConfirmation({line,hours});
    }
  }
  function closeConfirmation() {
    if (action.pending) return;
    if (action.errorCode === "diagnostic_already_active") history.first();
    action.clearError();
    setConfirmation(null);
  }
  function track(job) {
    action.clearError();
    sessionStorage.setItem(storageKey,job.id);
    setSelection({id:job.id,context,job});
    setConnection(job.connectionId);
  }
  function start(connectionId, reconcileHours = null) {
    if (waiting || action.pending || verifyCost) return;
    if (reconcileHours !== null && (!manager || confirmation?.line.id !== connectionId ||
        confirmation.line.source !== "evolution" || ![1,6,24].includes(reconcileHours))) return;
    const published = [run.data,...(history.data?.items ?? [])].find(job =>
      job?.connectionId === connectionId && job.status === "completed" && job.report);
    const body = reconcileHours === null ? {connectionId} : {connectionId,reconcileHours};
    action.run("diagnostics","POST",body,job => {
      if (published) setPreviousReport(published);
      setConfirmation(null);
      track(job);
      history.retry();
    });
  }
  function historyEntry(job) {
    return <details key={job.id}>
      <summary>{job.reconcileHours && `Conciliação · ${job.reconcileHours} h · `}{runLabels[job.status]} · {new Date(job.createdAt).toLocaleString("pt-BR")}</summary>
      <DiagnosticResult job={job} />
      <Button size="sm" variant="ghost" disabled={action.pending || !!waiting} onClick={() => track(job)}>Acompanhar execução</Button>
    </details>;
  }
  if (!id && !connections.confirmed) return <ReadState read={connections} />;
  if (!id && !connections.previous && connections.data?.items.length === 0)
    return <FirstAccess icon={ScanText} preview="diagnostics" title="Nenhuma conexão disponível"
      description={manager ? selfServeWhatsApp ? "Conecte um WhatsApp para analisar as conversas da operação." :
        "Solicite a conexão do WhatsApp da equipe à implantação para iniciar o diagnóstico." :
        "Peça ao gestor para atribuir uma linha à sua conta antes de iniciar uma análise."}
      action={<ButtonLink variant="primary" href="#whatsapps">Ver WhatsApps</ButtonLink>} />;
  return <DetailPage title="Diagnósticos" icon={ScanText} >
    <DetailSection title="Novo diagnóstico"><ReadState retain read={connections}>{({items}) => items.length ?
      <form className="flow" onSubmit={e => {e.preventDefault();if (formAction) start(activeLine.id);}}>
        <label className="op-field">Conexão <select aria-label="Conexão" value={activeLine?.id ?? ""} disabled={action.pending || !!waiting}
          onChange={e => {action.clearError();setConnection(e.target.value);setPreviousReport(null);setSelection(null);sessionStorage.removeItem(storageKey);}}>
          {items.map(c => <option key={c.id} value={c.id}>{c.name}{c.source === "synthetic" ? " · Exemplo" : " · WhatsApp"}</option>)}
        </select></label>
        <div className={diagnosticStyles.actions}>{formAction && <Button type="submit" disabled={action.pending || !!waiting || history.loading}>
          {partialHere && !current?.reconcileHours ? "Continuar leitura desta linha" : "Iniciar diagnóstico"}</Button>}
          {manager && activeLine?.source === "evolution" && !verifyCost && !(retryHere && current?.reconcileHours) &&
            <Button type="button" variant="secondary" disabled={action.pending || !!waiting || history.loading}
              onClick={() => reviewReconciliation(activeLine)}>Conciliar histórico</Button>}
        </div>
        {verifyCost && run.data?.error !== "ai_cost_indeterminate" && <DetailText>{diagnosticErrors.ai_cost_indeterminate}</DetailText>}
      </form> : <EmptyState icon={ScanText} preview={connections.previous ? undefined : "diagnostics"} title={connections.previous ? "Nenhuma conexão nesta página" : "Nenhuma conexão disponível"}
        description={connections.previous ? "Volte para as conexões da página anterior." : manager ? selfServeWhatsApp ? "Conecte um WhatsApp para analisar as conversas da operação." :
          "Solicite a conexão do WhatsApp da equipe à implantação para iniciar o diagnóstico." :
          "Peça ao gestor para atribuir uma linha à sua conta antes de iniciar uma análise."}
        action={connections.previous ? <Button size="sm" onClick={connections.previous}>Página anterior</Button> :
          <ButtonLink href="#whatsapps" size="sm" variant="secondary">Ver WhatsApps</ButtonLink>} />}</ReadState></DetailSection>
    {!confirmation && startError && <p role="alert">{startError}</p>}
    {!waiting && !action.pending && <CursorNav page={connections} label="Páginas de conexões" />}
    {id && <DetailSection title="Acompanhamento" meta={lines.find(line => line.id === run.data?.connectionId)?.name}>
      <ReadState read={run} notFound={<EmptyState size="compact" icon={ScanText} title="Leitura indisponível"
        description="Consulte o histórico da conexão para escolher outra leitura."
        action={<ButtonLink href="#diagnosticos" size="sm" onClick={() => {setSelection(null);sessionStorage.removeItem(storageKey);}}>Voltar aos diagnósticos</ButtonLink>} />}>{job => <>
        <p role="status">{job.reconcileHours && `Conciliação · ${job.reconcileHours} h · `}{runLabels[job.status]}{run.reconnecting && " · Restabelecendo conexão…"}</p><DiagnosticResult job={job} tracking />
        {!verifyCost && (job.status === "failed" || (job.status === "completed" && job.report?.hasBacklog === true)) &&
          (job.reconcileHours ? manager && retryLine?.source === "evolution" &&
            <Button disabled={action.pending} onClick={() => reviewReconciliation(retryLine,job.reconcileHours)}>Revisar e repetir conciliação</Button> :
            <Button disabled={action.pending} onClick={() => start(job.connectionId)}>
            {action.pending ? "Enfileirando…" : job.status === "failed" ? "Tentar diagnóstico novamente" : "Continuar leitura desta linha"}
          </Button>)}
      </>}</ReadState></DetailSection>}
    {activeLine && <DetailSection title="Histórico da conexão"><ReadState retain read={history}>{({items}) =>
      items.length ? <div className="flow">{items.map(historyEntry)}</div> :
        <EmptyState icon={ScanText} preview={history.previous ? undefined : "diagnostics"} size="compact" title={history.previous ? "Esta página está vazia" : "Nenhuma leitura nesta conexão"}
          description={history.previous ? "Volte à página anterior para conferir as leituras." : "Inicie a análise pelo formulário acima para acompanhar o processamento aqui."} />}</ReadState>
      {previousReport?.connectionId === activeLine.id && !history.data?.items.some(job => job.id === previousReport.id) &&
        <div><DetailText>Relatório anterior à tentativa</DetailText>{historyEntry(previousReport)}</div>}
      <CursorNav page={history} label="Páginas de diagnósticos" /></DetailSection>}
    {confirmation && manager && <ReconciliationDialog line={confirmation.line} initialHours={confirmation.hours}
      pending={action.pending} disabled={!!waiting || verifyCost} error={startError} blocked={blocked} close={closeConfirmation}
      confirm={hours => start(confirmation.line.id,hours)} />}
  </DetailPage>;
}
