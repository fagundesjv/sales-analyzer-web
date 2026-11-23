import { recoveryQueue } from "../lib/recovery-queue";
import { contactsOf, kindOf, money } from "../lib/operation";
import { channels, inboxHref } from "../lib/inbox";

export function CommercialInsights({ ops }) {
  const contacts = contactsOf(ops);
  const waiting = recoveryQueue(ops, { includeScheduled: true }).filter(
    (r) => r.waiting,
  );
  const losses = new Map();
  for (const contact of contacts.filter((c) => kindOf(c, ops) === "lost")) {
    const cause = ops.outcomes[contact.id]?.reason || contact.title;
    losses.set(cause, [...(losses.get(cause) || []), contact]);
  }
  return (
    <div className="sales-insights">
      <section className="source-card">
        <h2>Onde a venda travou</h2>
        {losses.size === 0 && (
          <p>Nenhuma negociação está marcada como perdida.</p>
        )}
        {[...losses].map(([cause, cases]) => (
          <details key={cause}>
            <summary>
              {cause}
              <strong>{cases.length}</strong>
            </summary>
            {cases.map((c) => (
              <a key={c.id} href={"#conversa/" + c.id}>
                {c.name}
                <span>{c.cents ? money(c.cents) : "Valor a apurar"}</span>
              </a>
            ))}
          </details>
        ))}
      </section>
      <section className="source-card">
        <h2>Espera por canal</h2>
        {Object.entries(channels).map(([id, name]) => {
          const rows = waiting.filter((r) => r.thread.channel === id);
          return (
            <details key={id}>
              <summary>
                {name}
                <strong>{rows.length} aguardando</strong>
              </summary>
              {rows.length ? (
                rows.map((r) => (
                  <a key={r.thread.id} href={inboxHref(r.thread.id)}>
                    {r.contact.name}
                    <span>
                      {r.delay} · {r.owner}
                    </span>
                  </a>
                ))
              ) : (
                <p>Nenhum caso na fila deste canal.</p>
              )}
            </details>
          );
        })}
      </section>
    </div>
  );
}
