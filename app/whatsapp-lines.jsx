"use client";
import { FirstWhatsApp } from "./pairing-code";
import { PortalLines } from "./portal-lines";
import { portalEnabled } from "../lib/official-portal";
import board from "./operations-board.module.css";
import { ConfirmDialog } from "@content-ventures/design-system/v3";
import { SettingsViews } from "./settings-views";
import { QrCode, Smartphone, ChartColumn } from "lucide-react";
import {
  LinePhoneField,
  formatLinePhone,
  linePhoneKey,
} from "./operation-fields";
import { threadsOf, inboxHref } from "../lib/inbox";
import { LineDirectory } from "./line-directory";
import { activeMembers } from "../lib/operation";
import { useState } from "react";
import {
  ButtonLink,
  ChartCard,
  MeterList,
  Button,
} from "@content-ventures/design-system/v3";
import { ResponsiveDialog } from "../src/ui/os/responsive-dialog";

export function WhatsAppLines({
  route,
  ops,
  change,
  onConnect,
  onDisconnect,
}) {
  const lines = ops.lines || [];
  const conversations = threadsOf(ops).filter(t => t.channel === "whatsapp");
  const primary = lines.find(l => l.primaryLine);
  const workload = new Map();
  for (const thread of conversations) {
    const key = thread.lineId || primary?.id || thread.account || "Linha sem identificação";
    workload.set(key, (workload.get(key) || 0) + 1);
  }
  const byId = new Map(lines.map(l => [l.id,l]));
  const [ending, setEnding] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  function open(line) {
    setError("");
    setForm(
      line || {
        id: "",
        name: "",
        phone: "",
        owner: activeMembers(ops)[0]?.name || "",
        active: true,
      },
    );
  }
  if (portalEnabled) return <PortalLines />;
  return (
    <div className="settings-task">
      <SettingsViews label="Áreas de WhatsApps" base="whatsapps" current={route.split("/")[1]}
        views={[[ "", "Linhas", Smartphone ], ["distribuicao", "Distribuição", ChartColumn]]} />
      {route.split("/")[1] !== "distribuicao" ? <section className={board.linesBoard}>
        {lines.length > 0 ? <div className={board.sectionHead}>
          <div>
            <p>
              {lines.filter((l) => l.paired).length} conectadas · {lines.length}{" "}
              cadastradas
            </p>
          </div>
          <div className="actions">
            <Button variant="primary" icon={QrCode} onClick={() => onConnect()}>
              Conectar WhatsApp
            </Button>
            <Button variant="ghost" title="Cadastrar número e responsável antes de conectar" onClick={() => open()}>
              Adicionar linha
            </Button>
          </div>
        </div> : (
          <FirstWhatsApp onConnect={() => onConnect()}>
            <Button variant="ghost" onClick={() => open()}>Adicionar linha</Button>
          </FirstWhatsApp>
        )}
        {!!lines.length && <LineDirectory local workload={workload}
          lines={lines.map(l=>({...l, connected:!!l.paired, pending:!l.paired && !l.pairedAt, owners:l.owner ? [l.owner] : []}))}
          onEdit={id => open(byId.get(id))} onPair={id => onConnect(byId.get(id))} onEnd={id => setEnding(byId.get(id))} />}
        {ending && (
          <ConfirmDialog
            open
            tone="danger"
            title={"Desconectar " + ending.name + "?"}
            description="Será preciso escanear outro QR para retomar esta conexão."
            confirmLabel="Desconectar linha"
            onClose={() => setEnding(null)}
            onConfirm={() => {
              onDisconnect(ending);
              setEnding(null);
            }}
          />
        )}
        {form && (
          <ResponsiveDialog
            footer={
              <Button form="linha-whatsapp" type="submit" variant="primary">
                {" "}
                Salvar linha{" "}
              </Button>
            }
            open
            title={form.id ? "Editar linha" : "Adicionar linha de WhatsApp"}
            onClose={() => setForm(null)}
          >
            <form
              id="linha-whatsapp"
              className="op-form"
              onSubmit={(e) => {
                e.preventDefault();
                const original = lines.find((line) => line.id === form.id);
                const phone =
                  linePhoneKey(form.phone) ||
                  (original &&
                  formatLinePhone(original.phone) ===
                    formatLinePhone(form.phone)
                    ? original.phone
                    : "");
                if (!form.owner) {
                  setError("Cadastre um responsável ativo em Equipe.");
                  return;
                }
                if (!form.name.trim() || !phone) {
                  setError("Confira o nome e o número com DDD.");
                  return;
                }
                if (
                  lines.some(
                    (l) =>
                      l.id !== form.id &&
                      (linePhoneKey(l.phone) || l.phone) === phone,
                  )
                ) {
                  setError("Este número já tem uma linha cadastrada.");
                  return;
                }
                const line = {
                  ...form,
                  name: form.name.trim(),
                  phone,
                  id: form.id || crypto.randomUUID(),
                };
                change(
                  {
                    lines: form.id
                      ? lines.map((l) => (l.id === line.id ? line : l))
                      : [...lines, line],
                  },
                  {
                    kind: "Linha de atendimento atualizada",
                    detail: line.name,
                  },
                );
                setForm(null);
              }}
            >
              <label className="op-field">
                Nome da linha
                <input
                  required
                  maxLength={60}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label className="op-field">
                Número com DDD
                <LinePhoneField
                  value={form.phone}
                  onValueChange={(phone) => {
                    setError("");
                    setForm({ ...form, phone });
                  }}
                />
              </label>
              <label className="op-field">
                Responsável pela linha
                <select
                  value={form.owner}
                  onChange={(e) => setForm({ ...form, owner: e.target.value })}
                >
                  {[
                    ...new Set([
                      ...activeMembers(ops).map((m) => m.name),
                      form.owner,
                    ]),
                  ]
                    .filter(Boolean)
                    .map((name) => (
                      <option key={name}>{name}</option>
                    ))}
                </select>
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) =>
                    setForm({ ...form, active: e.target.checked })
                  }
                />{" "}
                Linha ativa para atendimento
              </label>
              {error && <p role="alert">{error}</p>}
            </form>
          </ResponsiveDialog>
        )}
      </section> : <ChartCard
        title="Conversas por linha"
        titleAs="h2"
        description={workload.size > 6 ? "As seis linhas com mais conversas" : "Distribuição dos atendimentos de WhatsApp"}
      >
        <MeterList
          label="Conversas de WhatsApp por linha"
          items={[...workload].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([id, value]) => ({
            key: id,
            label: byId.get(id)?.name || id,
            value,
            share: (100 * value) / conversations.length,
            color: "teal",
          }))}
        />
        <div className="section-actions">
          <ButtonLink
            size="sm"
            variant="ghost"
            href={inboxHref(null, "whatsapp")}
          >
            Abrir conversas do WhatsApp
          </ButtonLink>
        </div>
      </ChartCard>}
    </div>
  );
}
