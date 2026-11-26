import assert from "node:assert/strict";

// Uses the authenticated browser and the real BFF/API of the isolated integrated stack.
export async function exerciseOpportunities({page, context, conversationId, width}) {
  async function read(path) {
    const result = await page.evaluate(async ({path, context}) => {
      const response = await fetch("/api/v2/" + path, {headers:{"X-V2-Context":context}, cache:"no-store"});
      return {status:response.status, data:await response.json()};
    }, {path, context});
    assert.equal(result.status, 200, "Consulta autorizada do ledger local.");
    return result.data;
  }
  const before = await read("opportunities/summary");
  assert.equal(before.period, "all_time"); assert.equal(before.scope, "authorized_opportunities");
  const panel = page.getByRole("region", {name:"Pedidos desta conversa", exact:true});
  const selected = panel.getByRole("region", {name:"Pedido selecionado", exact:true});
  const totals = panel.getByRole("region", {name:"Ganhos dos pedidos autorizados", exact:true});
  const stamp = width + "-" + Date.now();
  const titles = ["Compra A " + stamp, "Compra B " + stamp];
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
    const saved = page.waitForResponse(response => response.url().includes("/api/v2/opportunities/")
      && response.url().endsWith("/outcome") && response.request().method() === "PUT");
    await dialog.getByRole("button", {name:"Confirmar ganho do pedido", exact:true}).click();
    const response = await saved;
    const result = await response.json();
    assert.equal(response.status(), 200, "Ganho manual retornou " + response.status() + " " + (result.error?.code || ""));
    await selected.getByText("Ganho", {exact:true}).waitFor();
  }
  await create(titles[0]); await win("100,00");
  await create(titles[1]); await win();
  const after = await read("opportunities/summary");
  assert.equal(after.sales, before.sales + 2);
  assert.equal(after.salesWithoutAmount, before.salesWithoutAmount + 1);
  assert.equal(BigInt(after.amountCents), BigInt(before.amountCents) + 10000n);
  await totals.getByText(after.sales + (after.sales === 1 ? " venda" : " vendas"), {exact:true}).waitFor();
  const list = await read("conversations/" + conversationId + "/opportunities?limit=100");
  const [first, second] = titles.map(title => list.items.find(item => item.title === title));
  assert.ok(first && second);
  assert.equal(first.customerId, second.customerId); assert.notEqual(first.id, second.id);
  assert.equal(first.conversationId, conversationId); assert.equal(second.conversationId, conversationId);
  assert.equal(first.status, "won"); assert.equal(second.status, "won");
  assert.equal(first.outcome.amountCents, 10000); assert.equal(second.outcome.amountCents, null);
  assert.equal(first.outcome.origin, "manual"); assert.ok(first.outcome.confirmedAt && second.outcome.confirmedAt);
  assert.ok(first.version > 0 && second.version > 0);
  await panel.evaluate(element => element.scrollIntoView({block:"center"}));
  if (process.env.SA_EVIDENCE_DIR) await page.screenshot({
    path:process.env.SA_EVIDENCE_DIR + "/pedidos-integrados-duas-vendas-" + width + ".png", animations:"disabled",
  });

  await selected.getByRole("button", {name:"Registrar perda", exact:true}).click();
  const loss = page.getByRole("dialog", {name:"Registrar perda do pedido", exact:true});
  await loss.getByLabel("Motivo da perda", {exact:true}).fill("Correção da segunda compra no ensaio local");
  await loss.getByRole("button", {name:"Confirmar perda do pedido", exact:true}).click();
  await selected.getByText("Perdido", {exact:true}).waitFor();
  const firstAfter = await read("opportunities/" + first.id), secondAfter = await read("opportunities/" + second.id);
  assert.equal(firstAfter.status, "won"); assert.equal(firstAfter.version, first.version);
  assert.equal(secondAfter.status, "lost"); assert.equal(secondAfter.version, second.version + 1);
  assert.deepEqual(firstAfter.outcome, first.outcome);
  const corrected = await read("opportunities/summary");
  assert.equal(corrected.sales, before.sales + 1);
  assert.equal(corrected.salesWithoutAmount, before.salesWithoutAmount);
  return {createdThroughUi:2, sameCustomer:true, immediateManualWins:true, unknownAmount:true,
    firstGainPreservedAfterSecondLoss:true, firstId:first.id, secondId:second.id};
}
