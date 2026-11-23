"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Input } from "@content-ventures/design-system/v3";
import {
  enterPortal,
  portalAuth,
  portalEnabled,
  portalRequest,
  readInspection,
  saveInspection,
  supportPath,
  workspaceKey,
} from "../lib/official-portal";
import s from "./portal.module.css";

function Login({ notice }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await enterPortal(form.get("email").trim(), form.get("password"));
    } catch (e) {
      setError(
        e instanceof TypeError
          ? "O portal não respondeu. Confira a conexão e a origem autorizada desta interface."
          : e.message,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={s.gate}>
      <form onSubmit={submit} className={s.login}>
        <img
          src="/assets/sales-mark.svg"
          alt="Sales Analyzer"
          width="44"
          height="44"
        />
        <h1>Entrar na empresa</h1>
        <p>Use sua conta da Sales Analyzer.</p>
        <label>
          E-mail
          <Input type="email" name="email" autoComplete="username" required />
        </label>
        <label>
          Senha
          <Input
            type="password"
            name="password"
            autoComplete="current-password"
            required
          />
        </label>
        {(notice || error) && <p role="alert">{error || notice}</p>}
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </main>
  );
}

export function PortalSession({ children }) {
  const [state, setState] = useState({ phase: "loading" });
  const generation = useRef(0),
    controller = useRef(null);
  const user = useRef(null);
  const invalidate = useCallback((next) => {
    generation.current++;
    controller.current?.abort();
    setState(next);
  }, []);
  const load = useCallback(
    async (nextWorkspace = null) => {
      invalidate({ phase: "loading" });
      const index = generation.current,
        control = new AbortController();
      controller.current = control;
      const options = { signal: control.signal };
      try {
        let inspection = readInspection(user.current);
        if (inspection && !(Date.parse(inspection.expiresAt) > Date.now())) {
          saveInspection(null);
          inspection = null;
          location.hash = "empresa";
        }
        if (nextWorkspace) {
          const selected = await portalRequest("/api/auth/workspaces", {
            ...options,
            method: "POST",
            body: { workspaceId: nextWorkspace },
          });
          if (index !== generation.current) return;
          if (selected.workspace?.id !== nextWorkspace)
            throw new Error("A empresa selecionada não foi confirmada.");
          localStorage.setItem(workspaceKey, nextWorkspace);
        }
        const session = await portalRequest("/api/auth/session", options);
        if (
          !session.workspaceId ||
          session.user?.id !== user.current ||
          (inspection
            ? !(session.supportAdmin && session.support?.active &&
                session.support.mode === "inspect" &&
                session.support.sellerId === inspection.sellerId &&
                session.workspaceId === inspection.workspaceId)
            : session.support?.active) ||
          (session.workspaceCrmRole && session.destination === "/workspace")
        )
          throw new Error(
            "Esta conta precisa de acesso direto ao portal do cliente.",
          );
        const [portal, membership] = await Promise.all([
          portalRequest("/api/portal", { ...options, identity: session }),
          inspection ? null : portalRequest("/api/auth/workspaces", {
            ...options,
            identity: session,
          }),
        ]);
        if (index !== generation.current) return;
        if (
          portal.user?.id !== session.user.id ||
          portal.workspaceId !== session.workspaceId ||
          !["manager", "seller"].includes(portal.viewer?.kind) ||
          (inspection
            ? portal.supportMode !== "inspect" || portal.viewer.kind !== "seller" ||
                portal.viewer.sellerId !== inspection.sellerId
            : !membership.workspaces.some((w) => w.id === portal.workspaceId))
        )
          throw new Error("Não foi possível confirmar a empresa e o perfil.");
        setState({ phase: "ready", portal: {
          ...portal, supportAdmin: session.supportAdmin === true,
          support: session.support, supportTarget: session.supportTarget,
        }, workspaces: membership?.workspaces || [] });
      } catch (e) {
        if (index === generation.current)
          setState({
            phase: e.status === 401 ? "login" : "error",
            message: e.message,
          });
      }
    },
    [invalidate],
  );
  useEffect(() => {
    if (!portalEnabled) return;
    let alive = true,
      sub;
    function authChanged(event, session) {
      if (!alive) return;
      const id = session?.user.id ?? null;
      if (
        id === user.current &&
        event !== "INITIAL_SESSION" &&
        event !== "SIGNED_OUT"
      )
        return;
      user.current = id;
      if (!id) {
        saveInspection(null);
        invalidate({ phase: "login" });
        return;
      }
      invalidate({ phase: "loading" });
      // Let the auth callback release its session lock before requesting the portal.
      queueMicrotask(() => {
        if (alive && user.current === id) load();
      });
    }
    portalAuth()
      .then((auth) => {
        if (alive) sub = auth.onAuthStateChange(authChanged).data.subscription;
      })
      .catch((e) => {
        if (alive) invalidate({ phase: "error", message: e.message });
      });
    const expired = () => {
      saveInspection(null);
      user.current = null;
      invalidate({
        phase: "login",
        message: "Sua sessão expirou. Entre novamente.",
      });
    };
    const storage = (e) => {
      if (e.key === workspaceKey && user.current) load();
    };
    window.addEventListener("storage", storage);
    window.addEventListener("portal-session-expired", expired);
    return () => {
      alive = false;
      generation.current++;
      controller.current?.abort();
      sub?.unsubscribe();
      window.removeEventListener("storage", storage);
      window.removeEventListener("portal-session-expired", expired);
    };
  }, [load, invalidate]);
  useEffect(() => {
    const end = state.portal?.support?.expiresAt;
    if (!end) return;
    const timer = setTimeout(() => { saveInspection(null); location.hash = "empresa"; load(); },
      Math.max(0, Date.parse(end) - Date.now()));
    return () => clearTimeout(timer);
  }, [state.portal, load]);
  async function inspectSeller(workspaceId, sellerId) {
    const identity = state.portal;
    if (!identity?.supportAdmin || identity.support?.active) return;
    const index = generation.current;
    const result = await portalRequest(supportPath, {
      method: "POST", identity, body: { workspaceId, sellerId, mode: "inspect" },
    });
    if (index !== generation.current) return;
    if (!result.token || result.mode !== "inspect" || result.workspace?.id !== workspaceId ||
        !(Date.parse(result.expiresAt) > Date.now())) throw new Error("A API não confirmou a consulta.");
    saveInspection({ userId: identity.user.id, workspaceId, sellerId, token: result.token, expiresAt: result.expiresAt });
    location.hash = "radar";
    await load();
  }
  async function endInspection() {
    const scoped = readInspection(user.current);
    if (scoped && Date.parse(scoped.expiresAt) > Date.now()) {
      try { await portalRequest(supportPath, { method: "DELETE" }); }
      catch (error) {
        if (user.current) setState({phase: "error", message: error.message});
        return;
      }
    }
    saveInspection(null);
    location.hash = "empresa";
    if (user.current) await load();
  }
  async function logout() {
    invalidate({ phase: "loading" });
    try {
      if (readInspection(user.current)) await portalRequest(supportPath, { method: "DELETE" });
      saveInspection(null);
      const { error } = await (await portalAuth()).signOut({ scope: "local" });
      if (error) throw error;
      user.current = null;
      localStorage.removeItem(workspaceKey);
      invalidate({ phase: "login" });
    } catch (e) {
      invalidate({ phase: "error", message: e.message });
    }
  }
  if (!portalEnabled)
    return (
      <main className={s.gate}>
        <div className={s.login}>
          <h1>Portal da empresa</h1>
          <p>
            A conexão com o backend ainda não foi configurada neste ambiente.
          </p>
        </div>
      </main>
    );
  if (state.phase === "login") return <Login notice={state.message} />;
  if (state.phase === "loading")
    return (
      <main className={s.gate}>
        <p role="status">Confirmando seu acesso…</p>
      </main>
    );
  if (state.phase === "error")
    return (
      <main className={s.gate}>
        <div className={s.login}>
          <h1>Acesso à empresa</h1>
          <p role="alert">{state.message}</p>
          {readInspection(user.current) && <Button onClick={endInspection}>Encerrar consulta</Button>}
          <Button
            onClick={() => {
              localStorage.removeItem(workspaceKey);
              load();
            }}
          >
            Tentar novamente
          </Button>
          <Button onClick={logout}>Sair</Button>
        </div>
      </main>
    );
  return children(state.portal, state.workspaces, load, logout, inspectSeller, endInspection);
}
