import { IconAction } from "../src/ui/os/icon-action";
import { useState } from "react";
import {
  Button,
  ButtonLink,
} from "@content-ventures/design-system/v3";
import { ResponsiveDialog } from "../src/ui/os/responsive-dialog";
import {
  ArrowUpRight,
  CalendarClock,
  CheckCheck,
  Clock3,
  ListTree,
  LockKeyhole,
  MessageCircle,
  Send,
  Sparkles,
  Trophy,
} from "lucide-react";
import { evidenceId } from "../lib/conversation-request";
import { RequestEvidence } from "./request-evidence";
import { historyOf, channels } from "../lib/inbox";
import { contactsOf, timestamp, kinds, money } from "../lib/operation";
import { attendanceProfile } from "../lib/attendance";
import { attendanceDuration, paceCutoff } from "../lib/official/analysis";
import { nextAttention } from "../lib/thread-attention";
import st from "./signals.module.css";

export function ConversationReading({
  thread,
  contact,
  ops,
  reading,
  filter,
  inboxHref,
  triggerClassName,
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const messages = historyOf(ops, thread);
  const entries = ops.events.filter(
    (e) =>
      e.threadId === thread.id || (!e.threadId && e.contact === contact.id),
  );
  const timeline = [
    ...entries.map((e) => ({
      id: e.id,
      when: timestamp(e.at),
      title: kinds[e.kind] || e.kind,
      detail: e.cents
        ? [e.detail, money(e.cents)].filter(Boolean).join(" · ")
        : e.detail,
      icon:
        {
          won: Trophy,
          resolved: CheckCheck,
          "Atendimento resolvido": CheckCheck,
          "Retorno agendado": CalendarClock,
          "Nota interna": LockKeyhole,
          "Mensagem recebida": MessageCircle,
          "Resposta simulada": Send,
        }[e.kind] || Clock3,
      message: ["Mensagem recebida", "Resposta simulada"].includes(e.kind),
      win: e.kind === "won",
    })),
    ...thread.messages
      .map((m, i) => ({
        id: evidenceId(m, i),
        when: m.when,
        title: m.outgoing ? "Equipe comercial" : contact.name,
        detail: m.text,
        icon: m.outgoing ? Send : MessageCircle,
        message: true,
      }))
      .reverse(),
  ];
  const next = nextAttention(ops, thread, contact);
  const cutoff = open
    ? paceCutoff({
        messages: messages.map((m) => ({
          em: m.sentAt,
          de: m.outgoing ? "empresa" : "cliente",
        })),
        pace: attendanceProfile(ops, "", "", contactsOf(ops), 30).pace,
        now: new Date().toISOString(),
      })
    : null;
  return (
    <>
      <IconAction
        type="button"
        className={triggerClassName}
        onClick={() => setOpen(true)}
        aria-label="Abrir leitura e timeline da Zoe"
        title="Leitura e timeline"
      >
        <ListTree size={16} />
      </IconAction>
      {open && (
        <ResponsiveDialog
          open
          title={"Leitura de " + contact.name}
          onClose={() => setOpen(false)}
        >
          <div className="op-form">
            <section className={st.evidence}>
              <small>
                {channels[thread.channel]} · {thread.account}
              </small>
              <h3>Próximo passo</h3>
              <p>{reading.next}</p>
              {next && (
                <small>
                  <Clock3 size={13} /> Retomar em{" "}
                  {timestamp(Date.parse(next.at))}
                </small>
              )}
              {cutoff && (
                <p>
                  Depois do corte de {timestamp(Date.parse(cutoff.at))}. A
                  espera passou da mediana habitual de{" "}
                  {attendanceDuration(cutoff.reference.minutes)}.
                </p>
              )}
            </section>
            <RequestEvidence
              {...{ thread, ops, filter, inboxHref }}
              onNavigate={() => setOpen(false)}
            />
            <section className={st.evidence}>
              <h3>Timeline do atendimento</h3>
              <small>
                {messages.length} mensagens no histórico · {entries.length}{" "}
                ações registradas
              </small>
              <ol
                className={st.timeline}
                aria-label="Histórico da conversa e da equipe"
              >
                {timeline
                  .slice(0, expanded ? timeline.length : 4)
                  .map((item) => (
                    <li key={item.id} data-win={item.win}>
                      <span className={st.timelineMark}>
                        <item.icon size={13} />
                      </span>
                      <div>
                        <time>{item.when}</time>
                        <strong>{item.title}</strong>
                        <p>{item.detail}</p>
                        {item.message && (
                          <a
                            href={
                              inboxHref(thread.id, filter) +
                              "/mensagem/" +
                              item.id
                            }
                            onClick={() => setOpen(false)}
                          >
                            Ver mensagem <ArrowUpRight size={12} />
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
              </ol>
              {timeline.length > 4 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded
                    ? "Recolher"
                    : "Mostrar mais " + (timeline.length - 4) + " registros"}
                </Button>
              )}
            </section>
            <ButtonLink
              icon={Sparkles}
              href={"#zoe/" + contact.id + "/" + thread.id}
              onClick={() => setOpen(false)}
            >
              Perguntar à Zoe sobre esta conversa
            </ButtonLink>
          </div>
        </ResponsiveDialog>
      )}
    </>
  );
}
