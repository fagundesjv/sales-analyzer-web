"use client";
import { useEffect, useState } from "react";
import { portalRequest } from "../lib/official-portal";

export function usePortalData(path, identity, revision = 0) {
  const [state, setState] = useState(null);
  useEffect(() => {
    if (!path) return;
    const control = new AbortController();
    portalRequest(path, { identity, signal: control.signal })
      .then((data) => {
        if (!control.signal.aborted)
          setState({ path, identity, revision, data });
      })
      .catch((error) => {
        if (!control.signal.aborted)
          setState({ path, identity, revision, error: error.message });
      });
    return () => control.abort();
  }, [path, identity, revision]);
  return state &&
    state.path === path &&
    state.identity === identity &&
    state.revision === revision
    ? state
    : {};
}
export const realMoney = (value) =>
  value == null
    ? "A apurar"
    : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const dateTime = (date) =>
  new Date(date).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
export function useActivityPulse(identity) {
  useEffect(() => {
    if (identity.supportMode) return;
    const control = new AbortController();
    const clientId = crypto.randomUUID();
    let last = Date.now(),
      inFlight = false,
      previous;
    const touch = () => {
      last = Date.now();
    };
    const pulse = () => {
      const active =
        document.visibilityState === "visible" &&
        document.hasFocus() &&
        Date.now() - last < 90000;
      if (inFlight || (!active && previous === false)) return;
      previous = active;
      inFlight = true;
      portalRequest("/api/activity/usage", {
        method: "POST",
        identity,
        signal: control.signal,
        body: {
          expectedUserId: identity.user.id,
          workspaceId: identity.workspaceId,
          clientId,
          active,
          roundId: null,
        },
      })
        .catch(() => {})
        .finally(() => {
          inFlight = false;
        });
    };
    const focus = () => {
      touch();
      pulse();
    };
    const interval = window.setInterval(pulse, 15000);
    for (const ev of ["pointerdown", "keydown", "scroll"])
      window.addEventListener(ev, touch, true);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", pulse);
    pulse();
    return () => {
      control.abort();
      clearInterval(interval);
      for (const ev of ["pointerdown", "keydown", "scroll"])
        window.removeEventListener(ev, touch, true);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", pulse);
    };
  }, [identity]);
}
