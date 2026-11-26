// No HTTP fixture: exact packaged Web, real local API/worker/database and local identity.
// External model and WhatsApp traffic must remain blocked by the isolated stack configuration.
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {resolve,join} from "node:path";
import {chromium} from "playwright";
const bundle=resolve(process.argv[2]||"");assert.ok(process.argv[2],"Informe o pacote.");
const origin=process.env.SA_ENGINE_EXTERNAL_ORIGIN||process.env.SA_MOTOR_EXTERNAL_ORIGIN;
assert.ok(origin,"Este teste exige o runtime empacotado já em execução.");
const web=new URL(origin);assert.equal(web.hostname,"127.0.0.1");assert.equal(web.protocol,"http:");assert.equal(web.origin,origin);
const state=process.env.SA_INTEGRADO_DIR;assert.ok(state);
const accounts=JSON.parse(await readFile(join(state,"contas.json"),"utf8")),manager=accounts.gestora;
const staffFile=process.env.SA_ENGINE_STAFF_ACCOUNT;assert.ok(staffFile,"Informe o arquivo privado da conta staff sintética.");
const staff=JSON.parse(await readFile(staffFile,"utf8"));
for(const actor of [manager,staff])assert.ok(actor?.email?.endsWith(".test")&&(actor.senha||actor.password),"Somente contas sintéticas.");
const revision=(await readFile(join(bundle,"REVISION"),"utf8")).trim();
const health=await fetch(origin+"/healthz",{signal:AbortSignal.timeout(10000)});assert.equal(health.status,200);assert.deepEqual(await health.json(),{status:"ok",revision});
const shots=process.env.SA_EVIDENCE_DIR;if(shots)await mkdir(shots,{recursive:true});
const browser=await chromium.launch({channel:"chrome"}),results=[];
async function open(width){
  const context=await browser.newContext({viewport:{width,height:width<600?844:900}}),page=await context.newPage();page.setDefaultTimeout(20000);
  const errors=[];page.on("pageerror",error=>errors.push(error.message));
  await context.route(/^https?:/,route=>{if(new URL(route.request().url()).origin===origin)return route.continue();errors.push("request_outside_local_web");return route.abort();});
  return {context,page,errors};
}
async function signIn(page,actor,staffMode){
  await page.goto(origin+(staffMode?"/#central-ia":"/#empresa"));
  await page.getByLabel("E-mail",{exact:true}).fill(actor.email);await page.getByLabel("Senha",{exact:true}).fill(actor.senha||actor.password);
  const response=page.waitForResponse(r=>r.url().endsWith(staffMode?"/api/v2/staff/auth/session":"/api/v2/auth/session")&&r.request().method()==="POST");
  await page.getByRole("button",{name:staffMode?"Entrar na Central":"Entrar",exact:true}).click();
  const received=await response;assert.equal(received.status(),200,"Login real local");let session=await received.json();assert.equal(Object.hasOwn(session,"token"),false);
  if(staffMode){
    assert.equal(session.secondFactor?.state,"required","A identidade sintética deve ter autenticador configurado pelo fluxo normal.");
    const code=actor.reserveCodes?.shift();assert.ok(typeof code==="string"&&code.length>=8,"Informe um código de reserva sintético ainda não usado.");
    // Reserve before submitting: an interrupted browser run must never reuse a code with an unknown result.
    await writeFile(staffFile,JSON.stringify(actor,null,2)+"\n",{mode:0o600});
    await page.getByLabel("Código do autenticador ou de reserva",{exact:true}).fill(code);
    const verified=page.waitForResponse(r=>r.url().endsWith("/api/v2/staff/factor")&&r.request().method()==="POST");
    await page.getByRole("button",{name:"Confirmar código",exact:true}).click();
    const factor=await verified;assert.equal(factor.status(),200,"Segundo fator validado pelo endpoint real");
    session=(await factor.json()).session;assert.equal(session.secondFactor.state,"verified");
  }
  return session;
}
async function customerFlow(width){
  const {context,page,errors}=await open(width);let sourceId;
  try {
    const session=await signIn(page,manager,false);assert.equal(session.capabilities?.memory,true);assert.equal(session.capabilities?.commercialEngine,true);
    assert.equal((await context.cookies()).find(c=>c.name==="sa2_session")?.httpOnly,true);
    const scope=session.user.id+"/"+session.workspace.id;
    await page.getByRole("button",{name:"Adicionar conhecimento da empresa",exact:true}).click();
    const create=page.getByRole("dialog",{name:"Conhecimento da empresa",exact:true});
    await create.getByRole("combobox",{name:"Tipo da fonte",exact:true}).click();await page.getByRole("option",{name:"Documento",exact:true}).click();
    await create.getByLabel("Título da fonte",{exact:true}).fill("Material sintético de aceite "+width+" "+randomUUID().slice(0,8));
    const created=page.waitForResponse(r=>r.url().endsWith("/api/v2/memory/documents")&&r.request().method()==="POST");
    await create.getByRole("button",{name:"Salvar fonte",exact:true}).click();const sourceResponse=await created;assert.equal(sourceResponse.status(),201);sourceId=(await sourceResponse.json()).id;
    const source=page.getByRole("dialog",{name:"Fonte de conhecimento",exact:true});
    await source.getByText("Importar ou substituir material desta fonte",{exact:true}).click();
    await source.getByLabel("Arquivo de conhecimento",{exact:true}).setInputFiles({name:"politica.txt",mimeType:"text/plain",buffer:Buffer.from("POLITICA SINTETICA DE ACEITE. Entrega confirmada somente apos consulta do CEP.\n".repeat(300))});
    const queued=page.waitForResponse(r=>r.url().endsWith("/api/v2/memory/materials")&&r.request().method()==="POST");
    await source.getByRole("button",{name:"Importar material",exact:true}).click();assert.equal((await queued).status(),202);
    await source.getByText("Material importado",{exact:true}).waitFor({timeout:60000});
    await source.getByRole("button",{name:"Conferir conteúdo e versão importados",exact:true}).click();await source.getByText("POLITICA SINTETICA DE ACEITE",{exact:false}).waitFor();
    if(shots)await page.screenshot({path:join(shots,`runtime-memory-${width}.png`),fullPage:true});
    await source.getByRole("button",{name:"Remover fonte",exact:true}).click();const removed=page.waitForResponse(r=>r.url().endsWith("/api/v2/memory/documents/"+sourceId)&&r.request().method()==="DELETE");
    await source.getByRole("button",{name:"Confirmar remoção da fonte",exact:true}).click();assert.equal((await removed).status(),204);await source.waitFor({state:"hidden"});
    let resolver=null;
    if(process.env.SA_ENGINE_SEND_TEST==="1"){
      const candidate=await page.evaluate(async context=>{
        const get=async path=>{const r=await fetch('/api/v2/'+path,{headers:{'X-V2-Context':context},cache:'no-store'});return r.ok?r.json():null;};
        const conversations=await get('conversations?limit=100');
        for(const talk of conversations?.items||[]){
          if(!['whatsapp','evolution'].includes(talk.source)||talk.pendingRevision)continue;
          const list=await get('conversations/'+talk.id+'/opportunities?limit=25');
          for(const [index,op] of (list?.items||[]).entries()){
            if(op.legacy||['won','lost'].includes(op.status))continue;
            const result=await get('opportunities/'+op.id+'/reading'),r=result?.reading;
            if(!r||r.stale||r.state!=='pending'||r.step?.writes!==true||r.draftState!=='ready'||!r.draftText)continue;
            const actions=await get('opportunities/'+op.id+'/actions');if(actions?.items.some(a=>a.revision===r.revision&&a.kind==='send'))continue;
            return {conversationId:talk.id,opportunityId:op.id,revision:r.revision,index};
          }
        }return null;
      },scope);
      assert.ok(candidate,"O worker deve publicar uma sugestão elegível para Resolver.");
      await page.goto(origin+"/#conversa/"+candidate.conversationId);
      const select=page.getByRole("combobox",{name:"Pedido selecionado",exact:true});await select.click();await page.getByRole("option").nth(candidate.index).click();
      const work=page.getByRole("region",{name:"Trabalho da Zoe neste pedido",exact:true});
      await work.getByRole("button",{name:"Resolver e enviar sugestão",exact:true}).click();
      const confirm=page.getByRole("dialog",{name:"Enviar a sugestão da Zoe?",exact:true});
      const submitted=page.waitForResponse(r=>r.url().endsWith('/opportunities/'+candidate.opportunityId+'/resolve')&&r.request().method()==='POST');
      await confirm.getByRole("button",{name:"Confirmar Resolver e enviar",exact:true}).click();const result=await submitted;assert.equal(result.status(),200);const receipt=await result.json();assert.ok(receipt.id);
      await work.getByText("Mensagem aceita pelo canal",{exact:true}).waitFor({timeout:60000});
      if(shots)await page.screenshot({path:join(shots,`runtime-resolver-${width}.png`),fullPage:true});
      resolver={opportunityId:candidate.opportunityId,actionId:receipt.id,state:"accepted"};
    }
    assert.deepEqual(errors,[]);return {width,webRevision:revision,runtime:"packaged-private-web",api:"real-local",database:"postgres",identity:"local-real",providers:"internal-deterministic",memoryImport:true,memoryDelete:true,...(resolver?{resolver}:{})};
  } finally {await context.close();}
}
async function staffFlow(width){
  const {context,page,errors}=await open(width);
  try {
    const session=await signIn(page,staff,true);assert.equal(session.staff.role,"owner");assert.equal(session.secondFactor.state,"verified");
    assert.equal((await context.cookies()).find(c=>c.name==="sa2_staff")?.httpOnly,true);
    await page.getByRole("button",{name:"Biblioteca",exact:true}).click();await page.getByRole("button",{name:"Cadastrar fornecedor",exact:true}).click();
    const dialog=page.getByRole("dialog",{name:"Cadastrar fornecedor",exact:true}),slug="browser_"+randomUUID().replaceAll("-","").slice(0,10);
    await dialog.getByLabel("Identificador do fornecedor",{exact:true}).fill(slug);await dialog.getByLabel("Nome do fornecedor",{exact:true}).fill("Fornecedor sintético desativado "+slug);
    await dialog.getByLabel("Referência da credencial no servidor",{exact:true}).fill("no-key-"+slug);
    await dialog.getByRole("checkbox",{name:"Disponível na biblioteca",exact:true}).uncheck();await dialog.getByLabel("Motivo da alteração",{exact:true}).fill("Aceite sintético sem chamadas externas");
    const saved=page.waitForResponse(r=>r.url().endsWith('/api/v2/staff/ai/catalog')&&r.request().method()==='POST');
    await dialog.getByRole("button",{name:"Salvar cadastro",exact:true}).click();assert.equal((await saved).status(),201);await dialog.waitFor({state:"hidden"});
    await page.getByRole("button",{name:"Custo e operação",exact:true}).click();await page.getByRole("heading",{name:"Custo e fila",exact:true}).waitFor();
    if(shots)await page.screenshot({path:join(shots,`runtime-ai-admin-${width}.png`),fullPage:true});
    assert.deepEqual(errors,[]);return {width,staffLogin:true,serverOnlyCredentialReference:true,disabledProviderCreated:true};
  } finally {await context.close();}
}
try {for(const width of [1440,390]){const result={...await customerFlow(width),staff:await staffFlow(width)};results.push(result);console.log(JSON.stringify(result));}
  if(shots)await writeFile(join(shots,"runtime-engine-results.json"),JSON.stringify(results,null,2)+"\n");
} finally {await browser.close();}
