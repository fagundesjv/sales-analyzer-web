"use client";
import {useState} from "react";
import {Activity, CalendarDays, LockKeyhole} from "lucide-react";
import {Button, ButtonLink} from "@content-ventures/design-system/v3";
import {DetailPage, DetailRows, DetailSection, DetailText} from "../../src/ui/os/detail";
import {StatTiles} from "../../src/ui/os/stat-tiles";
import {EmptyState} from "../../src/ui/os/empty-state";
import {useV2Read} from "../../lib/v2-client";
import {ReadState} from "./read-state";

const integers = new Intl.NumberFormat("pt-BR");
const monthPattern = /^[1-9]\d{3}-(0[1-9]|1[0-2])$/;

// The API supplies decimal strings. Keep all six fractional digits when needed.
function usd(micros) {
  const amount = BigInt(micros);
  const fraction = String(amount % 1000000n).padStart(6,"0").replace(/0+$/,"").padEnd(2,"0");
  return "US$ " + integers.format(amount / 1000000n) + "," + fraction;
}

function UsageResult({data, period, currentMonth, workspaceId, showCurrent}) {
  if (data.workspaceId !== workspaceId || data.period !== period)
    return <p role="alert">A leitura recebida corresponde a outra empresa ou período. Consulte o mês novamente.</p>;
  const metered = data.mode === "provider_metered";
  if ((!metered && data.mode !== "local_simulated") || data.scope !== "diagnostic_analysis")
    return <p role="alert">O modo ou o escopo desta leitura de uso é incompatível.</p>;
  const {commercial, cost, currentTariff} = data;
  const blocked = cost.blockedReason === "provider_usage_above_cap";
  const available = blocked ? "0" : cost.availableMicros;
  const units = currentTariff?.tokenizer === "utf8-bytes-v1" ? "bytes UTF-8" : "tokens";
  const hasRecordedCost = cost.authorizedCount > 0 || cost.indeterminateCount > 0 || cost.settledCount > 0 ||
    BigInt(cost.reservedMicros) > 0n || BigInt(cost.settledMicros) > 0n;
  const past = period < currentMonth;
  const noHistory = past && commercial.limitCalls === null && cost.limitMicros === null &&
    !commercial.reservedCalls && !commercial.consumedCalls && !cost.authorizedCount && !cost.indeterminateCount && !cost.settledCount &&
    BigInt(cost.reservedMicros) === 0n && BigInt(cost.settledMicros) === 0n;
  if (noHistory && !blocked) return <DetailSection title="Ciclo sem histórico">
    <EmptyState icon={CalendarDays} preview="usage" title="Sem uso registrado neste mês"
      description="Não há consumo ou orçamento nesse ciclo. Confira o mês atual para acompanhar a operação."
      action={<Button size="sm" variant="secondary" onClick={showCurrent}>Ver mês atual</Button>} />
  </DetailSection>;

  return <>
    <DetailSection title="Franquia de chamadas">
      <StatTiles label="Chamadas de análise" items={[
        {id:"used",label:"Consumidas",value:integers.format(commercial.consumedCalls)},
        {id:"reserved",label:"Reservadas",value:integers.format(commercial.reservedCalls)},
        {id:"limit",label:"Franquia do mês",value:commercial.limitCalls === null ? "Sem registro" : integers.format(commercial.limitCalls)},
      ]} />
    </DetailSection>
    <DetailSection title="Custo de execução" meta="USD">
      {!past && !hasRecordedCost && !blocked && commercial.consumedCalls === 0 && commercial.reservedCalls === 0 &&
        <EmptyState size="compact" icon={Activity} preview="usage" title="Nenhuma execução neste ciclo"
          description="O consumo aparece aqui quando uma análise da equipe é processada."
          action={<ButtonLink href="#diagnosticos" size="sm">Ver diagnósticos</ButtonLink>} />}
      <DetailText>{metered
        ? "O custo usa os tokens confirmados pelo provedor e a versão da tarifa aplicada à análise. Esse valor acompanha o orçamento. A fatura final é apurada pelo provedor."
        : hasRecordedCost ? "Os valores deste ciclo são estimativas calculadas sem medição do provedor."
        : "Nenhum custo de execução foi registrado neste ciclo."}</DetailText>
      {blocked && <div role="status"><strong>Novos envios para análise bloqueados neste mês</strong>
        <DetailText>O uso informado pelo provedor excedeu o limite autorizado. A reserva da empresa permanece registrada neste mês.</DetailText></div>}
      {cost.limitMicros === null && <strong>{past ? "Sem orçamento registrado neste ciclo" : "Sem orçamento configurado para este ciclo"}</strong>}
      <DetailRows items={[
        {label:"Custo liquidado",value:usd(cost.settledMicros)},
        {label:"Reserva total",value:usd(cost.reservedMicros)},
        {label:"Parcela indeterminada da reserva",value:usd(cost.indeterminateMicros)},
        {label:"Saldo disponível",value:available === null ? "Sem saldo definido" : usd(available)},
        ...(cost.limitMicros === null ? [] : [{label:"Orçamento do mês",value:usd(cost.limitMicros)}]),
      ]} />
      {cost.indeterminateCount > 0 && <DetailText>A reserva total já inclui o valor das execuções que aguardam confirmação.</DetailText>}
    </DetailSection>
    {currentTariff && <details><summary>{metered ? "Tarifa vigente de controle do orçamento" : "Tarifa usada na estimativa"}</summary>
      <DetailRows items={[
        {label:"Modelo",value:currentTariff.model},
        {label:"Versão da tarifa",value:currentTariff.version},
        {label:"Entrada por milhão de " + units,value:usd(currentTariff.inputMicrosPerMillion)},
        {label:"Saída por milhão de " + units,value:usd(currentTariff.outputMicrosPerMillion)},
        {label:"Limite de entrada",value:integers.format(currentTariff.maxInputTokens) + " " + units},
        {label:"Limite de saída",value:integers.format(currentTariff.maxOutputTokens) + " " + units},
      ]} />
    </details>}
  </>;
}

export function BudgetUsage({session,context}) {
  const currentMonth = new Date().toISOString().slice(0,7);
  const [period,setPeriod] = useState(currentMonth);
  const manager = session.workspace.role === "manager";
  const validPeriod = monthPattern.test(period) && period <= currentMonth;
  const usage = useV2Read(manager && validPeriod ? "budget/usage?period=" + period : null,context,0,"budget/usage");
  return <DetailPage title="Uso da empresa" icon={Activity}>
    {manager ? <>
      <label className="op-field" data-stable-phone-tabs>Mês de referência (UTC)
        <input type="month" value={period} min="1000-01" max={currentMonth} onChange={event => setPeriod(event.target.value)} />
      </label>
      {validPeriod ? <ReadState retain read={usage}>{data => <UsageResult data={data} period={period}
        currentMonth={currentMonth} workspaceId={session.workspace.id} showCurrent={() => setPeriod(currentMonth)} />}</ReadState> :
        <p role="status">Escolha o mês atual ou um mês anterior.</p>}
    </> : <EmptyState icon={LockKeyhole} title="Uso disponível para gestores"
      description="O gestor acompanha o consumo e o orçamento da empresa. Você pode seguir para o seu trabalho no Dashboard."
      action={<ButtonLink href="#dashboard" size="sm" variant="secondary">Abrir Dashboard</ButtonLink>} />}
  </DetailPage>;
}
