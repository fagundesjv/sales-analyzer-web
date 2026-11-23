"use client";
import { useEffect, useRef, useState } from "react";
import qr from "qrcode-generator";
import { Button } from "@content-ventures/design-system/v3";
import { CheckCheck, QrCode, RefreshCw, ScanLine } from "lucide-react";
import { portalRequest } from "../lib/official-portal";
import styles from "./operations-board.module.css";

function demoCode() {
  const code = qr(0, "M");
  code.addData(
    "Sales Analyzer | Pareamento de demonstração | " + crypto.randomUUID(),
    "Byte",
  );
  code.make();
  return code.createDataURL(5, 20);
}

export function FirstWhatsApp({ onConnect, children }) {
  return (
    <section className={styles.lineIntro} aria-label="Primeira conexão de WhatsApp">
      <span className={styles.channelMark}><img src="/assets/whatsapp.svg" alt="" /></span>
      <div>
        <h2>Conecte seu primeiro número</h2>
        <p>Abra o QR Code aqui. No WhatsApp do celular, vá em Aparelhos conectados e escaneie o código.</p>
      </div>
      <div className={styles.pairActions}>
        <Button variant="primary" icon={QrCode} onClick={onConnect}>Conectar WhatsApp</Button>
        {children}
      </div>
    </section>
  );
}

export function PairingCode({ live = false, identity, line, onPaired, days = 7 }) {
  const [session, setSession] = useState(null);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(null);
  const callback = useRef(onPaired);
  callback.current = onPaired;
  const remaining = session
    ? Math.max(0, Math.ceil((session.until - now) / 1000))
    : 0;
  function display(id, code) {
    const time = Date.now();
    setNow(time);
    setSession({ id, code, until: time + 120000 });
  }
  useEffect(() => {
    if (!live) display(line?.id, demoCode());
    return () => request.current?.abort();
  }, [line?.id, live]);
  useEffect(() => {
    if (!session) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [session]);
  const watching = live && remaining > 0 && Boolean(session?.id);
  useEffect(() => {
    if (!watching) return;
    const controller = new AbortController();
    let timer;
    async function check() {
      try {
        const data = await portalRequest(
          "/api/whatsapp/connect?conexao=" + encodeURIComponent(session.id),
          { signal: controller.signal, identity },
        );
        if (controller.signal.aborted) return;
        setError("");
        if (data.connected) {
          callback.current(data);
          return;
        }
        if (data.qrCode)
          setSession((s) =>
            s && s.id === session.id ? { ...s, code: data.qrCode } : s,
          );
      } catch (e) {
        if (!controller.signal.aborted) setError(e.message);
      }
      if (!controller.signal.aborted) timer = setTimeout(check, 5000);
    }
    timer = setTimeout(check, 3000);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [watching, session?.id, session?.until, identity]);
  async function generate() {
    if (!live) {
      display(line?.id, demoCode());
      return;
    }
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    try {
      const id = session?.id || line?.id;
      const data = await portalRequest("/api/whatsapp/connect", {
        method: "POST", identity,
        signal: controller.signal,
        body: id
          ? { conexao: id, automatic: false }
          : { novo: true, automatic: false },
      });
      if (controller.signal.aborted) return;
      if (data.connected) callback.current(data);
      else if (data.connectionId) display(data.connectionId, data.qrCode);
      else throw new Error("A conexão não retornou um código. Gere outro QR.");
    } catch (e) {
      if (!controller.signal.aborted) setError(e.message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      request.current = null;
    }
  }
  return (
    <div className={styles.pairing}>
      <div className={styles.qrStage}>
        {remaining > 0 && session.code ? (
          <img
            src={session.code}
            alt={
              live
                ? "QR Code para parear este WhatsApp"
                : "Código QR de teste da linha"
            }
            width="176"
            height="176"
          />
        ) : (
          <QrCode size={70} aria-hidden="true" />
        )}
      </div>
      <div className={styles.qrInstructions}>
        <strong>
          {session && !remaining ? "Código expirado" : "Escaneie pelo WhatsApp"}
        </strong>
        <p>
          No celular, abra <b>Aparelhos conectados</b>, toque em{" "}
          <b>Conectar um aparelho</b> e aponte a câmera para o código.
        </p>
        {remaining > 0 && (
          <small>
            Aguardando leitura · {Math.floor(remaining / 60)}min{" "}
            {String(remaining % 60).padStart(2, "0")}s
          </small>
        )}
        {session && !remaining && (
          <small>Gere um novo código para continuar.</small>
        )}
        {!live && (
          <small>
            QR de demonstração. Use a simulação para testar o fluxo.
          </small>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="actions">
        {!live && remaining > 0 && (
          <Button
            variant="primary"
            icon={ScanLine}
            onClick={() => onPaired(days)}
          >
            Simular leitura do QR
          </Button>
        )}
        {(!session || !remaining || error) && (
          <Button
            variant="primary"
            icon={RefreshCw}
            disabled={busy}
            onClick={generate}
          >
            {busy
              ? "Gerando…"
              : session
                ? "Gerar novo QR Code"
                : "Gerar QR Code"}
          </Button>
        )}
      </div>
    </div>
  );
}
