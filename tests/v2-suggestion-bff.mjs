import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {createServer} from "node:http";
import {test} from "node:test";
import {createV2Bff} from "../server/v2-bff.mjs";

const listen = server => new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => resolve("http://127.0.0.1:" + server.address().port));
});
const close = server => new Promise(resolve => server.close(resolve));

test("Sugestão mantém revisão, fontes e contexto ao atravessar o BFF", async () => {
  const userId = randomUUID(), workspaceId = randomUUID(), conversationId = randomUUID();
  const context = userId + "/" + workspaceId;
  const serviceKey = randomUUID(), token = randomUUID();
  const reply = {state:"ready", text:"Qual é o CEP de entrega?", evidenceIds:["mensagem-do-pedido", "contexto-anterior"]};
  const item = {id:conversationId, revision:3, pendingRevision:false, analysis:{reply}, evidence:[
    {externalId:"mensagem-do-pedido", text:"Quero saber o frete.", direction:"inbound", occurredAt:"2026-01-01T12:00:00Z"},
  ]};
  let upstreamCalls = 0;
  const upstream = createServer((req, res) => {
    upstreamCalls++;
    assert.equal(req.url, "/v1/conversations/" + conversationId);
    assert.equal(req.headers["x-service-key"], serviceKey);
    assert.equal(req.headers.authorization, "Bearer " + token);
    assert.equal(req.headers["x-v2-context"], context);
    res.writeHead(200, {"Content-Type":"application/json"});
    res.end(JSON.stringify(item));
  });
  const apiOrigin = await listen(upstream);
  let handler;
  const server = createServer((req, res) => handler(req, res));
  const webOrigin = await listen(server);
  handler = createV2Bff({apiOrigin, webOrigin, serviceKey});
  const url = webOrigin + "/api/v2/conversations/" + conversationId;
  const headers = {Cookie:"sa2_session=" + token, "X-V2-Context":context};
  try {
    for (const variant of [
      {state:"ready", pending:false}, {state:"writing", pending:false}, {state:"ready", pending:true},
    ]) {
      item.analysis.reply = {...reply, state:variant.state, text:variant.state === "ready" ? reply.text : null};
      item.pendingRevision = variant.pending;
      const response = await fetch(url, {headers});
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.deepEqual(await response.json(), item);
    }
    assert.equal(upstreamCalls, 3);

    const noSession = await fetch(url, {headers:{"X-V2-Context":context}});
    assert.equal(noSession.status, 401);
    await noSession.body?.cancel();
    const noContext = await fetch(url, {headers:{Cookie:headers.Cookie}});
    assert.equal(noContext.status, 400);
    await noContext.body?.cancel();
    assert.equal(upstreamCalls, 3);
  } finally {
    await close(server);
    await close(upstream);
  }
});
