"use client";
import { IconAction, IconLink } from "../src/ui/os/icon-action";
import { useEffect, useRef, useState } from "react";
import {
  Button,
  ButtonLink,
  CopyButton,
  Menu,
  IconButton,
  SearchField,
  Tooltip,
} from "@content-ventures/design-system/v3";
import { ResponsiveDialog } from "../src/ui/os/responsive-dialog";
import {
  ArrowLeft,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  FilePenLine,
  Reply,
  Search,
  Star,
  Users,
  X,
  ArrowUpRight,
  Check,
  ChevronDown,
  Play,
  Link2,
  Download,
  Inbox,
  Instagram,
  Mail,
  MessageCircle,
  Send,
  Sparkles,
  SlidersHorizontal,
} from "lucide-react";
import {
  channels,
  threadsOf,
  inboxHref as normalHref,
  primaryThread,
  updatesOf,
  historyOf,
} from "../lib/inbox";
import { kinds, kindOf, money } from "../lib/operation";
import { ContactMark } from "./recovery-desk";
import {
  focusQueue,
  recoveryQueue,
} from "../lib/recovery-queue";
import { readingOf } from "../lib/intake";
import { ProductVisual } from "./product-visual";
import { CaseActions } from "./operations";
import { ConversationAttachment } from "./conversation-attachment";
import { messageFiles } from "../lib/attachments";
import {
  followUps,
  isFavorite,
  isResolved,
  opportunityValue,
  toggleFavorite,
} from "../lib/conversation-work";
import { FocusControls } from "./focus-workspace";
import { ConversationFilters } from "./conversation-filters";
import { ConversationActions, OpportunityBadge } from "./conversation-actions";
import { ConversationReading } from "./conversation-reading";
import { AttendanceComposer } from "./attendance-composer";
import { Pills } from "../src/ui/os/pills";
import { RequestEvidence } from "./request-evidence";
import { evidenceId } from "../lib/conversation-request";
import {
  defaultFilters,
  foldText,
  matchesFilters,
  mediaNames,
  queueRows,
  sliceNames,
} from "../lib/conversation-queue";
import css from "./customer-inbox.module.css";

const icons = { whatsapp: MessageCircle, instagram: Instagram, email: Mail };
function ConversationLink({ thread, contact, plan, onClose }) {
  const [section, setSection] = useState(plan ? "plano" : "conversa");
  const href = normalHref(thread.id) + (section === "plano" ? "/plano" : "");
  const url = new URL(href, location.href);
  const smallShop = url.searchParams.get("demo") === "loja";
  url.search = smallShop ? "?demo=loja" : "";
  return (
    <ResponsiveDialog
      open
      size="sm"
      onClose={onClose}
      title="Link da conversa"
      description="O link abre o atendimento com os dados disponíveis neste navegador."
    >
      <div className={css.linkForm}>
        <div className={css.linkContact}>
          <ContactMark s={contact} />
          <div>
            <strong>{contact.name}</strong>
            <Channel value={thread.channel} />
          </div>
        </div>
        <Pills
          label="Abrir link em"
          value={section}
          onChange={setSection}
          items={[
            { value: "conversa", label: "Histórico" },
            { value: "plano", label: "Recuperação" },
          ]}
        />
        <label className={css.linkLabel} htmlFor="thread-link">
          Endereço do atendimento
        </label>
        <div className={css.copyField}>
          <input
            id="thread-link"
            readOnly
            value={url.href}
            onFocus={(e) => e.target.select()}
          />
          <CopyButton text={url.href} label="link da conversa" />
        </div>
        <ButtonLink href={href} trailingIcon={ArrowUpRight} onClick={onClose}>
          Abrir {section === "plano" ? "recuperação" : "histórico"}
        </ButtonLink>
      </div>
    </ResponsiveDialog>
  );
}
function Channel({ value, iconOnly = false }) {
  const Icon = icons[value];
  const mark = (
    <span
      className={css.channel}
      data-channel={value}
      role={iconOnly ? "img" : undefined}
      aria-label={iconOnly ? channels[value] : undefined}
    >
      {value === "whatsapp" ? (
        <i aria-hidden="true" className={css.whatsappLogo} />
      ) : (
        <Icon size={14} aria-hidden="true" />
      )}
      {!iconOnly && channels[value]}
    </span>
  );
  return iconOnly ? <Tooltip bare content={channels[value]} describe={false}>{mark}</Tooltip> : mark;
}

function MessageExtras({ message, onQuote, author, index, href }) {
  return (
    <>
      {message.replyTo && (
        <a
          className={css.citation}
          href={href + "/mensagem/" + message.replyTo.id}
        >
          <Reply size={13} />
          <span>
            <b>{message.replyTo.author}</b>
            {message.replyTo.text}
          </span>
        </a>
      )}
      {messageFiles(message).map((file) => (
        <ConversationAttachment key={file.id} file={file} />
      ))}
      <IconAction
        type="button"
        className={css.quoteButton}
        aria-label={"Citar mensagem de " + author}
        title="Responder a esta mensagem"
        onClick={() =>
          onQuote({
            id: evidenceId(message, index),
            author,
            text: message.text || message.attachment?.name,
          })
        }
      >
        <Reply size={13} />
        <span>Citar</span>
      </IconAction>
    </>
  );
}

function MailHistory({ messages, contact, highlight, onQuote, href }) {
  const [expanded, setExpanded] = useState([]);
  return messages.map((message, index) => {
    const key = message.id || String(index);
    const latest = index === messages.length - 1;
    const open =
      latest ||
      expanded.includes(key) ||
      highlight === evidenceId(message, index);
    const author = message.outgoing
      ? message.author || "Equipe comercial"
      : contact.name;
    const header = (
      <>
        <span className={css.mailAvatar} data-team={message.outgoing}>
          {message.outgoing ? <Send size={14} /> : contact.initials}
        </span>
        <span className={css.sender}>
          <strong>{author}</strong>
          {!open && <small>{message.text.replace(/\s+/g, " ")}</small>}
        </span>
        <time>{message.when}</time>
        {!latest && <ChevronDown size={14} className={css.caret} />}
      </>
    );
    return (
      <div
        data-evidence-id={evidenceId(message, index)}
        data-highlight={highlight === evidenceId(message, index)}
        className={css.letter}
        key={key}
        tabIndex={-1}
        data-open={open}
      >
        {latest ? (
          <div className={css.envelope}>{header}</div>
        ) : (
          <button
            type="button"
            className={css.envelope}
            aria-expanded={open}
            onClick={() =>
              setExpanded(
                open ? expanded.filter((k) => k !== key) : [...expanded, key],
              )
            }
          >
            {header}
          </button>
        )}
        <div className={css.foldBody} aria-hidden={!open}>
          <div>
            <div className={css.letterBody}>
              {message.text}
              {open && (
                <MessageExtras {...{ message, author, index, onQuote, href }} />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  });
}

function ReadyReply({ suggestion, active, onUse, href }) {
  return (
    <section className={css.readyReply} aria-label="Retomada da Zoe">
      <div className={css.readyTitle}><img src="/assets/idle_thumbnail.png" width="25" height="25" alt="" /><strong>Retomada da Zoe</strong></div>
      <p>{suggestion}</p>
      <div className={css.readyActions}>
        <Button size="sm" icon={FilePenLine} disabled={!active} onClick={onUse}>Usar na resposta</Button>
        {href && <a href={href} aria-label="Abrir plano de recuperação">Ver análise <ArrowUpRight size={13} /></a>}
      </div>
      {!active && <small>Ative o atendimento para usar esta mensagem.</small>}
    </section>
  );
}

function RecoveryPlan({
  contact,
  thread,
  ops,
  suggestion,
  onUse,
  reading,
  filter,
  inboxHref = normalHref,
}) {
  const evidence = historyOf(ops, thread)
    .filter((m) => !m.outgoing)
    .at(-1);
  const related = threadsOf(ops).filter(
    (t) => t.contactId === contact.id && t.id !== thread.id,
  );
  return (
    <div className={css.work}>
      <ReadyReply suggestion={suggestion} active={!!ops.attendances?.[thread.id]} onUse={onUse} />
      <section className={css.brief}>
        <span className={css.overline}>
          <Sparkles size={14} />
          Plano da Zoe
        </span>
        <h3>{reading.title}</h3>
        <blockquote>{evidence?.text}</blockquote>
        <small>
          {contact.product} ·{" "}
          {contact.cents ? money(contact.cents) : "Valor a apurar"} ·{" "}
          {kinds[kindOf(contact, ops)]}
        </small>
      </section>
      <RequestEvidence {...{ ops, thread, filter, inboxHref }} />
      {related.length > 0 && (
        <section>
          <h3>Outros canais de {contact.name.split(" ")[0]}</h3>
          {related.map((t) => (
            <ButtonLink
              key={t.id}
              href={inboxHref(t.id)}
              icon={icons[t.channel]}
            >
              {channels[t.channel]}
            </ButtonLink>
          ))}
        </section>
      )}
    </div>
  );
}

function Thread({
  thread,
  contact,
  ops,
  change,
  savedReply,
  highlight,
  inboxHref = normalHref,
  filter,
  plan,
  outcome,
  fromFocus,
  onFocus,
  onFocusSlot,
  notify,
}) {
  const events = updatesOf(ops, thread);
  const log = useRef(null);
  const composer = useRef(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchTrigger = useRef(null);
  const historyPosition = useRef(null);
  function toggleSearch() {
    if (!searchOpen) historyPosition.current = log.current?.scrollTop ?? 0;
    setSearchOpen(!searchOpen);
  }
  const [term, setTerm] = useState("");
  const [hit, setHit] = useState(0);
  const [action, setAction] = useState("");
  const [commercialAction, setCommercialAction] = useState("");
  const messages = historyOf(ops, thread);
  const messageQuery = foldText(term.trim());
  const matches = messageQuery
    ? messages.flatMap((m, i) =>
        foldText(
          [m.text, ...messageFiles(m).map((f) => f.name)].join(" "),
        ).includes(messageQuery)
          ? [evidenceId(m, i)]
          : [],
      )
    : [];
  const activeHit = matches.length ? hit % matches.length : 0;
  const targetId = searchOpen ? matches[activeHit] : highlight;
  const favorite = isFavorite(ops, thread);
  const currentHref = inboxHref(thread.id, filter);
  function quote(ref) {
    composer.current?.quote(ref);
  }
  function flipStar() {
    change((before) => toggleFavorite(before, thread));
  }
  const isMail = thread.channel === "email";
  const reading = readingOf(ops, contact, thread);
  const suggestion =
    ops.zoeReplies?.[thread.id] || (thread.id === primaryThread(contact) && !events.some(e => e.kind === "Mensagem recebida") && savedReply) || reading.reply;
  const useReply = () => composer.current?.useSuggestion();
  useEffect(() => {
    if (!searchOpen && historyPosition.current !== null && log.current) {
      log.current.scrollTop = historyPosition.current;
      historyPosition.current = null;
      searchTrigger.current?.focus({ preventScroll: true });
      return;
    }
    if (searchOpen && !targetId) return;
    if (targetId && log.current) {
      const item = [...log.current.querySelectorAll("[data-evidence-id]")].find(
        (el) => el.dataset.evidenceId === targetId,
      );
      if (item) {
        item.scrollIntoView({ block: "nearest" });
        if (!searchOpen) item.focus({ preventScroll: true });
        return;
      }
    }
    const history = log.current;
    if (!history) return;
    if (window.matchMedia("(max-width: 860px)").matches) {
      const latest = Array.from(history.querySelectorAll("[data-evidence-id]")).at(-1);
      if (latest) {
        history.scrollTop += latest.getBoundingClientRect().top - history.getBoundingClientRect().top - 8;
        return;
      }
    }
    history.scrollTop = isMail && !events.length ? 0 : history.scrollHeight;
  }, [thread.id, events.length, isMail, targetId, searchOpen]);
  const nextInQueue = (fromFocus ? focusQueue(ops) : recoveryQueue(ops)).find(
    (row) => row.thread.id !== thread.id,
  );
  const exposure = opportunityValue(ops, contact);
  const pendingTasks = followUps(ops, thread, contact);
  const closed = isResolved(ops, thread, pendingTasks);
  const handled = closed || events[0]?.kind === "Resposta simulada";
  const siblings = threadsOf(ops).filter(
    (t) => t.contactId === contact.id && t.id !== thread.id,
  );
  function download() {
    const lines = [
      contact.name,
      channels[thread.channel],
      thread.account,
      thread.subject,
      ...messages.map(
        (m) =>
          (m.outgoing ? "Equipe" : contact.name) +
          " · " +
          m.when +
          "\n" +
          [m.text, ...messageFiles(m).map((f) => "Anexo · " + f.name)]
            .filter(Boolean)
            .join("\n"),
      ),
    ];
    const url = URL.createObjectURL(
      new Blob([lines.filter(Boolean).join("\n\n")], {
        type: "text/plain;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = thread.id + ".txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <article
      aria-label={"Atendimento de " + contact.name}
      className={css.thread}
    >
      <header className={css.threadHead}>
        <IconLink
          className={css.back}
          href={inboxHref(null, filter)}
          aria-label="Voltar à lista de conversas"
        >
          <ArrowLeft size={19} />
        </IconLink>
        <span className={css.headerMark}>
          <ContactMark s={contact} />
        </span>
        <div className={css.identity}>
          <div className={css.identityLine}>
            <h2 title={contact.name}>{contact.name}</h2>
            <OpportunityBadge
              {...{ ops, contact }}
              onClick={() => setCommercialAction("value")}
            />
          </div>
          <small>
            <Channel value={thread.channel} iconOnly />
            {thread.account && thread.account !== channels[thread.channel] && (
              <span className={css.account} title={thread.account}>
                {thread.account === "WhatsApp comercial"
                  ? "Comercial"
                  : thread.account}
              </span>
            )}
          </small>
        </div>
        <ConversationActions
          {...{ thread, contact, ops, change, notify, fromFocus, onFocus }}
          mode={commercialAction || (outcome ? "decision" : "")}
          setMode={(next) => {
            setCommercialAction(next);
            if (outcome) location.hash = currentHref;
          }}
        />
        <div className={css.threadUtilities}>
          <IconAction ref={searchTrigger} className={css.headTool} aria-label="Buscar nesta conversa" aria-expanded={searchOpen}
            title="Buscar nesta conversa" onClick={toggleSearch}><Search size={15} /></IconAction>
          <ConversationReading triggerClassName={css.headTool} {...{ thread, contact, ops, reading, filter, inboxHref }} />
          <IconAction
            className={css.headTool}
            aria-label={
              favorite ? "Remover dos favoritos" : "Favoritar conversa"
            }
            aria-pressed={favorite}
            title={favorite ? "Remover dos favoritos" : "Favoritar conversa"}
            onClick={flipStar}
          >
            <Star size={16} fill={favorite ? "currentColor" : "none"} />
          </IconAction>
          <Menu
            label="Ações da conversa"
            trigger={(props) => (
              <IconButton
                {...props}
                label="Ações da conversa"
                icon={Ellipsis}
                size="sm"
                variant="ghost"
              />
            )}
            align="end"
            width={232}
            sections={[
              { items: [{ label: "Atribuir responsável", icon: Users, onSelect: () => setAction("assign") }] },
              { items: [
                { label: "Compartilhar link", icon: Link2, onSelect: () => setAction("link") },
                { label: "Exportar histórico", icon: Download, onSelect: download },
              ] },
            ]}
          />
        </div>
      </header>
      <div className={css.threadFocusSlot} ref={onFocusSlot} />
      {searchOpen && (
        <div className={css.threadSearch}>
          <label className={css.historyField}>
            <Search size={15} aria-hidden="true" />
            <input
              autoFocus
              type="search" inputMode="search" enterKeyHint="search" autoComplete="off"
              aria-label="Texto no histórico"
              placeholder="Buscar neste histórico…"
              value={term}
              onChange={(e) => {
                setTerm(e.target.value);
                setHit(0);
              }}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === "Escape") {
                  e.preventDefault();
                  setSearchOpen(false);
                }
                if (e.key === "Enter" && matches.length > 1) {
                  e.preventDefault();
                  setHit((activeHit + (e.shiftKey ? matches.length - 1 : 1)) % matches.length);
                }
              }}
            />
          </label>
          {messageQuery && <div className={css.hitControls}>
            <small role="status">
              {matches.length ? (activeHit + 1) + " de " + matches.length : "Sem resultados"}
            </small>
            {matches.length > 1 && <>
              <IconAction aria-label="Ocorrência anterior" onClick={() => setHit((activeHit + matches.length - 1) % matches.length)}>
                <ChevronLeft size={15} />
              </IconAction>
              <IconAction aria-label="Próxima ocorrência" onClick={() => setHit((activeHit + 1) % matches.length)}>
                <ChevronRight size={15} />
              </IconAction>
            </>}
          </div>}
          <IconAction
            aria-label="Fechar busca"
            onClick={() => setSearchOpen(false)}
          >
            <X size={15} />
          </IconAction>
        </div>
      )}
      {action === "link" ? (
        <ConversationLink
          {...{ thread, contact, plan }}
          onClose={() => setAction("")}
        />
      ) : (
        action && (
          <CaseActions
            key={action}
            initialAction={action}
            onDismiss={() => setAction("")}
            s={contact}
            threadId={thread.id}
            {...{ ops, change, notify }}
          />
        )
      )}
      {handled && (
        <div className={css.continueRow}>
          <span>
            <Check size={14} />
            {!closed && events[0]?.kind === "Resposta simulada"
              ? "Resposta registrada"
              : "Atendimento concluído"}
          </span>
          <a
            href={
              nextInQueue
                ? inboxHref(nextInQueue.thread.id)
                : fromFocus
                  ? "#entrada"
                  : "#radar"
            }
          >
            {nextInQueue
              ? "Próxima conversa · " + nextInQueue.contact.name.split(" ")[0]
              : fromFocus
                ? "Voltar à fila"
                : "Voltar ao radar"}{" "}
            <ArrowUpRight size={14} />
          </a>
        </div>
      )}
      <div className={css.detailGrid} data-plan={plan}>
            <div className={css.dialogue}>
              <div
                ref={log}
                className={css.log}
                role="log"
                aria-label="Histórico do atendimento"
              >
                <a
                  className={css.compactDeal}
                  aria-label="Abrir plano de recuperação"
                  href={inboxHref(thread.id, filter) + "/plano"}
                >
                  <span className={css.miniCover}>
                    <ProductVisual contact={contact} />
                  </span>
                  <span>
                    <small className={css.mobileStatus}>
                      <i />
                      {kinds[kindOf(contact, ops)]}
                    </small>
                    <strong>{contact.product}</strong>
                    <b>{exposure == null ? "A apurar" : money(exposure)}</b>
                  </span>
                  <ArrowUpRight size={15} />
                </a>
                {isMail && (
                  <div className={css.subject}>
                    <small>
                      <Mail size={13} />
                      Assunto
                    </small>
                    <h3>{thread.subject || "E-mail"}</h3>
                  </div>
                )}
                {isMail ? (
                  <MailHistory
                    messages={messages}
                    contact={contact}
                    highlight={targetId}
                    onQuote={quote}
                    href={currentHref}
                  />
                ) : (
                  messages.map((m, i) => (
                    <div
                      key={m.id || i}
                      className={css.message}
                      tabIndex={-1}
                      data-evidence-id={evidenceId(m, i)}
                      data-highlight={targetId === evidenceId(m, i)}
                      data-out={m.outgoing}
                    >
                      <small>
                        {m.outgoing ? m.author || "Equipe" : contact.name} ·{" "}
                        {m.when}
                      </small>
                      <p>{m.text}</p>
                      <MessageExtras
                        message={m}
                        index={i}
                        author={
                          m.outgoing ? m.author || "Equipe" : contact.name
                        }
                        onQuote={quote}
                        href={currentHref}
                      />
                    </div>
                  ))
                )}
                {!plan && <div className={css.inlineReply}>
                  <ReadyReply suggestion={suggestion} active={!!ops.attendances?.[thread.id]} onUse={useReply} />
                </div>}
              </div>
              <AttendanceComposer
                ref={composer}
                {...{ thread, contact, ops, change, suggestion, notify }}
                onSuggestionApplied={() => { if (plan) location.hash = currentHref; }}
              />
            </div>
            {plan ? (
              <aside className={css.recoveryPanel} aria-label="Plano de recuperação">
                <header className={css.recoveryHead}>
                  <span><Sparkles size={16} /> Recuperação</span>
                  <IconLink href={currentHref} aria-label="Fechar plano de recuperação" title="Fechar plano de recuperação"><X size={16} /></IconLink>
                </header>
                <RecoveryPlan {...{ contact, thread, ops, suggestion, reading, filter, inboxHref }} onUse={useReply} />
              </aside>
            ) : (
            <aside className={css.dossier} aria-label="Contexto comercial">
              <div className={css.dealCover}>
                <ProductVisual contact={contact} />
                <span
                  className={css.coverStatus}
                  data-kind={kindOf(contact, ops)}
                >
                  <i />
                  {kinds[kindOf(contact, ops)]}
                </span>
              </div>
              <div className={css.dealCaption}>
                <span className={css.overline}>
                  {kindOf(contact, ops) === "risk"
                    ? "Valor em risco"
                    : kindOf(contact, ops) === "won"
                      ? "Venda ganha"
                      : "Oportunidade"}
                </span>
                <h3>{contact.product}</h3>
                <p className={css.amount}>
                  {exposure == null ? "A apurar" : money(exposure)}
                </p>
                <div className={css.owner}>
                  <span>{contact.owner.slice(0, 1)}</span>
                  {contact.owner}
                  <small>Responsável</small>
                </div>
              </div>
              <ReadyReply suggestion={suggestion} active={!!ops.attendances?.[thread.id]} onUse={useReply} href={currentHref + "/plano"} />
              {!!pendingTasks.length && (
                <section>
                  <h4>Retornos em aberto</h4>
                  {pendingTasks.map((t) => (
                    <p key={t.id}>
                      <a href="#tarefas">
                        {t.text} · {t.due.split("-").reverse().join("/")}
                      </a>
                    </p>
                  ))}
                </section>
              )}
              {!!siblings.length && (
                <section>
                  <h4>Também conversou por</h4>
                  {siblings.map((t) => (
                    <a key={t.id} href={inboxHref(t.id)}>
                      <Channel value={t.channel} />
                      <ArrowUpRight size={13} />
                    </a>
                  ))}
                </section>
              )}
            </aside>
            )}
      </div>
    </article>
  );
}

export function CustomerInbox({ route, ops, change, saved, notify }) {
  const inboxHref = normalHref;
  const [, channelId, requested, view, origin] = route.split("/");
  const [focusSetup, setFocusSetup] = useState(null);
  const focusMode = Boolean(ops.focus && !ops.focus.paused);
  const queueIds = focusMode ? focusQueue(ops).map((r) => r.thread.id) : [];
  const directSetup = channelId === "rodada" && !ops.focus;
  const filter = Object.hasOwn(channels, channelId) ? channelId : "todos";
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(defaultFilters);
  const [editing, setEditing] = useState(null);
  const [quick, setQuick] = useState("");
  const [folded, setFolded] = useState({});
  const [groupLimits, setGroupLimits] = useState({});
  const [sort, setSort] = useState("recent");
  const [queueSlot, setQueueSlot] = useState(null);
  const [threadSlot, setThreadSlot] = useState(null);
  const all = queueRows(ops).filter(({ thread, contact }) => {
    if (!focusMode || queueIds.includes(thread.id)) return true;
    return (
      requested === thread.id &&
      (!ops.focus.owner || contact.owner === ops.focus.owner)
    );
  });
  const needle = foldText(query);
  const inChannel = all.filter(
    (row) =>
      (filter === "todos" || filter === row.thread.channel) &&
      (!needle ||
        row.searchable.includes(needle) ||
        foldText(channels[row.thread.channel]).includes(needle)),
  );
  const scoped = inChannel.filter((row) => matchesFilters(row, filters));
  const rows = scoped.filter((row) => !quick || row[quick]);
  const quickFilters = [
    { id: "waiting", label: "A responder", icon: MessageCircle },
    { id: "follow", label: "Follow-ups", icon: CalendarClock },
    { id: "draft", label: "Rascunhos", icon: FilePenLine },
  ];
  const amountLabels = {
    absent: "Sem valor",
    known: "Com valor",
    min: "A partir de R$ " + filters.amountValue,
    max: "Até R$ " + filters.amountValue,
  };
  const labels = {
    sort: sort === "value" ? "Maior valor" : sort === "oldest" ? "Mais antigas" : "",
    amount: amountLabels[filters.amount],
    work:
      filters.work && (filters.work === "closed" ? "Resolvidas" : "Em aberto"),
    owner: filters.owner,
    status: kinds[filters.status],
    slice: sliceNames[filters.slice],
    line: filters.line,
    media: mediaNames[filters.media],
    period:
      filters.period &&
      (Number(filters.period) >= 168
        ? "Últimos " + Number(filters.period) / 24 + " dias"
        : "Últimas " + filters.period + " h"),
  };
  const applied = Object.entries(labels).filter(([, label]) => label);
  const filterCount = applied.length;
  const hasSelection = !!(query || quick || filter !== "todos" || filters.favoriteOnly || filterCount);
  const grouped = new Map(
    [
      "Favoritas",
      "Retomar",
      "Esperando",
      "Em acompanhamento",
      "Resolvidas",
    ].map((k) => [k, []]),
  );
  for (const row of rows) {
    const group = row.done
      ? "Resolvidas"
      : row.favorite
        ? "Favoritas"
        : row.due
          ? "Retomar"
          : row.waiting
            ? "Esperando"
            : "Em acompanhamento";
    grouped.get(group).push(row);
  }
  for (const group of grouped.values())
    group.sort((a, b) =>
      sort === "value"
        ? (b.amount ?? -1) - (a.amount ?? -1)
        : sort === "oldest"
          ? a.latest - b.latest
          : focusMode
            ? queueIds.indexOf(a.thread.id) - queueIds.indexOf(b.thread.id)
            : b.latest - a.latest,
    );
  function clearFilters() {
    setFilters(defaultFilters);
    setSort("recent");
    setQuick("");
    setQuery("");
    setFolded({});
    location.hash = inboxHref(null, "todos");
  }
  const selected = all.find(
    (x) =>
      x.thread.id === requested &&
      (filter === "todos" || filter === x.thread.channel),
  );
  const shown =
    selected ||
    (focusMode
      ? [...rows].sort(
          (a, b) =>
            queueIds.indexOf(a.thread.id) - queueIds.indexOf(b.thread.id),
        )[0]
      : [...grouped.values()].find((group) => group.length)?.[0]);
  function closeSetup() {
    setFocusSetup(null);
    if (directSetup) location.hash = "#entrada";
  }
  function startFocus(id) {
    setQuery("");
    setFilters(defaultFilters);
    setQuick("");
    setSort("recent");
    setFolded({});
    setFocusSetup(null);
    if (requested !== id || directSetup || view) location.hash = inboxHref(id);
  }
  return (
    <div
      className={css.inbox}
      data-thread={Boolean(selected)}
      data-focus={!!ops.focus}
    >
      <FocusControls
        ops={ops}
        change={change}
        setup={!!focusSetup || directSetup}
        onClose={closeSetup}
        source={all.find((r) => r.thread.id === focusSetup)}
        current={shown}
        onStart={startFocus}
        queueSlot={queueSlot}
        threadSlot={threadSlot}
        selected={Boolean(selected)}
      />

      <section className={css.list} aria-label="Lista de atendimentos">
        <div className={css.listHead}>
          <div className={css.queueFocusSlot} ref={setQueueSlot}>
            {!ops.focus && (
              <button
                type="button"
                className={css.startFocus}
                aria-label="Abrir Foco da Zoe"
                onClick={() => setFocusSetup(selected?.thread.id || "queue")}
              >
                <span className={css.zoeMark}>
                  <img
                    src="/assets/idle_thumbnail.png"
                    width="34"
                    height="34"
                    alt=""
                  />
                </span>
                <span className={css.startCopy}>
                  <strong>Foco da Zoe</strong>
                  <small>Recuperação · 10 min</small>
                </span>
                <span className={css.startPlay}>
                  <Play size={12} /> Iniciar
                </span>
              </button>
            )}
          </div>
          <div className={css.queueLenses} aria-label="Filas de trabalho">
            {quickFilters.map(({ id, label, icon: Icon }) => (
              <button
                type="button"
                key={id}
                aria-label={label}
                aria-pressed={quick === id}
                onClick={() => {
                  setQuick(quick === id ? "" : id);
                  location.hash = inboxHref(null, filter);
                }}
              >
                <span>
                  <i
                    className={css.metricRing}
                    data-metric={id}
                    style={{
                      "--share": scoped.length
                        ? (scoped.filter((row) => row[id]).length /
                            scoped.length) *
                            100 +
                          "%"
                        : "0%",
                    }}
                  >
                    <Icon size={11} />
                  </i>
                  <strong>{scoped.filter((row) => row[id]).length}</strong>
                </span>
                <small>{label}</small>
              </button>
            ))}
          </div>
            <SearchField
              label="Buscar no atendimento" inputMode="search" enterKeyHint="search" autoComplete="off"
              placeholder="Buscar conversas…"
              value={query}
              onValueChange={(value) => {
                setFolded({});
                setQuery(value);
                if (requested) location.hash = inboxHref(null, filter);
              }}
            />
          <nav
            className={css.filters}
            aria-label="Filtrar por canal"
            style={{
              "--active-slot": ["todos", ...Object.keys(channels)].indexOf(
                filter,
              ),
            }}
          >
            {Object.entries({ todos: "Todos", ...channels }).map(
              ([key, label]) => (
                <a
                  key={key}
                  href={inboxHref(null, key)}
                  onClick={() => {
                    setFolded({});
                    if (key !== "todos" && key !== "whatsapp" && filters.line)
                      setFilters(before => ({ ...before, line: "" }));
                  }}
                  aria-current={key === filter ? "page" : undefined}
                >
                  {label}
                </a>
              ),
            )}
          </nav>
        </div>
        <div className={css.resultCount}>
          <span role="status" aria-live="polite" aria-atomic="true">
            {rows.length} {rows.length === 1 ? "conversa" : "conversas"}
          </span>
          <button
            className={css.onlyStars}
            aria-label="Mostrar só favoritas"
            aria-pressed={!!filters.favoriteOnly}
            onClick={() => {
              setFilters({
                ...filters,
                favoriteOnly: filters.favoriteOnly ? "" : "yes",
              });
              location.hash = inboxHref(null, filter);
            }}
          >
            <Star
              size={12}
              fill={filters.favoriteOnly ? "currentColor" : "none"}
            />{" "}
            Favoritas
          </button>
          <button
            aria-label="Filtros de atendimento"
            aria-haspopup="dialog"
            aria-expanded={!!editing}
            data-active={!!filterCount}
            onClick={() => setEditing({ ...filters })}
          >
            <SlidersHorizontal size={12} /> Filtros
            {filterCount ? " · " + filterCount : ""}
          </button>
        </div>
        {hasSelection && (
          <div className={css.applied} role="group" aria-label="Seleção da fila">
            {applied.map(([key, label]) => (
              <button
                key={key}
                aria-label={"Remover filtro " + label}
                onClick={() => {
                  if (key === "sort") setSort("recent");
                  else setFilters({ ...filters, [key]: "", ...(key === "amount" ? { amountValue: "" } : {}) });
                  location.hash = inboxHref(null, filter);
                }}
              >
                {label}
                <X size={12} />
              </button>
            ))}
            <button type="button" className={css.clearAll} onClick={clearFilters}>Limpar seleção</button>
          </div>
        )}
        <div className={css.rows}>
          {[...grouped]
            .filter(([, list]) => list.length)
            .map(([group, list]) => (
              <div key={group}>
                <button
                  className={css.groupHead}
                  aria-expanded={!folded[group]}
                  onClick={() =>
                    setFolded({ ...folded, [group]: !folded[group] })
                  }
                >
                  <ChevronDown size={13} />
                  {group}
                  <span>{list.length}</span>
                </button>
                {!folded[group] &&
                  list.slice(0, groupLimits[group] || 20).map(
                    ({
                      thread,
                      contact,
                      elapsed,
                      preview,
                      waiting,
                      draft,
                      due,
                      payment,
                      amount,
                      favorite,
                    }) => (
                      <a
                        key={thread.id}
                        className={css.row}
                        href={inboxHref(thread.id, filter)}
                        aria-current={
                          thread.id === shown?.thread.id ? "true" : undefined
                        }
                      >
                        <span className={css.rowMark}>
                          <ContactMark s={contact} />
                          <Channel value={thread.channel} iconOnly />
                        </span>
                        <span className={css.rowText}>
                          <span className={css.rowTitle}>
                            <strong>{contact.name}</strong>
                            {favorite && (
                              <Star
                                size={11}
                                fill="currentColor"
                                aria-label="Favorita"
                              />
                            )}
                            <time>
                              {waiting ? (
                                <i
                                  className={css.waitDot}
                                  aria-label="A responder"
                                />
                              ) : (
                                <Check size={11} aria-label="Respondida" />
                              )}
                              {elapsed < 1
                                ? "Agora"
                                : elapsed < 60
                                  ? elapsed + " min"
                                  : elapsed < 1440
                                    ? Math.floor(elapsed / 60) + " h"
                                    : Math.floor(elapsed / 1440) + " d"}
                            </time>
                          </span>
                          <span className={css.rowPreview}>
                            <small>
                              {draft
                                ? "Rascunho · " +
                                  (ops.inboxDrafts[thread.id] ||
                                    (ops.noteDrafts?.[thread.id]
                                      ? "Nota interna"
                                      : "Resposta em preparação"))
                                : preview}
                            </small>
                            {amount != null && (
                              <b className={css.rowAmount}>{money(amount)}</b>
                            )}
                          </span>
                          {(due || payment || amount == null) && (
                            <span className={css.rowSignal}>
                              {due
                                ? "Retorno pendente"
                                : payment
                                  ? "Quer pagar"
                                  : contact.owner}
                            </span>
                          )}
                        </span>
                      </a>
                    ),
                  )}
                {!folded[group] && list.length > (groupLimits[group] || 20) && <button className={css.moreRows}
                  onClick={() => setGroupLimits(limits => ({...limits,[group]:(limits[group] || 20) + 20}))}>
                  Mostrar mais de {group.toLocaleLowerCase("pt-BR")} ({list.length - (groupLimits[group] || 20)})
                </button>}
              </div>
            ))}
          {!rows.length && (
            <div className={css.emptyState}>
              <Search size={22} />
              <strong>Nenhuma conversa encontrada.</strong>
              {hasSelection && <small>Ajuste a busca ou limpe a seleção acima.</small>}
            </div>
          )}
        </div>
      </section>
      <div className={css.read}>
        {shown ? (
          <Thread
            key={shown.thread.id}
            {...{ ...shown, ops, change, filter, notify }}
            plan={view === "plano"}
            highlight={view === "mensagem" ? origin : null}
            outcome={view === "resultado"}
            inboxHref={inboxHref}
            fromFocus={focusMode}
            onFocus={() => setFocusSetup(shown.thread.id)}
            onFocusSlot={setThreadSlot}
            savedReply={saved[shown.contact.id]}
          />
        ) : (
          <div className={css.blank}>
            <Inbox size={28} />
            <p>Selecione uma conversa para ler o histórico.</p>
          </div>
        )}
      </div>
      {editing && (
        <ConversationFilters
          initial={editing}
          sort={sort}
          channel={filter}
          all={all}
          rows={inChannel.filter((row) => !quick || row[quick])}
          onClose={() => setEditing(null)}
          onApply={(next, order) => {
            setFolded({});
            setSort(order);
            setFilters(next);
            setEditing(null);
            location.hash = inboxHref(null, filter);
          }}
        />
      )}
    </div>
  );
}
