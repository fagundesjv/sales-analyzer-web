import {selfServeWhatsApp} from "../../lib/v2-capabilities";

export function connectionNextStep(manager, lines) {
  if (lines.some(line => line.status === "connected")) return {
    title:"Sua linha está pronta para a primeira análise",
    description:"Inicie um diagnóstico. A Zoe lê as conversas da linha e identifica oportunidades de recuperação.",
    label:"Iniciar diagnóstico", href:"#diagnosticos",
  };
  if (lines.some(line => line.source === "synthetic")) return {
    title:"Sua primeira leitura de exemplo",
    description:"Inicie um diagnóstico para explorar como a Zoe organiza as conversas de teste.",
    label:"Iniciar diagnóstico", href:"#diagnosticos",
  };
  const whatsapp = lines.filter(line => line.channel === "whatsapp" || line.source === "evolution");
  if (whatsapp.length) {
    const preparing = whatsapp.every(line => line.status === "provisioning");
    if (preparing) return {
      title:"Seu WhatsApp está em preparação",
      description:manager && selfServeWhatsApp ? "Abra a linha da equipe para continuar a conexão e acessar o QR Code." :
        "Acompanhe o estado da linha. Assim que ela estiver conectada, você poderá iniciar a análise.",
      label:manager && selfServeWhatsApp ? "Continuar conexão" : "Ver meus WhatsApps", href:"#whatsapps",
    };
    return {
      title:"Confira a conexão do WhatsApp",
      description:manager ? "Abra a linha para conferir o estado e escanear o QR Code, se necessário." :
        "Confira sua linha e peça ao gestor para concluir o pareamento, se necessário.",
      label:"Ver meus WhatsApps", href:"#whatsapps",
    };
  }
  return {
    title:"Toda conversa começa com uma conexão",
    description:manager ? selfServeWhatsApp ?
      "Conecte o WhatsApp da equipe para trazer as conversas e encontrar oportunidades com a Zoe." :
      "Solicite a conexão do WhatsApp à equipe de implantação para a Zoe identificar vendas a recuperar." :
      "Peça ao gestor para atribuir um WhatsApp à sua conta. Após a primeira análise, suas conversas aparecem aqui.",
    label:manager ? selfServeWhatsApp ? "Conectar WhatsApp" : "Ver orientações de conexão" : "Ver meus WhatsApps",
    href:"#whatsapps",
  };
}
