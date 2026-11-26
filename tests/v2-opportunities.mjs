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

async function scenario(width, enabled) {
  const user = {id:randomUUID(), name:"Operador de teste", email:"operador@example.test"};
  const workspace = {id:randomUUID(), name:"Empresa de teste", role:"seller"};
  const item = {id:randomUUID(), title:"Cliente de duas compras", summary:"Pedido de orçamento", source:"synthetic", evidence:[]};
  const customerId = randomUUID();
  const legacy = {id:randomUUID(), conversationId:item.id, customerId, legacy:true, title:"Pedido histórico", status:"open", outcome:null, version:0};
  const opportunities = [legacy], receipts = new Map();
  const state = {calls:0, stale:false, blocked:false, outcomes:0};
  function summary() {
    const wins = opportunities.filter(record => record.status === "won");
    return {period:"all_time", scope:"authorized_opportunities", customerIdentity:"source_conversation",
      opportunities:opportunities.length, customers:1, sales:wins.length,
      salesWithoutAmount:wins.filter(record => record.outcome.amountCents === null).length,
      amountCents:String(wins.reduce((sum, record) => sum + (record.outcome.amountCents || 0), 0))};
  }
  const fixture = await startFixtureWeb(bundle, 0, async (req, res, path) => {
    if (path === "session") return json(res, 200, {user, workspace, workspaces:[workspace], ...(enabled ? {capabilities:{opportunities:true}} : {})});
    if (req.headers["x-v2-context"] !== user.id + "/" + workspace.id) return json(res, 403, {});
    if (path === "focus") return json(res, 200, {round:null});
    if (path === "conversations") return json(res, 200, {items:[item], nextCursor:null});
    if (path === "conversations/" + item.id) return json(res, 200, item);
    if (path.endsWith("/attendance")) return json(res, 200, {available:false, messages:[]});
    if (!path.includes("opportunities")) return json(res, 404, {});
    state.calls++;
    assert.ok(enabled, "A flag ausente não pode consultar o ledger novo.");
    if (state.blocked) return json(res, 403, {error:{code:"forbidden", message:"Acesso indisponível."}});
    if (path === "opportunities/summary") return json(res, 200, summary());
    const create = path === "conversations/" + item.id + "/opportunities";
    if (create && req.method === "GET") return json(res, 200, {items:opportunities, nextCursor:null});
    const [, id, action] = path.split("/");
    const record = opportunities.find(candidate => candidate.id === id);
    if (record && req.method === "GET") return json(res, 200, {...record, history:{items:[], limited:false}});
    let text = ""; for await (const part of req) text += part;
    const body = JSON.parse(text), key = req.headers["idempotency-key"];
    assert.ok(key);
    if (receipts.has(key)) return json(res, 200, receipts.get(key));
    if (create && req.method === "POST") {
      const made = {...legacy, id:randomUUID(), title:body.title, legacy:false};
      opportunities.push(made); receipts.set(key, made); return json(res, 201, made);
    }
    if (action === "outcome" && req.method === "PUT" && record) {
      assert.equal(record.legacy, false);
      if (state.stale) {state.stale=false; record.version++;}
      if (body.expectedVersion !== record.version) return json(res, 409, {error:{code:"opportunity_version_conflict", message:"Atualize a negociação antes de continuar."}});
      record.version++; record.status=body.status;
      record.outcome={...body, origin:"manual", confirmedAt:new Date().toISOString(), amountCents:body.amountCents ?? null, credit:{by:"unknown"}};
      state.outcomes++; receipts.set(key, {...record}); return json(res, 200, record);
    }
    return json(res, 404, {});
  });
  const context = await browser.newContext({viewport:{width, height:width < 600 ? 844 : 900}});
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await context.route(/^https?:/, route => {
    if (new URL(route.request().url()).origin === fixture.origin) return route.continue();
    errors.push("Requisição externa"); return route.abort();
  });
  const panel = page.getByRole("region", {name:"Pedidos desta conversa", exact:true});
  const selected = panel.getByRole("region", {name:"Pedido selecionado", exact:true});
  const totals = panel.getByRole("region", {name:"Ganhos dos pedidos autorizados", exact:true});
  async function create(title) {
    await panel.getByRole("button", {name:"Novo pedido", exact:true}).click();
    const dialog = page.getByRole("dialog", {name:"Novo pedido", exact:true});
    await dialog.getByLabel("Nome do pedido", {exact:true}).fill(title);
    await dialog.getByRole("button", {name:"Criar pedido", exact:true}).click();
    await selected.getByText(title, {exact:true}).waitFor();
  }
  async function win(amount) {
    await selected.getByRole("button", {name:"Registrar ganho", exact:true}).click();
    const dialog = page.getByRole("dialog", {name:"Registrar ganho do pedido", exact:true});
    if (amount) {
      await dialog.getByRole("checkbox", {name:"Valor ainda desconhecido"}).uncheck();
      await dialog.getByRole("textbox", {name:"Valor da venda do pedido"}).fill(amount);
    }
    await dialog.getByRole("button", {name:"Confirmar ganho do pedido", exact:true}).click();
    return dialog;
  }
  try {
    await page.goto(fixture.origin + "/#entrada/todos/" + item.id);
    if (!enabled) {
      await page.getByRole("button", {name:"Desfecho", exact:true}).waitFor();
      assert.equal(await panel.count(), 0); assert.equal(state.calls, 0);
      return;
    }
    await selected.getByText(/Pedido legado/).waitFor();
    assert.equal(await selected.getByRole("button", {name:"Registrar ganho"}).count(), 0);
    assert.equal(await page.getByRole("button", {name:"Desfecho", exact:true}).count(), 0);
    await create("Compra A"); await win("100,00");
    await totals.getByText("1 venda", {exact:true}).waitFor();
    await create("Compra B"); await win();
    await totals.getByText("2 vendas", {exact:true}).waitFor();
    assert.equal(opportunities[1].status, "won"); assert.equal(opportunities[2].status, "won");
    assert.equal(opportunities[1].customerId, opportunities[2].customerId);
    assert.equal(summary().amountCents, "10000"); assert.equal(summary().salesWithoutAmount, 1);
    await selected.getByText("Ainda desconhecido", {exact:true}).waitFor();
    await selected.getByText("Crédito ainda sem base suficiente", {exact:true}).waitFor();
    await panel.evaluate(element => element.scrollIntoView({block:"center"}));
    if (shots) await page.screenshot({path:shots + "/duas-compras-" + width + ".png", animations:"disabled"});

    state.stale=true;
    const conflict = await win();
    await conflict.getByRole("alert").getByText(/Atualize a negociação/).waitFor();
    assert.ok(await conflict.getByRole("button", {name:"Confirmar ganho do pedido"}).isDisabled());
    assert.equal(state.outcomes, 2);
    await conflict.getByRole("button", {name:"Reler pedido"}).click();
    await selected.getByText("Compra B", {exact:true}).waitFor();
    await selected.getByRole("button", {name:"Registrar perda", exact:true}).click();
    const loss = page.getByRole("dialog", {name:"Registrar perda do pedido", exact:true});
    await loss.getByLabel("Motivo da perda", {exact:true}).fill("Desistiu da segunda compra");
    await loss.getByRole("button", {name:"Confirmar perda do pedido", exact:true}).click();
    await totals.getByText("1 venda", {exact:true}).waitFor();
    assert.equal(opportunities[1].status, "won"); assert.equal(opportunities[2].status, "lost");
    await page.reload();
    await totals.getByText("1 venda", {exact:true}).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    state.blocked=true; await page.reload();
    await panel.getByRole("alert").first().waitFor();
    assert.equal(await selected.count(), 0);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({width, enabled, sameCustomerTwoWins:true, unknownAmount:true, staleBlocked:true, secondLossPreservesFirst:true, accessRevoked:true}));
  } finally {await context.close(); await fixture.close();}
}
try {
  for (const width of [1440, 390]) {await scenario(width, false); await scenario(width, true);}
} finally {await browser.close();}
