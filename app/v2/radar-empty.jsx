"use client";
import {Button, ButtonLink} from "@content-ventures/design-system/v3";
import {Bell, Handshake, Radar} from "lucide-react";
import {useV2Read} from "../../lib/v2-client";
import {FirstAccess} from "../../src/ui/os/empty-state";
import {connectionNextStep} from "./connection-next-step";
import {ReadState} from "./read-state";

const sections = {
  radar: {
    icon: Radar, title: "Veja quais conversas retomar primeiro",
    quiet: "Nenhuma conversa para priorizar",
    description: "A Zoe já analisou conversas. Quando identificar uma oportunidade de recuperação, ela aparecerá aqui.",
  },
  deals: {
    icon: Handshake, title: "Acompanhe suas primeiras negociações",
    quiet: "Nenhuma negociação identificada",
    description: "As conversas analisadas seguem disponíveis na caixa de entrada. As negociações aparecem aqui quando a Zoe encontra um sinal comercial.",
  },
  alerts: {
    icon: Bell, title: "Receba alertas da sua operação",
    quiet: "Nenhum alerta por enquanto",
    description: "Os alertas aparecem quando há sinais de perda, vendas em risco ou uma desconexão do WhatsApp.",
  },
};

export function RadarEmpty({kind, session, context, openRules, notice}) {
  const summary = useV2Read("summary",context);
  const connections = useV2Read(summary.data?.conversations === 0 ? "connections?limit=100" : null,context);
  const section = sections[kind];
  const headingId = kind + "-empty-title";

  function panel(step) {
    const rulesPrimary = openRules && !step;
    return <FirstAccess notice={notice}
        tools={openRules && step && <Button variant="ghost" size="sm" onClick={openRules}>Regras de alerta</Button>} headingId={headingId} preview={kind} icon={section.icon}
        title={step ? section.title : section.quiet} description={step ? step.description : section.description}
        action={rulesPrimary ? <Button variant="primary" shape="pill" onClick={openRules}>Regras de alerta</Button> :
          <ButtonLink variant="primary" shape="pill" href={step?.href || "#entrada"}>
            {step?.label || "Abrir conversas"}</ButtonLink>} />;
  }

  return <ReadState read={summary}>{data => data.conversations > 0 ? panel(null) :
    <ReadState read={connections}>{({items}) => panel(connectionNextStep(session.workspace.role === "manager",items))}</ReadState>
  }</ReadState>;
}
