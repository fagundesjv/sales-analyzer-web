// Browser client for the existing Sales Analyzer API and its PKCE session.
const project = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
export const portalEnabled = process.env.NEXT_PUBLIC_SALES_MODE === "legacy-pilot" && Boolean(project && publicKey);
export const workspaceKey = "sales_analyzer_workspace";
const inspectionKey = "sales-analyzer:seller-inspection";
export const supportPath = "/api/admin/support/session";
export function readInspection(userId) {
  const value = JSON.parse(sessionStorage.getItem(inspectionKey) || "null");
  return value?.userId === userId ? value : null;
}
export function saveInspection(value) {
  if (value) sessionStorage.setItem(inspectionKey, JSON.stringify(value));
  else sessionStorage.removeItem(inspectionKey);
}
let clientPromise;

export async function portalAuth() {
  if (!portalEnabled)
    throw new Error("Configure a conexão com o portal da empresa.");
  clientPromise ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(project, publicKey, {
      auth: { flowType: "pkce", detectSessionInUrl: false },
    }),
  );
  return (await clientPromise).auth;
}

export async function portalFetch(
  path,
  {
    method = "GET",
    body,
    signal,
    identity,
    publicRequest = false,
    stream = false,
    rawError = false,
  } = {},
) {
  if (!portalEnabled) throw new Error("O piloto legado está desativado.");
  const base = (
    process.env.NEXT_PUBLIC_API_URL || project + "/functions/v1"
  ).replace(/\/+$/, "");
  const headers = {};
  if (!publicRequest) {
    const { data, error } = await (await portalAuth()).getSession();
    if (error || !data.session)
      throw Object.assign(new Error("Entre com sua conta para continuar."), {
        status: 401,
      });
    const workspace = localStorage.getItem(workspaceKey);
    const inspection = readInspection(data.session.user.id);
    if (inspection) {
      const closing = path === supportPath && method === "DELETE";
      if (!(Date.parse(inspection.expiresAt) > Date.now()) ||
          (!closing && (method !== "GET" || (!identity && path !== "/api/auth/session"))))
        throw new Error("A consulta do vendedor é somente leitura ou já expirou.");
      if (identity && (identity.support?.mode !== "inspect" ||
          identity.support.sellerId !== inspection.sellerId ||
          identity.workspaceId !== inspection.workspaceId))
        throw new Error("A visão do vendedor mudou. Abra a consulta novamente.");
      headers["x-support-session"] = inspection.token;
    } else if (identity?.support?.active) {
      throw new Error("A consulta do vendedor foi encerrada.");
    }
    if (
      identity &&
      (data.session.user.id !== identity.user.id ||
        (!inspection && workspace && workspace !== identity.workspaceId))
    ) {
      throw new Error("A conta mudou. Abra a conversa novamente.");
    }
    headers.authorization = "Bearer " + data.session.access_token;
    if (!inspection && (identity || workspace))
      headers["x-workspace-id"] = identity?.workspaceId || workspace;
  }
  if (body !== undefined) headers["content-type"] = "application/json";
  if (stream) headers.accept = "application/x-ndjson";
  const timeout = AbortSignal.timeout(stream ? 120000 : 20000);
  const url = new URL(base + path, window.location.origin);
  const region = process.env.NEXT_PUBLIC_FUNCTIONS_REGION?.trim();
  if (region) url.searchParams.set("forceFunctionRegion", region);
  const response = await fetch(url, {
    method,
    headers,
    cache: "no-store",
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (response.status === 401 && !publicRequest && !signal?.aborted)
    window.dispatchEvent(new Event("portal-session-expired"));
  if (!response.ok && !rawError) {
    const data = await response.json().catch(() => ({}));
    throw Object.assign(
      new Error(data.error || "Não foi possível concluir a solicitação."),
      { status: response.status, code: data.code },
    );
  }
  return response;
}
export async function portalRequest(path, options) {
  const response = await portalFetch(path, options);
  return response.status === 204 ? null : response.json();
}
export async function enterPortal(email, password) {
  const { session } = await portalRequest("/api/auth/password", {
    method: "POST",
    publicRequest: true,
    body: { action: "login", email, password },
  });
  localStorage.removeItem(workspaceKey);
  saveInspection(null);
  const { error } = await (
    await portalAuth()
  ).setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (error) throw error;
}
