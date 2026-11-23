"use client";
import { ReaisField } from "./operation-fields";
import { IconAction } from "../src/ui/os/icon-action";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@content-ventures/design-system/v3";
import { ResponsiveDialog } from "../src/ui/os/responsive-dialog";
import {
  CalendarDays,
  CircleCheck,
  CircleDollarSign,
  ListFilter,
  Paperclip,
  Phone,
  Plus,
  SlidersHorizontal,
  Tag,
  User,
  X,
} from "lucide-react";
import { kinds } from "../lib/operation";
import {
  defaultFilters,
  matchesFilters,
  sliceNames,
  mediaNames,
} from "../lib/conversation-queue";
import css from "./customer-inbox.module.css";

export function ConversationFilters({
  initial,
  sort,
  channel,
  rows,
  all,
  onClose,
  onApply,
}) {
  const [draft, setDraft] = useState(initial);
  const [order, setOrder] = useState(sort);
  const fields = [
    {
      key: "owner",
      label: "Responsável",
      icon: User,
      any: "Toda a equipe",
      choices: [...new Set(all.map((r) => r.contact.owner))].map((n) => [n, n]),
    },
    {
      key: "slice",
      label: "Prioridade de atendimento",
      icon: ListFilter,
      any: "Qualquer prioridade",
      choices: Object.entries(sliceNames).filter(([key]) => key !== "stars"),
    },
    {
      key: "status",
      label: "Situação da oportunidade",
      icon: Tag,
      any: "Todas as situações",
      choices: Object.entries(kinds),
    },
    {
      key: "amount",
      label: "Valor em risco",
      icon: CircleDollarSign,
      any: "Qualquer valor",
      choices: [
        ["known", "Com valor conhecido"],
        ["absent", "Sem valor informado"],
        ["min", "Maior ou igual a"],
        ["max", "Menor ou igual a"],
      ],
    },
    {
      key: "work",
      label: "Status do atendimento",
      icon: CircleCheck,
      any: "Todos os atendimentos",
      choices: [
        ["open", "Em aberto"],
        ["closed", "Resolvidos"],
      ],
    },
    {
      key: "period",
      label: "Última mensagem",
      icon: CalendarDays,
      any: "Todo o período",
      choices: [
        ["24", "Últimas 24 horas"],
        ["48", "Últimas 48 horas"],
        ["168", "Últimos 7 dias"],
        ["720", "Últimos 30 dias"],
      ],
    },
    {
      key: "media",
      label: "Anexo recebido",
      icon: Paperclip,
      any: "Com ou sem anexo",
      choices: Object.entries(mediaNames),
    },
  ];
  if (channel === "todos" || channel === "whatsapp" || draft.line)
    fields.push({
      key: "line",
      label: "Linha de WhatsApp",
      icon: Phone,
      any: "Todas as linhas",
      choices: [...new Set(all.map((r) => r.line).filter(Boolean))].map((n) => [
        n,
        n,
      ]),
    });
  const [shown, setShown] = useState(() =>
    fields
      .filter((f) => ["owner", "slice"].includes(f.key) || initial[f.key])
      .map((f) => f.key),
  );
  const [choosing, setChoosing] = useState(false);
  const formId = useId();
  const form = useRef(null);
  const added = useRef(null);
  useEffect(() => {
    if (!added.current) return;
    form.current?.elements.namedItem(added.current)?.focus();
    added.current = null;
  }, [shown]);
  const hidden = fields.filter((f) => !shown.includes(f.key));
  const count = rows.filter((r) => matchesFilters(r, draft)).length;
  function update(key, value) {
    setDraft((before) => ({ ...before, [key]: value }));
  }
  return (
    <ResponsiveDialog
      open
      size="sm"
      title="Filtrar atendimentos"
      onClose={onClose}
      footer={
        <>
          {(fields.some((field) => draft[field.key]) || order !== "recent") && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDraft({
                  ...defaultFilters,
                  favoriteOnly: draft.favoriteOnly,
                });
                setOrder("recent");
                setShown(["owner", "slice"]);
                setChoosing(false);
              }}
            >
              Limpar critérios
            </Button>
          )}
          <Button variant="primary" type="submit" form={formId}>
            Aplicar filtros
          </Button>
        </>
      }
    >
      <form
        id={formId}
        ref={form}
        className="op-form"
        onSubmit={(e) => {
          e.preventDefault();
          onApply(
            {
              ...draft,
              amountValue: ["min", "max"].includes(draft.amount)
                ? draft.amountValue
                : "",
            },
            order,
          );
        }}
      >
        <div className={css.filterRules}>
          {shown.map((key) => {
            const field = fields.find((f) => f.key === key);
            if (!field) return null;
            const Icon = field.icon;
            return (
              <div className={css.filterRule} key={key}>
                <label>
                  <span>
                    <Icon size={14} />
                    {field.label}
                  </span>
                  <select
                    name={key}
                    aria-label={field.label}
                    value={draft[key]}
                    onChange={(e) => update(key, e.target.value)}
                  >
                    <option value="">{field.any}</option>
                    {field.choices.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <IconAction
                  type="button"
                  aria-label={"Remover regra " + field.label}
                  onClick={() => {
                    update(key, "");
                    setShown(shown.filter((k) => k !== key));
                  }}
                >
                  <X size={14} />
                </IconAction>
                {key === "amount" && ["min", "max"].includes(draft.amount) && (
                  <label className={css.moneyInput}>
                    <span>Limite em reais</span>
                    <ReaisField
                      required
                      allowZero
                      aria-label="Limite em reais"
                      value={draft.amountValue}
                      onValueChange={(value) => update("amountValue", value)}
                    />
                  </label>
                )}
              </div>
            );
          })}
        </div>
        {!!hidden.length && (
          <div className={css.addRules}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={Plus}
              aria-expanded={choosing}
              aria-controls={formId + "-choices"}
              onClick={() => setChoosing(!choosing)}
            >
              Adicionar filtro
            </Button>
            {choosing && (
              <div
                id={formId + "-choices"}
                role="group"
                aria-label="Critérios disponíveis"
              >
                {hidden.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      added.current = key;
                      setShown([...shown, key]);
                      setChoosing(false);
                    }}
                  >
                    <Icon size={15} aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <label className="op-field">
          Ordenação
          <select value={order} onChange={(e) => setOrder(e.target.value)}>
            <option value="recent">Mais recentes</option>
            <option value="oldest">Mais antigas</option>
            <option value="value">Maior valor citado</option>
          </select>
        </label>
        <div className={css.previewCount} role="status">
          <SlidersHorizontal size={14} />
          {count}{" "}
          {count === 1 ? "conversa encontrada" : "conversas encontradas"}
        </div>
      </form>
    </ResponsiveDialog>
  );
}
