// Start tests/fixtures/budget_usage.py with the compiled Web bundle first.
import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";

const origin = new URL(process.env.SA_WEB_URL || "http://127.0.0.1:4399").origin;
assert.equal(new URL(origin).hostname,"127.0.0.1");
const health = await fetch(origin+"/healthz").then(response => response.json());
assert.equal(health.fixture,true);
const evidence = process.env.SA_EVIDENCE_DIR;
if (evidence) await mkdir(evidence,{recursive:true});
const now = new Date();
const month = offset => new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-offset,1)).toISOString().slice(0,7);
const blockText = "Novos envios para análise bloqueados neste mês";
const diagnostic = "A análise não iniciou porque o contador de tokens de entrada estava indisponível.";
const browser = await chromium.launch({channel:"chrome"});

async function scenario(width) {
  const context = await browser.newContext({viewport:{width,height:width < 600 ? 844 : 900},serviceWorkers:"block"});
  const unexpected = [];
  await context.route(/^https?:/, route => {
    const req = route.request();
    if (new URL(req.url()).origin === origin && req.method() === "GET") return route.continue();
    unexpected.push(req.method());
    return route.abort();
  });
  const page = await context.newPage();
  page.on("pageerror",e => unexpected.push(e.message));
  page.on("requestfailed",request => {
    if (request.resourceType() === "stylesheet") unexpected.push(request.url());
  });
  page.setDefaultTimeout(8000);
  const exact = text => page.getByText(text,{exact:true});
  async function amount(label,expected) {
    const value = exact(label).locator("..").locator("dd");
    await value.filter({hasText:expected}).waitFor();
    assert.equal(await value.innerText(),expected);
  }
  async function capture(name,anchor) {
    await anchor.evaluate(el => el.scrollIntoView({block:"center",behavior:"instant"}));
    await page.evaluate(() => document.fonts.ready);
    if (name.startsWith("uso-")) {
      const row = exact("Custo liquidado").locator("..");
      assert.equal(await row.evaluate(el => getComputedStyle(el).display),"grid");
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1));
    if (evidence) await page.screenshot({path:evidence+"/"+name+"-"+width+".png",animations:"disabled"});
  }
  try {
    await page.goto(origin+"/#uso");
    await exact(blockText).waitFor();
    await amount("Saldo disponível","US$ 0,00");
    await amount("Reserva total","US$ 1,234567");
    await amount("Parcela indeterminada da reserva","US$ 0,234567");
    await amount("Custo liquidado","US$ 2,500123");
    await capture("uso-bloqueado",exact(blockText));

    const period = page.getByLabel("Mês de referência (UTC)");
    await period.fill(month(1));
    await amount("Saldo disponível","US$ 6,26531");
    assert.equal(await exact(blockText).count(),0);
    await page.getByText(/tokens confirmados pelo provedor/).waitFor();
    await page.getByText(/A fatura final é apurada pelo provedor/).waitFor();
    const tariff = exact("Tarifa vigente de controle do orçamento");
    await tariff.click();
    await amount("Versão da tarifa","controle-v3");
    await amount("Entrada por milhão de tokens","US$ 1,00");
    await capture("uso-medido",tariff);

    await period.fill(month(2));
    await exact("A análise dos diagnósticos usa uma tarifa simulada.").waitFor();
    await tariff.waitFor(); // Selected month and current tariff may have different modes.
    await capture("uso-simulado",exact("Custo de execução"));
    const api = "**/api/v2/budget/usage?*";
    async function changeReading(transform) {
      await page.unroute(api);
      await page.route(api,async route => {
        const res = await route.fetch();
        const data = await res.json();
        transform(data);
        await route.fulfill({json:data});
      });
      await page.reload();
    }
    await changeReading(data => {
      data.mode="local_simulated";
      delete data.cost.blockedReason;
      data.currentTariff.tokenizer="utf8-bytes-v1";
    });
    await exact("Tarifa simulada vigente").click();
    await amount("Limite de entrada","8.192 bytes UTF-8");
    await changeReading(data => {
      data.commercial={limitCalls:null,consumedCalls:0,reservedCalls:0};
      data.cost={currency:"USD",limitMicros:null,availableMicros:null,settledMicros:"0",
        reservedMicros:"0",indeterminateMicros:"0",authorizedCount:0,indeterminateCount:0,settledCount:0};
      data.currentTariff=null;
    });
    await period.fill(month(3));
    await exact("Ciclo sem histórico").waitFor();
    for (const invalid of [{workspaceId:"outra-empresa"},{period:month(1)},{scope:"outro"},{mode:"desconhecido"}]) {
      await changeReading(data => Object.assign(data,invalid));
      await page.getByRole("alert").filter({hasText:/outra empresa ou período|incompatível/}).waitFor();
      assert.equal(await exact("Custo liquidado").count(),0);
    }
    await page.goto(origin+"/#diagnosticos");
    const entry = page.getByRole("region",{name:"Histórico da conexão"}).locator("details").first();
    await entry.locator("summary").click();
    await entry.getByText(diagnostic,{exact:true}).waitFor();
    await entry.getByRole("button",{name:"Acompanhar execução"}).click();
    const alert = page.getByRole("region",{name:"Acompanhamento"}).getByRole("alert");
    await alert.getByText(diagnostic,{exact:true}).waitFor();
    await capture("contador-indisponivel",alert);
    await page.route("**/api/v2/session",async route => {
      const session=await (await route.fetch()).json();
      session.workspace.role="seller";
      session.workspaces=[session.workspace];
      await route.fulfill({json:session});
    });
    await page.unroute(api);
    const sellerUsage=[];
    page.on("request",r => {if(r.url().includes("/api/v2/budget/usage")) sellerUsage.push(r.method());});
    await page.goto(origin+"/?perfil=vendedor#uso");
    await exact("Somente gestores podem consultar o uso da empresa.").waitFor();
    assert.deepEqual(sellerUsage,[]);
    assert.deepEqual(unexpected,[]);
    console.log(JSON.stringify({revision:health.revision,width,simulated:true,metered:true,blockedAvailable:"0",
      preservedReserve:"1234567",isolation:true,diagnostic:"ai_input_count_unavailable"}));
  } finally { await context.close(); }
}
try { for (const width of [1440,390]) await scenario(width); }
finally { await browser.close(); }
