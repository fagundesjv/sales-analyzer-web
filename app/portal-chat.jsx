"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@content-ventures/design-system/v3";
import { Ask } from "../src/ui/os/chat/turns";
import { portalFetch } from "../lib/official-portal";
import { askQuestion, ZOE_STEPS } from "../lib/official/zoe-chat";
import { usePortalData, realMoney } from "./portal-data";
import { LoadState } from "./portal-conversations";
import s from "./portal.module.css";

function metric(value, unit) {
  if (value == null) return "—";
  if (unit === "reais") return realMoney(value);
  return (
    value.toLocaleString("pt-BR") +
    ({ porcentagem: "%", minutos: " min" }[unit] || "")
  );
}
function Block({ b }) {
  if (b.tipo === "texto" || b.tipo === "anexo") return <p>{b.texto}</p>;
  if (b.tipo === "conversas")
    return (
      <div>
        <h3>{b.titulo}</h3>
        {b.cartoes.map((c) => (
          <p key={c.ref}>
            <a href={"#conversa/" + encodeURIComponent(c.conversaId)}>
              {c.contato}
            </a>{" "}
            {c.porque}
          </p>
        ))}
      </div>
    );
  if (b.tipo === "tabela")
    return (
      <div className={s.table}>
        <table>
          <caption>{b.titulo}</caption>
          <thead>
            <tr>
              {b.colunas.map((c, i) => (
                <th key={i}>{c.rotulo}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {b.linhas.map((r, i) => (
              <tr key={i}>
                {r.celulas.map((c, j) => (
                  <td key={j}>
                    {c.texto ?? metric(c.valor, b.colunas[j].tipo)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  if (b.tipo === "acao") {
    const route = {
      visao_geral: "radar",
      zoe: "radar",
      conversas: "entrada",
      whatsapps: "whatsapps",
      empresa: "empresa",
    }[b.acao.comando];
    return route ? (
      <a href={"#" + route}>{b.acao.titulo}</a>
    ) : (
      <p>{b.acao.titulo} · Disponível no portal oficial</p>
    );
  }
  const items = b.itens || b.partes || b.serie?.pontos || [];
  return (
    <div>
      <h3>{b.titulo}</h3>
      <dl>
        {items.map((v, i) => (
          <div key={i}>
            <dt>
              {v.rotulo || (v.em && new Date(v.em).toLocaleDateString("pt-BR"))}
            </dt>
            <dd>
              {metric(v.valor, v.unidade || b.unidade || b.serie?.unidade)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
export function PortalChat({ identity }) {
  const base =
    identity.viewer.kind === "seller"
      ? "/api/zoe/seller/chat"
      : "/api/zoe/chat";
  const [revision, refresh] = useState(0),
    [thread, setThread] = useState(""),
    [draft, setDraft] = useState("");
  const [question, setQuestion] = useState(""),
    [step, setStep] = useState(""),
    [error, setError] = useState("");
  const pending = useRef(null);
  const state = usePortalData(base, identity, revision);
  const history = usePortalData(
    thread && base + "/historicos/" + encodeURIComponent(thread),
    identity,
    revision,
  );
  useEffect(() => () => pending.current?.abort(), []);
  async function submit(e) {
    e.preventDefault();
    const text = draft.trim();
    if (text.length < 2 || pending.current) return;
    const control = new AbortController();
    pending.current = control;
    setQuestion(text);
    setError("");
    setStep("Consultando a Zoe…");
    const ask = askQuestion((path, init = {}) =>
      portalFetch(base + path.slice("/api/zoe/chat".length), {
        identity,
        method: init.method,
        body: init.body ? JSON.parse(init.body) : undefined,
        signal: control.signal,
        stream: true,
        rawError: true,
      }),
    );
    try {
      await ask(
        {
          historicoId: thread || null,
          pergunta: text,
          clienteId: crypto.randomUUID(),
        },
        (event) => {
          if (control.signal.aborted) return;
          if (event.tipo === "etapa")
            setStep(ZOE_STEPS[event.etapa] || "Consultando a operação…");
          if (event.tipo === "erro")
            setError(event.error || "A Zoe não conseguiu concluir a resposta.");
          if (event.tipo === "fim" || event.tipo === "recuperada") {
            setThread(event.historico.id);
            setDraft("");
            refresh((v) => v + 1);
          }
        },
        control.signal,
      );
    } catch (e) {
      if (!control.signal.aborted) setError(e.message);
    } finally {
      if (!control.signal.aborted) {
        pending.current = null;
        setStep("");
        setQuestion("");
      }
    }
  }
  const canAsk =
    state.data?.acesso?.permitido &&
    ["pronta", "pausada"].includes(state.data.situacao);
  return (
    <section className={s.page}>
      <header className={s.heading}>
        <div>
          <h1>Chat da Zoe</h1>
          <p>{identity.company}</p>
        </div>
        {state.data && (
          <select
            className="sales-select"
            aria-label="Histórico da Zoe"
            value={thread}
            disabled={!!step}
            onChange={(e) => {
              setThread(e.target.value);
              setError("");
            }}
          >
            <option value="">Nova conversa</option>
            {state.data.historicos.map((h) => (
              <option value={h.id} key={h.id}>
                {h.titulo}
              </option>
            ))}
          </select>
        )}
      </header>
      {!state.data ? (
        <LoadState error={state.error} retry={() => refresh((v) => v + 1)} />
      ) : (
        <>
          {thread && !history.data && (
            <LoadState
              error={history.error}
              retry={() => refresh((v) => v + 1)}
            />
          )}
          {history.data?.mensagens.map((m) =>
            m.papel === "pergunta" ? (
              <Ask role="user" key={m.id}>
                {m.texto}
              </Ask>
            ) : (
              <article className={s.response} key={m.id}>
                <h3>Zoe</h3>
                {m.blocos.map((b, i) => (
                  <Block key={i} b={b} />
                ))}
                {m.citacoes
                  ?.filter((c) => c.conversaId)
                  .map((c) => (
                    <a
                      key={c.ref}
                      href={"#conversa/" + encodeURIComponent(c.conversaId)}
                    >
                      {c.rotulo || "Abrir conversa de origem"}
                    </a>
                  ))}
              </article>
            ),
          )}
          {!thread && canAsk && (
            <div className={s.actions}>
              {[
                "Como foi a operação hoje?",
                ...state.data.sugestoes.map((v) => v.pergunta),
              ]
                .slice(0, 3)
                .map((v) => (
                  <Button key={v} onClick={() => setDraft(v)}>
                    {v}
                  </Button>
                ))}
            </div>
          )}
          {question && <Ask role="user">{question}</Ask>}
          {step && <p role="status">{step}</p>}
          {error && <p role="alert">{error}</p>}
          {canAsk ? (
            <form className={s.composer} onSubmit={submit}>
              <label htmlFor="zoe-question">Perguntar à Zoe</label>
              <textarea
                id="zoe-question"
                rows={2}
                maxLength={500}
                value={draft}
                disabled={!!step}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Pergunte sobre os resultados de hoje…"
              />
              <Button
                variant="primary"
                type="submit"
                disabled={draft.trim().length < 2 || !!step}
              >
                Enviar pergunta
              </Button>
            </form>
          ) : (
            <p className={s.status}>
              {state.data.situacao === "primeira_leitura"
                ? "A Zoe está preparando a primeira leitura."
                : "O chat está indisponível para este acesso."}
            </p>
          )}
        </>
      )}
    </section>
  );
}
