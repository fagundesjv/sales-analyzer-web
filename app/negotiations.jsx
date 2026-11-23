"use client";
import { useMemo, useState } from "react";
import {
  Button,
  ButtonLink,
  SearchField,
} from "@content-ventures/design-system/v3";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCheck,
  ChevronDown,
  Columns3,
  Eye,
  SlidersHorizontal,
  Star,
  UsersRound,
} from "lucide-react";
import {
  galleryRecords,
  dealStages,
  dealViews,
  galleryHref,
  inDealView,
  matchingDeals,
} from "../lib/deal-gallery";
import { channels, inboxHref } from "../lib/inbox";
import { readingOf } from "../lib/intake";
import { kinds, money } from "../lib/operation";
import { ProductVisual } from "./product-visual";
import s from "./negotiations.module.css";

function detailHref(row) {
  const thread = row.source?.thread || row.preferred?.thread;
  return "#conversa/" + row.contact.id + (thread ? "/" + thread.id : "");
}

function Status({ stage }) {
  return (
    <span className={s.status} data-stage={stage}>
      <i />
      {kinds[stage]}
    </span>
  );
}
function Amount({ row }) {
  return (
    <div className={s.amount} data-stage={row.stage}>
      <small>{row.stage === "won" ? "Valor confirmado" : "Valor citado"}</small>
      <strong>
        {row.cents != null
          ? money(row.cents)
          : row.stage === "won"
            ? "Sem registro"
            : "A apurar"}
      </strong>
    </div>
  );
}
function hint(row) {
  if (row.stage === "won")
    return row.win?.recovered ? "Venda recuperada" : "Venda confirmada";
  if (row.stage === "resolved") return "Atendimento resolvido";
  return row.decision?.reason || row.contact.title;
}
function DealCard({ row }) {
  const { contact } = row;
  return (
    <a
      className={s.card}
      href={detailHref(row)}
      aria-label={"Ver negociação de " + contact.name}
    >
      <div className={s.cover}>
        <ProductVisual contact={contact} />
        <Status stage={row.stage} />
      </div>
      <div className={s.cardBody}>
        <div className={s.name}>
          <h3>{contact.name}</h3>
          {row.favorite && (
            <span role="img" aria-label="Favorita" title="Favorita">
              <Star size={14} />
            </span>
          )}
          {row.reviewed && (
            <span role="img" aria-label="Revisada" title="Revisada">
              <CheckCheck size={15} />
            </span>
          )}
        </div>
        <p>{contact.product}</p>
        <div className={s.cardFooter}>
          <Amount row={row} />
          <span className={s.cardGo} aria-hidden="true">
            <ArrowUpRight size={16} />
          </span>
        </div>
      </div>
    </a>
  );
}
export function ClosedDealCards({ ops, items }) {
  const records = useMemo(() => galleryRecords(ops), [ops]);
  const ids = new Set(items.map((c) => c.id));
  return (
    <div className={s.cards}>
      {records
        .filter((r) => ids.has(r.contact.id))
        .map((row) => (
          <DealCard key={row.contact.id} row={row} />
        ))}
    </div>
  );
}

function Lead({ row, ops }) {
  const { contact } = row;
  const thread = row.source?.thread || row.preferred?.thread;
  const actionable = Number.isFinite(row.source?.rank) && thread;
  const reading = actionable ? readingOf(ops, contact, thread) : null;
  return (
    <article
      className={s.lead}
      aria-label={"Negociação em destaque de " + contact.name}
    >
      <div className={s.leadArt}>
        <ProductVisual contact={contact} />
        <Status stage={row.stage} />
        <span className={s.productCaption}>{contact.product}</span>
      </div>
      <div className={s.leadBody}>
        {actionable ? (
          <div className={s.byline}>
            <img src="/assets/idle_thumbnail.png" alt="" />
            Prioridade da Zoe
          </div>
        ) : (
          <div className={s.byline}>{hint(row)}</div>
        )}
        <h2>{contact.name}</h2>
        <p className={s.source}>
          {[contact.owner, channels[thread?.channel]]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {reading ? (
          <p className={s.next}>{reading.next}</p>
        ) : row.win?.at ? (
          <p className={s.next}>
            Ganho registrado em{" "}
            {new Date(row.win.at).toLocaleDateString("pt-BR")}.
          </p>
        ) : null}
        <Amount row={row} />
        <div className={s.actions}>
          <ButtonLink
            variant="primary"
            trailingIcon={ArrowUpRight}
            href={actionable ? inboxHref(thread.id) : detailHref(row)}
          >
            {actionable ? "Abrir conversa" : "Ver negociação"}
          </ButtonLink>
          {actionable && (
            <a className={s.textLink} href={detailHref(row)}>
              Ver negociação
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function StageChart({ rows, stage, view }) {
  const counts = Object.fromEntries(dealStages.map((g) => [g.key, 0]));
  for (const row of rows) counts[row.stage] = (counts[row.stage] || 0) + 1;
  const peak = Math.max(1, ...Object.values(counts));
  return (
    <section className={s.chart} aria-label="Filtrar por situação">
      <header>
        <h2>Situação da carteira</h2>
        <a
          href={galleryHref("all", view)}
          aria-current={stage === "all" ? "true" : undefined}
        >
          Todas <b>{rows.length}</b>
        </a>
      </header>
      <div className={s.plot}>
        {dealStages.map(({ key, label }) => (
          <a
            key={key}
            href={galleryHref(stage === key ? "all" : key, view)}
            data-stage={key}
            title={
              stage === key
                ? "Mostrar todas as situações"
                : "Filtrar por " + label.toLocaleLowerCase("pt-BR")
            }
            aria-current={stage === key ? "true" : undefined}
            aria-label={label + " · " + counts[key]}
          >
            <span className={s.barSpace}>
              <span
                className={s.bar}
                style={{ height: (counts[key] / peak) * 100 + "%" }}
                data-empty={!counts[key]}
              >
                <b>{counts[key]}</b>
              </span>
            </span>
            <small>{label}</small>
          </a>
        ))}
      </div>
    </section>
  );
}

export function Negotiations({
  ops,
  saved,
  route,
  search,
  setSearch,
  owner,
  setOwner,
}) {
  const segments = route.split("/").slice(1);
  const stage =
    dealStages.find((item) => segments.includes(item.key))?.key || "all";
  const view =
    dealViews.find((item) => item.key !== "all" && segments.includes(item.key))
      ?.key || "all";
  const records = useMemo(() => galleryRecords(ops, saved), [ops, saved]);
  const base = useMemo(
    () => matchingDeals(records, owner, search, view),
    [records, owner, search, view],
  );
  const scoped = base.filter((r) => inDealView(r, view));
  const visible = scoped.filter((r) => stage === "all" || r.stage === stage);
  const [lead, ...rest] = visible;
  const owners = [
    ...new Set(records.map((r) => r.contact.owner).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const clear = () => {
    setSearch("");
    setOwner("Todos");
    location.hash = galleryHref("all", "all");
  };
  return (
    <section className={s.workspace} aria-label="Carteira de negociações">
      <header className={s.heading}>
        <h1>Negociações</h1>
        <ButtonLink icon={Columns3} href="#crm">
          Abrir pipeline
        </ButtonLink>
      </header>
      <div className={s.tools}>
        <SearchField
          label="Buscar oportunidades"
          placeholder="Contato, produto ou mensagem"
          value={search}
          onValueChange={setSearch}
          enterKeyHint="search"
        />
        <label className={s.select}>
          <UsersRound />
          <select
            aria-label="Responsável"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
          >
            <option value="Todos">Toda a equipe</option>
            {owners.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
          <ChevronDown />
        </label>
        <label className={s.select}>
          <SlidersHorizontal />
          <select
            aria-label="Exibição de negociações"
            value={view}
            onChange={(e) => {
              location.hash = galleryHref(stage, e.target.value);
            }}
          >
            {dealViews.map(({ key, label }) => (
              <option key={key} value={key}>
                {label} (
                {
                  base.filter(
                    (r) =>
                      (stage === "all" || r.stage === stage) &&
                      inDealView(r, key),
                  ).length
                }
                )
              </option>
            ))}
          </select>
          <ChevronDown />
        </label>
      </div>
      <div className={s.overview}>
        <StageChart rows={scoped} stage={stage} view={view} />
        {lead ? (
          <Lead row={lead} ops={ops} />
        ) : (
          <div className={s.empty}>
            <Eye size={24} />
            <h2>Nenhuma negociação neste recorte</h2>
            <Button onClick={clear}>Limpar filtros</Button>
          </div>
        )}
      </div>
      {rest.length > 0 && (
        <RemainingDeals
          key={JSON.stringify([owner, search, stage, view])}
          rows={rest}
        />
      )}
    </section>
  );
}

function RemainingDeals({ rows }) {
  const [limit, setLimit] = useState(9);
  return (
    <section className={s.collection} aria-label="Outras negociações">
      <header>
        <h2>Outras negociações</h2>
        <span>{rows.length}</span>
      </header>
      <div className={s.cards}>
        {rows.slice(0, limit).map((row) => (
          <DealCard row={row} key={row.contact.id} />
        ))}
      </div>
      {rows.length > limit && (
        <Button
          variant="ghost"
          trailingIcon={ArrowRight}
          onClick={() => setLimit(limit + 9)}
        >
          Mostrar mais negociações
        </Button>
      )}
    </section>
  );
}
