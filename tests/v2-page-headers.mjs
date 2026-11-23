// Run against the compiled public bundle served by tests/fixtures/budget_usage.py.
import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";

const origin = new URL(process.env.SA_WEB_URL || "http://127.0.0.1:4399").origin;
assert.equal(new URL(origin).hostname,"127.0.0.1");
const health = await fetch(origin + "/healthz").then(response => response.json());
assert.equal(health.fixture,true);
const evidence = process.env.SA_EVIDENCE_DIR;
if (evidence) await mkdir(evidence,{recursive:true});
const browser = await chromium.launch({channel:"chrome"});
const summary = {conversations:1,opportunities:1,
  pendingWins:{count:0,amountCents:"0"},confirmedWins:{count:0,amountCents:"0"}};
const emptyPage = {items:[],nextCursor:null};
const radarPage = {items:[{id:"50000000-0000-4000-8000-000000000001",title:"Marina Costa",
  summary:"Pediu o link de pagamento",priority:"high"}],nextCursor:null};

try {
  for (const width of [1440,390]) {
    const context = await browser.newContext({viewport:{width,height:width < 600 ? 844 : 900},serviceWorkers:"block"});
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on("pageerror",error => errors.push(error.message));
    await context.route(/^https?:/,route => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      errors.push("Requisição externa");
      return route.abort();
    });
    await context.route("**/api/v2/summary",route => route.fulfill({json:summary}));
    await context.route(/\/api\/v2\/radar(?:\?.*)?$/,route => route.fulfill({json:radarPage}));
    await context.route("**/api/v2/conversations?*",route => route.fulfill({json:emptyPage}));
    await context.route(/\/api\/v2\/alerts(?:\?.*)?$/,route => route.fulfill({json:{items:[{id:"alerta-1",title:"Venda em risco",kind:"risk",fromHistory:true}],nextCursor:null}}));
    try {
      for (const [hash,title] of [["dashboard","Panorama comercial"],["resultados","Ganhos"],
        ["uso","Uso da empresa"],["diagnosticos","Diagnósticos"],
        ["radar","Radar de recuperação"],["oportunidades","Negociações"],["alertas","Alertas"]]) {
        await page.goto(origin + "/#" + hash);
        const heading = page.getByRole("heading",{name:title,exact:true});
        await heading.waitFor();
        const tile = heading.locator("xpath=..").locator('span[aria-hidden="true"]');
        assert.equal(await tile.count(),1,title + " deve ter um ícone no cabeçalho");
        assert.equal(await tile.locator("svg").count(),1,title + " deve usar um ícone SVG");
        const box = await tile.boundingBox();
        assert.equal(Math.round(box.width),40,title + " deve usar o bloco de 40 px");
        assert.equal(Math.round(box.height),40,title + " deve usar o bloco de 40 px");
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          title + " não deve gerar rolagem horizontal");
        if (["dashboard","resultados"].includes(hash)) {
          await page.getByText("Versão do painel",{exact:true}).waitFor();
          const stats = page.getByRole("list",{name:"Operação comercial"});
          await stats.waitFor();
          const head = heading.locator("xpath=ancestor::header[1]");
          const [statsBox,headBox] = await Promise.all([stats.boundingBox(),head.boundingBox()]);
          assert.ok(statsBox.width >= headBox.width * 0.9,title + " deve ocupar a largura da página");
        }
        if (["radar","oportunidades"].includes(hash)) {
          const head = heading.locator("xpath=ancestor::header[1]");
          const headBox = await head.boundingBox();
          assert.ok(headBox.height <= (width === 390 ? 110 : 70),title + " deve ter cabeçalho compacto");
          assert.equal(await head.getByRole("link",{name:"Abrir diagnósticos"}).getAttribute("href"),"#diagnosticos",
            title + " deve manter a ação");
          const search = page.getByPlaceholder("Buscar contato ou sinal…");
          await search.waitFor();
          const body = search.locator("xpath=ancestor::div[contains(@class, 'flow')][1]");
          const bodyBox = await body.boundingBox();
          assert.ok(bodyBox.width >= headBox.width * 0.9,title + " deve ocupar a largura da página");
          await page.getByRole("link",{name:/Marina Costa/}).waitFor();
        }
        if (evidence) await page.screenshot({path:evidence + "/cabecalho-" + hash + "-" + width + ".png",animations:"disabled"});
      }
      assert.deepEqual(errors,[]);
      console.log(JSON.stringify({revision:health.revision,width,headers:7,tiles:"40x40",overflow:false}));
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
