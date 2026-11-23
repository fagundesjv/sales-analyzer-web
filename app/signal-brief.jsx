"use client";
import { IconAction } from "../src/ui/os/icon-action";
import { useState } from "react";
import {
  ArrowUpRight,
  ArrowUp,
  AudioLines,
  Sparkles,
  MessageCircle,
  Instagram,
  Mail,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button, ButtonLink } from "@content-ventures/design-system/v3";
import { channels, inboxHref } from "../lib/inbox";
import { money } from "../lib/operation";
import { ZoeAvatar } from "./zoe-avatar";
import st from "./signals.module.css";

const icons = { whatsapp: MessageCircle, instagram: Instagram, email: Mail };
const channelAngle = { whatsapp: -120, instagram: 0, email: 120 };

function positions(rows) {
  const groups = rows.reduce((all, r) => {
    (all[r.thread.channel] ||= []).push(r);
    return all;
  }, {});
  return rows.map((row) => {
    const siblings = groups[row.thread.channel];
    const angle =
      ((channelAngle[row.thread.channel] +
        (100 * (siblings.indexOf(row) + 0.5)) / siblings.length) *
        Math.PI) /
      180;
    const distance = 26 + Math.min(15, Math.log1p(row.elapsed) / 0.6);
    return {
      left: 50 + Math.cos(angle) * distance + "%",
      top: 50 + Math.sin(angle) * distance + "%",
    };
  });
}

export function SignalBrief({ queue, ask }) {
  const [selected, setSelected] = useState("");
  const [question, setQuestion] = useState("");
  const index = Math.max(
    0,
    queue.findIndex((r) => r.thread.id === selected),
  );
  const row = queue[index];
  const contact = row?.contact;
  const name = contact?.name.split(" ")[0];
  const title =
    row?.reason === "Cliente quer pagar"
      ? name + " quer pagar."
      : row?.reason === "Confirmar pagamento"
        ? "Confira o pagamento de " + name + "."
        : row
          ? "É hora de retomar com " + name + "."
          : "Sua fila está em dia.";
  const pageStart = Math.floor(index / 8) * 8;
  const displayed = queue.slice(pageStart, pageStart + 8);
  const spots = positions(displayed);
  const Icon = icons[row?.thread.channel] || MessageCircle;
  function shift(offset) {
    setSelected(
      queue[(index + offset + queue.length) % queue.length].thread.id,
    );
  }
  return (
    <section className={st.brief} aria-label="Recomendação da Zoe">
      <div className={st.story}>
        <div className={st.author}>
          <AudioLines size={15} /> Zoe <span /> Leitura da operação
        </div>
        <div key={row?.thread.id} className={st.reading} aria-live="polite">
          <h2>{title}</h2>
          {row && (
            <>
              <blockquote>“{row.quote}”</blockquote>
              <div className={st.context}>
                <span>
                  <Icon size={13} />
                  {channels[row.thread.channel]}
                </span>
                <i />{" "}
                {row.waiting ? row.delay + " de espera" : "Retorno pendente"}{" "}
                {contact.cents != null && (
                  <>
                    <i />
                    {money(contact.cents)}
                  </>
                )}
              </div>
            </>
          )}
        </div>
        <div className={st.buttons}>
          {row && (
            <ButtonLink
              variant="primary"
              href={inboxHref(row.thread.id)}
              trailingIcon={ArrowUpRight}
            >
              Abrir conversa
            </ButtonLink>
          )}
          {row ? <Button size="sm" variant="ghost" icon={Sparkles}
            onClick={() => ask("O que ficou em aberto na conversa de " + contact.name + "?", "request", undefined, row.thread)}>
            Entender o sinal
          </Button> : <ButtonLink href="#tarefas" variant="ghost">Ver agenda</ButtonLink>}
        </div>
      </div>
      <div className={st.instrument} aria-label="Sinais comerciais">
        <div className={st.scope}>
          <div className={st.disc} aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className={st.zoe}>
            <ZoeAvatar
              expression={row?.priority === 1 ? "listening" : "idle"}
            />
          </div>
          {displayed.map((r, i) => (
            <IconAction
              type="button"
              key={r.thread.id}
              className={st.point}
              style={spots[i]}
              aria-pressed={r === row}
              aria-label={
                "Ver sinal de " +
                r.contact.name +
                " no " +
                channels[r.thread.channel]
              }
              title={r.contact.name + " · " + r.reason}
              onClick={() => setSelected(r.thread.id)}
            >
              <span>{r.contact.initials}</span>
            </IconAction>
          ))}
        </div>
        {queue.length > 1 && (
          <div className={st.pager}>
            <IconAction onClick={() => shift(-1)} aria-label="Sinal anterior">
              <ChevronLeft size={15} />
            </IconAction>
            <span>
              {String(index + 1).padStart(2, "0")} /{" "}
              {String(queue.length).padStart(2, "0")}
            </span>
            <IconAction onClick={() => shift(1)} aria-label="Próximo sinal">
              <ChevronRight size={15} />
            </IconAction>
          </div>
        )}
      </div>
      <form
        className={st.prompt}
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim()) ask(question.trim());
        }}
      >
        <AudioLines size={18} />
        <input
          value={question}
          maxLength={500} enterKeyHint="send" autoComplete="off"
          onChange={(e) => setQuestion(e.target.value)}
          aria-label="Perguntar à Zoe no Radar"
          placeholder="Pergunte à Zoe…"
        />
        <IconAction aria-label="Enviar pergunta à Zoe" disabled={!question.trim()}>
          <ArrowUp size={16} />
        </IconAction>
      </form>
    </section>
  );
}
