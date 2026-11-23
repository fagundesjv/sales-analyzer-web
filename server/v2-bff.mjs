// Browser routes deliberately mirror only the operations consumed by the official Web UI.
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const attendance = "conversations/" + uuid + "/attendance";
const attendanceStart = new RegExp("^" + attendance + "$");
const attendanceSend = new RegExp("^" + attendance + "/messages$");
const routes = [
  ["POST", "auth/session"], ["DELETE", "auth/session"], ["GET", "session"],
  ["POST", "auth/recovery"], ["POST", "auth/recovery/confirm"],
  ["PUT", "session/workspace"], ["GET", "connections"], ["POST", "connections"], ["GET", "connections/" + uuid + "/status"],
  ["POST", "connections/" + uuid + "/provision"],
  ["GET", "connections/" + uuid + "/diagnostic-schedule"], ["PUT", "connections/" + uuid + "/diagnostic-schedule"],
  ["POST", "connections/" + uuid + "/pairing"], ["POST", "diagnostics"],
  ["GET", "diagnostics"], ["GET", "summary"], ["GET", "conversations"], ["GET", "budget/usage"], ["GET","team"],
  ["POST", "team/invitations"], ["POST", "team/invitations/accept"],
  ["GET", "catalog/items"], ["POST", "catalog/items"], ["PATCH", "catalog/items/" + uuid],
  ["GET", "credits"],
  ["GET", "alerts"], ["GET", "alerts/settings"], ["PATCH", "alerts/settings"], ["PUT", "alerts/" + uuid + "/read"],
  ["GET", "pipelines"], ["POST", "pipelines"], ["GET", "pipelines/" + uuid], ["PATCH", "pipelines/" + uuid],
  ["GET", "pipelines/" + uuid + "/stages/" + uuid + "/cards"], ["PUT", "conversations/" + uuid + "/pipeline"],
  ["GET", "diagnostics/" + uuid], ["GET", "radar"], ["GET", "conversations/" + uuid],
  ["GET", attendance], ["POST", attendance], ["POST", attendance + "/messages"],
  ["PUT", "conversations/" + uuid + "/favorite"], ["PUT", "conversations/" + uuid + "/outcome"],
  ["GET", "focus"], ["POST", "focus"], ["PATCH","focus/" + uuid],
  ["GET","returns"], ["POST","returns"], ["PATCH","returns/" + uuid],
  ["PUT", "conversations/" + uuid + "/outcome/confirmation"],
  ["GET", "zoe/session"], ["GET", "zoe/history"], ["POST", "zoe/queries"],
  ["GET", "zoe/turns/" + uuid + "/citations/[0-9]"],
].map(([method, pattern]) => ({method, matches: new RegExp("^" + pattern + "$")}));
const uuidValue = new RegExp("^" + uuid + "$");
const contextValue = new RegExp("^" + uuid + "/" + uuid + "$");
const listQueries = {
  summary:["connectionId"], connections:["limit","cursor"], radar:["limit","cursor","q","outcome"],
  conversations:["limit","cursor","connectionId","q","outcome","favorite"], diagnostics:["limit","cursor","connectionId"],
  returns:["limit","cursor","status","conversationId","throughDate"],
  "zoe/history":["limit","cursor"], "budget/usage":["period"], team:["limit","cursor"],
  "catalog/items":["limit","cursor","q","kind","status"], pipelines:["limit","cursor"], alerts:["limit","cursor","kind","read"],
};
const pipelineBoardPath = new RegExp("^pipelines/" + uuid + "$");
const pipelineStagePath = new RegExp("^pipelines/" + uuid + "/stages/" + uuid + "/cards$");
function queryFor(path, method, raw) {
  if (!raw) return "";
  const pipelineBoard = pipelineBoardPath.test(path), pipelineStage = pipelineStagePath.test(path);
  const filters = pipelineBoard ? ["limit","assigneeId"] : pipelineStage ? ["limit","assigneeId","cursor"] : listQueries[path];
  if (raw.length > 1200 || method !== "GET" || !Array.isArray(filters))
    throw fail(400, "Consulta indisponível.");
  const params = new URLSearchParams(raw);
  for (const [name,value] of params) {
    if (!filters.includes(name) || params.getAll(name).length !== 1 ||
        (name === "q" && (value.length > 80 || value.includes("\0"))) ||
        (name === "limit" && (!/^(?:[1-9][0-9]?|100)$/.test(value) || ((path === "zoe/history" || path === "alerts" || pipelineBoard || pipelineStage) && Number(value) > 50))) ||
        (name === "outcome" && !["won","lost","resolved","open"].includes(value)) ||
        (name === "favorite" && !["true","false"].includes(value)) ||
        (name === "kind" && !(path === "alerts" ? ["risk","loss","disconnected"] : ["product","service"]).includes(value)) ||
        (name === "read" && !["true","false"].includes(value)) ||
        (name === "status" && !(path === "catalog/items" ? ["available","on_request","unavailable","archived"] : ["open","completed"]).includes(value)) ||
        (name === "throughDate" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) ||
        (name === "period" && !/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(value)) ||
        (["connectionId","conversationId","assigneeId"].includes(name) && !uuidValue.test(value)) ||
        (name === "cursor" && !(["diagnostics","returns","alerts"].includes(path) ? /^[A-Za-z0-9_-]{1,160}$/.test(value) : uuidValue.test(value))))
      throw fail(400, "Filtro ou paginação inválida.");
  }
  return "?" + params.toString();
}
const cookieName = "sa2_session";
const fail = (status, message) => Object.assign(new Error(message), {status});
const upstreamDeadlines = new Map([
  ["team/invitations/accept", 35000],
  ["auth/recovery", 13000],
  ["auth/recovery/confirm", 17000],
]);

async function bodyOf(req, limit) {
  if (req.method === "GET" || req.method === "DELETE") return;
  if (req.headers["content-type"]?.split(";")[0] !== "application/json")
    throw fail(415, "Envie os dados em JSON.");
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw fail(413, "O formulário excede o tamanho permitido.");
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString();
  // Preserve numeric literals for the API's exact-cent validation.
  try { JSON.parse(body); return body; }
  catch { throw fail(400, "Confira os dados do formulário."); }
}

export function createV2Bff({apiOrigin, webOrigin, serviceKey, network = "loopback"}) {
  const api = new URL(apiOrigin);
  const browserOrigin = new URL(webOrigin);
  const cookieScope = "; HttpOnly; SameSite=Strict; Path=/api/v2" +
    (browserOrigin.protocol === "https:" ? "; Secure" : "");
  const allowed = network === "private" ? ["http://sa-v2-api:4331","http://api:4331"].includes(apiOrigin) :
    network === "loopback" && api.protocol === "http:" && api.hostname === "127.0.0.1" && api.origin === apiOrigin;
  if (!allowed || !serviceKey || serviceKey.length < 32)
    throw new Error("Configure a origem privada e a chave de serviço da API V2.");
  return async function handle(req, res) {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");
    function send(status, value) {
      res.statusCode = status;
      res.end(value === undefined ? undefined : JSON.stringify(value));
    }
    try {
      if (req.headers.host !== browserOrigin.host) throw fail(403, "Origem não permitida.");
      const [path, ...query] = req.url.slice("/api/v2/".length).split("?");
      if (!routes.some(route => route.method === req.method && route.matches.test(path)))
        throw fail(404, "Operação indisponível.");
      if ((req.method !== "GET" && req.headers.origin !== webOrigin) ||
          req.headers["sec-fetch-site"] === "cross-site") throw fail(403, "Origem não permitida.");

      const search = queryFor(path, req.method, query.join("?"));
      const login = req.method === "POST" && path === "auth/session";
      const acceptance = req.method === "POST" && path === "team/invitations/accept";
      const recovery = path === "auth/recovery" || path === "auth/recovery/confirm";
      const usesSession = !login && !acceptance && !recovery;
      const logout = req.method === "DELETE" && path === "auth/session";
      const token = req.headers.cookie?.split(/;\s*/).find(x => x.startsWith(cookieName + "="))?.slice(cookieName.length + 1);
      const headers = {"X-Service-Key": serviceKey, Accept: "application/json"};
      if (usesSession) {
        if (!token || !/^[A-Za-z0-9._~-]{1,2048}$/.test(token)) throw fail(401, "Entre na V2 para continuar.");
        headers.Authorization = "Bearer " + token;
      }
      const key = req.headers["idempotency-key"];
      const optionalCatalogKey = req.method === "PATCH" && path.startsWith("catalog/items/") && key === undefined;
      const optionalAttendanceKey = req.method === "POST" && attendanceStart.test(path) && key === undefined;
      if (["POST","PUT","PATCH"].includes(req.method) && usesSession && path !== "session/workspace" && !path.endsWith("/pairing") && !optionalCatalogKey && !optionalAttendanceKey) {
        if (!key || !/^[A-Za-z0-9._:-]{1,128}$/.test(key)) throw fail(400, "Identificador da operação inválido.");
        headers["Idempotency-Key"] = key;
      }
      const body = await bodyOf(req, req.method === "POST" && attendanceSend.test(path) ? 32 * 1024 : 8192);
      if (body !== undefined) headers["Content-Type"] = "application/json";
      const upstream = (endpoint, options) => fetch(api.origin + "/v1/" + endpoint, {
        headers, redirect: "error", signal: AbortSignal.timeout(upstreamDeadlines.get(path) ?? 9000), ...options,
      });
      // The API checks the expected identity, workspace and role inside its resource transaction.
      if (usesSession && !logout && path !== "session") {
        const context = req.headers["x-v2-context"];
        if (!contextValue.test(context || "")) throw fail(400, "Contexto de empresa inválido.");
        headers["X-V2-Context"] = context;
      }
      const response = await upstream(path + search, {method:req.method, body});
      if (response.status === 401 && usesSession)
        res.setHeader("Set-Cookie", cookieName + "=; Max-Age=0" + cookieScope);
      if (response.status === 204 || (logout && response.ok)) {
        if (logout) res.setHeader("Set-Cookie", cookieName + "=; Max-Age=0" + cookieScope);
        return send(204);
      }
      const data = await response.json();
      if (!response.ok) return send(response.status, {error:{
        code: data.error?.code || "request_failed",
        message: data.error?.message || "A operação não foi concluída.",
      }});
      if (login) {
        if (!/^[A-Za-z0-9._~-]{1,2048}$/.test(data.token || "") || !data.session?.workspace?.id)
          throw fail(502, "A API retornou uma sessão inválida.");
        res.setHeader("Set-Cookie", cookieName + "=" + data.token + cookieScope);
        return send(200, data.session);
      }
      send(response.status, data);
    } catch (error) {
      send(error.status || 503, {error:{code:error.code === "stale_context" ? error.code : undefined, message:error.status ? error.message : "O serviço está indisponível. Tente novamente."}});
    }
  };
}
