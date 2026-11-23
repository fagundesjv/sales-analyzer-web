import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {chromium} from "playwright";
import {json,startFixtureWeb} from "./fixtures/web-bff.mjs";

const bundle=process.argv[2];
assert.ok(bundle,"Informe o diretório do pacote Web compilado.");
const browser=await chromium.launch({channel:"chrome"});
const runLabels={queued:"Na fila",running:"Em análise",completed:"Diagnóstico concluído"};
const reconnect="Restabelecendo conexão";

async function verify(width) {
  const line={id:randomUUID(),name:"Linha de ensaio",source:"synthetic"};
  let workspace={id:randomUUID(),name:"Empresa de ensaio",role:"manager"};
  let user={id:randomUUID(),name:"Gestor de ensaio",email:"teste@example.test"};
  let job;
  let steps=[];
  let startStatus=201;
  const reads=[],writes=[],errors=[];
  const fixture=await startFixtureWeb(bundle,0,(req,res,path)=>{
    if (path==="session") return json(res,200,{user,workspace,workspaces:[workspace]});
    if (path==="connections") return json(res,200,{items:[line],nextCursor:null});
    if (path==="diagnostics" && req.method==="POST") {
      writes.push(req.method);
      if (startStatus!==201) return json(res,startStatus,{error:{message:"Falha ao iniciar o diagnóstico."}});
      return json(res,201,{id:job.id,connectionId:line.id,status:"queued"});
    }
    if (path==="diagnostics") return json(res,200,{items:[],nextCursor:null});
    if (path.startsWith("diagnostics/")) {
      const id=path.slice(12), context=req.headers["x-v2-context"];
      reads.push({id,context});
      if (!job || id!==job.id || context!==user.id+"/"+workspace.id) return json(res,404,{});
      const result=steps.length>1 ? steps.shift() : steps[0];
      if (typeof result==="number") return json(res,result,{error:{message:"Falha de leitura "+result}});
      return json(res,200,{...job,status:result,progress:36,connectionId:line.id,report:result==="completed" ?
        {source:"synthetic",conversations:0,analyzed:0,reused:0,opportunities:0} : null});
    }
    return json(res,404,{});
  });
  const origin=fixture.origin;
  const ctx=await browser.newContext({viewport:{width,height:width===390?844:900},serviceWorkers:"block"});
  const page=await ctx.newPage();
  page.setDefaultTimeout(6000);
  page.on("pageerror",err=>errors.push(err.message));
  let dropNetwork=false, cancelInflight;
  const detail=/\/api\/v2\/diagnostics\/[0-9a-f-]+$/;
  await page.route(/^https?:/,async route=>{
    const request=route.request();
    if (new URL(request.url()).origin!==origin) {
      errors.push("Acesso externo");return route.abort();
    }
    if (detail.test(request.url()) && request.method()==="GET") {
      if (dropNetwork) { dropNetwork=false; return route.abort("connectionreset"); }
      if (cancelInflight) {
        const intercepted=cancelInflight;cancelInflight=null;
        await intercepted(route);return;
      }
    }
    return route.continue();
  });
  const live=page.getByRole("status");
  const startButton=page.getByRole("button",{name:"Iniciar diagnóstico"});
  async function open(sequence,show=true) {
    job={id:randomUUID(),createdAt:"2026-01-01T11:00:00Z"};steps=[...sequence];
    await page.goto(origin+"/#diagnosticos/"+job.id);
    if(show) await live.filter({hasText:runLabels[sequence[0]]}).waitFor();
    return job.id;
  }
  const count=id=>reads.filter(read=>read.id===id).length;
  async function recovered() {
    await live.filter({hasText:reconnect}).waitFor();
    assert.ok(await startButton.isDisabled());
    assert.equal(await page.getByRole("progressbar",{name:"Progresso"}).getAttribute("value"),"36");
    assert.equal(await page.getByRole("button",{name:"Tentar novamente",exact:true}).count(),0);
    await live.filter({hasText:"Diagnóstico concluído"}).waitFor();
  }
  try {
    const recoveredId=await open(["running",503,"completed"]);
    await recovered();
    assert.equal(count(recoveredId),3);
    await page.clock.install();
    await page.clock.runFor(7000);
    assert.equal(count(recoveredId),3);

    for(const status of [502,504]) {
      await open(["queued",status,"completed"]);await recovered();
    }
    await open(["running","completed"]);dropNetwork=true;
    await recovered();

    const persistent=await open(["running",503]);
    await live.filter({hasText:reconnect}).waitFor();
    await page.getByRole("alert").getByText("Falha de leitura 503").waitFor({timeout:11000});
    assert.equal(count(persistent),5); // One success, one failure and three retries.
    await page.clock.runFor(12000);assert.equal(count(persistent),5);
    steps=["completed"];
    await page.getByRole("button",{name:"Tentar novamente",exact:true}).click();
    await live.filter({hasText:"Diagnóstico concluído"}).waitFor();assert.equal(count(persistent),6);

    for(const status of [403,404,429,500]) {
      const id=await open(["running",status]);
      await page.getByRole("alert").getByText("Falha de leitura "+status).waitFor();
      await page.clock.runFor(8000);assert.equal(count(id),2);
    }
    const firstRead=await open([503],false);
    await page.getByRole("alert").getByText("Falha de leitura 503").waitFor();
    await page.clock.runFor(8000);assert.equal(count(firstRead),1);

    // Leaving the route, changing reports and replacing the authenticated context each cancel the old timer.
    for(const change of ["rota","diagnóstico","empresa","conta"]) {
      const id=await open(["running",503]);
      await live.filter({hasText:reconnect}).waitFor();
      const previousContext=user.id+"/"+workspace.id;
      if (change==="rota") {
        await page.evaluate(()=>{location.hash="whatsapps";});
        await page.getByRole("heading",{name:"WhatsApps",exact:true}).waitFor();
      } else if (change==="diagnóstico") {
        await open(["completed"]);
      } else {
        if(change==="conta") user={...user,id:randomUUID()}; else workspace={...workspace,id:randomUUID()};
        steps=[404];
        await page.evaluate(()=>window.dispatchEvent(new Event("sa2-session-changed")));
        await page.getByRole("alert").getByText("Falha de leitura 404").waitFor();
      }
      await page.clock.runFor(12000);
      assert.equal(reads.filter(r=>r.id===id && r.context===previousContext).length,2,change);
      assert.equal(await live.filter({hasText:reconnect}).count(),0,change);
    }
    // A late successful response for a discarded report never replaces the current report.
    const oldId=await open(["running"]);
    let intercepted;
    const waiting=new Promise(resolve=>{intercepted=resolve;});
    let release;
    const gate=new Promise(resolve=>{release=resolve;});
    cancelInflight=async route=>{
      intercepted();
      await gate;
      await route.fulfill({json:{id:oldId,connectionId:line.id,status:"running",progress:99}}).catch(()=>{});
    };
    await waiting;
    const aborted=page.waitForEvent("requestfailed",{
      predicate:req=>req.url().endsWith("/diagnostics/"+oldId) && req.failure()?.errorText.includes("ABORTED"),
      timeout:6000,
    });
    const newId=await open(["completed"]);release();
    await aborted;
    await page.clock.runFor(8000);
    await live.filter({hasText:"Diagnóstico concluído"}).waitFor();
    assert.equal(count(newId),1);
    assert.equal(await page.getByRole("progressbar").count(),0);

    assert.equal(writes.length,0);
    // An explicit start is the only POST, even if the first detail GET fails.
    await page.goto(origin+"/#diagnosticos");
    job={id:randomUUID(),createdAt:"2026-01-01T11:00:00Z"};steps=[503,"completed"];
    await startButton.click();await live.filter({hasText:"Na fila · "+reconnect}).waitFor();
    await live.filter({hasText:"Diagnóstico concluído"}).waitFor();
    assert.equal(writes.length,1);
    startStatus=503;
    await startButton.click();
    await page.getByRole("alert").getByText("Falha ao iniciar o diagnóstico.").waitFor();
    await page.clock.runFor(12000);
    assert.equal(writes.length,2);
    const expired=await open(["running",401]);
    await page.getByRole("button",{name:"Entrar",exact:true}).waitFor();
    await page.clock.runFor(8000);assert.equal(count(expired),2);
    assert.equal(await live.filter({hasText:reconnect}).count(),0);
    assert.deepEqual(errors,[]);
    console.log("OK",width,fixture.revision,"recuperação, esgotamento, autorização, troca de contexto e envio único");
  } catch (error) {
    console.error("Leituras do relatório:",count(job?.id),"Estado:",await live.allTextContents(),
      "Erro:",await page.getByRole("alert").allTextContents());
    throw error;
  } finally {await ctx.close();await fixture.close();}
}
try {for (const width of [1440,390]) await verify(width);}
finally {await browser.close();}
