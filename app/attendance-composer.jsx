"use client";
import { billingUnit, matchesCatalogSearch } from "../lib/catalog";
import { DirectoryPager, useDirectoryPage } from "./directory";

import { IconAction } from "../src/ui/os/icon-action";
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  Button,
  Menu,
  NumberField,
} from "@content-ventures/design-system/v3";
import { ResponsiveDialog } from "../src/ui/os/responsive-dialog";
import {
  ArrowUpRight,
  ChevronDown,
  Clock3,
  File,
  Instagram,
  LockKeyhole,
  Mail,
  MessageCircle,
  Mic,
  Package,
  Paperclip,
  Reply,
  Smile,
  Sparkles,
  Square,
  X,
  Zap,
} from "lucide-react";
import { Composer } from "../src/ui/os/chat/composer";
import { money } from "../lib/operation";
import { signals } from "../lib/demo";
import { ProductVisual } from "./product-visual";
import { foldText } from "../lib/conversation-queue";
import { channels } from "../lib/inbox";
import {
  deleteAttachment,
  readAttachment,
  storeDraftFiles,
} from "../lib/attachments";
import { useVoiceRecording } from "./use-voice-recording";
import st from "./attendance.module.css";

const channelIcons = {
  whatsapp: MessageCircle,
  instagram: Instagram,
  email: Mail,
};
const MAX_FILES = 5;
const MAX_LENGTH = 2000;
function without(map, id) {
  const next = { ...map };
  delete next[id];
  return next;
}
function QuotePicker({ products, onClose, onInsert }) {
  const [search, setSearch] = useState("");
  const [quantity, setQuantity] = useState(1);
  const term = foldText(search.trim());
  const list = useDirectoryPage(products.filter(p => matchesCatalogSearch(p, term)), [8]);
  const validQuantity = Number.isInteger(quantity) && quantity >= 1 && quantity <= 999;
  const results = useRef(null);
  return (
    <ResponsiveDialog open title="Inserir produto" size="md" onClose={onClose}
      description="Escolha um produto ou serviço para incluir na resposta."
      footer={list.pages > 1 ? <DirectoryPager list={list} noun="itens" onNavigate={() => {
        results.current?.scrollTo({ top: 0 });
      }} /> : undefined}>
      <div className="op-form">
        <label className="op-field">
          Buscar no catálogo
          <input type="search" enterKeyHint="search" autoComplete="off" value={search}
            placeholder="Nome ou código" onChange={e => { setSearch(e.target.value); list.reset(); }} />
        </label>
        <div className={st.quantity}>
          <label htmlFor="quote-quantity">Quantidade</label>
          <NumberField id="quote-quantity" value={quantity} onChange={setQuantity} min={1} max={999} fit stepper />
        </div>
        <div className={st.products} ref={results}>
          {list.rows.map((item, i) => {
            const unit = billingUnit(item);
            const unitPrice = item.price != null ? money(item.price) : null;
            const total = unitPrice && validQuantity ? money(item.price * quantity) : null;
            const showUnit = unitPrice && (quantity > 1 || unit !== "unidade");
            const quote = [
              quantity > 1 ? quantity + " × " + item.name : item.name,
              unitPrice ? unitPrice + (showUnit ? " por " + unit : "") : "Preço sob consulta",
              quantity > 1 && total ? "Total " + total : null,
              item.stock,
            ].filter(Boolean).join(" · ");
            const photo = item.scene || signals.find(s => s.product === item.name)?.id;
            return <button key={item.id ?? list.start + i} type="button" disabled={!validQuantity} onClick={() => onInsert(quote)}>
              <span className={st.productImage}>{photo ? <ProductVisual contact={{ id: photo }} /> : <Package size={19} />}</span>
              <span className={st.productName}><strong>{item.name}</strong><small>{[item.sku, item.stock].filter(Boolean).join(" · ")}</small></span>
              <span className={st.productPrice}><b>{unitPrice ? total || "—" : "Sob consulta"}</b>
                {showUnit && <small>{quantity > 1 ? unitPrice + " / " + unit : "por " + unit}</small>}
              </span>
            </button>;
          })}
          {!list.count && <p role="status">{term ? "Nenhum item corresponde à busca." : "O catálogo está vazio."}</p>}
        </div>
      </div>
    </ResponsiveDialog>
  );
}

function FilePreview({ file, onRemove, disabled }) {
  const [url, setUrl] = useState("");
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let alive = true;
    let objectUrl;
    readAttachment(file.id)
      .then((blob) => {
        if (!alive) return;
        if (!blob) {
          setMissing(true);
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (alive) setMissing(true);
      });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.id]);
  return (
    <div className={st.attachment}>
      {url && file.type.startsWith("image/") ? (
        <img src={url} alt={file.name} />
      ) : (
        <File size={16} />
      )}
      <span>
        <strong>{file.name}</strong>
        <small>
          {missing
            ? "Arquivo indisponível"
            : Math.max(1, Math.round(file.size / 1024)) + " KB"}
        </small>
      </span>
      <IconAction
        type="button"
        disabled={disabled}
        onClick={onRemove}
        aria-label={"Remover " + file.name}
      >
        <X size={14} />
      </IconAction>
      {url && file.type.startsWith("audio/") && (
        <audio controls src={url} aria-label="Ouvir antes de enviar" />
      )}
      {url && file.type.startsWith("video/") && (
        <video controls src={url} aria-label="Ver antes de enviar" />
      )}
    </div>
  );
}
export function AttendanceComposer({
  ref,
  thread,
  contact,
  ops,
  change,
  suggestion,
  onSuggestionApplied,
  notify,
}) {
  const id = thread.id;
  const name = contact.name.split(" ")[0];
  const [note, setNote] = useState(false);
  const [zoe, setZoe] = useState(false);
  const [dialog, setDialog] = useState("");
  const [replyName, setReplyName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const input = useRef(null);
  const picker = useRef(null);
  const lock = useRef(false);
  const live = useRef(true);
  const dragDepth = useRef(0);
  const draft = (note ? ops.noteDrafts : ops.inboxDrafts)?.[id] || "";
  const files = ops.draftFiles?.[id] || [];
  const quoted = ops.replyReferences?.[id];
  const active = Boolean(ops.attendances?.[id]);
  const notes = ops.events.filter(
    (e) => e.kind === "Nota interna" && e.threadId === id,
  );
  const Icon = channelIcons[thread.channel];
  const recorder = useVoiceRecording((file) => addFiles([file]), setError);
  const locked = busy || recorder.recording || recorder.requesting;
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  function write(value, field = note ? "noteDrafts" : "inboxDrafts") {
    change((before) => ({ [field]: { ...before[field], [id]: value } }));
  }
  function focus() {
    requestAnimationFrame(() => input.current?.focus());
  }
  useImperativeHandle(ref, () => ({
    useSuggestion: requestSuggestion,
    quote(reference) {
      setNote(false);
      setZoe(false);
      change((before) => ({
        replyReferences: { ...before.replyReferences, [id]: reference },
      }));
      focus();
    },
  }));
  async function addFiles(list) {
    const additions = Array.from(list);
    if (!additions.length || lock.current) return;
    if (
      files.length + additions.length > MAX_FILES ||
      additions.some((f) => !f.size || f.size > 16 * 1024 * 1024)
    ) {
      setError("Escolha até cinco arquivos com conteúdo, de até 16 MB cada.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const stored = await storeDraftFiles(additions);
      change((before) => ({
        draftFiles: {
          ...before.draftFiles,
          [id]: [...(before.draftFiles?.[id] || []), ...stored],
        },
      }));
    } catch {
      if (live.current)
        setError(
          "O navegador não conseguiu guardar o anexo. Tente um arquivo menor.",
        );
    } finally {
      lock.current = false;
      if (live.current) setBusy(false);
    }
  }
  function removeFile(file) {
    change((before) => ({
      draftFiles: {
        ...before.draftFiles,
        [id]: (before.draftFiles?.[id] || []).filter((f) => f.id !== file.id),
      },
    }));
    deleteAttachment(file.id).catch(() => {});
  }
  function requestSuggestion() {
    if (!active || locked) return;
    const current = ops.inboxDrafts[id];
    if (current?.trim() && current !== suggestion) setDialog("replace");
    else applySuggestion();
  }
  function applySuggestion() {
    if (!active || locked) return;
    setNote(false);
    write(suggestion, "inboxDrafts");
    onSuggestionApplied?.();
    setDialog("");
    setZoe(false);
    focus();
  }
  function finish() {
    change(
      (before) => ({
        attendances: without(before.attendances, id),
        inboxDrafts: without(before.inboxDrafts, id),
        draftFiles: without(before.draftFiles, id),
        replyReferences: without(before.replyReferences, id),
      }),
      {
        kind: "Atendimento encerrado",
        contact: contact.id,
        threadId: id,
        detail: thread.account,
      },
    );
    for (const file of files) deleteAttachment(file.id).catch(() => {});
    setDialog("");
    setError("");
  }
  function submit() {
    if (locked || lock.current) return;
    if (note) {
      if (!draft.trim()) return;
      change((before) => ({ noteDrafts: without(before.noteDrafts, id) }), {
        kind: "Nota interna",
        threadId: id,
        contact: contact.id,
        author: contact.owner,
        detail: draft.trim(),
      });
      notify("Nota salva para a equipe.");
      focus();
      return;
    }
    if (!active) {
      setDialog("activate");
      return;
    }
    if (!draft.trim() && !files.length) return;
    change(
      (before) => ({
        inboxDrafts: without(before.inboxDrafts, id),
        draftFiles: without(before.draftFiles, id),
        replyReferences: without(before.replyReferences, id),
      }),
      {
        kind: "Resposta simulada",
        threadId: id,
        channel: thread.channel,
        author: contact.owner,
        contact: contact.id,
        detail: draft.trim() || files.map((f) => f.name).join(", "),
        attachment: files[0],
        attachments: files,
        replyTo: quoted,
      },
    );
    setZoe(false);
    notify("Mensagem registrada no atendimento local.");
    focus();
  }
  const quickReplies = [
    ...(ops.quickReplies || []),
    { label: "Saudação", text: "Olá, " + name + "! Como posso te ajudar?" },
    {
      label: "Confirmar o pedido",
      text:
        "Oi, " +
        name +
        "! Podemos confirmar os detalhes de " +
        contact.product +
        "?",
    },
    {
      label: "Combinar um retorno",
      text: "Vou conferir com a equipe. Qual é o melhor horário para te dar um retorno?",
    },
    {
      label: "Retomar proposta",
      text:
        "Oi, " +
        name +
        "! Conseguiu avaliar a proposta? Posso esclarecer alguma dúvida?",
    },
  ];
  function tool(icon, label, labelText) {
    const Mark = icon;
    return (props) => (
      <IconAction
        {...props}
        type="button"
        className={st.tool}
        disabled={locked}
        aria-label={label}
        title={label}
      >
        <Mark size={16} />
        {labelText && <span>{labelText}</span>}
      </IconAction>
    );
  }
  return (
    <div
      className={st.box}
      data-note={note}
      data-drag={dragging}
      onDragEnter={(e) => {
        if (!note && e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          dragDepth.current++;
          setDragging(true);
        }
      }}
      onDragOver={(e) => {
        if (!note && e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDragLeave={(e) => {
        if (dragging) {
          e.preventDefault();
          if (--dragDepth.current <= 0) setDragging(false);
        }
      }}
      onDrop={(e) => {
        if (e.dataTransfer.files.length) {
          e.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          if (!note && !locked) addFiles(e.dataTransfer.files);
        }
      }}
      onPaste={(e) => {
        if (!note && !locked && e.clipboardData.files.length) {
          e.preventDefault();
          addFiles(e.clipboardData.files);
        }
      }}
    >
      <div className={st.modes} role="group" aria-label="Destino da composição">
        <button
          type="button"
          aria-pressed={!note}
          disabled={locked}
          onClick={() => {
            setNote(false);
            setError("");
            focus();
          }}
        >
          <Icon size={14} />
          Responder
        </button>
        <button
          type="button"
          aria-pressed={note}
          disabled={locked}
          onClick={() => {
            setNote(true);
            setError("");
            setZoe(false);
            focus();
          }}
        >
          <LockKeyhole size={13} />
          Nota interna{notes.length > 0 && <small>{notes.length}</small>}
        </button>
        <span className={st.channelName}>
          {note ? "Só a equipe vê" : channels[thread.channel]}
        </span>
      </div>
      {note && notes.length > 0 && (
        <details className={st.noteHistory}>
          <summary>
            <Clock3 size={13} />
            Notas da equipe ({notes.length})
          </summary>
          <div>
            {notes.map((n) => (
              <article key={n.id}>
                <small>
                  {n.author || "Equipe"} ·{" "}
                  {new Date(n.at).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </small>
                <p>{n.detail}</p>
              </article>
            ))}
          </div>
        </details>
      )}
      {zoe && !note && (
        <div className={st.zoePanel}>
          <div>
            <img
              src="/assets/idle_thumbnail.png"
              width="30"
              height="30"
              alt=""
            />
            <strong>Sugestão da Zoe</strong>
            <IconAction
              type="button"
              aria-label="Fechar sugestão"
              onClick={() => setZoe(false)}
            >
              <X size={14} />
            </IconAction>
          </div>
          <p>{suggestion}</p>
          <footer>
            <a href={"#zoe/" + contact.id + "/" + id}>
              Analisar conversa <ArrowUpRight size={13} />
            </a>
            <Button
              size="sm"
              disabled={!active || locked}
              onClick={requestSuggestion}
            >
              Inserir no campo
            </Button>
          </footer>
        </div>
      )}
      <Composer
        ref={input}
        value={draft}
        onChange={write}
        onSubmit={submit}
        status={busy ? "submitting" : "idle"}
        disabled={locked}
        label={
          note
            ? "Nota para a equipe"
            : "Resposta por " + channels[thread.channel]
        }
        formLabel={
          note
            ? "Escrever nota interna"
            : active
              ? "Compor resposta"
              : "Preparar atendimento"
        }
        placeholder={
          note
            ? "Escreva uma observação para a equipe…"
            : "Mensagem para " + name + "…"
        }
        minRows={2}
        maxRows={4}
        maxLength={MAX_LENGTH}
        allowEmpty={!note && (!active || files.length > 0)}
        submitLabel={
          note
            ? "Salvar nota interna"
            : active
              ? "Enviar na demo"
              : "Iniciar atendimento"
        }
        submitText={
          note ? "Salvar nota" : active ? "Enviar" : "Iniciar atendimento"
        }
        attached={
          <>
            {!note && quoted && (
              <div className={st.reference}>
                <Reply size={15} />
                <span>
                  <strong>{quoted.author}</strong>
                  <small>{quoted.text}</small>
                </span>
                <IconAction
                  type="button"
                  aria-label="Remover citação"
                  onClick={() =>
                    change((before) => ({
                      replyReferences: without(before.replyReferences, id),
                    }))
                  }
                >
                  <X size={14} />
                </IconAction>
              </div>
            )}
            {!note &&
              files.map((f) => (
                <FilePreview
                  key={f.id}
                  file={f}
                  disabled={locked}
                  onRemove={() => removeFile(f)}
                />
              ))}
            {!note && (recorder.recording || recorder.requesting) && (
              <div className={st.record} role="status">
                <Mic size={15} />
                {recorder.requesting ? (
                  "Aguardando microfone…"
                ) : (
                  <>
                    Gravando · {Math.floor(recorder.seconds / 60)}:
                    {String(recorder.seconds % 60).padStart(2, "0")}
                    <button type="button" onClick={recorder.stop}>
                      <Square size={12} />
                      Parar para ouvir
                    </button>
                    <IconAction
                      type="button"
                      aria-label="Cancelar gravação"
                      onClick={recorder.cancel}
                    >
                      <X size={15} />
                    </IconAction>
                  </>
                )}
              </div>
            )}
          </>
        }
        tools={
          <>
            {!note && (
              <>
                <input
                  ref={picker}
                  type="file"
                  hidden
                  multiple
                  disabled={locked}
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <IconAction
                  type="button"
                  className={st.tool}
                  disabled={locked}
                  aria-label="Anexar arquivo à resposta"
                  title="Anexar arquivos"
                  onClick={() => picker.current?.click()}
                >
                  <Paperclip size={16} />
                </IconAction>
                {thread.channel !== "email" && (
                  <IconAction
                    type="button"
                    className={st.tool}
                    aria-label="Gravar áudio"
                    title="Gravar áudio"
                    disabled={locked || files.length >= MAX_FILES}
                    onClick={recorder.start}
                  >
                    <Mic size={16} />
                  </IconAction>
                )}
                <Menu
                  label="Respostas rápidas"
                  side="top"
                  trigger={tool(Zap, "Respostas rápidas", "Atalhos")}
                  sections={[
                    {
                      label: "Respostas rápidas",
                      items: quickReplies.map((r) => ({
                        label: r.label,
                        description: r.text,
                        onSelect: () => input.current?.insert(r.text),
                      })),
                    },
                    {
                      items: [
                        {
                          label: "Salvar texto atual como atalho",
                          disabled: !draft.trim(),
                          onSelect: () => {
                            setReplyName("");
                            setDialog("shortcut");
                          },
                        },
                      ],
                    },
                  ]}
                />
                <IconAction
                  type="button"
                  className={st.tool}
                  disabled={locked}
                  aria-label="Inserir produto do catálogo"
                  title="Inserir produto do catálogo"
                  onClick={() => {
                    setDialog("product");
                  }}
                >
                  <Package size={16} />
                  <span>Catálogo</span>
                </IconAction>
              </>
            )}
            <Menu
              label="Inserir emoji"
              side="top"
              trigger={tool(Smile, "Inserir emoji")}
              sections={[
                {
                  label: "Inserir emoji",
                  items: [
                    ["😊", "Sorriso"],
                    ["👍", "Positivo"],
                    ["💜", "Coração"],
                    ["✅", "Confirmado"],
                    ["🙏", "Obrigado"],
                  ].map(([emoji, label]) => ({
                    label: emoji + " " + label,
                    onSelect: () => input.current?.insert(emoji),
                  })),
                },
              ]}
            />
            {!note && (
              <IconAction
                type="button"
                className={st.zoeTool}
                aria-pressed={zoe}
                aria-label="Sugestão da Zoe"
                disabled={locked}
                onClick={() => setZoe(!zoe)}
              >
                <Sparkles size={14} />
                Zoe
                <ChevronDown size={11} />
              </IconAction>
            )}
          </>
        }
        strip={
          <div className={st.strip}>
            <span>
              {note ? (
                <LockKeyhole size={12} />
              ) : active ? (
                <i />
              ) : (
                <Icon size={13} />
              )}{" "}
              {note
                ? "Privado · Equipe"
                : active
                  ? "Atendimento ativo"
                  : "Rascunho local"}
            </span>
            {draft.length >= 1750 ? (
              <small>
                {draft.length}/{MAX_LENGTH}
              </small>
            ) : (
              <small className={st.shortcut}>
                {note ? "Enter salva" : active ? "Enter envia" : ""}
              </small>
            )}
            {active && !note && (
              <button
                type="button"
                disabled={locked}
                onClick={() =>
                  draft || files.length || quoted ? setDialog("end") : finish()
                }
              >
                Encerrar
              </button>
            )}
          </div>
        }
      />
      {dragging && (
        <div className={st.drop}>
          <Paperclip size={20} />
          Solte para anexar
        </div>
      )}
      {error && (
        <p role="alert" className={st.error}>
          {error}
        </p>
      )}
      {dialog === "product" && (
        <QuotePicker products={ops.products} onClose={() => setDialog("")} onInsert={quote => {
          setDialog("");
          input.current?.insert(quote);
        }} />
      )}
      {dialog === "shortcut" && (
        <ResponsiveDialog
          footer={
            <Button
              form="resposta-rapida"
              type="submit"
              variant="primary"
              disabled={!replyName.trim()}
            >
              {" "}
              Salvar resposta rápida{" "}
            </Button>
          }
          open
          title="Salvar resposta rápida"
          onClose={() => setDialog("")}
        >
          <form
            id="resposta-rapida"
            className="op-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!replyName.trim() || !draft.trim()) return;
              change((before) => ({
                quickReplies: [
                  ...(before.quickReplies || []),
                  {
                    id: crypto.randomUUID(),
                    label: replyName.trim(),
                    text: draft.trim(),
                  },
                ],
              }));
              setDialog("");
              notify("Resposta rápida salva.");
            }}
          >
            <label className="op-field">
              Nome do atalho
              <input
                autoFocus
                required
                maxLength={60}
                value={replyName}
                onChange={(e) => setReplyName(e.target.value)}
              />
            </label>
            <p>{draft}</p>
          </form>
        </ResponsiveDialog>
      )}
      {["activate", "replace", "end"].includes(dialog) && (
        <ResponsiveDialog
          open
          onClose={() => setDialog("")}
          title={
            dialog === "activate"
              ? "Atender " + contact.name + "?"
              : dialog === "replace"
                ? "Substituir o rascunho?"
                : "Descartar rascunho e encerrar?"
          }
        >
          <div className="op-form">
            {dialog === "activate" ? (
              <>
                <p>Confira o destinatário deste atendimento local.</p>
                <div className={st.target}>
                  <Icon size={20} />
                  <span>
                    <strong>{contact.name}</strong>
                    <small>
                      {channels[thread.channel]} · {thread.account}
                    </small>
                  </span>
                </div>
              </>
            ) : (
              <p>
                {dialog === "replace"
                  ? "O texto da Zoe vai substituir a mensagem em edição."
                  : "A mensagem em edição e seus anexos serão descartados."}
              </p>
            )}
            <div className="actions">
              <Button onClick={() => setDialog("")}>Cancelar</Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (dialog === "replace") return applySuggestion();
                  if (dialog === "end") return finish();
                  change(
                    (before) => ({
                      attendances: { ...before.attendances, [id]: true },
                    }),
                    {
                      kind: "Atendimento iniciado",
                      contact: contact.id,
                      threadId: id,
                      detail: thread.account,
                    },
                  );
                  setDialog("");
                  focus();
                }}
              >
                {dialog === "replace"
                  ? "Substituir rascunho"
                  : dialog === "end"
                    ? "Encerrar atendimento"
                    : "Ativar atendimento"}
              </Button>
            </div>
          </div>
        </ResponsiveDialog>
      )}
    </div>
  );
}
