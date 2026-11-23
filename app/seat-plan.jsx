"use client";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Button, ButtonLink, LineChart, NumberField, SearchField } from "@content-ventures/design-system/v3";
import {
  ArrowRight,
  ArrowDownUp,
  ArrowUpRight,
  Check,
  ChevronRight,
  CalendarDays,
  Layers,
  MessageCircle,
  ScanText,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { ResponsiveDialog } from "../src/ui/os/responsive-dialog";
import { foldText } from "../lib/conversation-queue";
import { localUsageReport, sellerActivity, usageDuration } from "../lib/usage-report";
import { money } from "../lib/operation";
import {
  actionCredits,
  aiActions,
  applyCreditAction,
  creditCycle,
  cycleKey,
  digits,
  estimate,
  lowBalancePercent,
  seatBalance,
  seatKey,
  terms,
} from "../lib/seat-pricing";
import { DirectoryPager, useDirectoryPage } from "./directory";
import { SellerCount, maxSeats, validSeats } from "./seller-count";
import { SettingsViews } from "./settings-views";
import s from "./seat-plan.module.css";

const planViews = [
  ["", "Assinatura", Layers],
  ["vendedores", "Uso por vendedor", Users],
];
const initials = (name) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
const actionIcons = [MessageCircle, ScanText, Sparkles];
const inRange = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const shortDay = iso => iso.slice(8) + "/" + iso.slice(5, 7);

function Quantity({ id, label, value, onChange, min = 1 }) {
  return (
    <div className={s.quantity}>
      <label htmlFor={id}>{label}</label>
      <NumberField id={id} value={value} onChange={onChange} min={min} max={999} stepper fit />
    </div>
  );
}
function Amount({ label, children, emphasis = false }) {
  return (
    <div className={s.amount} data-emphasis={emphasis || undefined}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function PlanEstimate({ count, showPublicOffer = true }) {
  const [quantity, setQuantity] = useState(() => String(Math.max(1, Math.min(count, maxSeats))));
  const [packs, setPacks] = useState(0);
  const seats = Number(quantity);
  const valid = validSeats(quantity);
  const quote = valid ? estimate(seats) : null;
  const withExtras = valid && inRange(packs, 0, 999) ? estimate(seats, packs) : null;

  return (
    <section className={s.estimate} aria-labelledby="plan-estimate-title">
      <div className={s.selection}>
        <h2 id="plan-estimate-title">Simular contratação</h2>
        <div className={s.seatField}>
          <div>
            <label htmlFor="plan-sellers">Vendedores</label>
            <small>{money(terms.seatPrice)}/mês cada</small>
          </div>
          <SellerCount id="plan-sellers" quantity={quantity} onChange={setQuantity} hintId="plan-count-hint" />
        </div>
        {!valid && <p id="plan-count-hint" className={s.error} role="status">Informe um número inteiro de 1 a {maxSeats}.</p>}
        <div className={s.allowance}>
          <img src="/assets/idle_thumbnail.png" alt="" width="32" height="32" />
          <div>
            <p><strong>{digits(terms.included)} créditos/mês</strong> por vendedor</p>
            <small aria-live="polite">{valid ? digits(seats * terms.included) + " créditos de IA na equipe" : "Total da equipe a calcular"}</small>
          </div>
        </div>
      </div>
      <dl className={s.quoteTotals} aria-live="polite" aria-atomic="true">
        <div>
          <dt>Primeiro mês</dt>
          <dd>{quote ? money(quote.first) : "—"}</dd>
          <dd className={s.explanation}>Inclui {money(terms.setup)} de implementação única.</dd>
        </div>
        <div>
          <dt>A partir do 2º mês</dt>
          <dd>{quote ? money(quote.monthly) : "—"}{quote && <small> / mês</small>}</dd>
          <dd className={s.explanation}>{valid
            ? digits(seats) + (seats === 1 ? " vendedor" : " vendedores") + " × " + money(terms.seatPrice)
            : "Mensalidade da equipe"}</dd>
        </div>
      </dl>
      <div className={s.quoteFooter}>
        <details className={s.extras}>
          <summary><ChevronRight size={15} aria-hidden="true" />Simular recargas avulsas</summary>
          <div className={s.extraBody}>
            <Quantity id="sim-packs" label="Pacotes extras no primeiro mês" min={0} value={packs} onChange={setPacks} />
            <small>Cada pacote adiciona {digits(terms.packSize)} créditos a um vendedor por {money(terms.packPrice)}.</small>
            <dl className={s.detailLines} aria-live="polite" aria-atomic="true">
              <Amount label="Valor das recargas">{withExtras ? money(withExtras.extras) : "—"}</Amount>
              <Amount label="Primeiro mês com recargas" emphasis>{withExtras ? money(withExtras.first) : "—"}</Amount>
            </dl>
          </div>
        </details>
        {valid && showPublicOffer && <a className={s.publicOffer} href={"/lp/contratar/equipe/?vendedores=" + seats}>
          Ver oferta pública <ArrowUpRight size={14} aria-hidden="true" />
        </a>}
      </div>
    </section>
  );
}

function CreditRules() {
  return (
    <details className={s.rules}>
      <summary>
        <Sparkles size={17} aria-hidden="true" /> Como a Zoe consome créditos{" "}
        <ChevronRight size={16} aria-hidden="true" />
      </summary>
      <div className={s.ruleBody}>
        <ul>
          {aiActions.map((action, index) => {
            const Icon = actionIcons[index];
            return (
              <li key={action.id}>
                <Icon size={16} aria-hidden="true" />
                <span>
                  {action.label}
                  {action.blockSize && <small>Por bloco de até {action.blockSize} mensagens</small>}
                </span>
                <b>
                  {action.credits} {action.credits === 1 ? "crédito" : "créditos"}
                </b>
              </li>
            );
          })}
        </ul>
        <p>
          Cada vendedor tem saldo próprio. Ao esgotá-lo, as ações de IA aguardam a renovação ou uma recarga
          confirmada pela empresa. O atendimento manual continua disponível.
        </p>
        <p>
          A franquia renova no primeiro dia do mês. Créditos extras valem até o fim do ciclo da licença que
          recebeu a recarga.
        </p>
      </div>
    </details>
  );
}

function CreditMeter({ used, limit, label }) {
  const percent = limit ? Math.round((100 * used) / limit) : 0;
  return (
    <div
      className={s.track}
      role="meter"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={digits(used) + " de " + digits(limit) + " créditos"}
    >
      <span style={{ width: (limit ? (100 * used) / limit : 0) + "%" }} />
    </div>
  );
}

function CycleUsage({ seats, period, nextRenewal, showLink = false }) {
  const used = seats.reduce((n, seat) => n + seat.used, 0);
  const limit = seats.reduce((n, seat) => n + seat.limit, 0);
  const empty = seats.filter((seat) => seat.status === "empty").length;
  return (
    <section className={s.cycleUsage} aria-label="Consumo da equipe">
      <div className={s.blockHeading}>
        <h2>Consumo de IA</h2>
        <span className={s.period}>
          <CalendarDays size={14} />
          {period}
        </span>
      </div>
      <div className={s.usageLine}>
        <p>
          <strong>{digits(used)}</strong> de {digits(limit)} créditos usados
        </p>
        <span>{limit ? Math.round((100 * used) / limit) : 0}%</span>
      </div>
      <CreditMeter used={used} limit={limit} label="Consumo de IA da equipe" />
      <div className={s.usageFoot}>
        <span>Saldo individual por vendedor · Renova em {nextRenewal}</span>
        {showLink && (
          <a className={s.jump} href={"#plano/vendedores" + (empty ? "/limite" : "")}>
            {empty
              ? `Ver ${empty} ${empty === 1 ? "vendedor sem saldo" : "vendedores sem saldo"}`
              : "Ver uso por vendedor"}
            <ArrowRight size={14} aria-hidden="true" />
          </a>
        )}
      </div>
    </section>
  );
}

function PlanOverview({ seats, cycle, period, nextRenewal }) {
  const packs = Object.values(cycle.accounts).reduce((n, a) => n + a.packs, 0);
  const price = estimate(seats.length, packs);
  const renewals = seats.filter(seat => !seat.endAtRenewal).length;
  return (
    <>
      <PlanEstimate count={seats.length} />
      <div>
        <details className={s.rules}>
          <summary>
            <CalendarDays size={17} aria-hidden="true" />
            Resumo do ciclo atual
            <ChevronRight size={16} aria-hidden="true" />
          </summary>
          <div className={s.cycleDetails}>
            <section className={s.bill} aria-label="Resumo de cobrança">
              <h2>Cobrança da equipe</h2>
              <dl className={s.billLines}>
                <Amount label={seats.length + (seats.length === 1 ? " licença × " : " licenças × ") + money(terms.seatPrice)}>
                  {money(price.monthly)}
                </Amount>
                <Amount label="Recargas avulsas">{money(price.extras)}</Amount>
                <Amount label="Total previsto" emphasis>{money(price.ongoing)}</Amount>
              </dl>
              {seats.length !== renewals && <p className={s.note}>
                A partir de {nextRenewal}, {renewals} licenças · {money(estimate(renewals).monthly)}/mês.
              </p>}
            </section>
            <CycleUsage seats={seats} period={period} nextRenewal={nextRenewal} showLink />
          </div>
        </details>
        <CreditRules />
      </div>
    </>
  );
}

function SeatDirectory({ seats, initialFilter, onSelect, onAssign, onApply, period, nextRenewal }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(initialFilter);
  const [order, setOrder] = useState("balance");
  const [recharge, setRecharge] = useState(null);
  const directoryRef = useRef(null);
  const term = foldText(query.trim());
  const priority = {
    balance: seat => seat.used / seat.limit,
    credits: seat => seat.used,
    gain: seat => seat.activity.wonCents,
    time: seat => seat.activity.usageMs,
  };
  const rows = seats
    .filter(
      (seat) =>
        (!status || seat.status === status) &&
        foldText([seat.name, seat.channel].filter(Boolean).join(" ")).includes(term),
    )
    .sort((a, b) => priority[order](b) - priority[order](a) || a.name.localeCompare(b.name, "pt-BR"));
  const list = useDirectoryPage(rows, [10]);
  // A confirmed top-up can change the order or remove the seller from the active filter.
  // Keep the receipt beside the same seller until the operator closes it.
  const visibleRows = recharge ? recharge.keys.map(key => seats.find(seat => seat.key === key)).filter(Boolean) : list.rows;
  function closeRecharge() {
    const trigger = recharge?.trigger;
    setRecharge(null);
    requestAnimationFrame(() => {
      const target = trigger?.isConnected ? trigger : directoryRef.current?.querySelector("input");
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({block:"nearest"});
    });
  }
  const filters = [
    { value: "", label: "Todos", count: seats.length },
    { value: "empty", label: "Sem saldo", count: seats.filter((seat) => seat.status === "empty").length },
    { value: "low", label: "Perto do limite", count: seats.filter((seat) => seat.status === "low").length },
    { value: "ok", label: "Com folga", count: seats.filter((seat) => seat.status === "ok").length },
  ];
  function filterBy(value) {
    setRecharge(null);
    setStatus(value);
    list.reset();
  }
  return (
      <section className={s.directory} aria-label="Licenças da equipe" ref={directoryRef}>
        <div className={s.blockHeading}>
          <div>
            <h2>Vendedores</h2>
            <span className={s.period}>{period}</span>
          </div>
          <Button size="sm" variant="secondary" icon={UserPlus} onClick={() => { setRecharge(null); onAssign(); }}>
            Atribuir licença
          </Button>
        </div>
        <div className={s.directoryTools}>
          <div className={s.filters} role="group" aria-label="Filtrar por saldo">
            {filters.map((f) => (
              <button
                key={f.value}
                type="button"
                title={f.value === "low" ? "A partir de " + lowBalancePercent + "% dos créditos consumidos, com saldo restante" : undefined}
                aria-pressed={status === f.value}
                onClick={() => filterBy(f.value)}
              >
                {f.label}
                <span>{f.count}</span>
              </button>
            ))}
          </div>
          <SearchField
            label="Buscar vendedor"
            placeholder="Buscar"
            value={query}
            onValueChange={(value) => {
              setRecharge(null);
              setQuery(value);
              list.reset();
            }}
          />
          <select className={s.compactStatus + " sales-select"} aria-label="Filtrar por saldo" value={status}
            onChange={event => filterBy(event.target.value)}>
            {filters.map(f => <option key={f.value} value={f.value}>{f.label} ({f.count})</option>)}
          </select>
          <div className={s.orderPicker}>
          <ArrowDownUp size={17} aria-hidden="true" />
          <select className="sales-select" aria-label="Ordenar vendedores" value={order} title="Ordenar vendedores"
            onChange={event => { setRecharge(null); setOrder(event.target.value); list.reset(); }}>
            <option value="balance">Por urgência</option>
            <option value="gain">Maior ganho</option>
            <option value="time">Mais tempo de uso</option>
            <option value="credits">Mais créditos usados</option>
          </select>
          </div>
        </div>
        {status === "low" && <p className={s.filterNote}>Consumiram pelo menos {lowBalancePercent}% dos créditos e ainda têm saldo.</p>}
        {visibleRows.length ? (
          <div className={s.tableWrap}>
            <table className={s.table} aria-label="Créditos, atividade e ganhos por vendedor">
              <thead>
                <tr>
                  <th scope="col">Vendedor</th>
                  <th scope="col">Créditos usados</th>
                  <th scope="col">Saldo</th>
                  <th scope="col">Uso ativo</th>
                  <th scope="col">Ganhos confirmados</th>
                  <th scope="col">
                    <span className={s.srOnly}>Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((seat) => (
                  <Fragment key={seat.key}>
                  <tr data-status={seat.status}>
                    <td className={s.nameCell}>
                      <button
                        type="button"
                        className={s.person}
                        title={"Ver atividade e licença de " + seat.name}
                        aria-label={"Ver atividade e licença de " + seat.name}
                        onClick={(event) => { setRecharge(null); onSelect(seat.key, "details", event.currentTarget); }}
                      >
                        <span className={s.avatar} aria-hidden="true">
                          {initials(seat.name)}
                        </span>
                        <span className={s.personText}>
                          <span className={s.personName}>{seat.name} <ChevronRight size={12} aria-hidden="true" /></span>
                          <small>{seat.endAtRenewal ? "Encerra em " + nextRenewal : seat.channel}</small>
                        </span>
                      </button>
                    </td>
                    <td className={s.consumedCell}>
                      <small className={s.mobileLabel}>Créditos usados</small>
                      <span>
                        {digits(seat.used)}{" "}
                        <small>
                          / {digits(seat.limit)}
                        </small>
                      </span>
                      <CreditMeter used={seat.used} limit={seat.limit} label={"Uso de " + seat.name} />
                    </td>
                    <td className={s.balanceCell}>
                      <small className={s.mobileLabel}>Saldo</small>
                      <span className={s.status}>
                        <i aria-hidden="true" />
                        {digits(seat.available)} créditos
                      </span>
                      {seat.status !== "ok" && <small className={s.balanceHint}>{seat.available ? "Perto do limite" : "Sem saldo"}</small>}
                    </td>
                    <td className={s.activeCell}>
                      <small className={s.mobileLabel}>Uso ativo</small>
                      <strong>{usageDuration(seat.activity.usageMs)}</strong>
                      <small>{seat.activity.lastUse ? "Último uso " + shortDay(seat.activity.lastUse) : "Sem uso no ciclo"}</small>
                    </td>
                    <td className={s.gainCell} data-won={seat.activity.wonCents > 0 || undefined}>
                      <small className={s.mobileLabel}>Ganhos confirmados</small>
                      <strong>{money(seat.activity.wonCents)}</strong>
                      <small title="Ganhos confirmados divididos pelas horas de uso ativo neste ciclo">
                        {seat.activity.centsPerHour === null ? "Sem tempo registrado" : money(seat.activity.centsPerHour) + "/h de uso"}
                      </small>
                    </td>
                    <td className={s.rowAction}>
                      <Button
                        size="sm"
                        variant="secondary"
                        aria-label={"Recarregar créditos de " + seat.name}
                        aria-expanded={recharge?.key === seat.key}
                        aria-controls={recharge?.key === seat.key ? "seller-recharge" : undefined}
                        onClick={(event) => recharge?.key === seat.key
                          ? closeRecharge()
                          : setRecharge({key: seat.key, keys: visibleRows.map(row => row.key), trigger: event.currentTarget})}
                      >
                        Recarregar
                      </Button>
                    </td>
                  </tr>
                  {recharge?.key === seat.key && <tr className={s.rechargeRow}>
                    <td colSpan={6}><SeatDialog embedded seat={seat} initialView="pack" nextRenewal={nextRenewal}
                      onClose={closeRecharge} onApply={onApply} /></td>
                  </tr>}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={s.empty}>
            <Users size={21} aria-hidden="true" />
            <h3>{seats.length ? "Nenhum vendedor encontrado" : "Nenhuma licença ativa"}</h3>
            {seats.length ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setStatus("");
                  setQuery("");
                  list.reset();
                }}
              >
                Limpar filtros
              </Button>
            ) : (
              <p>Atribua a primeira licença a alguém da equipe.</p>
            )}
          </div>
        )}
        <DirectoryPager list={list} noun="licenças" onNavigate={() => setRecharge(null)} />
      </section>
  );
}

function AssignSeat({ candidates, count, onAssign, onClose }) {
  const [key, setKey] = useState("");
  const [assigned, setAssigned] = useState("");
  const member = candidates.find((m) => m.key === key);
  return (
    <ResponsiveDialog
      open
      title="Atribuir licença"
      description="Selecione quem vai receber os créditos mensais. Esta é uma simulação."
      onClose={onClose}
      footer={
        assigned || !candidates.length ? (
          <Button onClick={onClose}>Concluir</Button>
        ) : (
          <Button
            variant="primary"
            disabled={!member}
            onClick={() => {
              if (onAssign(key)) setAssigned(member.name);
            }}
          >
            Confirmar licença
          </Button>
        )
      }
    >
      <div className={s.dialogBody}>
        {assigned ? (
          <p role="status" className={s.success}>
            <Check size={17} />
            Licença atribuída a {assigned}.
          </p>
        ) : !candidates.length ? (
          <>
            <p>Toda a equipe já tem licença. Cadastre outro vendedor para simular a expansão.</p>
            <ButtonLink href="#equipe">Abrir equipe</ButtonLink>
          </>
        ) : (
          <>
            <label className="op-field">
              <span>Vendedor sem licença</span>
              <select value={key} onChange={(e) => setKey(e.target.value)}>
                <option value="">Selecionar vendedor</option>
                {candidates.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.name}
                    {m.active === false ? " · atendimento pausado" : ""}
                  </option>
                ))}
              </select>
            </label>
            <dl className={s.receipt}>
              <Amount label="Créditos da licença">{digits(terms.included)} / mês</Amount>
              <Amount label="Acréscimo mensal">{money(terms.seatPrice)}</Amount>
              <Amount label="Nova mensalidade" emphasis>
                {money(estimate(count + 1).monthly)}
              </Amount>
            </dl>
            <p>
              A estimativa considera um mês completo. A licença vale até o fim do ciclo, inclusive se o
              vendedor pausar o atendimento.
            </p>
          </>
        )}
      </div>
    </ResponsiveDialog>
  );
}

function SellerPerformance({ seat, ops, threads, period }) {
  const [windowDays, setWindowDays] = useState("cycle");
  const activity = useMemo(() => {
    if (windowDays === "cycle") return seat.activity;
    if (ops.official) {
      const person = ops.officialUsage.find(person => person.id === seat.userId);
      return sellerActivity((person?.days ?? []).slice(-Number(windowDays)));
    }
    const report = localUsageReport(ops, threads, Number(windowDays));
    const person = report.people.find(row => row.name === seat.name);
    return sellerActivity(person?.days ?? []);
  }, [windowDays, seat.activity, seat.name, seat.userId, ops, threads]);
  const list = useDirectoryPage([...activity.days].reverse(), [7]);
  return (
    <section className={s.performance} aria-label="Uso e ganhos">
      <header><h3>Uso e ganhos</h3>
        <select className="sales-select" aria-label="Período da atividade" value={windowDays}
          onChange={event => {setWindowDays(event.target.value); list.reset();}}>
          <option value="cycle">Ciclo atual · {period}</option>
          {[7,15,30,60,90].map(n => <option key={n} value={n}>Últimos {n} dias</option>)}
        </select>
      </header>
      <dl className={s.performanceStats}>
        <div><dt>Tempo ativo</dt><dd>{usageDuration(activity.usageMs)}</dd></div>
        <div><dt>Foco da Zoe</dt><dd>{usageDuration(activity.focusMs)}</dd></div>
        <div><dt>Ganhos confirmados</dt><dd>{money(activity.wonCents)}
          <small>{activity.centsPerHour === null ? "Sem tempo registrado" : money(activity.centsPerHour) + " por hora de uso"}</small></dd></div>
        {ops.official ? <div><dt>Atendimentos concluídos</dt><dd>{activity.concluded}</dd></div> : <div><dt>Desfechos com ganho</dt><dd>{activity.winRate === null ? "—" : activity.winRate + "%"}
          <small>{activity.concluded ? activity.wins + " de " + activity.concluded : "Sem desfechos"}</small></dd></div>}
      </dl>
      {activity.activeDays > 0 && <div className={s.trend}>
        <div className={s.chartLegend}><span>Uso ativo</span><span>Foco da Zoe</span><small>minutos por dia</small></div>
        <LineChart height={110} curve="linear" label="Uso ativo e Foco da Zoe por dia, em minutos"
        series={[{key:"usage", label:"Uso ativo (min)", color:"blue"}, {key:"focus", label:"Foco (min)", color:"violet"}]}
        data={activity.days.map(day => ({label:shortDay(day.day), values:{usage:day.usageMs / 60000, focus:day.focusMs / 60000}}))} /></div>}
      <details className={s.rules}>
        <summary>Histórico por dia<ChevronRight size={15} aria-hidden="true" /></summary>
        <table className={s.daily} aria-label="Atividade diária do vendedor">
          <thead><tr><th scope="col">Dia</th><th scope="col">Uso ativo</th><th scope="col">Foco</th>
            <th scope="col" title="Atendimentos concluídos">Concluídos</th><th scope="col">Ganhos</th></tr></thead>
          <tbody>{list.rows.map(d => <tr key={d.day}>
            <th scope="row"><time dateTime={d.day}>{shortDay(d.day)}</time></th>
            <td>{usageDuration(d.usageMs)}</td><td>{usageDuration(d.focusMs)}</td>
            <td>{digits(d.concluded)}</td><td>{money(d.wonCents)}</td>
          </tr>)}</tbody>
        </table>
        <DirectoryPager list={list} noun="dias" />
      </details>
    </section>
  );
}

function InlineRecharge({ title, footer, children }) {
  const heading = useRef(null);
  useEffect(() => {
    heading.current?.focus({preventScroll:true});
    heading.current?.scrollIntoView({block:"start"});
  }, [title]);
  return <section className={s.inlineRecharge} id="seller-recharge" aria-labelledby="recharge-title">
    <h3 id="recharge-title" ref={heading} tabIndex={-1}>{title}</h3>
    {children}
    <footer>{footer}</footer>
  </section>;
}

function SeatDialog({ seat, ops, threads, period, initialView, nextRenewal, onClose, onApply, onRenewal, embedded = false }) {
  const [view, setView] = useState(initialView);
  const [action, setAction] = useState(aiActions[0].id);
  const [qty, setQty] = useState(1);
  const [receipt, setReceipt] = useState(null);
  const buying = view === "pack";
  const valid = inRange(qty, 1, 999);
  const units = valid ? (buying ? terms.packSize * qty : actionCredits(action, qty)) : 0;
  const price = terms.packPrice * qty;
  const insufficient = !buying && valid && units > seat.available;
  const selectedAction = aiActions.find((item) => item.id === action);
  const closing = !seat.endAtRenewal;
  function selectView(value) {
    setView(value);
    setQty(1);
  }
  function confirm() {
    if (view === "renewal") {
      if (onRenewal(seat.key, closing))
        setReceipt({
          title: closing ? "Encerramento agendado" : "Renovação mantida",
          detail: closing
            ? "A licença de " + seat.name + " continua disponível até " + nextRenewal + "."
            : "A licença de " + seat.name + " será renovada em " + nextRenewal + ".",
        });
      return;
    }
    if (!valid || insufficient || !onApply(seat.key, buying ? "pack" : action, qty)) return;
    setReceipt(
      buying
        ? {
            title: "Créditos adicionados",
            detail:
              digits(units) + " créditos para " + seat.name + " por " + money(price) + " nesta simulação.",
          }
        : {
            title: "Consumo registrado",
            detail: digits(units) + " créditos utilizados por " + seat.name + " nesta simulação.",
          },
    );
  }
  const titles = {
    details: seat.name,
    pack: "Recarregar créditos",
    usage: "Simular consumo de IA",
    renewal: closing ? "Encerrar licença?" : "Manter licença?",
  };
  const Panel = embedded ? InlineRecharge : ResponsiveDialog;
  return (
    <Panel
      open
      title={receipt?.title || (embedded ? "Recarga para " + seat.name : titles[view])}
      onClose={onClose}
      footer={
        receipt ? (
          <Button variant="primary" onClick={onClose}>
            Concluir
          </Button>
        ) : view === "details" ? (
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        ) : (
          <div className={s.dialogActions}>
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              disabled={view !== "renewal" && (!valid || insufficient)}
              onClick={confirm}
            >
              {buying
                ? valid
                  ? "Recarregar por " + money(price)
                  : "Confirmar recarga"
                : view === "usage"
                  ? "Simular consumo"
                  : closing
                    ? "Confirmar encerramento"
                    : "Confirmar renovação"}
            </Button>
          </div>
        )
      }
    >
      <div className={s.dialogBody}>
        {receipt ? (
          <>
            <p role="status" className={s.success}>
              <Check size={17} />
              {receipt.detail}
            </p>
            {view !== "renewal" && (
              <dl className={s.receipt}>
                <Amount label="Saldo de créditos" emphasis>
                  {digits(seat.available)}
                </Amount>
              </dl>
            )}
          </>
        ) : view === "details" ? (
          <>
            <SellerPerformance {...{seat, ops, threads, period}} />
            <div className={s.seatBalance}>
              <span>Créditos disponíveis</span>
              <strong>{digits(seat.available)}</strong>
              <CreditMeter used={seat.used} limit={seat.limit} label={"Uso de " + seat.name} />
            </div>
            <dl className={s.detailLines}>
              <Amount label="Franquia mensal">{digits(terms.included)} créditos</Amount>
              <Amount label="Créditos extras">{digits(seat.packs * terms.packSize)}</Amount>
              <Amount label="Utilizados">{digits(seat.used)}</Amount>
              <Amount label={seat.endAtRenewal ? "Encerra em" : "Renova em"}>{nextRenewal}</Amount>
            </dl>
            <div className={s.detailActions}>
              <Button variant="secondary" onClick={() => selectView("usage")}>
                Simular consumo de IA
              </Button>
              <button className={s.textAction} onClick={() => selectView("renewal")}>
                {closing ? "Encerrar licença" : "Manter licença"}
              </button>
            </div>
          </>
        ) : view === "renewal" ? (
          <>
            <p>
              {closing
                ? seat.name +
                  " mantém o acesso até " +
                  nextRenewal +
                  ". A partir dessa data, a licença sai da mensalidade da equipe."
                : "A licença de " + seat.name + " continuará ativa no próximo ciclo."}
            </p>
            <dl className={s.receipt}>
              <Amount label="Alteração neste ciclo">{money(0)}</Amount>
              <Amount label="Próximo ciclo" emphasis>
                {(closing ? "− " : "+ ") + money(terms.seatPrice)} / mês
              </Amount>
            </dl>
          </>
        ) : (
          <>
            {!embedded && <div className={s.recipient}>
              <span className={s.avatar} aria-hidden="true">
                {initials(seat.name)}
              </span>
              <div>
                <strong>{seat.name}</strong>
                <small>Saldo atual de {digits(seat.available)} créditos</small>
              </div>
            </div>}
            {buying ? (
              <div className={s.pack}>
                <div>
                  <strong>Pacote de {digits(terms.packSize)} créditos</strong>
                  <small>{money(terms.packPrice)} por pacote · compra avulsa</small>
                </div>
                <Quantity id="seat-quantity" label="Quantidade de pacotes" value={qty} onChange={setQty} />
              </div>
            ) : (
              <>
                <label className="op-field">
                  <span>Ação da Zoe</span>
                  <select
                    value={action}
                    onChange={(e) => {
                      setAction(e.target.value);
                      setQty(1);
                    }}
                  >
                    {aiActions.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </label>
                <Quantity id="seat-quantity" label={selectedAction.input} value={qty} onChange={setQty} />
                <small>
                  {selectedAction.credits} {selectedAction.credits === 1 ? "crédito" : "créditos"}{" "}
                  {selectedAction.blockSize
                    ? "por bloco de até " + selectedAction.blockSize + " mensagens."
                    : "por ação."}
                </small>
              </>
            )}
            <dl className={s.receipt} aria-live="polite">
              {embedded && <Amount label="Saldo atual">{digits(seat.available)}</Amount>}
              <Amount label={buying ? "Créditos a adicionar" : "Créditos necessários"}>
                {valid ? digits(units) : "—"}
              </Amount>
              <Amount label={buying ? "Saldo após a recarga" : "Saldo após a simulação"}>
                {valid && !insufficient ? digits(seat.available + (buying ? units : -units)) : "—"}
              </Amount>
              {buying && !embedded && (
                <Amount label="Total da recarga" emphasis>
                  {valid ? money(price) : "—"}
                </Amount>
              )}
            </dl>
            {insufficient && (
              <div className={s.warning} role="status">
                <p>Saldo insuficiente para esta ação.</p>
                <button className={s.textAction} onClick={() => selectView("pack")}>
                  Recarregar créditos <ArrowRight size={14} />
                </button>
              </div>
            )}
            {buying && <small>Válidos até {nextRenewal}. Esta simulação não gera cobrança.</small>}
          </>
        )}
      </div>
    </Panel>
  );
}

export function SeatPlan({ ops, threads, change, route }) {
  const [now, setNow] = useState(() => new Date());
  const [assigning, setAssigning] = useState(false);
  const [selected, setSelected] = useState(null);
  const pageRef = useRef(null);
  const triggerRef = useRef(null);
  const month = cycleKey(now);
  const [, view, filter] = route.split("/");
  const showRoster = view === "vendedores";
  const daysInCycle = now.getDate();
  const activity = useMemo(() => {
    if (!showRoster) return null;
    if (ops.official) return new Map(ops.officialUsage.map(person => [
      person.id, sellerActivity(person.days.filter(day => day.day.startsWith(month)))
    ]));
    const report = localUsageReport(ops, threads, daysInCycle);
    return new Map(report.people.map(person => [person.name, sellerActivity(person.days)]));
  }, [showRoster, ops, threads, daysInCycle, month]);
  const cycle = creditCycle(ops, month);
  const nextRenewal = new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
  });
  const team = ops.members.map((member, index) => ({ ...member, key: seatKey(member, index) }));
  const seats = team
    .filter((m) => Object.hasOwn(cycle.accounts, m.key))
    .map((m) => ({
      ...m,
      ...seatBalance(cycle.accounts[m.key]),
      activity: ops.official ? activity?.get(m.userId) ?? sellerActivity([]) : activity?.get(m.name),
      endAtRenewal: !!cycle.accounts[m.key].endAtRenewal,
    }));
  const seat = seats.find((row) => row.key === selected?.key);
  const period = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = setTimeout(refresh, Math.max(0, nextDay - Date.now()));
    window.addEventListener("focus", refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [now]);
  useEffect(() => {
    if (ops.pricingPreview?.month !== month)
      change((before) => ({ pricingPreview: creditCycle(before, month) }));
  }, [month, ops.pricingPreview, change]);
  function updateLicense(key, transform) {
    const currentMonth = cycleKey(new Date());
    if (currentMonth !== month) {
      setNow(new Date());
      return false;
    }
    let updated = false;
    change((before) => {
      const exists = before.members.some((m, i) => seatKey(m, i) === key);
      const next = exists && transform(creditCycle(before, month));
      if (!next) return {};
      updated = true;
      return { pricingPreview: next };
    });
    return updated;
  }
  return (
    <div className={s.page} ref={pageRef}>
      <SettingsViews label="Áreas do plano" base="plano" current={view} views={planViews} />
      {showRoster ? (
        <SeatDirectory
          key={filter || ""}
          seats={seats}
          initialFilter={filter === "limite" ? "empty" : ""}
          period={period}
          nextRenewal={nextRenewal}
          onSelect={(key, view, trigger) => {
            triggerRef.current = trigger;
            setSelected({ key, view });
          }}
          onAssign={() => setAssigning(true)}
          onApply={(key, kind, qty) => updateLicense(key, current => applyCreditAction(current, key, kind, qty))}
        />
      ) : (
        <PlanOverview
          seats={seats}
          cycle={cycle}
          period={period}
          nextRenewal={nextRenewal}
        />
      )}
      {showRoster && assigning && (
        <AssignSeat
          candidates={team.filter((m) => !Object.hasOwn(cycle.accounts, m.key))}
          count={seats.length}
          onClose={() => setAssigning(false)}
          onAssign={(key) =>
            updateLicense(key, (current) =>
              Object.hasOwn(current.accounts, key)
                ? null
                : {
                    ...current,
                    accounts: { ...current.accounts, [key]: { used: 0, packs: 0 } },
                  },
            )
          }
        />
      )}
      {showRoster && seat && (
        <SeatDialog
          key={month + seat.key}
          seat={seat}
          initialView={selected.view}
          ops={ops}
          threads={threads}
          period={period}
          nextRenewal={nextRenewal}
          onClose={() => {
            setSelected(null);
            requestAnimationFrame(() => {
              const target = triggerRef.current?.isConnected
                ? triggerRef.current
                : pageRef.current?.querySelector("input");
              target?.focus({ preventScroll: true });
            });
          }}
          onApply={(key, kind, qty) =>
            updateLicense(key, (current) => applyCreditAction(current, key, kind, qty))
          }
          onRenewal={(key, endAtRenewal) =>
            updateLicense(key, (current) =>
              !Object.hasOwn(current.accounts, key)
                ? null
                : {
                    ...current,
                    accounts: { ...current.accounts, [key]: { ...current.accounts[key], endAtRenewal } },
                  },
            )
          }
        />
      )}
    </div>
  );
}
