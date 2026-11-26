// Official V1 filter IDs, labels and ordering, audited from ee2a28bb. Counts are supplied by the current authorized API.
export const commercialFilters = [
  {
    "id": "todas",
    "name": "Todas",
    "order": "recentes"
  },
  {
    "id": "esperando",
    "name": "Esperando resposta",
    "order": "urgencia"
  },
  {
    "id": "quentes_esperando",
    "name": "Quentes esperando",
    "order": "urgencia"
  },
  {
    "id": "esperando_30",
    "name": "Há mais de 30 min",
    "order": "urgencia"
  },
  {
    "id": "em_risco",
    "name": "Em risco",
    "order": "valor_em_risco"
  },
  {
    "id": "follow_up",
    "name": "Follow-ups para hoje",
    "order": "recentes"
  },
  {
    "id": "hoje",
    "name": "Conversas de hoje",
    "order": "recentes"
  },
  {
    "id": "novos_hoje",
    "name": "Contatos novos hoje",
    "order": "recentes"
  },
  {
    "id": "atividade_24h",
    "name": "Últimas 24 horas",
    "order": "recentes"
  },
  {
    "id": "atividade_48h",
    "name": "Últimas 48 horas",
    "order": "recentes"
  },
  {
    "id": "vendas_hoje",
    "name": "Vendas de hoje",
    "order": "valor_venda"
  },
  {
    "id": "vendas",
    "name": "Vendas no período",
    "order": "valor_venda"
  },
  {
    "id": "resolvidos",
    "name": "Resolvidos",
    "order": "recentes"
  },
  {
    "id": "pagos",
    "name": "Ganhos",
    "order": "recentes"
  },
  {
    "id": "perdidos",
    "name": "Perdidos",
    "order": "recentes"
  },
  {
    "id": "anexos_cliente",
    "name": "Cliente enviou PDF ou imagem",
    "order": "recentes"
  },
  {
    "id": "pdf_cliente",
    "name": "Cliente enviou PDF",
    "order": "recentes"
  },
  {
    "id": "imagem_cliente",
    "name": "Cliente enviou imagem",
    "order": "recentes"
  },
  {
    "id": "quentes",
    "name": "Quentes",
    "order": "urgencia"
  },
  {
    "id": "mornos",
    "name": "Mornos",
    "order": "urgencia"
  },
  {
    "id": "frios",
    "name": "Frios",
    "order": "urgencia"
  },
  {
    "id": "sem_temperatura",
    "name": "Sem temperatura",
    "order": "urgencia"
  }
];
export const filterNames = Object.fromEntries(commercialFilters.map(item => [item.id,item.name]));

// Canonical scenario occurrences; independent from the22 inbox filters.
export const commercialSignals = [
  {
    "id": "sem_resposta",
    "name": "Sem resposta"
  },
  {
    "id": "encaminhamento_sem_retorno",
    "name": "Encaminhamento sem retorno"
  },
  {
    "id": "resposta_rasa",
    "name": "Resposta rasa"
  },
  {
    "id": "abertura_impessoal",
    "name": "Abertura não personalizada"
  },
  {
    "id": "compra_sem_triagem",
    "name": "Compra sem triagem"
  },
  {
    "id": "pagamento_presencial_pendente",
    "name": "Pagamento presencial pendente"
  },
  {
    "id": "sem_retomada",
    "name": "Sem retomada"
  },
  {
    "id": "demora",
    "name": "Espera acima de 30 min"
  },
  {
    "id": "sem_proximo_passo",
    "name": "Proposta sem próximo passo"
  },
  {
    "id": "sem_sondagem",
    "name": "Necessidade não investigada"
  }
];
export const signalNames = Object.fromEntries(commercialSignals.map(item => [item.id,item.name]));
