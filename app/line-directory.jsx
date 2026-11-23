"use client";
import { useState } from "react";
import {
  DataTable,
  IconButton,
  Menu,
  SearchField,
} from "@content-ventures/design-system/v3";
import { Ellipsis, Pencil, QrCode, Unplug } from "lucide-react";
import { DirectoryPager, Status, useDirectoryPage } from "./directory";
import { formatLinePhone } from "./operation-fields";
import { foldText } from "../lib/conversation-queue";
import { Pills } from "../src/ui/os/pills";
import s from "./directory.module.css";

export function LineDirectory({
  lines,
  workload,
  onEdit,
  onPair,
  onEnd,
  local = false,
}) {
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [service, setService] = useState("all");
  const term = foldText(query.trim()),
    digits = /^[+\d\s()-]+$/.test(query) && query.replace(/\D/g, "");
  const statusOf = (line) =>
    line.connected ? "connected" : line.pending ? "pending" : "offline";
  const matches = lines
    .filter(
      (l) =>
        (!status || statusOf(l) === status) &&
        (service === "all" ||
          (l.active !== false) === (service === "active")) &&
        (foldText([l.name, l.phone, ...l.owners].join(" ")).includes(term) ||
          (digits && l.phone?.replace(/\D/g, "").includes(digits))),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
  const list = useDirectoryPage(matches);
  return (
    <section className={s.directory} aria-label="Diretório de WhatsApps">
      {local && (
        <Pills
          label="Filtrar linhas"
          size="sm"
          value={service}
          onChange={(v) => {
            setService(v);
            list.reset();
          }}
          items={[
            { value: "all", label: "Todas", count: lines.length },
            {
              value: "active",
              label: "Ativas",
              count: lines.filter((l) => l.active !== false).length,
            },
            {
              value: "paused",
              label: "Pausadas",
              count: lines.filter((l) => l.active === false).length,
            },
          ]}
        />
      )}
      <div className={s.tools}>
        <SearchField
          label="Buscar linha"
          placeholder="Nome, número ou responsável"
          enterKeyHint="search"
          value={query}
          onValueChange={(v) => {
            setQuery(v);
            list.reset();
          }}
        />
        <select
          aria-label="Estado da conexão"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            list.reset();
          }}
        >
          <option value="">Todas as conexões</option>
          <option value="connected">Conectadas</option>
          <option value="offline">Desconectadas</option>
          {local && <option value="pending">Aguardando QR</option>}
        </select>
      </div>
      <div className={s.directoryScroll} key={list.page} role="region" aria-label="Números de WhatsApp" tabIndex={0}>
      <DataTable
        stack={false}
        label="Linhas da empresa"
        density="compact"
        rows={list.rows}
        rowKey={(line) => line.id}
        empty="Nenhuma linha neste filtro."
        columns={[
          {
            key: "line",
            header: "Linha",
            pinned: true,
            render: (l) => (
              <div className={s.identity}>
                <span className={s.initial}>
                  <img
                    src="/assets/whatsapp.svg"
                    width="19"
                    height="19"
                    alt=""
                  />
                </span>
                <span>
                  <strong>{l.name}</strong>
                  <small className={s.sub}>
                    {formatLinePhone(l.phone || "") || "Número não informado"}
                    {l.active === false ? " · Pausada" : ""}
                  </small>
                  <small className={s.mobileMeta}>
                    {l.connected ? "Conectado" : l.pending ? "Aguardando QR" : "Desconectado"}
                    {l.owners.length ? " · " + l.owners.join(", ") : ""}
                    {workload && " · " + (workload.get(l.id) || 0) + " conversas"}
                  </small>
                </span>
              </div>
            ),
          },
          {
            key: "owners",
            header: "Responsável",
            render: (l) => l.owners.join(", ") || "Sem responsável",
          },
          ...(workload
            ? [
                {
                  key: "threads",
                  header: "Conversas",
                  numeric: true,
                  render: (l) => workload.get(l.id) || 0,
                },
              ]
            : []),
          {
            key: "status",
            header: "Conexão",
            render: (l) => (
              <Status tone={l.connected ? "good" : "warn"}>
                {l.connected
                  ? "Conectado"
                  : l.pending
                    ? "Aguardando QR"
                    : "Desconectado"}
              </Status>
            ),
          },
          ...(onEdit
            ? [
                {
                  key: "actions",
                  header: "",
                  name: "Ações",
                  render: (l) => {
                    const label = "Gerenciar " + l.name;
                    return (
                      <Menu
                        label={label}
                        align="end"
                        width={210}
                        trigger={(props) => (
                          <IconButton
                            {...props}
                            icon={Ellipsis}
                            label={label}
                            title={label}
                            variant="ghost"
                          />
                        )}
                        sections={[
                          {
                            items: [
                              {
                                label: local ? "Editar linha" : "Editar nome",
                                icon: Pencil,
                                onSelect: () => onEdit(l.id),
                              },
                              l.connected
                                ? {
                                    label: "Desconectar",
                                    icon: Unplug,
                                    onSelect: () => onEnd(l.id),
                                  }
                                : {
                                    label: l.pending
                                      ? "Ler QR Code"
                                      : "Reconectar",
                                    icon: QrCode,
                                    onSelect: () => onPair(l.id),
                                  },
                            ],
                          },
                        ]}
                      />
                    );
                  },
                },
              ]
            : []),
        ]}
      />
      </div>
      <DirectoryPager list={list} noun="linhas" />
    </section>
  );
}
