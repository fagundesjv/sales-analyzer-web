"use client";
import { DirectoryPager, Status, useDirectoryPage } from "./directory";
import s from "./directory.module.css";
import { catalogKind } from "../lib/catalog";
import { useState } from "react";
import {
  Button,
  DataTable,
  ButtonLink,
} from "@content-ventures/design-system/v3";
import { ResponsiveDialog } from "../src/ui/os/responsive-dialog";
import { CalendarClock, PackageCheck } from "lucide-react";
import { contactsOf, kindOf, money } from "../lib/operation";
import {
  channels,
  inboxHref,
  localDate,
  primaryThread,
  threadsOf,
} from "../lib/inbox";

const normalize = (value) => value.trim().toLocaleLowerCase("pt-BR");
export function RestockRecovery({ ops, change, notify }) {
  const [editing, setEditing] = useState(false);
  const [selection, setSelection] = useState([]);
  const [due, setDue] = useState(localDate());
  const threads = new Map(threadsOf(ops).map(t => [t.id, t]));
  const pending = new Map(ops.tasks.filter(t => !t.done).map(t => [t.contact, t]));
  const matches = contactsOf(ops).flatMap((contact) => {
    if (
      kindOf(contact, ops) !== "lost" ||
      !(
        contact.id === "clara" ||
        contact.category === "Disponibilidade de produto" ||
        /estoque|esgot/i.test(ops.outcomes[contact.id]?.reason || "")
      )
    )
      return [];
    const product = ops.products.find(
      (p) =>
        catalogKind(p) === "product" && normalize(p.name) === normalize(contact.product) &&
        p.stock === "Disponível" &&
        (!contact.cents || (p.price != null && p.price <= contact.cents)),
    );
    if (!product) return [];
    const thread = threads.get(primaryThread(contact));
    if (!thread) return [];
    const task = pending.get(contact.id);
    return [{ contact, product, thread, task }];
  });
  const free = matches.filter((m) => !m.task);
  const results = useDirectoryPage(matches);
  const candidates = useDirectoryPage(free);
  function prepare(e) {
    e.preventDefault();
    const picks = free.filter((m) => selection.includes(m.contact.id));
    if (!picks.length || !due) return;
    const replies = { ...ops.zoeReplies };
    const tasks = picks.map(({ contact, product, thread }) => {
      if (!replies[thread.id])
        replies[thread.id] =
          "Oi, " +
          contact.name.split(" ")[0] +
          "! " +
          product.name +
          " voltou ao estoque" +
          (product.price ? " por " + money(product.price) : "") +
          ". Você ainda tem interesse?";
      return {
        id: crypto.randomUUID(),
        contact: contact.id,
        threadId: thread.id,
        plan: true,
        text: "Avisar sobre a reposição de " + product.name,
        owner: contact.owner,
        due,
        done: false,
      };
    });
    change(
      { tasks: [...ops.tasks, ...tasks], zoeReplies: replies },
      {
        kind: "Retomada por reposição",
        detail: tasks.length + " retorno(s) preparado(s) com base no catálogo",
      },
    );
    setEditing(false);
    notify("Retornos preparados. As sugestões estão nas conversas.");
  }
  return (
    <section className={s.directory} aria-label="Recuperação por reposição">
      <div className="source-card">
      <span className="stock-label">
        <PackageCheck size={16} />
        Recuperação por reposição
      </span>
      <h2>
        {matches.length
          ? matches.length +
            " " +
            (matches.length === 1 ? "contato pode" : "contatos podem") +
            " voltar a comprar"
          : "Aguardar reposição"}
      </h2>
      <p>
        {matches.length
          ? "A Zoe encontrou pedidos que o estoque já pode atender. Revise a conversa antes de preparar o retorno."
          : "Quando o produto de uma venda perdida voltar ao estoque dentro do valor citado, o contato aparece aqui."}
      </p>
      <div className="actions">
        {free.length > 0 && (
          <Button
            icon={CalendarClock}
            onClick={() => {
              candidates.reset();
              setSelection(free.map((m) => m.contact.id));
              setEditing(true);
            }}
          >
            Preparar retornos ({free.length})
          </Button>
        )}
        {matches.some((m) => m.task) && (
          <ButtonLink href="#tarefas">Acompanhar retornos</ButtonLink>
        )}
      </div>
      </div>
      {!!results.count && <>
        <DataTable label="Contatos com produto reposto" density="compact" rows={results.rows} rowKey={row => row.contact.id}
          columns={[
            { key:"contact", header:"Contato", render:({contact,thread}) => <a className={s.name} href={inboxHref(thread.id)}>{contact.name}</a> },
            { key:"product", header:"Produto reposto", render:({product}) => product.name },
            { key:"owner", header:"Responsável", render:({contact}) => contact.owner || "Sem atribuição" },
            { key:"task", header:"Retorno", render:({task}) => <Status tone={task ? "good" : "warn"}>{task ? "Agendado" : "A preparar"}</Status> },
          ]} />
        <DirectoryPager list={results} noun="contatos" />
      </>}
      {editing && (
        <ResponsiveDialog
          footer={
            <Button
              form="reposicao"
              type="submit"
              variant="primary"
              disabled={!selection.length || !due}
            >
              {" "}
              Criar retornos e sugestões{" "}
            </Button>
          }
          open
          title="Revisar retornos de reposição"
          onClose={() => setEditing(false)}
        >
          <form id="reposicao" className="op-form" onSubmit={prepare}>
            {candidates.rows.map(({ contact, thread, product }) => (
              <div key={contact.id} className="stock-match">
                <label>
                  <input
                    type="checkbox"
                    checked={selection.includes(contact.id)}
                    onChange={(e) =>
                      setSelection(
                        e.target.checked
                          ? [...selection, contact.id]
                          : selection.filter((id) => id !== contact.id),
                      )
                    }
                  />{" "}
                  <strong>{contact.name}</strong> · {product.name}
                </label>
                <p>“{contact.quote}”</p>
                <ButtonLink
                  size="sm"
                  variant="ghost"
                  href={inboxHref(thread.id)}
                >
                  Ver {channels[thread.channel]}
                </ButtonLink>
              </div>
            ))}
            <DirectoryPager list={candidates} noun="contatos" />
            <label className="op-field">
              Data dos retornos
              <input
                type="date"
                required
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </label>
          </form>
        </ResponsiveDialog>
      )}
    </section>
  );
}
