import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {createServer} from "node:http";
import {test} from "node:test";
import {createV2Bff} from "../server/v2-bff.mjs";

const listen = server => new Promise((ok, fail) => {
  server.once("error", fail);
  server.listen(0, "127.0.0.1", () => ok("http://127.0.0.1:" + server.address().port));
});
const close = server => new Promise(ok => server.close(ok));

test("BFF encaminha pedidos, versões e chave sem permitir filtros arbitrários", async () => {
  const conversationId = randomUUID(), opportunityId = randomUUID(), cursor = randomUUID();
  const scope = randomUUID() + "/" + randomUUID(), token = randomUUID(), serviceKey = randomUUID();
  const requests = [];
  const upstream = createServer(async (req, res) => {
    let body = "";
    for await (const part of req) body += part;
    requests.push({path:req.url, method:req.method, body:body ? JSON.parse(body) : undefined, key:req.headers["idempotency-key"]});
    assert.equal(req.headers["x-v2-context"], scope);
    assert.equal(req.headers.authorization, "Bearer " + token);
    assert.equal(req.headers["x-service-key"], serviceKey);
    res.writeHead(200, {"Content-Type":"application/json"});
    res.end(JSON.stringify({ok:true}));
  });
  const apiOrigin = await listen(upstream);
  let handler;
  const web = createServer((req, res) => handler(req, res));
  const origin = await listen(web);
  handler = createV2Bff({apiOrigin, webOrigin:origin, serviceKey});
  async function request(path, method = "GET", body, key) {
    return fetch(origin + "/api/v2/" + path, {method, headers:{Cookie:"sa2_session=" + token,
      "X-V2-Context":scope, Origin:origin, "Content-Type":"application/json", ...(key ? {"Idempotency-Key":key} : {})},
      body:body ? JSON.stringify(body) : undefined});
  }
  const list = "conversations/" + conversationId + "/opportunities";
  try {
    for (const path of [list + "?limit=25&cursor=" + cursor, "opportunities/" + opportunityId, "opportunities/summary"]) {
      const response = await request(path);
      assert.equal(response.status, 200); await response.body?.cancel();
    }
    for (const [path, method, body, key] of [
      [list, "POST", {title:"Recompra"}, "novo-pedido"],
      ["opportunities/" + opportunityId + "/outcome", "PUT", {status:"won", amountCents:null, expectedVersion:3}, "ganho-sem-valor"],
    ]) {
      const response = await request(path, method, body, key);
      assert.equal(response.status, 200); await response.body?.cancel();
      assert.deepEqual(requests.at(-1), {path:"/v1/" + path, method, body, key});
    }
    const accepted = requests.length;
    for (const path of [list + "?limit=101", list + "?workspaceId=" + randomUUID(), list + "?cursor=invalid", list + "?limit=1&limit=2"]) {
      const response = await request(path); assert.equal(response.status, 400); await response.body?.cancel();
    }
    const noKey = await request(list, "POST", {title:"Sem chave"});
    assert.equal(noKey.status, 400); await noKey.body?.cancel();
    assert.equal(requests.length, accepted);
  } finally {
    await close(web); await close(upstream);
  }
});
