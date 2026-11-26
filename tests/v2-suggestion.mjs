import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";
import {json, startFixtureWeb} from "./fixtures/web-bff.mjs";

const bundle = process.argv[2];
assert.ok(bundle, "Informe o pacote Web compilado.");
const shots = process.env.SA_EVIDENCE_DIR;
if (shots) await mkdir(shots, {recursive:true});
const browser = await chromium.launch({channel:"chrome"});
try {
  for (const width of [1440, 390]) {
    const user = {id:randomUUID(), name:"Vendedor de teste", email:"vendedor@example.test"};
    const workspace = {id:randomUUID(), name:"Empresa sintética", role:"seller"};
    const sourceId = "pedido com espaço/?";
    const item = {id:randomUUID(), title:"Cliente de teste", summary:"Frete em aberto", source:"synthetic",
      revision:2, pendingRevision:false, evidence:[
        {externalId:sourceId, text:"Preciso do frete de três caixas.", direction:"inbound", occurredAt:"2026-01-01T12:00:00Z"},
      ], analysis:{reply:{state:"ready", text:"Qual é o CEP de entrega das três caixas?", evidenceIds:[sourceId,"contexto-fora-da-janela"]}}};
    let upstreamCalls = 0;
    const fixture = await startFixtureWeb(bundle, 0, async (req, res, path) => {
      upstreamCalls++;
      if (path === "session") return json(res, 200, {user, workspace, workspaces:[workspace]});
      if (req.headers["x-v2-context"] !== user.id + "/" + workspace.id) return json(res, 403, {});
      assert.equal(req.method, "GET", "Ler a sugestão só consulta dados publicados.");
      if (path === "focus") return json(res, 200, {round:null});
      if (path === "conversations") return json(res, 200, {items:[item], nextCursor:null});
      if (path === "conversations/" + item.id) return json(res, 200, item);
      if (path.endsWith("/attendance")) return json(res, 200, {available:false, messages:[]});
      return json(res, 404, {});
    });
    const context = await browser.newContext({viewport:{width, height:width < 600 ? 844 : 900}});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.setDefaultTimeout(9000);
    await context.route(/^https?:/, route => {
      if (new URL(route.request().url()).origin === fixture.origin) return route.continue();
      errors.push("Requisição externa");
      return route.abort();
    });
    const go = () => page.goto(fixture.origin + "/#entrada/todos/" + item.id);
    const suggestion = page.getByRole("region", {name:"Sugestão da Zoe", exact:true});
    try {
      await go();
      await suggestion.getByText(item.analysis.reply.text, {exact:true}).waitFor();
      const source = suggestion.getByRole("link", {name:"Ver fonte 1", exact:true});
      assert.equal(await source.getAttribute("href"), "#entrada/todos/" + item.id + "/evidencia/" + encodeURIComponent(sourceId));
      assert.equal(await suggestion.getByRole("link").count(), 1);
      await suggestion.getByRole("status").getByText(/fora desta leitura/).waitFor();
      await source.click();
      await page.getByRole("group", {name:"Trecho citado pela Zoe"}).waitFor();
      if (shots) await page.screenshot({path:shots + "/sugestao-pronta-" + width + ".png", animations:"disabled"});

      item.analysis.reply = {state:"writing", text:null, evidenceIds:[]};
      await page.reload();
      await suggestion.getByText("A Zoe está preparando a sugestão desta leitura.").waitFor();
      item.analysis.reply = {state:"ready", text:"Pode informar o CEP?", evidenceIds:[sourceId]};
      await suggestion.getByRole("button", {name:"Atualizar sugestão"}).click();
      await suggestion.getByText("Pode informar o CEP?", {exact:true}).waitFor();

      item.pendingRevision = true;
      await page.reload();
      await suggestion.getByRole("heading", {name:"Sugestão desatualizada"}).waitFor();
      assert.equal(await suggestion.getByText("Pode informar o CEP?", {exact:true}).count(), 0);
      assert.equal(await suggestion.getByRole("link").count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      if (shots) await page.screenshot({path:shots + "/sugestao-desatualizada-" + width + ".png", animations:"disabled"});

      item.pendingRevision = false;
      item.analysis.reply = {state:"no_quota", text:null, evidenceIds:[]};
      await page.reload();
      await suggestion.getByText(/liberação do limite de análise/).waitFor();
      assert.deepEqual(errors, []);
      assert.ok(upstreamCalls > 0);
      console.log(JSON.stringify({width, ready:true, sourceOpened:true, writingToReady:true, staleBlocked:true, noQuota:true}));
    } finally {
      await context.close();
      await fixture.close();
    }
  }
} finally {
  await browser.close();
}
