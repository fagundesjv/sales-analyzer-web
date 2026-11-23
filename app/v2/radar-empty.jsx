"use client";
import {Button, ButtonLink} from "@content-ventures/design-system/v3";
import {Bell, Handshake, Radar} from "lucide-react";
import {useV2Read} from "../../lib/v2-client";
import {FirstAccess} from "../../src/ui/os/empty-state";
import {connectionNextStep} from "./connection-next-step";

const sections = {
  radar: {
    icon: Radar, title: "Veja quais conversas retomar primeiro",
    quiet: "Nenhuma conversa para priorizar",
    onboarding: "Conecte o WhatsApp para a Zoe identificar quais clientes precisam de uma resposta primeiro.",
    description: "A Zoe já analisou conversas. Quando identificar uma oportunidade de recuperação, ela aparecerá aqui.",
  },
  deals: {
    icon: Handshake, title: "Acompanhe suas primeiras negociações",
    quiet: "Nenhuma negociação identificada",
    onboarding: "Conecte o WhatsApp para a Zoe encontrar pedidos de orçamento, objeções e sinais de compra nas conversas.",
    description: "As conversas analisadas seguem disponíveis na caixa de entrada. As negociações aparecem aqui quando a Zoe encontra um sinal comercial.",
  },
  alerts: {
    icon: Bell, title: "Receba alertas da sua operação",
    quiet: "Nenhum alerta por enquanto",
    onboarding: "Conecte o WhatsApp para acompanhar riscos de perda e interrupções da conexão.",
    description: "Os alertas aparecem quando há sinais de perda, vendas em risco ou uma desconexão do WhatsApp.",
  },
};

// A zero in a filtered list is not evidence that the company is new.
export function useRadarEmpty(enabled, session, context) {
  const summary = useV2Read(enabled ? "summary" : null,context);
  const connections = useV2Read(enabled && summary.data?.conversations === 0 ? "connections?limit=100" : null,context);
  if (!summary.data) return summary;
  if (summary.data.conversations > 0) return {data:{step:null}};
  if (!connections.data) return connections;
  return {data:{step:connectionNextStep(session.workspace.role === "manager",connections.data)}};
}

export function RadarEmpty({kind, step, openRules, notice}) {
  const section = sections[kind];
  const description = step?.canConnect ? section.onboarding : step?.description || section.description;
  return <FirstAccess notice={notice} headingId={kind+"-empty-title"} preview={kind} icon={section.icon}
    tools={openRules && step && <Button variant="ghost" size="sm" onClick={openRules}>Regras de alerta</Button>}
    title={step ? section.title : section.quiet} description={description}
    action={openRules && !step ? <Button variant="primary" shape="pill" onClick={openRules}>Regras de alerta</Button> :
      <ButtonLink variant="primary" shape="pill" href={step?.href || "#entrada"}>
        {step?.label || "Abrir conversas"}</ButtonLink>} />;
}
