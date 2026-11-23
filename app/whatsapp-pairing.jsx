"use client";

import { useEffect, useRef, useState } from "react";
import {
  Badge,
  Button,
  ButtonLink,
} from "@content-ventures/design-system/v3";
import { ResponsiveDialog } from "../src/ui/os/responsive-dialog";
import {
  ArrowUpRight,
  Check,
  CheckCheck,
  LayoutDashboard,
  LoaderCircle,
  MessageCircle,
} from "lucide-react";
import { inboxHref } from "../lib/inbox";
import { money } from "../lib/operation";
import { OutcomeCelebration } from "./outcome-celebration";
import { PairingCode } from "./pairing-code";
import st from "./whatsapp-pairing.module.css";

const steps = [
  "Parear o canal de exemplo",
  "Ler as conversas do período",
  "Preparar o diagnóstico da Zoe",
];

export function WhatsAppPairing({ company, line, onComplete, onClose }) {
  const [alias, setAlias] = useState(line?.name || "WhatsApp comercial");
  const [days, setDays] = useState(7);
  const [step, setStep] = useState(-1);
  const [result, setResult] = useState(null);
  const complete = useRef(onComplete);
  useEffect(() => {
    complete.current = onComplete;
  }, [onComplete]);
  useEffect(() => {
    if (step < 0 || result) return;
    const timer = window.setTimeout(
      () => {
        if (step < steps.length - 1) setStep(step + 1);
        else setResult(complete.current(days, alias));
      },
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 100 : 520,
    );
    return () => window.clearTimeout(timer);
  }, [step, days, result, alias]);

  return (
    <ResponsiveDialog
      open
      size="sm"
      onClose={onClose}
      title={
        result
          ? "Seu diagnóstico está pronto"
          : step >= 0
            ? "A Zoe está lendo o WhatsApp"
            : "Conectar WhatsApp"
      }
      description={
        result
          ? undefined
          : "Pareamento de demonstração com o histórico deste navegador."
      }
    >
      {result ? (
        <div className={st.receipt}>
          {result.first && (
            <OutcomeCelebration outcome="Primeiro diagnóstico do WhatsApp" />
          )}
          <span className={st.check}>
            <CheckCheck size={25} />
          </span>
          <strong>WhatsApp conectado</strong>
          <p>
            {company} · Últimos {result.run.days} dias
          </p>
          <dl className={st.metrics}>
            <div>
              <dt>Conversas lidas</dt>
              <dd>{result.run.conversationCount}</dd>
            </div>
            <div>
              <dt>Valor em risco</dt>
              <dd>{money(result.run.riskCents)}</dd>
            </div>
          </dl>
          <ButtonLink
            variant="primary"
            trailingIcon={ArrowUpRight}
            href={inboxHref(result.next?.thread.id, "whatsapp")}
            onClick={onClose}
          >
            {result.next
              ? "Abrir conversa de " + result.next.contact.name.split(" ")[0]
              : "Abrir conversas do WhatsApp"}
          </ButtonLink>
          <div className={st.receiptLinks}>
            <ButtonLink
              size="sm"
              variant="ghost"
              href={"#diagnosticos/" + result.run.id}
              icon={CheckCheck}
              onClick={onClose}
            >
              Ver diagnóstico
            </ButtonLink>
            <ButtonLink
              size="sm"
              variant="ghost"
              href="#dashboard"
              icon={LayoutDashboard}
              onClick={onClose}
            >
              Ir ao dashboard
            </ButtonLink>
          </div>
        </div>
      ) : step >= 0 ? (
        <ol
          className={st.steps}
          aria-label="Progresso da conexão"
          aria-live="polite"
        >
          {steps.map((name, i) => (
            <li
              key={name}
              data-state={i === step ? "active" : i < step ? "done" : "pending"}
              aria-current={i === step ? "step" : undefined}
            >
              <span>
                {i < step ? (
                  <Check size={15} />
                ) : i === step ? (
                  <LoaderCircle size={15} />
                ) : (
                  i + 1
                )}
              </span>
              {name}
            </li>
          ))}
        </ol>
      ) : (
        <div className={st.setup}>
          <div className={st.identity}>
            <span className={st.mark}>
              <MessageCircle size={21} />
            </span>
            <div>
              <strong>{line?.name || company}</strong>
              <small>WhatsApp comercial</small>
            </div>
            <Badge>Demo</Badge>
          </div>
          <label className="op-field">Nome da conexão<input required maxLength={60} value={alias} onChange={e=>setAlias(e.target.value)} /></label>
          <label className="op-field">
            Histórico para análise
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {[7, 15, 30, 60, 90].map((n) => (
                <option value={n} key={n}>
                  Últimos {n} dias
                </option>
              ))}
            </select>
          </label>
          {alias.trim() && <PairingCode line={line} days={days} onPaired={() => setStep(0)} />}
        </div>
      )}
    </ResponsiveDialog>
  );
}
