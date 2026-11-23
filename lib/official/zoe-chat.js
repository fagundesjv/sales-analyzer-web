// Official Zoe question transport and progress labels, sales-analyzer 6a52bcdb.
// lib/zoe-chat/contracts.ts
var ZOE_CHAT_LIMITS = {
  questionMinChars: 2,
  questionChars: 500,
  /** Brasília day. Per company overridable by `workspace_plans.zoe_questions_per_day`. */
  companyPerDay: 100,
  userPerDay: 40,
  inFlightPerUser: 1,
  inFlightPerCompany: 3,
  /** 5 gathering rounds + 1 correction round. */
  modelCalls: 6,
  gatherRounds: 5,
  dataToolCalls: 8,
  dataToolCallsPerRound: 4,
  maxOutputTokens: 3e3,
  maxInputTokens: 8e4,
  modelTimeoutMs: 2e4,
  toolTimeoutMs: 8e3,
  /** Whole turn, wall clock; a model call is not started with less than `minModelWindowMs` left. */
  deadlineMs: 45e3,
  minModelWindowMs: 12e3,
  toolOutputChars: 16e3,
  /** Question/answer pairs of the thread sent to the model (as text, never old tool outputs). */
  historyPairs: 3,
  historyAnswerChars: 1200,
  threadMessages: 200,
  threadsPage: 20,
  /** A row still "respondendo" after this is read as interrupted. */
  staleAnswerMs: 9e4,
  retentionDays: 90,
  usageRetentionDays: 400,
  /** The composer says "Restam N perguntas hoje" from this many down. */
  remainingHintAt: 10,
  suggestions: 4
};
var ZOE_STEPS = {
  lendo_leitura: "Lendo a \xFAltima leitura\u2026",
  lendo_fila: "Lendo a fila\u2026",
  buscando_conversas: "Procurando as conversas\u2026",
  lendo_conversa: "Lendo a conversa\u2026",
  abrindo_relatorio: "Abrindo o relat\xF3rio\u2026",
  somando_risco: "Somando o valor em risco\u2026",
  comparando_leituras: "Comparando as leituras\u2026",
  vendo_mudancas: "Vendo o que mudou\u2026",
  lendo_dias: "Lendo os dias anteriores\u2026",
  lendo_empresa: "Lendo os dados da empresa\u2026",
  lendo_anexo: "Lendo seu anexo\u2026",
  conferindo: "Conferindo os n\xFAmeros\u2026"
};
var ZOE_CHAT_SENTENCES = {
  refusal: "Eu respondo s\xF3 sobre a opera\xE7\xE3o da sua empresa, com base nas conversas que li nos seus WhatsApps. Posso te dizer, por exemplo, quem est\xE1 esperando resposta.",
  fallback: "N\xE3o consegui montar uma resposta segura com os dados das an\xE1lises. Tente perguntar de outro jeito.",
  unanswered: "A Zoe n\xE3o conseguiu responder agora. Tente de novo em instantes.",
  interrupted: "A resposta foi interrompida. Pergunte de novo.",
  correction: "Remova as afirma\xE7\xF5es rejeitadas e chame responder de novo, s\xF3 com dados das ferramentas desta pergunta. Para m\xE9tricas da empresa, use indicadores s\xF3 com refs numero:* j\xE1 retornados; o servidor preenche os valores e unidades. Use texto curto sem repetir quantidades ou dura\xE7\xF5es. Em prioridades, use um bloco conversas s\xF3 com os refs retornados; a tela apresenta os detalhes da fonte.",
  noCall: "Chame responder ou recusar."
};

// lib/zoe-chat/attachment-contracts.ts
var ZOE_ATTACHMENT_TYPES = {
  imagem: { mimes: ["image/jpeg", "image/png", "image/webp"], extensoes: ["jpg", "jpeg", "png", "webp"], maxBytes: 5 * 1024 * 1024, rotulo: "Imagem" },
  pdf: { mimes: ["application/pdf"], extensoes: ["pdf"], maxBytes: 5 * 1024 * 1024, rotulo: "PDF" },
  csv: { mimes: ["text/csv", "application/csv", "application/vnd.ms-excel", "text/plain"], extensoes: ["csv"], maxBytes: 1024 * 1024, rotulo: "CSV" },
  texto: { mimes: ["text/plain"], extensoes: ["txt"], maxBytes: 1024 * 1024, rotulo: "Texto" }
};
var ZOE_ATTACHMENT_LIMITS = {
  perQuestion: 4,
  pdfPerQuestion: 1,
  /** Sum of the files of one question. */
  bytesPerQuestion: 12 * 1024 * 1024,
  pdfPages: 20,
  /** Before the browser re-encodes a photo (JPEG, longest side `imageSide`). */
  rawImageBytes: 25 * 1024 * 1024,
  imageSide: 2048,
  nameChars: 80,
  /** Text sent to the model per text attachment (csv/texto); `cortado` beyond. */
  textChars: 16e3,
  csvRows: 200,
  csvColumns: 30,
  /** Brasília day; overridable by env (ZOE_CHAT_ATTACHMENTS_PER_USER_DAY / _PER_DAY). */
  userPerDay: 20,
  companyPerDay: 60,
  /** Images and PDFs are kept this long after the upload, then only their name, type and size remain. */
  binaryHours: 24,
  /** An attachment never sent with a question is deleted after this. */
  unsentMinutes: 60,
  /** Attachments of earlier questions of the same thread the model may still read (besides this question's). */
  earlierInThread: 3
};
var ZOE_DICTATION_LIMITS = {
  maxSeconds: 120,
  /** The timer turns amber from here. */
  warnSeconds: 110,
  minSeconds: 1,
  maxBytes: 4 * 1024 * 1024,
  /** Brasília day; overridable by env (ZOE_CHAT_DICTATIONS_PER_USER_DAY / _PER_DAY). */
  userPerDay: 60,
  companyPerDay: 300,
  providerTimeoutMs: 3e4,
  /** The recording types the browser may send, in the order the composer prefers them. */
  mimes: ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]
};

// components/zoe-chat/dictation-model.ts
var DICTATION_COPY = {
  start: "Ditar pergunta",
  cancel: "Cancelar grava\xE7\xE3o",
  confirm: "Transcrever grava\xE7\xE3o",
  recording: "Gravando",
  transcribing: "Transcrevendo\u2026",
  inserted: "Texto inserido. Revise e envie.",
  blocked: "O microfone est\xE1 bloqueado. Libere o acesso ao microfone nas configura\xE7\xF5es do navegador.",
  missing: "Nenhum microfone encontrado neste aparelho.",
  busy: "O microfone est\xE1 em uso por outro aplicativo.",
  unsupported: "Este navegador n\xE3o grava \xE1udio. Digite sua pergunta.",
  short: "Grava\xE7\xE3o curta demais. Fale e confirme de novo.",
  cut: `O ditado passou de ${ZOE_CHAT_LIMITS.questionChars} caracteres; revise o fim.`,
  noAnswer: "O servidor n\xE3o respondeu. Tente de novo."
};

// components/zoe-chat/zoe-chat-api.ts
var ZOE_CHAT_PATHS = {
  state: "/api/zoe/chat",
  threads: "/api/zoe/chat/historicos",
  thread: (id) => `/api/zoe/chat/historicos/${encodeURIComponent(id)}`,
  ask: "/api/zoe/chat/perguntas",
  attachments: "/api/zoe/chat/anexos",
  attachment: (id) => `/api/zoe/chat/anexos/${encodeURIComponent(id)}`,
  attachmentContent: (id) => `/api/zoe/chat/anexos/${encodeURIComponent(id)}/conteudo`,
  dictation: "/api/zoe/chat/transcricao"
};
var NO_ANSWER = "O servidor n\xE3o respondeu. Tente de novo.";
var EXPIRED = "Sua sess\xE3o expirou. Entre novamente para continuar.";
var FAILED = "N\xE3o foi poss\xEDvel concluir. Tente de novo.";
var ZoeChatRequestError = class extends Error {
  constructor(message, status, code = null, retryAfter = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
};
async function failure(response) {
  const body = await response.json().catch(() => ({}));
  const wait = Number(response.headers.get("retry-after"));
  const message = response.status === 401 ? EXPIRED : typeof body.error === "string" && body.error ? body.error : FAILED;
  return new ZoeChatRequestError(message, response.status, typeof body.code === "string" ? body.code : null, Number.isFinite(wait) && wait > 0 ? wait : null);
}
async function request(fetcher, path, init) {
  const response = await fetcher(path, { cache: "no-store", ...init }).catch((cause) => {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ZoeChatRequestError(NO_ANSWER, 0, "NO_ANSWER");
  });
  if (!response.ok) throw await failure(response);
  return response;
}
var json = async (fetcher, path, init) => (await request(fetcher, path, init)).json();
async function* readNdjson(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  try {
    for (; ; ) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) yield JSON.parse(line);
        newline = buffer.indexOf("\n");
      }
      if (done) break;
    }
    if (buffer.trim()) yield JSON.parse(buffer.trim());
  } finally {
    reader.releaseLock();
  }
}
var EVENT_KINDS = /* @__PURE__ */ new Set(["inicio", "etapa", "fim", "erro"]);
var isAskEvent = (value) => Boolean(value) && typeof value === "object" && EVENT_KINDS.has(value.tipo);
var sleep = (ms, signal) => new Promise((resolve, reject) => {
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener("abort", () => {
    clearTimeout(timer);
    reject(new DOMException("Aborted", "AbortError"));
  }, { once: true });
});
var ASK_TIMING = { pollMs: 2e3, pollForMs: ZOE_CHAT_LIMITS.staleAnswerMs, sleep };
function interruptedAnswer(id, at) {
  return { id, papel: "resposta", status: "falhou", blocos: [{ tipo: "texto", texto: ZOE_CHAT_SENTENCES.interrupted }], citacoes: [], sugestoes: [], fontes: [], leituraEm: null, criadaEm: at };
}
async function consume(response, onEvent) {
  let started = null;
  if (!response.body) return { started, ended: false };
  try {
    for await (const value of readNdjson(response.body)) {
      if (!isAskEvent(value)) continue;
      if (value.tipo === "inicio") started = { historico: value.historico, respostaId: value.respostaId };
      onEvent(value);
      if (value.tipo === "fim" || value.tipo === "erro") return { started, ended: true };
    }
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
  }
  return { started, ended: false };
}
function askQuestion(fetcher, timing = ASK_TIMING) {
  return async (input, onEvent, signal) => {
    const { anexos, ...rest } = input;
    const body = JSON.stringify(anexos?.length ? { ...rest, anexos } : rest);
    const init = () => ({ method: "POST", body, signal, headers: { "content-type": "application/json", accept: "application/x-ndjson" } });
    let waited = 0;
    const wait = async (ms) => {
      waited += ms;
      await timing.sleep(ms, signal);
    };
    const spent = () => waited >= timing.pollForMs;
    let attempt = 0;
    let started = null;
    while (!started) {
      attempt += 1;
      let response;
      try {
        response = await request(fetcher, ZOE_CHAT_PATHS.ask, init());
      } catch (cause) {
        const retryable = cause instanceof ZoeChatRequestError && (cause.code === "NO_ANSWER" || attempt > 1 && cause.code === "ZOE_BUSY");
        if (!retryable || spent()) throw cause;
        await wait(cause.retryAfter ? cause.retryAfter * 1e3 : timing.pollMs);
        continue;
      }
      const seen = await consume(response, onEvent);
      if (seen.ended) return;
      started = seen.started;
      if (!started) {
        if (spent()) throw new ZoeChatRequestError(NO_ANSWER, 0, "NO_ANSWER");
        await wait(timing.pollMs);
      }
    }
    const accepted = started;
    while (!spent()) {
      await wait(timing.pollMs);
      const thread = await json(fetcher, ZOE_CHAT_PATHS.thread(accepted.historico.id), { signal }).catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
        return null;
      });
      const answer = thread?.mensagens.find((message) => message.papel === "resposta" && message.id === accepted.respostaId);
      if (thread && answer && answer.status !== "respondendo") {
        onEvent({ tipo: "recuperada", historico: { id: thread.id, titulo: thread.titulo, ultimaEm: thread.ultimaEm }, resposta: answer });
        return;
      }
    }
    onEvent({ tipo: "recuperada", historico: accepted.historico, resposta: interruptedAnswer(accepted.respostaId, accepted.historico.ultimaEm) });
  };
}
export {
  ZOE_STEPS,
  askQuestion
};
