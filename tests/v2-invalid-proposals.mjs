// Local browser contract fixture. Only diagnostic jobs and their connection are simulated.
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {browser, createPage, errors, origin, shot, visible} from "./v2-browser.mjs";

const label = "Respostas descartadas por validação";
const note = "As respostas descartadas ficam fora do relatório comercial.";
const costMessage = "O consumo desta análise ainda está em verificação.";

async function scenario(width) {
  const {page,ctx} = await createPage("seller", width, "empresa");
  try {
    const line = {id:randomUUID(), name:"Linha de teste", source:"synthetic", status:"connected"};
    const legacy = {
      id:randomUUID(), connectionId:line.id, status:"completed", progress:100,
      createdAt:"2026-11-18T10:00:00Z", error:null,
      report:{source:"synthetic", conversations:3, analyzed:2, reused:1, opportunities:1},
    };
    const current = {...legacy, id:randomUUID(), createdAt:"2026-11-19T10:00:00Z",
      report:{...legacy.report, conversations:7, analyzed:5, reused:2, inconclusive:1, invalidProposals:2, opportunities:3}};
    const pendingCost = {...current, id:randomUUID(), createdAt:"2026-11-20T10:00:00Z",
      status:"failed", progress:0, error:"ai_cost_indeterminate", report:null};
    const history = [legacy];
    let starts = 0;
    await page.route("**/api/v2/connections?*", route => route.fulfill({json:{items:[line],nextCursor:null}}));
    await page.route("**/api/v2/diagnostics**", async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === "/api/v2/diagnostics") {
        if (request.method() === "GET") {
          assert.equal(url.searchParams.get("connectionId"),line.id);
          return route.fulfill({json:{items:history,nextCursor:null}});
        }
        assert.equal(request.method(),"POST");
        assert.deepEqual(request.postDataJSON(),{connectionId:line.id});
        starts++;
        history.unshift(current);
        return route.fulfill({status:202,json:{...current,status:"queued",progress:0,report:null}});
      }
      const job = history.find(item => url.pathname === "/api/v2/diagnostics/"+item.id);
      assert.ok(job);
      return route.fulfill({json:job});
    });
    const track = page.getByRole("region",{name:"Acompanhamento"});
    const archived = page.getByRole("region",{name:"Histórico da conexão"});
    const start = page.getByRole("button",{name:"Iniciar diagnóstico",exact:true});
    async function checkCount(region, title, expected) {
      const term = region.getByText(title,{exact:true});
      await visible(term);
      assert.equal(await term.locator("..").locator("dd").innerText(),String(expected));
    }
    async function checkDiscarded(region) {
      await checkCount(region,label,2);
      await checkCount(region,"Inconclusivas",1);
      await checkCount(region,"Oportunidades",3);
      await visible(region.getByText(note,{exact:true}));
    }
    async function captureCount(region,name) {
      await region.getByText(label,{exact:true}).evaluate(el => el.scrollIntoView({block:"center",behavior:"instant"}));
      await shot(page,name+"-"+width);
    }
    await page.goto(origin+"/#diagnosticos");
    await start.click();
    await checkDiscarded(track);
    await captureCount(track,"respostas-descartadas-resultado");
    await page.reload();
    await checkDiscarded(track);
    const latest = archived.locator("details").first();
    await latest.locator("summary").click();
    await checkDiscarded(latest);
    await captureCount(latest,"respostas-descartadas-historico");

    const older = archived.locator("details").nth(1);
    await older.locator("summary").click();
    await checkCount(older,"Conversas",3);
    assert.equal(await older.getByText(label,{exact:true}).count(),0);
    assert.equal(await older.getByText(note,{exact:true}).count(),0);
    await older.getByRole("button",{name:"Acompanhar execução"}).click();
    await checkCount(track,"Conversas",3);
    assert.equal(await track.getByText(label,{exact:true}).count(),0);

    history.unshift(pendingCost);
    await page.reload();
    await visible(page.getByText(costMessage,{exact:false}).first());
    const failed = archived.locator("details").first();
    await failed.locator("summary").click();
    await failed.getByRole("button",{name:"Acompanhar execução"}).click();
    await visible(track.getByRole("alert").getByText(costMessage,{exact:false}));
    assert.equal(await track.getByText(label,{exact:true}).count(),0);
    assert.equal(await start.count(),0);
    assert.equal(await page.getByRole("button",{name:"Tentar diagnóstico novamente"}).count(),0);
    assert.equal(starts,1);
    await shot(page,"respostas-descartadas-custo-em-verificacao-"+width);
    console.log(JSON.stringify({width,resultCount:2,historyCount:2,legacyWithoutField:true,costStillPending:true}));
  } finally { await ctx.close(); }
}
try {
  for (const width of [1440,390]) await scenario(width);
  assert.deepEqual(errors,[]);
} finally { await browser.close(); }
