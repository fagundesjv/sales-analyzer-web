"use client";
import {useState} from "react";
import {Button, ButtonLink, Input} from "@content-ventures/design-system/v3";
import {useV2Action} from "../../lib/v2-client";
import gate from "../portal.module.css";

export function PasswordRecovery() {
  const [email, setEmail] = useState("");
  const [requested, setRequested] = useState(false);
  const [complete, setComplete] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const send = useV2Action();
  const confirm = useV2Action();
  const pending = send.pending || confirm.pending;
  const request = (address) => send.run("auth/recovery", "POST", {email:address}, () => {
    setEmail(address);
    setRequested(true);
    setPasswordError("");
  });

  return <main className={gate.gate}><section className={gate.login} aria-labelledby="recovery-title">
    <img width="36" height="36" alt="" src="/assets/sales-mark.svg" />
    <h1 id="recovery-title">{complete ? "Senha atualizada" : "Recuperar senha"}</h1>
    {complete ? <p role="status">Entre com a nova senha.</p> : requested ? <>
      <p role="status">Se o endereço estiver cadastrado, você receberá um código válido por dez minutos.</p>
      <form className={gate.recoveryForm} onSubmit={event => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const password = data.get("password");
        if (password !== data.get("confirmation") || new TextEncoder().encode(password).length > 72) {
          setPasswordError(password !== data.get("confirmation") ? "As senhas precisam ser iguais." : "Use uma senha mais curta.");
          return;
        }
        setPasswordError("");
        confirm.run("auth/recovery/confirm", "POST", {email, code:data.get("code"), password}, () => setComplete(true));
      }}>
        <label>E-mail<Input type="email" name="email" value={email} readOnly autoComplete="username" /></label>
        <label>Código do e-mail<Input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></label>
        <label>Nova senha<Input type="password" name="password" autoComplete="new-password" minLength={8} maxLength={72} required /></label>
        <label>Confirmar nova senha<Input type="password" name="confirmation" autoComplete="new-password" minLength={8} maxLength={72} required /></label>
        {(passwordError || confirm.error || send.error) && <p role="alert">{passwordError || confirm.error || send.error}</p>}
        <Button type="submit" disabled={pending}>{confirm.pending ? "Atualizando…" : "Atualizar senha"}</Button>
      </form>
      <Button type="button" variant="ghost" disabled={pending} onClick={() => {confirm.clearError(); setRequested(false);}}>Solicitar outro código</Button>
    </> : <form className={gate.recoveryForm} onSubmit={event => {
      event.preventDefault();
      request(new FormData(event.currentTarget).get("email").trim());
    }}>
      <label>E-mail<Input name="email" type="email" required maxLength={254} autoComplete="username" defaultValue={email} /></label>
      {send.error && <p role="alert">{send.error}</p>}
      <Button type="submit" disabled={pending}>{send.pending ? "Solicitando…" : "Solicitar código"}</Button>
    </form>}
    <ButtonLink href="#dashboard" variant={complete ? "primary" : "ghost"}>Voltar ao login</ButtonLink>
  </section></main>;
}
