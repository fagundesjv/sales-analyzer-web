import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {setTimeout as delay} from "node:timers/promises";
import {browser, createPage, errors, origin, shot, visible} from "./v2-browser.mjs";

const watchdog = setTimeout(() => {console.error("Tempo total do ensaio excedido.");process.exit(124);},90000).unref();
const scope = session => ({"X-V2-Context":session.user.id+"/"+session.workspace.id});
async function pilotPage(role,width) {
  for (let attempt=1;attempt<=3;attempt++) {
    const before=new Set(browser.contexts());
    try {
      console.log("Iniciando a sessão de teste para",role,width);
      return await createPage(role,width,"crm");
    } catch (error) {
      for (const ctx of browser.contexts())
        if (!before.has(ctx)) await Promise.race([ctx.close(),delay(1500)]);
      if (error.actual!==503 || attempt===3) throw error;
      console.log("GoTrue devolveu 503 em conta fictícia. Repetindo o login no ensaio local.");
      await delay(attempt*1000);
    }
  }
}

async function api(client,path){
  const response=await client.ctx.request.get(origin+"/api/v2/"+path,{headers:scope(client.session)});
  assert.equal(response.status(),200);
  return response.json();
}
async function action(page, method, path, button, status) {
  const ready=page.waitForResponse(r=>r.url()===origin+"/api/v2/"+path && r.request().method()===method);
  await button.click();
  const result=await ready;
  const body=await result.json();
  assert.equal(result.status(),status,JSON.stringify(body));
  return body;
}
async function scenario(width) {
  const client=await pilotPage("manager",width);
  const {page}=client;
  try {
    await visible(page.getByRole("heading",{name:"Pipeline comercial",exact:true}));
    console.log("Pipeline renderizado em",width);
    const first=page.getByRole("region",{name:"Proposta",exact:true});
    await visible(first.getByRole("article"));
    const directory=await api(client,"pipelines?limit=100");
    const primary=directory.defaultPipelineId;
    const state=await api(client,"pipelines/"+primary+"?limit=8");
    const lane=state.stages[0];
    assert(lane.total>=67);
    assert.equal(lane.items.length,8);
    const pager=first.getByRole("navigation",{name:"Páginas de Proposta"});
    await pager.getByRole("button",{name:"Próxima",exact:true}).click();
    await visible(pager.getByText("Página 2",{exact:true}));
    const second=await api(client,"pipelines/"+primary+"/stages/"+lane.id+"/cards?limit=8&cursor="+lane.nextCursor);
    await visible(first.locator('a[href="#entrada/todos/'+second.items[0].id+'"]'));
    await pager.getByRole("button",{name:"Anterior",exact:true}).click();
    const selected = lane.items[0];
    const card=first.getByRole("article").filter({has:page.locator('a[href="#entrada/todos/'+selected.id+'"]')});
    await visible(card);
    await page.getByRole("heading",{name:"Pipeline comercial",exact:true}).scrollIntoViewIfNeeded();
    await shot(page,"pipeline-"+width);
    console.log("Paginação confirmada em",width);
    const label="Funil QA "+randomUUID().slice(0,8);
    await page.getByRole("button",{name:"Novo funil",exact:true}).click();
    const dialog=page.getByRole("dialog");
    await dialog.getByLabel("Nome do funil",{exact:true}).fill(label);
    await dialog.getByLabel("Etapa 2",{exact:true}).fill("Qualificação");
    const custom=await action(page,"POST","pipelines",dialog.getByRole("button",{name:"Salvar funil",exact:true}),201);
    await visible(page.getByRole("region",{name:"Qualificação",exact:true}));
    const selector=page.getByLabel("Funil",{exact:true});
    await selector.selectOption(primary);
    await visible(card);
    await card.getByRole("button",{name:/Mover negociação/}).click();
    await dialog.getByLabel("Funil de destino",{exact:true}).selectOption(custom.id);
    await dialog.getByLabel("Etapa de destino",{exact:true}).selectOption(custom.stages[1].id);
    const moved=await action(page,"PUT","conversations/"+selected.id+"/pipeline",dialog.getByRole("button",{name:"Confirmar movimento",exact:true}),200);
    assert.equal(moved.stageId,custom.stages[1].id);
    assert.equal(moved.version,1);
    await visible(page.getByText("Negociação movida.",{exact:true}));
    await page.reload();
    await visible(selector);
    await selector.selectOption(custom.id);
    const target=page.getByRole("region",{name:"Qualificação",exact:true});
    const link=target.locator('a[href="#entrada/todos/'+selected.id+'"]');
    await visible(link);
    await shot(page,"pipeline-movido-"+width);

    await page.getByRole("button",{name:"Editar funil",exact:true}).click();
    const text=dialog.getByLabel("Etapa 2",{exact:true});
    await text.fill("Revisão de proposta");
    const renamed=await action(page,"PATCH","pipelines/"+custom.id,dialog.getByRole("button",{name:"Salvar funil",exact:true}),200);
    assert.equal(renamed.stages[1].id,custom.stages[1].id);
    await visible(page.getByRole("region",{name:"Revisão de proposta",exact:true}).locator('a[href="#entrada/todos/'+selected.id+'"]'));
    await page.getByRole("button",{name:"Editar funil",exact:true}).click();
    await dialog.getByRole("button",{name:"Remover etapa 2",exact:true}).click();
    const conflict=await action(page,"PATCH","pipelines/"+custom.id,dialog.getByRole("button",{name:"Salvar funil",exact:true}),409);
    assert.equal(conflict.error.code,"pipeline_stage_in_use");
    await visible(dialog.getByRole("alert").getByText("Mova os cartões antes de remover a etapa.",{exact:true}));
    await page.keyboard.press("Escape");

    const seller=await pilotPage("seller",width);
    try {
      const sellerState=await api(seller,"pipelines/"+primary);
      const cards=sellerState.stages.flatMap(x=>x.items);
      assert(cards.length>0 && cards.every(x=>x.ownerId===seller.session.user.id));
      assert.equal(await seller.page.getByRole("button",{name:"Editar funil",exact:true}).count(),0);
      assert.equal(await seller.page.getByLabel("Responsável",{exact:true}).count(),0);
      assert.equal(await seller.page.getByRole("button",{name:"Novo funil",exact:true}).count(),0);
    } finally {await seller.ctx.close();}
    console.log(JSON.stringify({width,paginated:true,createFunnel:true,movePersists:true,renameKeepsCard:true,occupiedConflict:true,sellerScoped:true}));
  } finally {
    await client.ctx.close();
  }
}
try {
  for (const width of [1440,390]) await scenario(width);
  assert.deepEqual(errors,[]);
} finally {await browser.close();clearTimeout(watchdog);}
