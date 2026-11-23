import { ArrowUpRight, BookOpenCheck, Clock3 } from "lucide-react";
import { conversationRequest } from "../lib/conversation-request";
import { inboxHref as normalHref } from "../lib/inbox";
import st from "./signals.module.css";
const labels = {
  sem_resposta: "Em aberto",
  em_parte: "Resposta parcial",
  prometido: "Promessa da equipe",
  aguardando_leitura: "Mídia pendente",
};
export function RequestEvidence({
  ops,
  thread,
  filter,
  inboxHref = normalHref,
  onNavigate,
}) {
  const request = conversationRequest(ops, thread);
  const href = (id) =>
    inboxHref(thread.id, filter) + "/mensagem/" + encodeURIComponent(id);
  return (
    <section className={st.evidence} aria-label="Pedido em aberto">
      <div className={st.sectionTitle}>
        <BookOpenCheck size={17} />
        <h3>Pedido em aberto</h3>
      </div>
      {request.itens.length ? (
        request.itens.map((item) => (
          <a
            onClick={onNavigate}
            className={st.evidenceRow}
            key={item.ids.join("-") + item.rotulo}
            href={href(item.ids[0])}
          >
            <span>
              <small>
                {labels[item.situacao]}
                {item.vezes > 1 ? " · " + item.vezes + " pedidos" : ""}
              </small>
              <strong>{item.rotulo}</strong>
              <q>{item.trecho}</q>
            </span>
            <ArrowUpRight size={16} />
          </a>
        ))
      ) : (
        <p>Nenhum pedido pendente identificado nas mensagens.</p>
      )}
      {request.compromissos.map((c) => (
        <a
          onClick={onNavigate}
          className={st.evidenceRow}
          key={c.id}
          href={href(c.id)}
        >
          <span>
            <small>
              <Clock3 size={12} /> Compromisso da equipe
            </small>
            <q>{c.texto}</q>
          </span>
          <ArrowUpRight size={16} />
        </a>
      ))}
      {!!request.respondidos.length && (
        <details>
          <summary>
            Pedidos já respondidos · {request.respondidos.length}
          </summary>
          {request.respondidos.map((r, i) => (
            <a
              onClick={onNavigate}
              className={st.evidenceRow}
              key={i}
              href={href(r.por)}
            >
              {r.rotulo}
              <ArrowUpRight size={14} />
            </a>
          ))}
        </details>
      )}
    </section>
  );
}
