"use client";
import {Badge,ButtonLink} from "@content-ventures/design-system/v3";
import {Layers, LockKeyhole} from "lucide-react";
import {DetailPage,DetailSection,DetailText} from "../../src/ui/os/detail";
import {StatTiles} from "../../src/ui/os/stat-tiles";
import {EmptyState} from "../../src/ui/os/empty-state";
import {useV2Read} from "../../lib/v2-client";
import {ReadState} from "./read-state";
import {PlanEstimate} from "../seat-plan";
import planStyles from "../seat-plan.module.css";

const digits=new Intl.NumberFormat("pt-BR");
const date=new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeZone:"UTC"});

export function ConnectedCredits({session, context}) {
  const manager=session.workspace.role==="manager";
  const read=useV2Read(manager?"credits":null,context);
  const exhausted=read.data?.availableCalls===0;
  return <DetailPage title="Plano e créditos" icon={Layers}
    status={manager && exhausted ? <Badge>Saldo esgotado</Badge> : undefined}
    actions={manager ? <ButtonLink href="#uso" variant="secondary">Ver uso da empresa</ButtonLink> : undefined}>
    <div className={planStyles.page}>
      <PlanEstimate count={1} showPublicOffer={false} />
    </div>
    {manager ? <ReadState read={read}>{value=>{
      if(value.workspaceId!==session.workspace.id)
        return <p role="alert">A empresa da consulta mudou. Atualize a página.</p>;
      const reset=date.format(new Date(value.nextCycleStartsOn+"T00:00:00Z"));
      return <DetailSection title="Franquia de análises">
        <StatTiles label="Créditos do ciclo mensal" items={[
          {id:"limit",label:"Limite do mês",value:digits.format(value.limitCalls)},
          {id:"used",label:"Consumidos",value:digits.format(value.consumedCalls)},
          {id:"reserved",label:"Reservados",value:digits.format(value.reservedCalls)},
          {id:"available",label:"Disponíveis",value:digits.format(value.availableCalls)},
        ]} />
        <DetailText>Próximo ciclo em {reset} (UTC).</DetailText>
        {exhausted && <DetailText>Novas análises exigem saldo. Leituras já publicadas continuam acessíveis.</DetailText>}
      </DetailSection>;
    }}</ReadState> : <EmptyState icon={LockKeyhole} title="Plano disponível para gestores"
      description="O gestor acompanha a franquia de análises da empresa. Volte ao Dashboard para seguir com suas conversas."
      action={<ButtonLink href="#dashboard" size="sm" variant="secondary">Abrir Dashboard</ButtonLink>} />}
  </DetailPage>;
}
