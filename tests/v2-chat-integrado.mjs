// Exact packaged Web + real local API, worker, PostgreSQL and identity. No HTTP fixture.
import assert from "node:assert/strict";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {resolve,join} from "node:path";
import {chromium} from "playwright";
const bundle=resolve(process.argv[2]||"");assert.ok(process.argv[2]);
const origin=process.env.SA_ENGINE_EXTERNAL_ORIGIN;assert.ok(origin);const url=new URL(origin);assert.equal(url.hostname,"127.0.0.1");assert.equal(url.protocol,"http:");assert.equal(url.origin,origin);
const state=process.env.SA_INTEGRADO_DIR;assert.ok(state);const account=JSON.parse(await readFile(join(state,"contas.json"),"utf8")).gestora;
assert.ok(account.email.endsWith(".test")&&(account.senha||account.password),"Use apenas a identidade sintética do ambiente isolado.");
const revision=(await readFile(join(bundle,"REVISION"),"utf8")).trim(),health=await fetch(origin+"/healthz");assert.equal(health.status,200);assert.deepEqual(await health.json(),{status:"ok",revision});
const shots=process.env.SA_EVIDENCE_DIR;if(shots)await mkdir(shots,{recursive:true});
const browser=await chromium.launch({channel:"chrome"}),results=[];
async function scenario(width){
  const context=await browser.newContext({viewport:{width,height:width<600?844:900},reducedMotion:"reduce"}),page=await context.newPage();page.setDefaultTimeout(30000);
  const errors=[];let posts=0;page.on("pageerror",e=>errors.push(e.message));page.on("request",r=>{if(r.method()==="POST"&&r.url().endsWith("/api/v2/zoe/turns"))posts++;});
  await context.route(/^https?:/,route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  try{
    await page.goto(origin+"/#chat");await page.getByLabel("E-mail",{exact:true}).fill(account.email);await page.getByLabel("Senha",{exact:true}).fill(account.senha||account.password);
    const login=page.waitForResponse(r=>r.url().endsWith("/api/v2/auth/session")&&r.request().method()==="POST");await page.getByRole("button",{name:"Entrar",exact:true}).click();const response=await login;assert.equal(response.status(),200);const session=await response.json();assert.equal(Object.hasOwn(session,"token"),false);assert.equal(session.capabilities.zoeChat,true);
    assert.equal((await context.cookies()).find(c=>c.name==="sa2_session").httpOnly,true);
    await page.getByRole("textbox",{name:"Pergunta para a Zoe",exact:true}).fill("Quantas conversas foram analisadas na minha operação?");
    const accepted=page.waitForResponse(r=>r.url().endsWith("/api/v2/zoe/turns")&&r.request().method()==="POST");await page.getByRole("button",{name:"Consultar Zoe",exact:true}).click();const queued=await accepted;assert.equal(queued.status(),202);assert.ok((await queued.json()).id);
    await page.getByText("Fontes da resposta",{exact:true}).waitFor({timeout:120000});assert.equal(posts,1);assert.ok(page.url().includes("#zoe/"));
    const source=page.waitForResponse(r=>/\/api\/v2\/zoe\/chat\/turns\/[^/]+\/sources\/0$/.test(r.url()));
    await page.getByRole("button",{name:"Conversas analisadas",exact:true}).click();const actual=await source;assert.equal(actual.status(),200);const fact=await actual.json();assert.equal(fact.ref,"numero:leitura.conversas");assert.equal(typeof fact.value,"number");
    await page.getByRole("dialog",{name:"Fonte da resposta",exact:true}).getByText("Conversas analisadas",{exact:true}).waitFor();await page.keyboard.press("Escape");
    if(shots)await page.screenshot({path:join(shots,`normal-chat-${width}.png`),fullPage:true});
    await page.reload();await page.getByText("Fontes da resposta",{exact:true}).waitFor();assert.equal(posts,1,"Reabrir o histórico não cria nova pergunta paga.");
    await page.getByRole("button",{name:"Ações",exact:true}).click();await page.getByRole("menuitem",{name:"Pausar leituras da Zoe",exact:true}).click();
    let dialog=page.getByRole("dialog",{name:"Pausar leituras da Zoe",exact:true});const pause=page.waitForResponse(r=>r.url().endsWith("/confirm")&&r.request().method()==="POST");await dialog.getByRole("button",{name:"Confirmar ação",exact:true}).click();const paused=await pause;assert.equal(paused.status(),200);assert.equal((await paused.json()).response.paused,true);await dialog.getByRole("button",{name:"Concluir",exact:true}).click();
    await page.getByText("As leituras estão pausadas. Use as ações para retomar.",{exact:true}).waitFor();assert.equal(await page.getByRole("button",{name:"Consultar Zoe",exact:true}).isDisabled(),true);
    await page.getByRole("button",{name:"Ações",exact:true}).click();await page.getByRole("menuitem",{name:"Retomar leituras da Zoe",exact:true}).click();
    dialog=page.getByRole("dialog",{name:"Retomar leituras da Zoe",exact:true});const resume=page.waitForResponse(r=>r.url().endsWith("/confirm")&&r.request().method()==="POST");await dialog.getByRole("button",{name:"Confirmar ação",exact:true}).click();const resumed=await resume;assert.equal(resumed.status(),200);assert.equal((await resumed.json()).response.paused,false);await dialog.getByRole("button",{name:"Concluir",exact:true}).click();
    assert.deepEqual(errors,[]);return {width,revision,packagedRuntime:true,realLocalIdentity:true,workerGatewayCallback:true,authorizedSource:true,historyWithoutRebilling:true,pauseResumeReceipts:true};
  }finally{await context.close();}
}
try{for(const width of [1440,390]){const result=await scenario(width);results.push(result);console.log(JSON.stringify(result));}if(shots)await writeFile(join(shots,"normal-chat-results.json"),JSON.stringify(results,null,2)+"\n");}finally{await browser.close();}
