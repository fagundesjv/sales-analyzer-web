"use client";
import { useState } from "react";
import {
  Button,
  DataTable,
  SearchField,
} from "@content-ventures/design-system/v3";
import { UserPlus } from "lucide-react";
import { foldText } from "../lib/conversation-queue";
import { DirectoryPager, Status, useDirectoryPage } from "./directory";
import s from "./directory.module.css";

function MemberIdentity({member,tint,meta,onEdit}) {
  return <div className={s.identity}>
    <span className={s.initial} aria-hidden="true" data-tint={tint}>
      {member.name.trim().split(/\s+/).slice(0,2).map(word => word[0]).join("")}
    </span>
    <span>
      {onEdit ? <button className={s.name} onClick={onEdit}>{member.name}</button> :
        <strong className={s.memberName}>{member.name}</strong>}
      {member.email && <small className={s.sub}>{member.email}</small>}
      <small className={s.mobileMeta}>{meta}</small>
    </span>
  </div>;
}

export function ReadOnlyTeamDirectory({members}) {
  return <section className={s.directory} aria-label="Diretório da equipe">
    <p className={s.sub}>{members.length} {members.length === 1 ? "pessoa nesta página" : "pessoas nesta página"}</p>
    <div className={s.directoryScroll} role="region" aria-label="Integrantes da equipe" tabIndex={0}>
      <DataTable label="Equipe comercial" stack={false} density="compact" rows={members} rowKey={member => member.id}
        columns={[
          {key:"person",header:"Pessoa",pinned:true,render:member => <MemberIdentity member={member}
            tint={member.name.charCodeAt(0)%4} meta={member.assignedConnectionCount + (member.assignedConnectionCount === 1 ?
              " linha atribuída" : " linhas atribuídas")} />},
          {key:"role",header:"Papel",render:member => member.role === "manager" ? "Gestor" : "Vendedor"},
          {key:"lines",header:"Linhas atribuídas",numeric:true,render:member => member.assignedConnectionCount},
        ]}
      />
    </div>
  </section>;
}

export function TeamDirectory({ members, lines, onEdit }) {
  const [query, setQuery] = useState(""),
    [channel, setChannel] = useState(""),
    [state, setState] = useState("");
  const [sort, setSort] = useState({ key: "person", direction: "asc" });
  const groups = [
    ...new Set(members.map((m) => m.channel).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const owned = new Map();
  for (const line of lines)
    owned.set(line.owner, (owned.get(line.owner) || 0) + 1);
  const term = foldText(query.trim());
  const matches = members
    .map((member, index) => ({ member, index }))
    .filter(
      ({ member: m }) =>
        (!channel || m.channel === channel) &&
        (!state || (m.active !== false) === (state === "active")) &&
        foldText(
          [m.name, m.email, m.channel].filter(Boolean).join(" "),
        ).includes(term),
    )
    .sort(({ member: a }, { member: b }) => {
      const names = a.name.localeCompare(b.name, "pt-BR");
      const value =
        sort.key === "lines"
          ? (owned.get(a.name) || 0) - (owned.get(b.name) || 0)
          : sort.key === "channel"
            ? (a.channel || "").localeCompare(b.channel || "", "pt-BR")
            : names;
      return (sort.direction === "desc" ? -value : value) || names;
    });
  const list = useDirectoryPage(matches);
  return (
    <section className={s.directory} aria-label="Diretório da equipe">
      <div className={s.head}>
        <span className={s.sub}>
          {members.length} pessoas ·{" "}
          {members.filter((m) => m.active !== false).length} disponíveis para
          atribuição
        </span>
        <Button icon={UserPlus} variant="primary" onClick={() => onEdit(-1)}>
          Adicionar vendedor
        </Button>
      </div>
      <div className={s.tools}>
        <SearchField
          label="Buscar vendedor"
          placeholder="Nome, e-mail ou canal"
          value={query}
          enterKeyHint="search"
          onValueChange={(v) => {
            setQuery(v);
            list.reset();
          }}
        />
        <select
          aria-label="Canal da equipe"
          value={channel}
          onChange={(e) => {
            setChannel(e.target.value);
            list.reset();
          }}
        >
          <option value="">Todos os canais</option>
          {groups.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
        <select
          aria-label="Situação da equipe"
          value={state}
          onChange={(e) => {
            setState(e.target.value);
            list.reset();
          }}
        >
          <option value="">Todas as situações</option>
          <option value="active">Ativos</option>
          <option value="paused">Pausados</option>
        </select>
      </div>
      <div className={s.directoryScroll} key={list.page} role="region" aria-label="Integrantes da equipe" tabIndex={0}>
      <DataTable
        stack={false}
        label="Equipe comercial"
        density="compact"
        rows={list.rows}
        rowKey={({ member, index }) => String(member.id ?? index)}
        sort={sort}
        onSort={(next) => {
          setSort(next);
          list.reset();
        }}
        empty={
          members.length
            ? "Nenhum resultado para esta busca."
            : "A equipe ainda está vazia."
        }
        columns={[
          {
            key: "person",
            header: "Pessoa",
            pinned: true,
            sortable: true,
            render: ({ member: m, index }) => (
              <MemberIdentity member={m} tint={index % 4} onEdit={() => onEdit(index)}
                meta={(m.channel || "Sem canal") + " · " + (owned.get(m.name) || 0) + " linhas"} />
            ),
          },
          {
            key: "channel",
            header: "Canal atribuído",
            sortable: true,
            render: ({ member }) => member.channel || "Sem canal atribuído",
          },
          {
            key: "lines",
            header: "Linhas",
            numeric: true,
            sortable: true,
            render: ({ member }) => owned.get(member.name) || 0,
          },
          {
            key: "status",
            header: "Situação",
            render: ({ member }) => (
              <Status tone={member.active === false ? "neutral" : "good"}>
                {member.active === false ? "Pausado" : "Ativo"}
              </Status>
            ),
          },
        ]}
      />
      </div>
      <DirectoryPager list={list} noun="pessoas" />
    </section>
  );
}
