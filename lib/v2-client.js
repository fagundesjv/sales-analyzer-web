"use client";
import {useEffect, useRef, useState} from "react";

function networkError() {
  return Object.assign(new Error("Não foi possível conectar. Confira a conexão e tente novamente."), {code:"network_error"});
}

export async function v2Request(path, {method = "GET", body, key, context, signal} = {}) {
  const headers = {Accept: "application/json"};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (key) headers["Idempotency-Key"] = key;
  if (context) headers["X-V2-Context"] = context;
  let response;
  try {
    response = await fetch("/api/v2/" + path, {
      method, headers, credentials:"same-origin", cache:"no-store", signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw networkError();
  }
  if (response.status === 204) return;
  const data = await response.json().catch(error => {
    if (signal?.aborted || error.name === "AbortError") throw error;
    if (response.ok && error instanceof TypeError) throw networkError();
    return null;
  });
  if (!response.ok || !data) {
    if ((response.status === 401 && context) || data?.error?.code === "stale_context")
      window.dispatchEvent(new Event("sa2-session-changed"));
    throw Object.assign(new Error(data?.error?.message || "A V2 não conseguiu concluir a operação."), {
      status:response.status, code:data?.error?.code,
    });
  }
  return data;
}

export function useV2Read(path, context, revision = 0) {
  const [tick, setTick] = useState(0);
  const [state, setState] = useState({});
  const scope = JSON.stringify([path, context]);
  const identity = JSON.stringify([scope, revision, tick]);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    v2Request(path, {context, signal:controller.signal}).then(
      data => { if (!controller.signal.aborted) setState({identity, scope, data}); },
      error => { if (!controller.signal.aborted) setState({identity, scope, error}); },
    );
    return () => controller.abort();
  }, [identity, scope, path, context]);
  const keepDuringRefresh = path?.startsWith("diagnostics") || path?.endsWith("/attendance");
  return {...(state.identity === identity ? state : keepDuringRefresh && state.scope === scope && state.data ? {data:state.data,refreshing:true} : {loading:true}), retry: () => setTick(t => t + 1)};
}

// Retain the key on network/HTTP errors so a retry can recover an already committed write.
export function useV2Action(context) {
  const intent = useRef(null);
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  async function run(path, method, body, success) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    setErrorCode("");
    if (context) {
      const fingerprint = JSON.stringify([context, path, method, body]);
      if (intent.current?.fingerprint !== fingerprint)
        intent.current = {fingerprint, key:crypto.randomUUID()};
    }
    try {
      const data = await v2Request(path, {method, body, context, key:context ? intent.current?.key : undefined});
      intent.current = null;
      success(data);
    } catch (cause) {
      setError(cause.message);
      setErrorCode(cause.code || "");
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return {run, pending, error, errorCode, clearError: () => {setError(""); setErrorCode("");}};
}

export function useV2Page(path, context, revision = 0, size = 25) {
  const [position, setPosition] = useState({key:path, cursors:[null]});
  const cursors = position.key === path ? position.cursors : [null];
  const cursor = cursors.at(-1);
  const url = path && path + (path.includes("?") ? "&" : "?") + "limit=" + size +
    (cursor ? "&cursor=" + encodeURIComponent(cursor) : "");
  const read = useV2Read(url, context, revision);
  return {...read, number:cursors.length, cursor,
    first: () => {setPosition({key:path,cursors:[null]});read.retry();},
    previous: cursors.length > 1 ? () => setPosition({key:path,cursors:cursors.slice(0,-1)}) : null,
    next: read.data?.nextCursor ? () => setPosition({key:path,cursors:[...cursors,read.data.nextCursor]}) : null};
}
