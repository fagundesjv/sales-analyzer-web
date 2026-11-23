"use client";
import {useEffect, useMemo, useRef, useState} from "react";

function networkError() {
  return Object.assign(new Error("Não foi possível conectar. Confira a conexão e tente novamente."), {code:"network_error"});
}
function customerError(data) {
  const code = data?.error?.code;
  if (typeof code === "string" && code.startsWith("evolution_")) {
    if (code === "evolution_unavailable") return "Não foi possível consultar o WhatsApp. Tente novamente em instantes.";
    if (code === "evolution_unconfigured") return "Esta linha ainda não está pronta para conectar. Peça ao gestor que confira a configuração.";
    return "Não foi possível concluir a operação com o WhatsApp. Tente novamente.";
  }
  const message = data?.error?.message;
  if (typeof message !== "string" || !message.trim()) return "Não foi possível concluir a operação.";
  if (/evolution|backend|gotrue|provider|instância|servidor|\b(?:API|V2)\b/i.test(message))
    return "Não foi possível concluir a operação. Tente novamente.";
  return message;
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
    if (!signal?.aborted && ((response.status === 401 && context) || data?.error?.code === "stale_context"))
      window.dispatchEvent(new Event("sa2-session-changed"));
    throw Object.assign(new Error(customerError(data)), {
      status:response.status, code:data?.error?.code,
    });
  }
  return data;
}

export function useV2Read(path, context, revision = 0, collection = null) {
  const [tick, setTick] = useState(0);
  const [state, setState] = useState({});
  // Identity changes even when navigation returns to the same URL (A → B → A).
  const request = useMemo(() => ({path,context}), [path,context,revision,tick]);
  const enabled = !!path;
  const group = useMemo(() => ({}), [collection,context,enabled]);
  useEffect(() => {
    if (!request.path) return;
    const controller = new AbortController();
    v2Request(request.path, {context:request.context,signal:controller.signal}).then(
      data => { if (!controller.signal.aborted) setState({request,group,data,confirmed:true}); },
      error => {
        if (!controller.signal.aborted) setState(old => ({request,group,error,
          confirmed:old.group === group && old.confirmed && ![401,403].includes(error.status)}));
      },
    );
    return () => controller.abort();
  }, [request,group]);
  const current = enabled && state.request === request;
  const sameCollection = enabled && context && collection && state.group === group;
  const samePath = enabled && state.group === group && state.request?.path === path;
  // Polling reads have an existing contract with their status indicators.
  const polling = !current && samePath && !collection && state.data &&
    (path.startsWith("diagnostics") || path.endsWith("/attendance"));
  return {
    data:current || polling ? state.data : undefined,
    error:current ? state.error : undefined,
    loading:!current && !polling,
    refreshing:!!polling,
    // Only rendering code may use the prior result. Actions and onboarding decisions use data.
    previousData:!current && sameCollection ? state.data : undefined,
    confirmed:!!((current || sameCollection) && state.confirmed),
    retry:() => setTick(t => t + 1),
  };
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
  const key = useMemo(() => ({}), [context,path,size]);
  const [position, setPosition] = useState({key, cursors:[null]});
  const cursors = position.key === key ? position.cursors : [null];
  const cursor = cursors.at(-1);
  const url = path && path + (path.includes("?") ? "&" : "?") + "limit=" + size +
    (cursor ? "&cursor=" + encodeURIComponent(cursor) : "");
  const read = useV2Read(url, context, revision, path?.split("?")[0]);
  return {...read, number:cursors.length, cursor,
    first: () => {setPosition({key,cursors:[null]});read.retry();},
    previous: cursors.length > 1 ? () => setPosition({key,cursors:cursors.slice(0,-1)}) : null,
    next: read.data?.nextCursor ? () => setPosition({key,cursors:[...cursors,read.data.nextCursor]}) : null};
}
