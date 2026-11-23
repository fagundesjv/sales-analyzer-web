import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {setTimeout as delay} from "node:timers/promises";
import {browser,createPage,errors,origin,shot,visible} from "./v2-browser.mjs";

const watchdog=setTimeout(()=>{console.error("Tempo total do ensaio de alertas excedido.");process.exit(124);},120000).unref();
const context=session=>session.user.id+"/"+session.workspace.id;
async function session(role,width) {
  for(let attempt=1;attempt<=3;attempt++) {
    const existing=new Set(browser.contexts());
    try {return await createPage(role,width,"alertas");}
    catch(error) {
      for(const ctx of browser.contexts())
        if(!existing.has(ctx)) await Promise.race([ctx.close(),delay(1500)]);
      if(error.actual!==503 || attempt===3)throw error;
      console.log("503 transitório no login fictício",role,width);
      await delay(attempt*1200);
    }
  }
}
async function api(client,path,method="GET",data) {
  const response=await client.ctx.request.fetch(origin+"/api/v2/"+path,{method,data,headers:{
    "X-V2-Context":context(client.session),Origin:origin,
    ...(method!=="GET"?{"Idempotency-Key":randomUUID()}:{})}});
  const body=await response.json();
  assert.equal(response.status(),200,JSON.stringify(response.status()>=400?body:"status inesperado"));
  return body;
}
async function perform(page,method,path,button,status) {
  const pending=page.waitForResponse(r=>r.url()===origin+"/api/v2/"+path&&r.request().method()===method);
  await button.click();
  const response=await pending;
  const data=await response.json();
  assert.equal(response.status(),status,JSON.stringify(data));
  return data;
}
const type=page=>page.getByLabel("Tipo de alerta",{exact:true});
const rules=page=>page.getByRole("button",{name:"Regras de alerta",exact:true});
async function sellerView(width) {
  const actor=await session("seller",width);
  const {page}=actor;
  try {
    await visible(page.getByRole("heading",{name:"Alertas",exact:true}));
    assert.equal(await rules(page).count(),0);
    await type(page).selectOption("loss");
    const rows=await api(actor,"alerts?kind=loss");
    const loss=rows.items.find(row=>row.detail.startsWith("Prazo incompatível"));
    assert(loss);
    const item=page.getByRole("listitem").filter({hasText:loss.title});
    await visible(item);
    await visible(item.getByText(/Venda perdida/));
    assert.equal(await item.getByRole("link").getAttribute("href"),"#entrada/todos/"+loss.conversationId);
    const mark=item.getByRole("button",{name:"Marcar como lido — "+loss.title,exact:true});
    const unmark=item.getByRole("button",{name:"Marcar como não lido — "+loss.title,exact:true});
    assert((await perform(page,"PUT","alerts/"+loss.id+"/read",mark,200)).readAt);
    await visible(unmark);
    await page.reload();
    await type(page).selectOption("loss");
    await page.getByRole("button",{name:"Lidos",exact:true}).click();
    await visible(unmark);
    await shot(page,"alertas-lidos-"+width);
    assert.equal((await perform(page,"PUT","alerts/"+loss.id+"/read",unmark,200)).readAt,null);
    await visible(page.getByText("Nenhum alerta neste recorte.",{exact:true}));
    await page.getByRole("button",{name:"Não lidos",exact:true}).click();
    await visible(mark);
    assert.equal(await rules(page).count(),0);
  } finally {await actor.ctx.close();}
}
async function managerView(width) {
  const actor=await session("manager",width);
  const {page}=actor;
  try {
    await type(page).selectOption("risk");
    await visible(page.getByRole("list",{name:"Lista de alertas"}));
    const previous=await api(actor,"alerts/settings");
    await rules(page).click();
    const dialog=page.getByRole("dialog",{name:"Regras de alerta"});
    const risk=dialog.getByRole("checkbox",{name:"Mostrar vendas em risco",exact:true});
    const bridge=dialog.getByRole("checkbox",{name:"Mostrar desconexões confirmadas do WhatsApp",exact:true});
    const submit=dialog.getByRole("button",{name:"Salvar regras",exact:true});
    await visible(risk);
    assert(await risk.isChecked());
    await api(actor,"alerts/settings","PATCH",{version:previous.version,disconnected:!previous.disconnected});
    await risk.uncheck();
    const conflict=await perform(page,"PATCH","alerts/settings",submit,409);
    assert.equal(conflict.error.code,"alert_settings_conflict");
    await visible(dialog.getByRole("alert").getByText(/As regras mudaram/));
    await dialog.getByRole("button",{name:"Recarregar regras",exact:true}).click();
    await visible(risk);
    assert(await risk.isChecked());
    await risk.uncheck();
    await shot(page,"alertas-regras-"+width);
    const saved=await perform(page,"PATCH","alerts/settings",submit,200);
    assert.equal(saved.risk,false);
    await visible(page.getByText("Regras salvas.",{exact:true}));
    await visible(page.getByText("Nenhum alerta neste recorte.",{exact:true}));
    await rules(page).click();
    await risk.check();
    await bridge.setChecked(previous.disconnected);
    assert.equal((await perform(page,"PATCH","alerts/settings",submit,200)).risk,true);
    await visible(page.getByRole("list",{name:"Lista de alertas"}));
    const pager=page.getByRole("navigation",{name:"Páginas de alertas"});
    await pager.getByRole("button",{name:"Próxima",exact:true}).click();
    await visible(pager.getByText("Página 2",{exact:true}));
    await visible(page.getByRole("list",{name:"Lista de alertas"}));
    await shot(page,"alertas-pagina-"+width);
  } finally {await actor.ctx.close();}
}
try {
  for(const width of [1440,390]){
    await sellerView(width);
    await managerView(width);
    console.log(JSON.stringify({width,personalReceiptPersists:true,filterReadAndKind:true,
      managerRulesPersist:true,settingsConflict:true,pagination:true,sellerSettingsHidden:true}));
  }
  assert.deepEqual(errors,[]);
} finally {await browser.close();clearTimeout(watchdog);}
