"use client";
import { useEffect, useState } from "react";
import {
  Button,
  ChartCard,
  LineChart,
  MetricStrip,
} from "@content-ventures/design-system/v3";
import { DirectoryPager, useDirectoryPage } from "./directory";
import { foldText } from "../lib/conversation-queue";
import { SearchField } from "@content-ventures/design-system/v3";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Pills } from "../src/ui/os/pills";
import { portalEnabled, portalRequest } from "../lib/official-portal";
import { localUsageReport, portalUsageReport, usageDuration } from "../lib/usage-report";
import { money } from "../lib/operation";
import s from "./operations-board.module.css";

const measures = [
  { value: "usageMs", label: "Tempo de uso", color: "blue" },
  { value: "focusMs", label: "Foco da Zoe", color: "violet" },
  { value: "concluded", label: "Atendimentos", color: "teal" },
  { value: "wonCents", label: "Ganhos", color: "green" },
];
const total = (days, key) => days.reduce((v, row) => v + (row[key] || 0), 0);
function format(key, n) {
  if (key === "wonCents") return money(n);
  if (!key.endsWith("Ms")) return String(n);
  return usageDuration(n);
}
export function WorkspaceUsage({ ops, threads, identity }) {
  const [period, setPeriod] = useState("7"),
    [scope, setScope] = useState("company"),
    [selected, setSelected] = useState("");
  const [metric, setMetric] = useState("usageMs"),
    [report, setReport] = useState(null),
    [error, setError] = useState(""),
    [version, refresh] = useState(0);
  useEffect(() => {
    const update = () => refresh((v) => v + 1);
    if (!portalEnabled) {
      window.addEventListener("workspace-activity", update);
      window.addEventListener("storage", update);
    }
    return () => {
      window.removeEventListener("workspace-activity", update);
      window.removeEventListener("storage", update);
    };
  }, []);
  useEffect(() => {
    if (!portalEnabled) return;
    const control = new AbortController();
    setReport(null);
    setError("");
    async function load() {
      const options = { signal: control.signal, identity };
      if (identity?.viewer.kind === "seller") {
        if (!identity.usage) throw new Error("Uso pessoal indisponível neste acesso.");
        return {...portalUsageReport(identity.usage), self:true, period:identity.usage.days};
      }
      try {
        const data = await portalRequest(
          "/api/portal/usage?days=" + period,
          options,
        );
        return (
          portalUsageReport(data) || { name: "Empresa", days: [], people: [] }
        );
      } catch (error) {
        if (error.status !== 403 || control.signal.aborted) throw error;
        const portal = await portalRequest("/api/portal", options);
        if (!portal.usage) throw error;
        return {
          ...portalUsageReport(portal.usage),
          self: true,
          period: portal.usage.days,
        };
      }
    }
    load()
      .then((data) => {
        if (!control.signal.aborted) setReport(data);
      })
      .catch((e) => {
        if (!control.signal.aborted) setError(e.message);
      });
    return () => control.abort();
  }, [period, version, identity]);
  const data = portalEnabled
    ? report
    : localUsageReport(ops, threads, Number(period));
  const [query, setQuery] = useState("");
  const people = [...(data?.people || [])].sort((a,b) => total(b.days,"usageMs") - total(a.days,"usageMs") || a.name.localeCompare(b.name,"pt-BR")),
    person = people.find((p) => p.id === selected) || (data?.self ? people[0] : null);
  const directory = !data?.self && scope === "person" && !person;
  const individual = data?.self || (scope === "person" && !!person);
  const [detail, setDetail] = useState("trend");
  const days = (individual ? person?.days : data?.days) || [];
  const peoplePage = useDirectoryPage(people.filter(p => foldText(p.name).includes(foldText(query.trim()))));
  const dailyPage = useDirectoryPage([...days].reverse().filter(d => measures.some(m => d[m.value]) || d.sent || d.questions));
  const measure = measures.find((m) => m.value === metric);
  const selectPerson = (id) => {
    dailyPage.reset();
    setSelected(id);
    setDetail("trend");
    setScope("person");
  };
  return (
    <div className={s.usage}>
      {data?.self ? (
        <h2 className={s.subTitle}>Meu uso</h2>
      ) : (
        <div className={s.sectionHead}>
          <Pills
            label="Visão de uso"
            value={scope}
            onChange={v => { setScope(v); setSelected(""); setDetail("trend"); }}
            items={[
              { value: "company", label: "Empresa" },
              { value: "person", label: "Por usuário" },
            ]}
          />
          <Pills
            label="Período de uso"
            size="sm"
            value={period}
            onChange={v => { dailyPage.reset(); peoplePage.reset(); setPeriod(v); }}
            items={[7, 30, 90].map((n) => ({
              value: String(n),
              label: n + " dias",
            }))}
          />
        </div>
      )}
      {error ? (
        <div role="alert">
          {error}{" "}
          <Button onClick={() => refresh((v) => v + 1)}>
            Tentar novamente
          </Button>
        </div>
      ) : !data ? (
        <p role="status">Carregando o uso da empresa…</p>
      ) : (
        <>
          {individual && <div className={s.sectionHead}>
            {!data.self && <Button variant="ghost" icon={ArrowLeft} onClick={() => setSelected("")}>Lista de usuários</Button>}
            <Pills label="Detalhamento da atividade" items={[{value:"trend",label:"Evolução"}, {value:"daily",label:"Dia a dia"}]} value={detail} onChange={setDetail} />
          </div>}
          {!directory && (!individual || detail === "trend") && <>
          <MetricStrip
            label="Uso do espaço"
            items={measures.map((m) => ({
              label: m.label,
              value: format(m.value, total(days, m.value)),
            }))}
          />
          <ChartCard
            title={
              data.self
                ? "Minha atividade"
                : individual
                  ? "Atividade de " + (person?.name || "usuário")
                  : "Atividade da empresa"
            }
            titleAs="h2"
            description={
              data.name + " · últimos " + (data.period || period) + " dias"
            }
            actions={
              <select
                className="sales-select"
                aria-label="Indicador de uso"
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
              >
                {measures.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            }
          >
            <LineChart
              height={180}
              label={measure.label + " por dia"}
              series={[
                {
                  key: "value",
                  label:
                    measure.label +
                    (metric.endsWith("Ms")
                      ? " (min)"
                      : metric === "wonCents"
                        ? " (R$)"
                        : ""),
                  color: measure.color,
                },
              ]}
              data={days.map((d) => ({
                label: d.day.slice(8) + "/" + d.day.slice(5, 7),
                values: {
                  value:
                    (d[metric] || 0) /
                    (metric.endsWith("Ms")
                      ? 60000
                      : metric === "wonCents"
                        ? 100
                        : 1),
                },
              }))}
            />
          </ChartCard>
          </>}
          {directory && (
            <section>
              <h2 className={s.subTitle}>Uso por pessoa</h2>
              {people.length > 10 && <SearchField label="Buscar pessoa no uso" placeholder="Buscar por nome" value={query} onValueChange={v=>{setQuery(v);peoplePage.reset();}} />}
              <div className={s.people}>
                {peoplePage.rows.map((p) => (
                  <button key={p.id} onClick={() => selectPerson(p.id)}>
                    <span className={s.initial}>{p.name.slice(0, 1)}</span>
                    <strong>{p.name}</strong>
                    <span>{format("usageMs", total(p.days, "usageMs"))}</span>
                    <small>{total(p.days, "concluded")} atendimentos</small>
                    <ChevronRight size={14} />
                  </button>
                ))}
              </div>
              {!peoplePage.count && <p className={s.empty}>Nenhuma pessoa encontrada.</p>}
              <DirectoryPager list={peoplePage} noun="pessoas" />
            </section>
          )}
          {individual && detail === "daily" && (
            <section>
              <h2 className={s.subTitle}>Dia a dia · {person?.name || "Meu uso"}</h2>
              <div className={s.days}>
                {dailyPage.rows.map((d) => (
                    <div key={d.day}>
                      <strong>{d.day.split("-").reverse().join("/")}</strong>
                      <span>{format("usageMs", d.usageMs)} de uso</span>
                      <span>{d.concluded} atendimentos</span>
                      <span>{money(d.wonCents)}</span>
                    </div>
                  ))}
                {!days.some(
                  (d) =>
                    measures.some((m) => d[m.value]) || d.sent || d.questions,
                ) && (
                  <p className={s.empty}>
                    Este usuário ainda não registrou atividade neste período.
                  </p>
                )}
              </div>
              <DirectoryPager list={dailyPage} noun="dias" />
            </section>
          )}
          {!portalEnabled && !directory && (
            <small className={s.quiet}>
              Prévia local · {total(days, "sent")} respostas enviadas ·{" "}
              {total(days, "questions")} perguntas à Zoe
            </small>
          )}
        </>
      )}
    </div>
  );
}
