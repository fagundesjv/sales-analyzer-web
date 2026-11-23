import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";
import {json,startFixtureWeb} from "./fixtures/web-bff.mjs";

const bundle=process.argv[2], evidence=process.env.SA_EVIDENCE_DIR;
assert.ok(bundle,"Informe o pacote integrado.");
if (evidence) await mkdir(evidence,{recursive:true});

async function fixture(role) {
  const user={id:randomUUID(),name:"Pessoa de teste",email:"teste@example.test"};
  const workspace={id:randomUUID(),name:"Empresa de teste",role};
  const lines=["evolution","synthetic"].map(source=>({id:randomUUID(),source,name:source==="evolution"?"Comercial · Sul":"Linha de exemplo"}));
  const jobs=new Map(),receipts=new Map();
  const state={requests:[],sessions:0,postError:null,jobError:null,offPage:false,holdRunning:false};
  const makeJob=(line,hours=null,error=null)=>({id:randomUUID(),connectionId:line.id,createdAt:new Date().toISOString(),
    status:error?"failed":"completed",error,reconcileHours:hours,progress:100,
    report:error?null:{conversations:1,analyzed:1,reused:0,opportunities:1,source:line.source}});
  const web=await startFixtureWeb(bundle,0,async(req,res,path)=>{
    if (path==="session") {state.sessions++;return json(res,200,{user,workspace,workspaces:[workspace]});}
    if (req.headers["x-v2-context"]!==user.id+"/"+workspace.id) return json(res,403,{});
    if (path==="connections") return json(res,200,{items:state.offPage?lines.slice(1):lines,nextCursor:null});
    if (path==="connections/"+lines[0].id+"/status") return json(res,200,{...lines[0],connectionId:lines[0].id,status:"connected"});
    if (path==="diagnostics" && req.method==="GET") {
      const id=new URL(req.url,"http://localhost").searchParams.get("connectionId");
      return json(res,200,{items:[...jobs.values()].filter(j=>j.connectionId===id).reverse(),nextCursor:null});
    }
    if (path==="diagnostics" && req.method==="POST") {
      const chunks=[];
      for await (const chunk of req) chunks.push(chunk);
      const body=JSON.parse(Buffer.concat(chunks).toString()), key=req.headers["idempotency-key"];
      state.requests.push({body,key});
      const line=lines.find(item=>item.id===body.connectionId);
      if (!line || !key) return json(res,400,{});
      if ("reconcileHours" in body && (role!=="manager" || line.source!=="evolution")) return json(res,403,{});
      if (state.postError) return json(res,state.postError==="network" ? 503 : 409,{error:{code:state.postError,message:"Falha de teste"}});
      if (receipts.has(key)) return json(res,200,receipts.get(key));
      const result=makeJob(line,body.reconcileHours,state.jobError);
      jobs.set(result.id,result);
      const queued={...result,report:null,status:"queued",progress:0};
      receipts.set(key,queued);
      return json(res,201,queued);
    }
    const job=jobs.get(path.split("/")[1]);
    if (path.startsWith("diagnostics/") && job) return json(res,200,state.holdRunning ?
      {...job,status:"running",progress:55,report:null,error:null} : job);
    return json(res,404,{});
  });
  return {...web,lines,jobs,state,makeJob};
}

const browser=await chromium.launch({channel:"chrome"});
async function verify(width,role) {
  const f=await fixture(role);
  const {origin,state,lines,jobs}=f;
  const [line,synthetic]=lines;
  const ctx=await browser.newContext({viewport:{width,height:width===390?844:900},serviceWorkers:"block"});
  const page=await ctx.newPage(), errors=[];
  page.setDefaultTimeout(7000);
  await ctx.route(/^https?:/,route=>{
    if (new URL(route.request().url()).origin===origin) return route.continue();
    errors.push("Requisição externa");return route.abort();
  });
  page.on("pageerror",e=>errors.push(e.message));
  const btn=name=>page.getByRole("button",{name,exact:true});
  const choose=page.getByRole("combobox",{name:"Conexão"});
  const start=btn("Iniciar diagnóstico"),open=btn("Conciliar histórico");
  const again=btn("Revisar e repetir conciliação"),dialog=page.getByRole("dialog");
  const confirm=dialog.getByRole("button",{name:"Confirmar conciliação"});
  const period=h=>dialog.getByRole("radio",{name:h===1?"1 hora":h+" horas",exact:true});
  const live=page.getByRole("status");
  const history=page.locator("details summary");
  const n=()=>state.requests.length;
  const shot=async name=>{
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    if (evidence) await page.screenshot({path:evidence+"/"+name+"-"+width+".png",animations:"disabled"});
  };
  async function assertPeriod(hours) {assert.equal(await period(hours).getAttribute("aria-checked"),"true");}
  async function standard(id) {
    const before=n();await start.click();await live.filter({hasText:"Diagnóstico concluído"}).waitFor();
    assert.equal(n(),before+1);assert.deepEqual(state.requests.at(-1).body,{connectionId:id});
  }
  async function send(hours,failed=false) {
    const before=n();
    if (state.holdRunning) {
      await confirm.evaluate(button=>{button.click();button.click();});
      await live.filter({hasText:"Conciliação · "+hours+" h · Em análise"}).waitFor();
      assert.equal(await page.getByRole("progressbar",{name:"Progresso"}).getAttribute("value"),"55");
      assert.ok(await start.isDisabled());assert.equal(n(),before+1);
      state.holdRunning=false;
    } else await confirm.click();
    await dialog.waitFor({state:"hidden"});
    await live.filter({hasText:"Conciliação · "+hours+" h · "+(failed?"Falha no diagnóstico":"Diagnóstico concluído")}).waitFor();
    assert.equal(n(),before+1);assert.deepEqual(state.requests.at(-1).body,{connectionId:line.id,reconcileHours:hours});
    assert.match(state.requests.at(-1).key,/^[a-zA-Z0-9-]{36}$/);
  }
  try {
    await page.goto(origin+"/#diagnosticos");await choose.waitFor();assert.equal(n(),0);
    if (role==="manager") {
      await open.click();await assertPeriod(1);
      await dialog.getByText(/conversas que mudaram podem consumir créditos/i).waitFor();
      await period(24).click();await shot("confirmacao");assert.equal(n(),0);
      await page.keyboard.press("Escape");await dialog.waitFor({state:"hidden"});assert.equal(n(),0);
      await choose.selectOption(synthetic.id);assert.equal(await open.count(),0);
      await standard(synthetic.id);await choose.selectOption(line.id);
      await open.click();await assertPeriod(1);
      for (const [code,msg] of [["reconciliation_requires_import",/primeira importação/i],["diagnostic_already_active",/outro diagnóstico em andamento/i]]) {
        state.postError=code;
        const before=n();await confirm.click();await dialog.getByRole("alert").filter({hasText:msg}).waitFor();
        assert.equal(n(),before+1);assert.equal(await confirm.count(),0);
        await dialog.getByRole("button",{name:"Voltar ao diagnóstico"}).click();assert.equal(n(),before+1);
        await open.click();
      }
      state.postError="network";await period(6).click();await confirm.click();
      await dialog.getByRole("alert").waitFor();
      const retryKey=state.requests.at(-1).key;state.postError=null;state.jobError="evolution_reconciliation_limit";
      await send(6,true);assert.equal(state.requests.at(-1).key,retryKey);
      await page.getByRole("alert").filter({hasText:/40 páginas/}).first().getByText(/período menor/i).waitFor();
      const beforeRetry=n();await again.click();await assertPeriod(6);
      await page.keyboard.press("Escape");await dialog.waitFor({state:"hidden"});assert.equal(n(),beforeRetry);
      await page.reload();await again.click();await assertPeriod(6);await send(6,true);
      assert.notEqual(state.requests.at(-1).key,retryKey);
      await again.click();await period(1).click();await send(1,true);
      assert.equal(await page.getByRole("alert").filter({hasText:/período menor/i}).count(),0);
      await again.click();await assertPeriod(1);state.jobError=null;
      await period(24).click();state.holdRunning=true;await send(24);await history.filter({hasText:"Conciliação · 24 h"}).first().waitFor();
      await shot("historico");await standard(line.id);
      // Opening a report reached from another page of connections still targets its own line.
      const distant=f.makeJob(line,24,"evolution_reconciliation_limit");
      jobs.set(distant.id,distant);state.offPage=true;
      await page.goto(origin+"/#diagnosticos/"+distant.id);await page.reload();
      await again.click();await dialog.getByText(line.name,{exact:true}).waitFor();await assertPeriod(24);await send(24);
      state.jobError="ai_cost_indeterminate";state.offPage=false;await page.goto(origin+"/#diagnosticos");await page.reload();
      await open.click();await send(1,true);
      assert.equal(await again.count(),0);assert.equal(await open.count(),0);assert.equal(await start.count(),0);
    } else {
      assert.equal(await open.count(),0);await standard(line.id);
      const failed=f.makeJob(line,6,"evolution_reconciliation_limit");jobs.set(failed.id,failed);
      const before=n();await page.goto(origin+"/#diagnosticos/"+failed.id);
      await live.filter({hasText:"Conciliação · 6 h"}).waitFor();assert.equal(await again.count(),0);assert.equal(await open.count(),0);
      await choose.selectOption(synthetic.id);assert.equal(await open.count(),0);assert.equal(n(),before);
      await standard(synthetic.id);
    }
    assert.deepEqual(errors,[]);
    console.log("OK",width,role,f.revision,"requisições",n());
  } finally {await ctx.close();await f.close();}
}
try {for(const width of [1440,390]) for(const role of ["manager","seller"]) await verify(width,role);}
finally {await browser.close();}
