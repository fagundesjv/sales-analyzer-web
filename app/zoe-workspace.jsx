"use client";
import { IconAction } from "../src/ui/os/icon-action";
import { HoldConfirm } from "./hold-confirm";
import { useState } from "react";
import {
  Badge,
  Button,
  ButtonLink,
  Conversation,
  IconButton,
  Menu,
  Tabs,
} from "@content-ventures/design-system/v3";
import { ResponsiveDialog } from "../src/ui/os/responsive-dialog";
import {
  ArrowRight,
  Brain,
  Copy,
  FileText,
  MessageCircle,
  MessagesSquare,
  Plug,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
  Quote,
  PencilLine,
} from "lucide-react";
import { ChatThread } from "../src/ui/os/chat-home";
import { ZoeWelcome } from "./zoe-welcome";
import {
  Ask,
  Answer,
  AnswerText,
  AnswerContent,
  NextRow,
} from "../src/ui/os/chat/turns";
import { readingOf } from "../lib/intake";
import { Composer, StripItem } from "../src/ui/os/chat/composer";
import { Duo } from "../src/ui/os/duo";
import { PanelFacts, PanelSection, PanelStack } from "../src/ui/os/panel";
import { RowGroup, TileRow } from "../src/ui/os/rows";
import { money, totals } from "../lib/operation";
import { contactsOf } from "../lib/operation";
import { channels, threadsOf, inboxHref, primaryThread } from "../lib/inbox";

function RequestBox({ ask, company, active, sources, contextId, setContextId }) {
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [fileError, setFileError] = useState("");
  const context = sources.find((row) => row.thread.id === contextId);
  const questions = [
    ["Quem devo priorizar?", Target],
    ["Qual é o valor em risco?", TrendingUp],
    ["Por que perdemos vendas?", MessagesSquare],
    ["Quais retornos temos na agenda?", FileText],
    ["O que voltou ao estoque?", Brain],
    ["O que mudou desde a última leitura?", FileText],
    ["Quem aguarda há 30 minutos?", MessagesSquare],
    ['Buscar "proposta"', MessageCircle],
    ["O que ficou faltando no pedido?", MessagesSquare],
    ["Preparar retomada", Sparkles],
  ];
  return (
    <Composer
      value={text}
      onChange={setText}
      status="idle"
      label="Pergunta para a Zoe"
      minRows={active ? 1 : 2}
      placeholder={
        active
          ? "Continue a conversa com a Zoe…"
          : "Pergunte sobre perdas, conversas ou o próximo retorno da equipe…"
      }
      onSubmit={(value) => {
        ask(
          value,
          attachment ? "file" : undefined,
          attachment,
          context?.thread || null,
        );
        setAttachment(null);
        setFileError("");
        setText("");
      }}
      tools={
        <>
          <label className="zoe-attach" title="Ler trecho de TXT ou CSV">
            <FileText size={16} />
            <span>Arquivo</span>
            <input
              type="file"
              aria-label="Anexar TXT ou CSV à Zoe"
              accept=".txt,.csv"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                if (
                  !/\.(txt|csv)$/i.test(file.name) ||
                  file.size > 1024 * 1024
                ) {
                  setFileError("Escolha TXT ou CSV de até 1 MB.");
                  return;
                }
                try {
                  const content = (await file.text()).trim();
                  if (!content) {
                    setFileError("O arquivo está vazio.");
                    return;
                  }
                  setAttachment({
                    name: file.name,
                    lines: content.split(/\r?\n/).length,
                    preview: content.slice(0, 2000),
                  });
                  setFileError("");
                  setText("Ler trecho de " + file.name);
                } catch {
                  setFileError("Não foi possível ler o arquivo.");
                }
              }}
            />
          </label>
          <Menu
            label="Adicionar contexto"
            side="top"
            sections={[
              {
                label: "Conversa de origem",
                items: sources.map(({ thread, contact }) => ({
                  label: contact.name + " · " + channels[thread.channel],
                  description: thread.account,
                  icon: MessageCircle,
                  checked: contextId === thread.id,
                  onSelect: () => setContextId(thread.id),
                })),
              },
              {
                items: [
                  {
                    label: "Toda a operação",
                    onSelect: () => setContextId(""),
                  },
                ],
              },
            ]}
            trigger={(props) => (
              <IconButton
                {...props}
                label="Adicionar contexto"
                icon={Plus}
                variant="ghost"
                size="sm"
              />
            )}
          />
          <Menu
            label="Sugestões de análise"
            side="top"
            sections={[
              {
                items: questions.map(([label, icon]) => ({
                  label,
                  icon,
                  onSelect: () => setText(label),
                })),
              },
            ]}
            trigger={(props) => (
              <Button {...props} variant="ghost" size="sm" icon={Sparkles}>
                Analisar
              </Button>
            )}
          />
        </>
      }
      strip={
        <>
          <StripItem icon={Brain}>
            {context
              ? context.contact.name + " · " + channels[context.thread.channel]
              : company}
          </StripItem>
          {fileError && <span role="alert">{fileError}</span>}
          {attachment && (
            <IconAction
              type="button"
              aria-label="Remover arquivo da pergunta"
              onClick={() => {
                setText("");
                setAttachment(null);
              }}
            >
              {attachment.name} ×
            </IconAction>
          )}
          <StripItem end>Zoe · Exemplo local</StripItem>
        </>
      }
    />
  );
}
function Context({
  first,
  ops,
  connected,
  onStart,
  onReturn,
  contact,
  source,
}) {
  const [tab, setTab] = useState("summary");
  const s = contact || first;
  const amounts = totals(ops);
  return (
    <aside className="sales-context">
      <Tabs
        label="Contexto da conversa"
        size="sm"
        value={tab}
        onChange={setTab}
        items={[
          { value: "summary", label: "Visão geral" },
          { value: "source", label: "Fontes" },
        ]}
      />
      <PanelStack>
        {tab === "summary" ? (
          <>
            <PanelSection title="Operação comercial">
              <PanelFacts
                items={[
                  { label: "Valor em risco", value: money(amounts.risk) },
                  { label: "Vendas perdidas", value: amounts.lost },
                  {
                    label: "Valor recuperado",
                    value: money(amounts.recovered),
                  },
                ]}
              />
            </PanelSection>
            {s && (
              <PanelSection title="Evidência da conversa" meta={s.name}>
                <p className="sales-quote">
                  “
                  {source ? readingOf(ops, s, source.thread).evidence : s.quote}
                  ”
                </p>
              </PanelSection>
            )}
            <ButtonLink size="sm" icon={Target} href="#radar">
              Abrir recuperação
            </ButtonLink>
          </>
        ) : (
          <>
            <PanelSection title="Fontes da operação">
              <PanelFacts
                items={[
                  {
                    label: "WhatsApp",
                    value: connected ? "Conectado" : "Amostra local",
                  },
                  {
                    label: "Nowz / Helena",
                    value: ops.sources.nowz || "Disponível",
                  },
                  {
                    label: "DataCrazy",
                    value: ops.sources.datacrazy || "Disponível",
                  },
                ]}
              />
            </PanelSection>
            <ButtonLink icon={Plug} href="#conexao">
              Gerenciar conectores
            </ButtonLink>
            {!connected && (
              <>
                <Button onClick={onStart}>Conectar WhatsApp</Button>
                <Button variant="ghost" onClick={onReturn}>
                  Simular retorno
                </Button>
              </>
            )}
          </>
        )}
      </PanelStack>
    </aside>
  );
}
const suggestions = {
  priority: ["Quem priorizar?", "Quem devo priorizar?", Target],
  risk: ["Valor em risco", "Qual é o valor em risco?", TrendingUp],
  loss: ["Motivos de perda", "Por que perdemos vendas?", MessagesSquare],
  won: ["Vendas ganhas", "Quais vendas foram confirmadas?", TrendingUp],
  usage: ["Uso da empresa", "Qual foi o uso da empresa nos últimos sete dias?", FileText],
  tasks: ["Retornos pendentes", "Quais retornos temos na agenda?", FileText],
  waiting: ["Quem aguarda?", "Quem aguarda há 30 minutos?", MessagesSquare],
  stock: ["Reposições", "O que voltou ao estoque?", Brain],
  report: ["Último diagnóstico", "O que mostra o último diagnóstico?", FileText],
  changes: ["O que mudou?", "O que mudou desde a última leitura?", TrendingUp],
  connect: ["Fontes conectadas", "Quais fontes estão conectadas?", Plug],
  request: ["Pedido em aberto", "O que ficou faltando no pedido?", MessageCircle],
  evidence: ["Ver evidência", "Qual mensagem explica o sinal?", Quote],
  reply: ["Sugerir resposta", "Que resposta posso dar?", PencilLine],
};
const areaSuggestions = {
  resultados: ["won", "loss", "risk"], dashboard: ["risk", "won", "priority"],
  tarefas: ["tasks", "waiting", "priority"], entrada: ["waiting", "priority", "tasks"],
  crm: ["risk", "tasks", "won"], alertas: ["waiting", "risk", "loss"],
  diagnosticos: ["report", "changes", "loss"], catalogo: ["stock", "loss", "risk"],
  whatsapps: ["connect", "waiting", "report"], conexao: ["connect", "report", "changes"],
  ajustes: ["connect", "report", "tasks"], empresa: ["report", "changes", "connect"],
  equipe: ["tasks", "waiting", "usage"], uso: ["usage", "tasks", "won"],
};

export function ZoeWorkspace({
  contact,
  turns,
  priority,
  origin,
  ops,
  ask,
  connected,
  onStart,
  onReturn,
  onDraft,
  onForget,
  notify,
  thread,
  sourceThreadId,
  onStageReply,
}) {
  const first = priority?.contact;
  const [contextId, setContextId] = useState(sourceThreadId || (contact && primaryThread(contact)) || "");
  const [forget, setForget] = useState(null);
  const [region, setRegion] = useState("start");
  const contacts = contactsOf(ops);
  const sources = threadsOf(ops)
    .map((thread) => ({
      thread,
      contact: contacts.find((c) => c.id === thread.contactId),
    }))
    .filter((row) => row.contact);
  const source = sources.find(
    (row) =>
      row.thread.id === (sourceThreadId || (contact && primaryThread(contact))),
  );
  const selected = sources.find(row => row.thread.id === contextId);
  const recommended = selected ? ["request", "evidence", "reply"] : areaSuggestions[origin] || ["priority", "risk", "loss"];
  const reading = source && readingOf(ops, source.contact, source.thread);
  const box = (
    <RequestBox
      sources={sources}
      contextId={contextId}
      setContextId={setContextId}
      ask={ask}
      company={ops.profile.name}
      active={thread}
    />
  );
  const home = (
    <ZoeWelcome company={ops.profile.name} contactName={selected?.contact.name}>
          {box}
          <div className="zoe-shortcuts" aria-label="Perguntas sugeridas">
            {recommended.map(intent => {
              const [label, question, Icon] = suggestions[intent];
              return <Button key={intent} size="sm" icon={Icon} onClick={() => ask(question, intent, undefined, selected?.thread || null)}>{label}</Button>;
            })}
          </div>
          {first && !selected && (
            <RowGroup
              label="Retomar negociação"
              title="Retomar negociação"
              columns={1}
            >
              <TileRow
                icon={MessageCircle}
                title={first.name}
                detail={first.title}
                href={inboxHref(priority.thread.id)}
                end={
                  <Badge>{first.cents ? money(first.cents) : "A apurar"}</Badge>
                }
              />
            </RowGroup>
          )}
    </ZoeWelcome>
  );
  const conversation = thread && (
    <ChatThread>
      <Conversation label="Conversa com a Zoe" footer={box}>
        {!turns.length && source && (
          <div className="zoe-brief">
            <div className="zoe-byline">
              <img
                src="/assets/idle_thumbnail.png"
                width="30"
                height="30"
                alt=""
              />
              <span>Zoe · {channels[source.thread.channel]}</span>
            </div>
            <h2>{reading.title}</h2>
            <blockquote>{reading.evidence}</blockquote>
            <p>{reading.next}</p>
            <Button
              size="sm"
              icon={PencilLine}
              onClick={() =>
                ask(
                  "Preparar resposta para " + contact.name,
                  "reply",
                  undefined,
                  source.thread,
                )
              }
            >
              Preparar resposta
            </Button>
          </div>
        )}
        {turns.flatMap(
          ({ q, a, at, action, evidence, amounts, replyDraft }, i) => [
            <Ask key={"q-" + i} role="user">
              {q}
            </Ask>,
            <Answer
              key={"a-" + i}
              role="assistant"
              name="Zoe"
              working={false}
              meta={
                at
                  ? new Date(at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : undefined
              }
              actions={
                <>
                  <IconButton
                    size="sm"
                    variant="ghost"
                    label="Copiar resposta"
                    icon={Copy}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(a);
                        notify("Resposta copiada.");
                      } catch {
                        notify("Selecione a resposta para copiar.");
                      }
                    }}
                  />
                  <HoldConfirm
                    onClick={() => setForget(i)}
                    onConfirm={() => onForget(i)}
                  />
                </>
              }
            >
              <div className="zoe-byline">
                <img
                  src="/assets/idle_thumbnail.png"
                  width="28"
                  height="28"
                  alt=""
                />
                <strong>Zoe</strong>
              </div>
              <AnswerText>{a}</AnswerText>
              {amounts?.length > 0 && (
                <div
                  className="zoe-bars"
                  aria-label="Valor em risco por cliente"
                >
                  {amounts.map((row) => (
                    <a href={row.href} key={row.href}>
                      <span>
                        {row.name}
                        <b>{money(row.value)}</b>
                      </span>
                      <meter min="0" max={amounts[0].value} value={row.value}>
                        {money(row.value)}
                      </meter>
                    </a>
                  ))}
                </div>
              )}
              {!!evidence?.length && (
                <div className="zoe-sources">
                  <small>Fontes da resposta</small>
                  {evidence.map((row) => (
                    <AnswerContent
                      key={row.href}
                      href={row.href}
                      title={row.label}
                      meta={row.quote}
                      thumb={<Quote size={17} aria-hidden="true" />}
                    />
                  ))}
                </div>
              )}
              {replyDraft ? (
                <Button
                  size="sm"
                  icon={PencilLine}
                  onClick={() => onStageReply(replyDraft)}
                >
                  Revisar no atendimento
                </Button>
              ) : (
                action && (
                  <ButtonLink
                    size="sm"
                    variant="ghost"
                    href={"#" + action[1]}
                    trailingIcon={ArrowRight}
                  >
                    {action[0]}
                  </ButtonLink>
                )
              )}
            </Answer>,
          ],
        )}
        {turns.length > 0 && (
          <NextRow label="Perguntas para continuar">
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                ask(
                  contact
                    ? "O que ficou faltando no pedido de " + contact.name + "?"
                    : "Quais conversas aguardam há 30 minutos?",
                )
              }
            >
              {contact
                ? "Conferir pedido em aberto"
                : "Ver quem está esperando"}
            </Button>
          </NextRow>
        )}
        <ResponsiveDialog
          open={forget !== null}
          title="Apagar esta pergunta?"
          onClose={() => setForget(null)}
        >
          <div className="op-form">
            <p>
              A pergunta e a resposta serão removidas do histórico da Zoe neste
              navegador.
            </p>
            <div className="actions">
              <Button onClick={() => setForget(null)}>Manter</Button>
              <Button
                variant="primary"
                onClick={() => {
                  onForget(forget);
                  setForget(null);
                }}
              >
                Confirmar exclusão
              </Button>
            </div>
          </div>
        </ResponsiveDialog>
        {contact && (
          <div className="actions">
            <ButtonLink
              href={inboxHref(sourceThreadId || primaryThread(contact))}
              icon={FileText}
            >
              Conversa original
            </ButtonLink>
            <Button onClick={onDraft}>Ver sugestão</Button>
          </div>
        )}
      </Conversation>
    </ChatThread>
  );
  return (
    <Duo
      startLabel="Conversa"
      endLabel="Contexto"
      start={conversation || home}
      end={
        <Context
          first={first}
          source={thread ? source : selected}
          ops={ops}
          connected={connected}
          contact={thread ? contact : selected?.contact}
          onStart={onStart}
          onReturn={onReturn}
        />
      }
      defaultSize={760}
      min={420}
      max={1100}
      endMin={270}
      narrowBelow={760}
      region={region}
      onRegion={setRegion}
      storageKey="sales-v2.chat-width"
    />
  );
}
