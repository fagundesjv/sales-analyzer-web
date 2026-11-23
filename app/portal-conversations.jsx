"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, MessageCircle, Sparkles, Star } from "lucide-react";
import {
  Button,
  ButtonLink,
  LineChart,
  SearchField,
} from "@content-ventures/design-system/v3";
import { OutcomeCelebration } from "./outcome-celebration";
import { ResponsiveDialog } from "../src/ui/os/responsive-dialog";
import { Field, ReaisField } from "./operation-fields";
import { parseMoney } from "../lib/operation";
import { portalRequest } from "../lib/official-portal";
import { dateTime, realMoney, usePortalData } from "./portal-data";
import s from "./portal.module.css";

export function LoadState({ error, retry, text = "Carregando…" }) {
  return (
    <div className={s.status} role={error ? "alert" : "status"}>
      {error || text}
      {error && retry && (
        <Button size="sm" onClick={retry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
const href = (id) => "#conversa/" + encodeURIComponent(id);
const routes = (p) =>
  p.viewer.kind === "seller"
    ? { panel: "/api/zoe/seller/tela", list: "/api/zoe/seller/tela/conversas" }
    : { panel: "/api/radar", list: "/api/zoe/conversas" };

export function PortalQueue({ identity, radar }) {
  const [revision, refresh] = useState(0),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("todas");
  const [cursor, setCursor] = useState(null),
    [previous, setPrevious] = useState([]);
  const route = routes(identity);
  const params = new URLSearchParams({
    busca: query.trim(),
    filtro: filter,
    limite: "24",
    ...(cursor ? { cursor } : {}),
  });
  const { data, error } = usePortalData(
    radar ? route.panel : route.list + "?" + params,
    identity,
    revision,
  );
  const reading = data?.reading,
    amounts = reading?.numbers;
  const rows = radar
    ? Array.from(
        new Map(
          [...(reading?.queue || []), ...(reading?.lane || [])].map((row) => [
            row.id,
            row,
          ]),
        ).values(),
      )
    : data?.itens;
  function reset() {
    setCursor(null);
    setPrevious([]);
  }
  return (
    <section className={s.page}>
      <header className={s.heading}>
        <div>
          <h1>{radar ? "Radar de recuperação" : "Conversas"}</h1>
          <p>
            {radar
              ? reading
                ? "Leitura da Zoe · " + dateTime(reading.takenAt)
                : identity.company
              : identity.company}
          </p>
        </div>
        {radar && identity.zoeChatReleased !== false && (
          <ButtonLink href="#chat" icon={Sparkles}>
            Perguntar à Zoe
          </ButtonLink>
        )}
      </header>
      {radar && amounts && (
        <dl className={s.metrics}>
          <div>
            <dt>Valor em risco</dt>
            <dd>{realMoney(amounts.valorEmRisco)}</dd>
          </div>
          <div>
            <dt>Oportunidades em risco</dt>
            <dd>{amounts.leadsEmRisco}</dd>
          </div>
          <div>
            <dt>Aguardando resposta</dt>
            <dd>{amounts.esperando}</dd>
          </div>
        </dl>
      )}
      {radar && data?.series?.length > 1 && (
        <section className={s.insight} aria-label="Atividade por leitura">
          <h2>Conversas aguardando resposta</h2>
          <LineChart
            label="Aguardando resposta por leitura"
            height={130}
            curve="linear"
            series={[{ key: "waiting", label: "Aguardando", color: "teal" }]}
            data={data.series.map((p) => ({
              label: new Date(p.at).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              }),
              values: { waiting: p.esperando },
            }))}
          />
        </section>
      )}
      {radar && <h2>Prioridades da Zoe</h2>}
      {!radar && (
        <div className={s.filters}>
          <SearchField
            label="Buscar conversa"
            placeholder="Nome, telefone ou mensagem"
            value={query}
            onValueChange={(v) => {
              setQuery(v);
              reset();
            }}
          />
          <select
            aria-label="Filtrar conversas"
            className="sales-select"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              reset();
            }}
          >
            {[
              ["todas", "Todas"],
              ["em_risco", "Em risco"],
              ["esperando", "Aguardando"],
              ["follow_up", "Follow-ups"],
              ["pagos", "Ganhas"],
              ["perdidos", "Perdidas"],
              ["resolvidos", "Resolvidas"],
            ].map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      )}
      {!data ? (
        <LoadState error={error} retry={() => refresh((v) => v + 1)} />
      ) : rows?.length ? (
        <div className={s.cards}>
          {rows.map((row) => (
            <a className={s.card} key={row.id} href={href(row.id)}>
              <div className={s.row}>
                <span className={s.contact}>
                  <MessageCircle size={16} />
                  {row.contato}
                </span>
                <ArrowUpRight size={16} />
              </div>
              <p>
                {row.porque ||
                  row.ocorrencia ||
                  row.situacao ||
                  row.ultima?.texto ||
                  row.momento ||
                  row.passo?.titulo ||
                  row.whatsapp?.nome}
              </p>
              <footer>
                <small>
                  {row.work?.paid
                    ? "Ganho"
                    : row.work?.lost
                      ? "Perdido"
                      : row.emRisco || row.valorOrigem === "risco"
                        ? "Em risco"
                        : row.work?.resolved
                          ? "Resolvida"
                          : "Em acompanhamento"}
                </small>
                {(row.risco?.valor ?? row.perda ?? row.valor) != null && (
                  <strong>
                    {realMoney(row.risco?.valor ?? row.perda ?? row.valor)}
                  </strong>
                )}
              </footer>
            </a>
          ))}
        </div>
      ) : (
        <p className={s.status}>
          {radar
            ? reading
              ? "Nenhuma prioridade nesta leitura."
              : "Aguardando a primeira leitura da Zoe."
            : "Nenhuma conversa encontrada."}
        </p>
      )}
      {!radar && (cursor || data?.proximo) && (
        <div className={s.actions}>
          <Button
            disabled={!cursor}
            onClick={() => {
              setCursor(previous.at(-1));
              setPrevious(previous.slice(0, -1));
            }}
          >
            Anterior
          </Button>
          <Button
            disabled={!data?.proximo}
            onClick={() => {
              setPrevious([...previous, cursor]);
              setCursor(data.proximo);
            }}
          >
            Próxima
          </Button>
        </div>
      )}
      {radar && (
        <ButtonLink href="#entrada" variant="secondary">
          Ver todas as conversas
        </ButtonLink>
      )}
    </section>
  );
}

function Attachment({ media }) {
  if (!media?.url) return null;
  const url = URL.canParse(media.url) && new URL(media.url);
  if (!url || !["https:", "http:"].includes(url.protocol)) return null;
  return (
    <a href={url.href} target="_blank" rel="noreferrer">
      {media.nome || "Abrir mídia"}
    </a>
  );
}

export function PortalConversation({ identity, id }) {
  const path = routes(identity),
    detailPath = path.list + "/" + encodeURIComponent(id);
  const [revision, refresh] = useState(0),
    [dialog, setDialog] = useState(null);
  const detail = usePortalData(detailPath, identity, revision);
  const messages = usePortalData(detailPath + "/mensagens", identity, revision);
  const panel = usePortalData(path.panel, identity, revision);
  const readingAt = panel.data?.reading?.takenAt;
  const resolutionPath = "/api/zoe/resolucoes/" + encodeURIComponent(id);
  const resolution = usePortalData(
    readingAt &&
      "/api/zoe/resolucoes?leituraEm=" + encodeURIComponent(readingAt),
    identity,
    revision,
  );
  const favorites = usePortalData(
    "/api/favorites/conversations",
    identity,
    revision,
  );
  const [older, setOlder] = useState([]),
    [olderCursor, setOlderCursor] = useState(undefined);
  const [ticket, setTicket] = useState(null),
    [target, setTarget] = useState(null),
    [draft, setDraft] = useState("");
  const [sent, setSent] = useState([]),
    [kind, setKind] = useState("won"),
    [amount, setAmount] = useState(""),
    [loss, setLoss] = useState("");
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [failure, setFailure] = useState("");
  const [confirmed, setConfirmed] = useState(null),
    [favorite, setFavorite] = useState(null);
  const pendingOutcome = useRef(null),
    lock = useRef(false),
    controller = useRef(null);
  const input = useRef(null);
  const pendingKey = [
    "sa-pending-send",
    identity.workspaceId,
    identity.user.id,
    id,
  ].join(":");
  const [uncertain, setUncertain] = useState(
    () => sessionStorage.getItem(pendingKey) !== null,
  );
  const savedOutcome =
    confirmed ??
    resolution.data?.outcomes?.find((o) => o.conversationId === id);
  const attendance =
    "/api/whatsapp/conversations/" + encodeURIComponent(id) + "/attendance";
  const mark = favorite ?? favorites.data?.conversationIds.includes(id);
  const readOnly = identity.supportMode === "inspect";
  useEffect(() => {
    controller.current = new AbortController();
    return () => controller.current.abort();
  }, []);
  useEffect(() => {
    if (!ticket) return;
    const timer = setTimeout(
      () => setTicket(null),
      Math.max(0, Date.parse(ticket.expiresAt) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [ticket]);
  const request = (url, method = "GET", body) =>
    portalRequest(url, {
      method,
      body,
      identity,
      signal: controller.current.signal,
    });
  function reload() {
    setConfirmed(null);
    setOlder([]);
    setOlderCursor(undefined);
    refresh((v) => v + 1);
  }
  async function run(action) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setFailure("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      if (!controller.current.signal.aborted) setFailure(e.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const activate = () =>
    run(async () => {
      const result = await request(attendance);
      setTarget(result.target);
      setDialog("activate");
    });
  const send = () =>
    run(async () => {
      if (!draft.trim() || !ticket || uncertain) return;
      const clientMessageId = crypto.randomUUID();
      sessionStorage.setItem(pendingKey, clientMessageId);
      try {
        const result = await request(attendance + "/messages", "POST", {
          ticket: ticket.ticket,
          clientMessageId,
          text: draft.trim(),
        });
        if (!result.sent || !result.message)
          throw new Error("O provedor não confirmou o envio.");
        sessionStorage.removeItem(pendingKey);
        setSent((old) => [...old, result.message]);
        setDraft("");
        setNotice(
          result.persisted === false
            ? "O WhatsApp aceitou a mensagem. O histórico ainda não confirmou o registro."
            : "Mensagem enviada.",
        );
      } catch (e) {
        if (e.code === "ACTIVATION_REQUIRED") setTicket(null);
        if (!e.status || e.status >= 500 || e.code === "SEND_UNCERTAIN")
          setUncertain(true);
        else sessionStorage.removeItem(pendingKey);
        throw e;
      }
    });
  const saveOutcome = () =>
    run(async () => {
      const cents = parseMoney(amount);
      const decision = {
        leituraEm: readingAt,
        resultado: kind,
        ...(kind === "won" ? { valorCentavos: cents } : {}),
        ...(kind === "lost" && loss.trim() ? { motivo: loss.trim() } : {}),
      };
      const fingerprint = JSON.stringify(decision);
      if (pendingOutcome.current?.fingerprint !== fingerprint)
        pendingOutcome.current = {
          fingerprint,
          requestId: crypto.randomUUID(),
        };
      const response = await request(resolutionPath, "PUT", {
        ...decision,
        requestId: pendingOutcome.current.requestId,
      });
      if (response.conversationId !== id || response.outcome?.kind !== kind)
        throw new Error("Confira o resultado antes de tentar novamente.");
      setConfirmed(response.outcome);
      pendingOutcome.current = null;
      setDialog(null);
      setNotice("Desfecho registrado.");
    });
  const page = messages.data,
    nextOlder = olderCursor === undefined ? page?.anterior : olderCursor;
  const history = [...older, ...(page?.mensagens || [])];
  const error = detail.error || messages.error;
  if (!detail.data || !page)
    return (
      <section className={s.page}>
        <ButtonLink href="#entrada">Voltar às conversas</ButtonLink>
        <LoadState error={error} retry={reload} />
      </section>
    );
  const { conversa, leitura, risco } = detail.data;
  const suggestion = leitura?.respostaCompleta || leitura?.resposta;
  const finalKind =
    savedOutcome?.kind ||
    (conversa.work?.paid
      ? "won"
      : conversa.work?.lost
        ? "lost"
        : conversa.work?.resolved
          ? "resolved"
          : null);
  return (
    <section className={s.page}>
      <header className={s.heading}>
        <div>
          <a href="#entrada">Conversas</a>
          <h1>{conversa.contato}</h1>
          <p>
            {conversa.whatsapp?.nome}{" "}
            {conversa.telefone && "· " + conversa.telefone}
          </p>
        </div>
        <div className={s.actions}>
          <Button
            aria-label={mark ? "Remover favorito" : "Favoritar"}
            title={mark ? "Remover favorito" : "Favoritar"}
            aria-pressed={Boolean(mark)}
            icon={Star}
            disabled={busy || readOnly || !favorites.data}
            onClick={() =>
              run(async () => {
                await request(
                  "/api/favorites/conversations/" + encodeURIComponent(id),
                  mark ? "DELETE" : "PUT",
                );
                setFavorite(!mark);
              })
            }
          />
          <Button
            variant="primary"
            disabled={readOnly || busy || !resolution.data}
            onClick={() => {
              setFailure("");
              setDialog("outcome");
            }}
          >
            {finalKind && finalKind !== "open"
              ? "Ver desfecho"
              : "Registrar desfecho"}
          </Button>
        </div>
      </header>
      {(panel.error || resolution.error || favorites.error) && (
        <LoadState
          error={panel.error || resolution.error || favorites.error}
          retry={reload}
        />
      )}
      {finalKind && finalKind !== "open" && (
        <p className={s.outcome}>
          {
            {
              won: "Venda ganha",
              lost: "Venda perdida",
              resolved: "Atendimento resolvido",
            }[finalKind]
          }{" "}
          {finalKind === "won" && savedOutcome?.sale &&
            "· " + realMoney(savedOutcome.sale.amountCents / 100)}
        </p>
      )}
      <div className={s.threadGrid}>
        <div className={s.thread}>
          {nextOlder && (
            <Button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const more = await request(
                    detailPath +
                      "/mensagens?antes=" +
                      encodeURIComponent(nextOlder),
                  );
                  setOlder([...more.mensagens, ...older]);
                  setOlderCursor(more.anterior);
                })
              }
            >
              Mensagens anteriores
            </Button>
          )}
          {history.map((m) => (
            <article
              className={s.bubble}
              data-out={m.de === "empresa"}
              key={m.id}
            >
              <small>
                {m.autor || (m.de === "empresa" ? "Equipe" : conversa.contato)}{" "}
                · {dateTime(m.em)}
              </small>
              <p>{m.texto}</p>
              <Attachment media={m.midia} />
            </article>
          ))}
          {sent
            .filter(
              (m) =>
                !history.some((h) => h.id === m.id || h.id === m.providerId),
            )
            .map((m) => (
              <article className={s.bubble} data-out="true" key={m.id}>
                <small>Equipe · {dateTime(m.sentAt)}</small>
                <p>{m.text}</p>
              </article>
            ))}
          {!history.length && !sent.length && (
            <p>Nenhuma mensagem disponível.</p>
          )}
          {!readOnly && (
            <div className={s.composer}>
              {uncertain ? (
                <>
                  <p role="alert">
                    Envio sem confirmação. Confira o WhatsApp antes de enviar
                    outra mensagem.
                  </p>
                  <Button
                    onClick={() => {
                      sessionStorage.removeItem(pendingKey);
                      setUncertain(false);
                      setDraft("");
                      reload();
                    }}
                  >
                    Já conferi o histórico
                  </Button>
                </>
              ) : ticket ? (
                <>
                  <label htmlFor="customer-draft">
                    Mensagem para {conversa.contato}
                  </label>
                  <textarea
                    id="customer-draft"
                    ref={input}
                    rows={3}
                    value={draft}
                    maxLength={4000}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <div className={s.actions}>
                    <Button onClick={() => setTicket(null)} disabled={busy}>
                      Encerrar atendimento
                    </Button>
                    <Button
                      variant="primary"
                      onClick={send}
                      disabled={busy || !draft.trim()}
                    >
                      Enviar mensagem
                    </Button>
                  </div>
                </>
              ) : (
                <Button disabled={busy} onClick={activate}>
                  Ativar atendimento
                </Button>
              )}
            </div>
          )}
        </div>
        <aside className={s.insight}>
          <Sparkles size={20} />
          <h2>Leitura da Zoe</h2>
          <p>
            {risco?.explicacao ||
              leitura?.porque ||
              "A Zoe ainda não tem uma leitura para esta conversa."}
          </p>
          {suggestion && (
            <>
              <h3>Sugestão de retomada</h3>
              <blockquote>{suggestion}</blockquote>
              {leitura.desatualizada && (
                <small>
                  {leitura.avisoDesatualizada ||
                    "A conversa mudou desde a sugestão. Confira as últimas mensagens."}
                </small>
              )}
              {leitura.respostaResumida && (
                <small>A leitura trouxe apenas um trecho da sugestão.</small>
              )}
              <Button
                disabled={
                  !ticket ||
                  busy ||
                  uncertain ||
                  leitura.respostaResumida ||
                  draft.length + suggestion.length + (draft ? 1 : 0) > 4000
                }
                onClick={() => {
                  setDraft((old) =>
                    old ? old + "\n" + suggestion : suggestion,
                  );
                  input.current?.focus();
                }}
              >
                Usar na resposta
              </Button>
            </>
          )}
        </aside>
      </div>
      {!dialog && failure && <p role="alert">{failure}</p>}
      {notice && <p role="status">{notice}</p>}
      {(confirmed?.kind === "won" || confirmed?.kind === "resolved") && (
        <OutcomeCelebration outcome={confirmed.kind} />
      )}
      {dialog && (
        <ResponsiveDialog
          open
          title={
            dialog === "activate"
              ? "Ativar atendimento"
              : "Desfecho da conversa"
          }
          onClose={() => {
            if (!busy) setDialog(null);
          }}
          footer={
            <>
              <Button disabled={busy} onClick={() => setDialog(null)}>
                Cancelar
              </Button>
              {dialog === "activate" ? (
                <Button
                  variant="primary"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const session = await request(attendance, "POST", {
                        acknowledged: true,
                        connectionId: target.connectionId,
                      });
                      setTicket(session);
                      setDialog(null);
                    })
                  }
                >
                  Confirmar ativação
                </Button>
              ) : finalKind && finalKind !== "open" ? (
                <Button
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await request(resolutionPath, "DELETE", {
                        leituraEm: readingAt,
                      });
                      setDialog(null);
                      reload();
                      setNotice("Negociação reaberta.");
                    })
                  }
                >
                  Reabrir negociação
                </Button>
              ) : (
                <Button
                  variant="primary"
                  disabled={
                    busy ||
                    (kind === "won" && parseMoney(amount) === null) ||
                    (kind === "lost" && !loss.trim())
                  }
                  onClick={saveOutcome}
                >
                  Confirmar desfecho
                </Button>
              )}
            </>
          }
        >
          {dialog === "activate" ? (
            <p>
              Enviar mensagens a{" "}
              <strong>
                {target.contact} · {target.phone}
              </strong>{" "}
              por {target.whatsapp}. A ativação vale por 30 minutos.
            </p>
          ) : finalKind && finalKind !== "open" ? (
            <p>
              {
                {
                  won: "Venda ganha",
                  lost: "Venda perdida",
                  resolved: "Atendimento resolvido",
                }[finalKind]
              }
              {finalKind === "won" && savedOutcome?.sale &&
                " · " + realMoney(savedOutcome.sale.amountCents / 100)}
            </p>
          ) : (
            <div className={s.stack}>
              <Field label="Resultado">
                <select value={kind} onChange={(e) => setKind(e.target.value)}>
                  <option value="won">Ganho</option>
                  <option value="lost">Perdido</option>
                  <option value="resolved">Resolver atendimento</option>
                </select>
              </Field>
              {kind === "won" && (
                <Field label="Valor confirmado">
                  <ReaisField
                    value={amount}
                    onValueChange={setAmount}
                    aria-label="Valor confirmado"
                  />
                </Field>
              )}
              {kind === "lost" && (
                <Field label="Motivo da perda">
                  <textarea
                    maxLength={500}
                    value={loss}
                    onChange={(e) => setLoss(e.target.value)}
                  />
                </Field>
              )}
            </div>
          )}
          {failure && (
            <div role="alert">
              {failure}{" "}
              <Button
                disabled={busy}
                onClick={() => {
                  setDialog(null);
                  reload();
                }}
              >
                Atualizar conversa
              </Button>
            </div>
          )}
        </ResponsiveDialog>
      )}
    </section>
  );
}
