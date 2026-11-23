"use client";

import {useRef, useState} from "react";
import {Button, ButtonLink, Input} from "@content-ventures/design-system/v3";
import {UserPlus} from "lucide-react";
import {ResponsiveDialog} from "../../src/ui/os/responsive-dialog";
import {useV2Action, v2Request} from "../../lib/v2-client";
import gate from "../portal.module.css";
import s from "./invitations.module.css";

const invitations = "team/invitations";
const expires = new Intl.DateTimeFormat("pt-BR", {dateStyle:"short", timeStyle:"short"});

export function InviteSeller({workspace, context}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const busy = useRef(false);
  const intent = useRef(null);
  const delivered = receipt?.deliveryStatus === "delivered";

  function edit(value) {
    setEmail(value);
    setError(null);
    setReceipt(null);
  }
  async function submit(event) {
    event.preventDefault();
    if (busy.current) return;
    const recipient = email.trim().toLowerCase();
    if (intent.current?.email !== recipient) intent.current = {email:recipient, key:crypto.randomUUID()};
    busy.current = true;
    setSending(true);
    setError(null);
    try {
      const result = await v2Request(invitations, {
        method:"POST", body:{email:recipient}, context, key:intent.current.key,
      });
      setReceipt(result);
      if (result.deliveryStatus === "delivered") intent.current = null;
    } catch (cause) {
      setError(cause);
      if (cause.code === "invitation_expired" || cause.code === "invitation_used") {
        intent.current = null;
        setReceipt(null);
      }
    } finally {
      busy.current = false;
      setSending(false);
    }
  }
  return <>
    <Button icon={UserPlus} variant="primary" onClick={() => {
      if (delivered) edit("");
      setOpen(true);
    }}>Convidar vendedor</Button>
    {open && <ResponsiveDialog open size="sm" title={delivered ? "Convite enviado" : "Convidar vendedor"}
      description={workspace.name} onClose={() => setOpen(false)}>
      {delivered ? <div className={s.form}>
        <p role="status">O código foi enviado para <strong>{receipt.email}</strong>. O acesso de vendedor será liberado após o aceite.</p>
        <p className={s.hint}>Válido até {expires.format(new Date(receipt.expiresAt))}.</p>
        <Button variant="primary" onClick={() => setOpen(false)}>Concluir</Button>
      </div> : <form method="post" className={s.form} onSubmit={submit}>
        <label>E-mail do vendedor<Input type="email" required maxLength={254} autoComplete="off" value={email}
          disabled={sending} onChange={event => edit(event.target.value)} /></label>
        <p className={s.hint}>A pessoa receberá um código válido por 24 horas para entrar nesta empresa como vendedor.</p>
        {receipt && <p role="status">Entrega em andamento para {receipt.email}.</p>}
        {error && <p role="alert">{error.code === "invitation_expired" ? "O convite expirou. Envie um novo código." : error.message}</p>}
        <Button type="submit" variant="primary" disabled={sending}>{sending ? "Verificando entrega…" :
          receipt ? "Verificar entrega" : error?.code === "invitation_expired" ? "Enviar novo convite" : "Enviar convite"}</Button>
      </form>}
    </ResponsiveDialog>}
  </>;
}

export function AcceptInvitation({session, onSwitch, showCompanies}) {
  const [mode, setMode] = useState("existing");
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const busy = useRef(false);
  const change = useV2Action(session && session.user.id + "/" + session.workspace.id);
  const used = error?.code === "invitation_used" || error?.code === "already_member";
  const expired = error?.code === "invitation_expired";
  const sameAccount = session && receipt?.userId === session.user.id;

  async function accept(event) {
    event.preventDefault();
    if (busy.current) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    busy.current = true;
    setSending(true);
    setError(null);
    try {
      const result = await v2Request(invitations + "/accept", {method:"POST", body:{
        email:fields.get("email").trim(), token:fields.get("token").trim(), password:fields.get("password"), mode,
      }});
      form.reset();
      setReceipt(result);
    } catch (cause) {
      setError(cause);
    } finally {
      busy.current = false;
      setSending(false);
    }
  }

  return <main className={gate.gate}><section className={gate.login} aria-labelledby="invite-title">
    <img width="36" height="36" alt="Sales Analyzer" src="/assets/sales-mark.svg" />
    {receipt || used ? <>
      <h1 id="invite-title">{receipt ? "Convite aceito" : "Acesso já vinculado"}</h1>
      <p>{receipt ? "Sua conta já tem acesso de vendedor à empresa." : "Entre com a conta convidada para consultar suas empresas."}</p>
      {sameAccount ? <Button variant="primary" disabled={change.pending} onClick={() => change.run("session/workspace", "PUT",
        {workspaceId:receipt.workspaceId}, onSwitch)}>{change.pending ? "Abrindo…" : "Abrir empresa do convite"}</Button> :
        session ? <>
          {receipt && <p>Para entrar com a conta convidada, use uma janela privativa. Sua sessão atual continua aberta.</p>}
          <Button variant="primary" onClick={showCompanies}>Ver minhas empresas</Button>
        </> : <ButtonLink variant="primary" href="#empresa">Entrar com minha conta</ButtonLink>}
      {change.error && <p role="alert">{change.error}</p>}
    </> : expired ? <>
      <h1 id="invite-title">Convite expirado</h1><p>Peça um novo código ao gestor da empresa.</p>
      <Button variant="primary" onClick={() => setError(null)}>Usar outro código</Button>
    </> : <>
      <h1 id="invite-title">Aceitar convite</h1>
      <p>Use o e-mail que recebeu o convite e o código enviado pelo gestor.</p>
      <form method="post" className={s.form} onSubmit={accept}>
        <fieldset className={s.modes} disabled={sending}><legend>Conta do vendedor</legend>
          {[["existing","Já tenho conta"],["create","Criar conta"]].map(([value,label]) =>
            <label key={value}><input type="radio" name="account-mode" value={value} checked={mode === value}
              onChange={() => {setMode(value);setError(null);}} /><span>{label}</span></label>)}
        </fieldset>
        <label>E-mail do convite<Input type="email" name="email" autoComplete="username" maxLength={254} required /></label>
        <label>Código do convite<Input name="token" autoComplete="one-time-code" autoCapitalize="none" spellCheck={false}
          pattern="[a-f0-9]{64}" maxLength={64} title="Cole os 64 caracteres do código recebido por e-mail." required /></label>
        <label>{mode === "create" ? "Criar senha" : "Senha atual"}<Input key={mode} name="password" type="password"
          autoComplete={mode === "create" ? "new-password" : "current-password"} minLength={mode === "create" ? 8 : 1}
          maxLength={256} required /></label>
        {mode === "create" && <small className={s.hint}>Use pelo menos 8 caracteres.</small>}
        {error && <p role="alert">{error.message}</p>}
        <Button type="submit" variant="primary" disabled={sending}>{sending ? "Confirmando…" : "Aceitar convite"}</Button>
      </form>
    </>}
    {!receipt && !used && <ButtonLink href={session ? "#empresa" : "#dashboard"} variant="ghost">
      {session ? "Voltar à minha empresa" : "Voltar para entrar"}</ButtonLink>}
  </section></main>;
}
