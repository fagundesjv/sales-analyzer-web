"use client";

import { IconAction, IconLink } from "../src/ui/os/icon-action";
import { useEffect, useState } from "react";

import {
  Bell,
  Activity,
  Phone,
  BookOpen,
  Building2,
  CalendarCheck,
  ChartColumn,
  ClipboardList,
  FileText,
  Layers,
  MessageCircle,
  Moon,
  Settings2,
  Plug,
  Radar,
  Sparkles,
  Sun,
  Target,
  Wallet,
  Users,
} from "lucide-react";
import {
  OsShell,
  SheetPage,
  BarTitle,
  BarActions,
} from "../src/ui/os/shell/os-shell";
import {
  AccountButton,
  ColumnHead,
  ColumnNew,
  ColumnScroll,
} from "../src/ui/os/shell/column";

import { SearchField } from "@content-ventures/design-system/v3";
import { SettingsWorkspace, settingsSections } from "./settings-home";
import { foldText } from "../lib/conversation-queue";
import { SessionRows } from "../src/ui/os/session-rows";

import { Palette } from "../src/ui/os/palette";
import { portalEnabled } from "../lib/official-portal";
import { historyOf, primaryThread, threadsOf, channels, inboxHref } from "../lib/inbox";
import { contactsOf, destinations } from "../lib/operation";

const item = (id, label, icon) => ({ id, label, icon, href: "#" + id });
const sections = [
  item("dashboard", "Dashboard", ChartColumn),
  item("radar", "Radar", Radar),
  item("entrada", "Conversas", MessageCircle),
  item("tarefas", "Retornos", CalendarCheck),
];
const assistant = item("chat", "Chat da Zoe", Sparkles);
const settings = {...item("conexao", "Ajustes", Settings2), href:"#empresa"};
const families = {
  radar: [
    item("radar", "Prioridades", Radar),
    item("oportunidades", "Negociações", Layers),
    item("alertas", "Alertas", Bell),
  ],
  tarefas: [item("tarefas", "Agenda", CalendarCheck)],
  dashboard: [
    item("dashboard", "Panorama", ChartColumn),
    item("uso", "Uso", Activity),
    item("resultados", "Ganhos", ChartColumn),
    item("diagnosticos", "Diagnósticos", FileText),
  ],
  conexao: settingsSections,
};
const tools = [
  FileText,
  Bell,
  Target,
  CalendarCheck,
  Layers,
  ChartColumn,
  Plug,
  BookOpen,
  Users,
  Building2,
  Activity,
  Phone,
  Settings2,
  Wallet,
];
const operations = destinations.map(([id, label], index) =>
  item(id, label, tools[index]),
);
const go = (url) => {
  window.location.hash = url;
};

function Conversations({ threads, current }) {
  const [query, setQuery] = useState("");
  const needle = foldText(query);
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  const yesterday = new Date(day);
  yesterday.setDate(yesterday.getDate() - 1);
  const groups = ["Hoje", "Ontem", "Anteriores"].map((label) => ({
    id: label.toLowerCase(),
    label,
    rows: [],
  }));
  for (const [id, turns] of Object.entries(threads)
    .filter(([, turns]) => turns.length)
    .sort((a, b) => (b[1].at(-1).at || 0) - (a[1].at(-1).at || 0))) {
    if (
      needle &&
      !turns.some((t) => foldText([t.q, t.a].join(" ")).includes(needle))
    )
      continue;
    const at = turns.at(-1).at || 0;
    const group = at >= day.getTime() ? 0 : at >= yesterday.getTime() ? 1 : 2;
    groups[group].rows.push({
      id: "zoe/" + id,
      href: "#zoe/" + id,
      title: turns[0].q,
      meta: String(turns.length),
    });
  }
  return (
    <>
        {Object.keys(threads).length > 0 && (
          <div className="zoe-history-search">
            <SearchField
              label="Buscar histórico da Zoe"
              placeholder="Buscar no histórico…"
              value={query}
              onValueChange={setQuery}
            />
          </div>
        )}
        <SessionRows
          label="Perguntas anteriores"
          current={current}
          groups={groups}
          empty={
            needle
              ? "Nenhuma pergunta encontrada."
              : "Suas perguntas à Zoe aparecem aqui."
          }
        />
    </>
  );
}

export function SalesFrame({
  onReset,
  live,
  route,
  area,
  title,
  ops,
  threads,
  chatHistory,
  changeTheme,
  dark,
  ask,
  children,
}) {
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    const shortcut = (event) => {
      if (event.defaultPrevented || event.isComposing) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!document.querySelector("dialog[open]")) setSearching(true);
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  const signals = live ? [] : contactsOf(ops);
  const isChat = area === "chat";
  const path = route.split("/")[0];
  const [, contactId, threadId] = route.split("/");
  const sourceContact = path === "conversa" && signals.find(contact => contact.id === contactId);
  const originatingThread = path === "conversa"
    ? (live ? contactId : threadId || (sourceContact && primaryThread(sourceContact)))
    : path === "entrada" ? threadId : null;
  const zoeHref = originatingThread ? "#chat/origem/" + originatingThread : "#chat/" + path;
  const selected =
    path === "crm" || path === "conversa"
      ? "oportunidades"
      : path === "operacao"
        ? "radar"
        : path;
  const settingsUsage = path === "uso" && contactId === "ajustes";
  const family = path === "ajustes" || settingsUsage ? "conexao" : isChat
    ? "chat"
    : Object.keys(families).find((key) =>
        families[key].some((link) => link.id === selected),
      ) || area;
  const links = [
    ...new Map(
      [
        ...operations,
        ...sections,
        assistant,
        item("oportunidades", "Negociações", Layers),
      ].map((link) => [link.id, link]),
    ).values(),
  ];
  const found = searching ? [
    ...links.map((x) => ({
      id: x.id,
      scope: x.id === "entrada/rodada" ? "cases" : "screens",
      group: x.id === "entrada/rodada" ? "Conversas" : "Áreas",
      label: x.label,
      icon: x.icon,
      first: true,
      onSelect: () => go(x.id),
    })),
    ...(live ? [] : threadsOf(ops)).map((thread) => {
      const messages = historyOf(ops, thread);
      const contact = signals.find((s) => s.id === thread.contactId);
      return {
        id: thread.id,
        scope: "cases",
        group: "Atendimentos",
        label: contact?.name || thread.account,
        detail: [channels[thread.channel], thread.subject || messages.at(-1)?.text].filter(Boolean).join(" · "),
        keywords: [thread.account, ...messages.map((m) => m.text)].join(" "),
        icon: MessageCircle,
        onSelect: () => go(inboxHref(thread.id)),
      };
    }),
    ...signals.map((s) => ({
      id: s.id,
      scope: "cases",
      group: "Oportunidades",
      label: s.name,
      detail: s.title,
      keywords: s.product,
      icon: MessageCircle,
      first: true,
      onSelect: () => go("conversa/" + s.id),
    })),
    ...(live ? [] : ops.tasks).map((task) => ({
      id: "task-" + task.id,
      scope: "tasks",
      group: "Retornos",
      label: task.text,
      detail: task.owner + " · " + (task.done ? "Concluído" : "A fazer"),
      meta: task.due,
      icon: CalendarCheck,
      keywords: signals.find((s) => s.id === task.contact)?.name,
      onSelect: () => go("tarefas"),
      first: !task.done,
    })),
    ...Object.entries(threads)
      .filter(([, h]) => h.length)
      .map(([key, h]) => ({
        id: "thread-" + key,
        scope: "cases",
        group: "Histórico da Zoe",
        label: h.at(-1).q,
        icon: Sparkles,
        onSelect: () => go("zoe/" + key),
      })),
  ] : [];
  return (
    <>
      <OsShell
        product="Sales Analyzer"
        mark={
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <use href="/assets/sales-mark.svg#mark" />
          </svg>
        }
        home="#dashboard"
        areas={sections}
        phoneAreas={(!isChat && path !== "conversa"
          && (path !== "entrada" || (!threadId && contactId !== "rodada"))) ? [...sections, settings] : undefined}
        lower={[assistant, settings]}
        active={family}
        location={route}
        onSearch={() => setSearching(true)}
        onBack={() => window.history.back()}
        onForward={() => window.history.forward()}
        notice={live ? "V2 · Homologação" : portalEnabled && ["uso","whatsapps"].includes(path) ? "Portal da empresa" : "Dados de exemplo"}
        wide={isChat}
        columnLabel="Histórico da Zoe"
        column={
          isChat ? (
            <>
              <ColumnHead title="Histórico da Zoe" />
              <ColumnNew href="#chat" label="Nova pergunta" />
              <ColumnScroll>{chatHistory ?? <Conversations threads={threads} current={route} />}</ColumnScroll>
            </>
          ) : undefined
        }
        account={
          <AccountButton
            name={live ? live.session.user.name : ops.profile.name}
            sections={[
              {
                label: live?.session.workspace.name || "Conta",
                items: [
                  ...(live ? [{label:"Sair da V2", icon:Users, onSelect:live.logout}] : []),
                  {
                    label: "Dados da empresa",
                    icon: Building2,
                    onSelect: () => go("empresa"),
                  },
                ],
              },
              {
                label: "Aparência",
                items: [
                  {
                    label: dark ? "Usar tema claro" : "Usar tema escuro",
                    icon: dark ? Sun : Moon,
                    onSelect: changeTheme,
                  },
                ],
              },
            ]}
          />
        }
        back={
          route.startsWith("conversa/")
            ? route.split("/")[2]
              ? { label: "Conversa", href: inboxHref(route.split("/")[2]) }
              : { label: "Negociações", href: "#oportunidades" }
            : undefined
        }
      >
        {family !== "conexao" && <BarTitle><span className="sales-location">{title}</span></BarTitle>}
        <BarActions>
          <IconAction
            className="sales-theme-switch"
            type="button"
            role="switch"
            aria-label="Tema escuro"
            aria-checked={dark}
            title={dark ? "Usar tema claro" : "Usar tema escuro"}
            onClick={changeTheme}
          >
            <Sun size={13} />
            <Moon size={13} />
          </IconAction>
          {!isChat && (
            <IconLink
              className="sales-product-entry"
              href={zoeHref}
              aria-label="Perguntar à Zoe"
            >
              <Sparkles size={14} />
              <span>Perguntar à Zoe</span>
            </IconLink>
          )}
        </BarActions>
        <SheetPage
          key={family === "conexao" ? "ajustes" : area === "entrada" || path === "oportunidades" ? area : route}
          docked={isChat || area === "entrada"}
        >
          {family !== "conexao" && families[family]?.length > 1 && path !== "conversa" && (
            <nav
              className="sales-context-nav"
              aria-label={
                "Seções de " +
                ([...sections, settings].find((x) => x.id === family)?.label ||
                  title)
              }
            >
              {families[family].map((x) => (
                <a
                  key={x.id}
                  href={x.href}
                  aria-current={x.id === selected ? "page" : undefined}
                >
                  {x.label}
                </a>
              ))}
            </nav>
          )}
          {family === "conexao" && path !== "conversa" ? (
            <SettingsWorkspace onReset={onReset} current={path}>{children}</SettingsWorkspace>
          ) : children}
        </SheetPage>
      </OsShell>
      <Palette
        open={searching}
        onClose={() => setSearching(false)}
        label="Pedir ou buscar"
        placeholder="Buscar conversas, oportunidades e áreas…"
        scopes={[
          { id: "screens", label: "Áreas" },
          { id: "cases", label: "Conversas" },
          { id: "tasks", label: "Retornos" },
        ]}
        items={found}
        typed={live ? undefined : (text) => ({
          id: "ask",
          scope: "ask",
          group: "Zoe",
          label: text,
          detail: "Perguntar à Zoe",
          icon: Sparkles,
          onSelect: () => ask(text),
        })}
      />
    </>
  );
}
