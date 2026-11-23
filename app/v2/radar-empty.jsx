"use client";
import {Button, ButtonLink} from "@content-ventures/design-system/v3";
import {Bell, Handshake, Radar} from "lucide-react";
import {useV2Read} from "../../lib/v2-client";
import {selfServeWhatsApp} from "../../lib/v2-capabilities";
import {FirstAccess} from "../../src/ui/os/empty-state";
import {connectionNextStep} from "./connection-next-step";

const sections = {
  radar: {
    icon: Radar, title: "Veja quais conversas retomar primeiro",
    quiet: "Nenhuma conversa para priorizar",
    purpose: "A Zoe prioriza conversas com sinais de venda em risco.",
    description: "Nenhuma conversa entrou na fila de recuperação. Você pode acompanhar os atendimentos na caixa de entrada.",
  },
  deals: {
    icon: Handshake, title: "Acompanhe suas primeiras negociações",
    quiet: "Nenhuma negociação identificada",
    purpose: "A Zoe identifica pedidos de orçamento, objeções e sinais de compra.",
    description: "As conversas analisadas seguem disponíveis na caixa de entrada. As negociações aparecem aqui quando a Zoe encontra um sinal comercial.",
  },
  alerts: {
    icon: Bell, title: "Receba alertas da sua operação",
    quiet: "Nenhum alerta por enquanto",
    purpose: "Acompanhe vendas em risco, perdas e interrupções do WhatsApp.",
    description: "Os alertas aparecem quando há sinais de perda, vendas em risco ou uma desconexão do WhatsApp.",
  },
};

const readingStatus = {
  queued: ["Leitura na fila", "A Zoe recebeu a solicitação. Acompanhe o diagnóstico para ver quando a leitura começar.", "Acompanhar leitura"],
  running: ["A Zoe está analisando as conversas", "Os resultados aparecem quando a leitura termina. Você pode acompanhar o progresso agora.", "Acompanhar leitura"],
  failed: ["A última leitura foi interrompida", "Confira o motivo no diagnóstico antes de iniciar uma nova tentativa.", "Ver diagnóstico"],
};

export function useRadarEmpty(enabled, session, context, kind) {
  const summary = useV2Read(enabled ? "summary" : null,context);
  const needsLines = enabled && summary.data?.conversations === 0;
  const connections = useV2Read(needsLines ? "connections?limit=100" : null,context);
  const lines = connections.data?.items;
  const ready = lines?.some(line => line.status === "connected");
  const needsReading = needsLines && ready && kind !== "alerts";
  const history = useV2Read(needsReading ? "diagnostics?limit=1" : null,context);
  if (!summary.data) return summary;
  if (!needsLines) return {data:{step:null}};
  if (!connections.data) return connections;
  if (ready && kind === "alerts") return {data:{step:null}};
  if (needsReading && !history.data) return history;
  const job = history.data?.items[0];
  if (job && lines.some(line => line.id === job.connectionId && line.status === "connected")) {
    const status = readingStatus[job.status];
    const href = "#diagnosticos/"+job.id;
    if (status) return {data:{step:{heading:status[0],description:status[1],label:status[2],href}}};
    if (job.status === "completed") return {data:{step:{
      heading:sections[kind].quiet,description:"A última leitura foi concluída. Confira os resultados no diagnóstico.",
      label:"Ver última leitura",href,
    }}};
  }
  const manager = session.workspace.role === "manager";
  if (connections.data.nextCursor && !ready) return {data:{step:{
    heading:"Confira as linhas disponíveis",description:"Consulte os WhatsApps para conferir o estado das demais linhas.",
    label:manager ? "Ver WhatsApps" : "Ver meus WhatsApps",href:"#whatsapps",
  }}};
  const step = connectionNextStep(manager,lines);
  if (!lines.length) {
    const guidance = manager ? (selfServeWhatsApp ? "Conecte o WhatsApp da equipe para começar." :
      "Solicite a conexão do WhatsApp à equipe de implantação.") : "Peça ao gestor para atribuir um WhatsApp à sua conta.";
    return {data:{step:{...step,description:sections[kind].purpose+" "+guidance}}};
  }
  return {data:{step}};
}

export function RadarEmpty({kind, step, openRules, notice}) {
  const section = sections[kind];
  return <FirstAccess notice={notice} headingId={kind+"-empty-title"} preview={kind} icon={section.icon}
    tools={openRules && step && <Button variant="ghost" size="sm" onClick={openRules}>Regras de alerta</Button>}
    title={step?.heading || (step ? section.title : section.quiet)} description={step ? step.description : section.description}
    action={openRules && !step ? <Button variant="primary" shape="pill" onClick={openRules}>Regras de alerta</Button> :
      <ButtonLink variant="primary" shape="pill" href={step?.href || "#entrada"}>
        {step?.label || "Abrir conversas"}</ButtonLink>} />;
}
