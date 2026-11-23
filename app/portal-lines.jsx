"use client";
import { useEffect, useState } from "react";
import {
  Button,
  ConfirmDialog,
} from "@content-ventures/design-system/v3";
import { ResponsiveDialog } from "../src/ui/os/responsive-dialog";
import { QrCode } from "lucide-react";
import { portalRequest } from "../lib/official-portal";
import { FirstWhatsApp, PairingCode } from "./pairing-code";
import { LineDirectory } from "./line-directory";
import s from "./operations-board.module.css";

export function PortalLines({identity}) {
  const [lines, setLines] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [readOnly, setReadOnly] = useState(true);
  const [revision, refresh] = useState(0);
  const [dialog, setDialog] = useState(null);
  const [alias, setAlias] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const control = new AbortController();
    setError("");
    setLoaded(false);
    portalRequest("/api/portal", { signal: control.signal, identity })
      .then((data) => {
        if (!control.signal.aborted) {
          setLines(data.connections.filter((l) => l.source !== "nowz"));
          setReadOnly(Boolean(data.readOnly || data.viewer?.kind === "seller"));
          setLoaded(true);
        }
      })
      .catch((e) => {
        if (!control.signal.aborted) setError(e.message);
      });
    return () => control.abort();
  }, [revision,identity]);
  async function save(path, method, body) {
    if (busy || readOnly) return;
    setBusy(true);
    setError("");
    try {
      await portalRequest(path, { method, body, identity });
      setDialog(null);
      refresh((v) => v + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={s.linesBoard}>
      {(!loaded || lines.length > 0) && <header className={s.sectionHead}>
        <div>
          <h2>Números da empresa</h2>
          <p>
            {loaded
              ? lines.filter((l) => l.connected).length + " conectados"
              : "Consultando conexões do portal"}
          </p>
        </div>
        {(!loaded || !readOnly) && (
          <Button
            variant="primary"
            icon={QrCode}
            disabled={!loaded}
            onClick={() => setDialog({ type: "pair" })}
          >
            Conectar WhatsApp
          </Button>
        )}
      </header>}
      {error && !dialog && (
        <p role="alert">
          {error}{" "}
          <Button onClick={() => refresh((v) => v + 1)}>
            Tentar novamente
          </Button>
        </p>
      )}
      {loaded && !lines.length && (readOnly
        ? <p>Nenhum número disponível para este acesso.</p>
        : <FirstWhatsApp onConnect={() => setDialog({ type: "pair" })} />)}
      {loaded && lines.length > 0 && <LineDirectory lines={lines.map(l => ({...l, owners:l.people || []}))}
        onEdit={readOnly ? null : id => {const line = lines.find(l => l.id === id); setAlias(line.name); setDialog({type:"name",line});}}
        onPair={id => setDialog({type:"pair",line:lines.find(l => l.id === id)})}
        onEnd={id => setDialog({type:"end",line:lines.find(l => l.id === id)})} />}
      {dialog?.type === "pair" && (
        <ResponsiveDialog
          open
          title="Conectar WhatsApp"
          size="sm"
          onClose={() => {
            setDialog(null);
            refresh((v) => v + 1);
          }}
        >
          <PairingCode
            live
            identity={identity}
            line={dialog.line}
            onPaired={() => {
              setDialog(null);
              refresh((v) => v + 1);
            }}
          />
        </ResponsiveDialog>
      )}
      {dialog?.type === "name" && (
        <ResponsiveDialog
          open
          title="Nome da conexão"
          onClose={() => setDialog(null)}
          footer={
            <Button
              form="rename-line"
              type="submit"
              disabled={!alias.trim() || busy}
            >
              Salvar nome
            </Button>
          }
        >
          <form
            id="rename-line"
            className="op-form"
            onSubmit={(e) => {
              e.preventDefault();
              save(
                "/api/portal/connections/" + encodeURIComponent(dialog.line.id),
                "PATCH",
                { name: alias.trim() },
              );
            }}
          >
            <label className="op-field">
              Nome da linha
              <input
                required
                maxLength={60}
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
              />
            </label>
            {error && <p role="alert">{error}</p>}
          </form>
        </ResponsiveDialog>
      )}
      {dialog?.type === "end" && (
        <ConfirmDialog
          open
          tone="danger"
          title={"Desconectar " + dialog.line.name + "?"}
          description={
            error ||
            "Esta linha interrompe a sincronização até ser pareada novamente."
          }
          confirmLabel="Desconectar linha"
          onClose={() => setDialog(null)}
          onConfirm={() =>
            save(
              "/api/whatsapp/connect?conexao=" +
                encodeURIComponent(dialog.line.id),
              "DELETE",
            )
          }
        />
      )}
    </section>
  );
}
