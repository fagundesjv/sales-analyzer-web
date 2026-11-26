"use client";
import {Button, ButtonLink} from "@content-ventures/design-system/v3";
import {inboxHref} from "../../lib/inbox";
import css from "../customer-inbox.module.css";

const waiting = {
  writing: "A Zoe está preparando a sugestão desta leitura.",
  no_quota: "A sugestão aguarda a liberação do limite de análise da empresa.",
  unavailable: "A sugestão desta leitura ainda não está disponível.",
};

export function ReplySuggestion({item, refresh, title = "Sugestão da Zoe"}) {
  const reply = item.analysis?.reply;
  if (!reply) return null;

  const stale = Boolean(item.pendingRevision);
  const ready = !stale && reply.state === "ready" && Boolean(reply.text?.trim());
  const ids = [...new Set(reply.evidenceIds ?? [])];
  const evidence = item.evidence ?? [];
  const sources = ids.filter(id => evidence.some(message => message.externalId === id));
  const missing = sources.length < ids.length;

  return <section className={css.brief} aria-label={title}>
    <h3>{stale ? "Sugestão desatualizada" : title}</h3>
    {ready ? <>
      <blockquote>{reply.text}</blockquote>
      {sources.length > 0 && <nav aria-label="Fontes da sugestão">
        {sources.map((id, index) => <ButtonLink key={id} size="sm" variant="ghost"
          href={inboxHref(item.id) + "/evidencia/" + encodeURIComponent(id)}>
          Ver fonte {index + 1}
        </ButtonLink>)}
      </nav>}
      {(missing || ids.length === 0) && <p role="status">
        Parte das fontes da sugestão está fora desta leitura. Consulte o histórico antes de usar o texto.
      </p>}
    </> : <>
      <p role="status">{stale
        ? "A conversa mudou após esta sugestão. Atualize a leitura antes de usar o texto."
        : waiting[reply.state] || waiting.unavailable}</p>
      <Button size="sm" variant="ghost" onClick={refresh}>Atualizar sugestão</Button>
    </>}
  </section>;
}
