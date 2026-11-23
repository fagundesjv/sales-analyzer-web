import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";
import {startFixture,testContext} from "./fixtures/attendance-web.mjs";

const bundle=process.argv[2];
assert.ok(bundle,"Informe o diretório do pacote Web compilado.");
const evidence=process.env.SA_EVIDENCE_DIR;
if (evidence) await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({channel:"chrome"});

async function scenario(width) {
  const {origin,lines,state,revision,close}=await startFixture(bundle);
  const [sim,real,unavailable]=lines;
  const context=await browser.newContext({viewport:{width,height:width<600?844:900},serviceWorkers:"block"});
  const errors=[];
  await context.route(/^https?:/,route=>{
    if (new URL(route.request().url()).origin===origin) return route.continue();
    errors.push("Requisição externa");return route.abort();
  });
  const page=await context.newPage();
  page.on("pageerror",e=>errors.push(e.message));
  page.setDefaultTimeout(10000);
  const open=line=>page.goto(origin+"/#entrada/todos/"+line.id);
  const panel=page.getByRole("region",{name:"Envio pelo WhatsApp"});
  const editor=panel.getByRole("textbox",{name:"Mensagem de WhatsApp"});
  const log=page.getByRole("region",{name:"Evidências da conversa"});
  const act=panel.getByRole("button",{name:"Ativar atendimento"});
  async function shot(name) {
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    if (evidence) await page.screenshot({path:evidence+"/"+name+"-"+width+".png",animations:"disabled"});
  }
  async function activate(line,cancel=false) {
    const before=state.starts;
    assert.equal(await editor.count(),0);
    await act.click();
    const dialog=page.getByRole("dialog");
    for (const value of [line.title,line.destination,line.lineName]) await dialog.getByText(value,{exact:true}).first().waitFor();
    assert.equal(state.starts,before);
    if (cancel) {
      await shot("confirmar-destino");
      await page.keyboard.press("Escape");
      await dialog.waitFor({state:"hidden"});
      assert.equal(state.starts,before);
      return;
    }
    await dialog.getByRole("button",{name:"Confirmar e ativar"}).click();
    await editor.waitFor();
    assert.equal(state.starts,before+1);
  }
  async function send(text,status,label) {
    state.nextStatus=status;
    const expected=status==="accepted"?200:202;
    await editor.fill(text);
    const response=page.waitForResponse(r=>r.url().endsWith("/attendance/messages") && r.request().method()==="POST");
    await panel.getByRole("button",{name:label,exact:true}).click();
    assert.equal((await response).status(),expected);
    await log.getByText(text,{exact:true}).waitFor();
  }
  try {
    await open(sim);
    await act.waitFor();
    await activate(sim,true);
    await activate(sim);
    await send("Posso separar o produto para você?","accepted","Simular envio");
    await log.getByText(/Aceita na simulação/).waitFor();
    await shot("atendimento-ativo");
    const imported=sim.messages[0];
    sim.evidence.push({externalId:imported.providerMessageId,text:imported.text,occurredAt:imported.createdAt,direction:"outbound"});
    await page.reload();
    await act.waitFor();
    assert.equal(await log.getByText(imported.text,{exact:true}).count(),1);
    await log.getByText(/Aceita na simulação/).waitFor();
    assert.equal(await editor.count(),0);

    await open(real);
    await panel.getByText("Envio real",{exact:true}).waitFor();
    await activate(real);
    await send("Combinado para sexta.","accepted","Enviar mensagem");
    await log.getByText(/Aceita pelo provedor/).waitFor();
    await send("Conferindo o endereço.","sending","Enviar mensagem");
    const waiting=real.messages.at(-1);
    await log.getByText(/Em processamento/).waitFor();
    waiting.status="uncertain";
    const beforeRefresh=state.calls.length;
    await panel.getByRole("button",{name:"Atualizar histórico"}).click();
    await log.getByText(/Envio sem confirmação/).waitFor();
    assert.equal(state.calls.length,beforeRefresh);
    await send("Retorno amanhã.","uncertain","Enviar mensagem");
    await editor.fill("Mensagem única após falha de rede.");
    state.nextStatus="accepted";
    const beforeTimeout=state.dispatches;
    await page.route("**/attendance/messages",async route=>{
      const upstream=await route.fetch();
      assert.equal(upstream.status(),200);
      await route.abort("timedout");
    });
    await panel.getByRole("button",{name:"Enviar mensagem",exact:true}).click();
    const retry=panel.getByRole("button",{name:"Tentar o mesmo envio"});
    await retry.waitFor();
    const first=state.calls.at(-1);
    await page.unroute("**/attendance/messages");
    await panel.getByRole("button",{name:"Atualizar histórico"}).click();
    await log.getByText(first.body.text,{exact:true}).waitFor();
    assert.equal(state.dispatches,beforeTimeout+1);
    await retry.click();
    await retry.waitFor({state:"hidden"});
    assert.deepEqual(state.calls.at(-1),first);
    assert.equal(state.dispatches,beforeTimeout+1);
    assert.equal(await log.getByText(first.body.text,{exact:true}).count(),1);

    const max="界".repeat(4000);
    await editor.fill(max+"X");
    assert.equal(await editor.inputValue(),max);
    await send(max,"accepted","Enviar mensagem");
    assert.equal(state.calls.at(-1).body.text.length,4000);
    const requests=state.calls.length;
    await page.reload();
    await act.waitFor();
    await log.getByText(max,{exact:true}).waitFor();
    assert.equal(state.calls.length,requests);
    await page.clock.install();
    state.ttl=60000;
    await activate(real);
    await editor.fill("Rascunho antes de expirar");
    await page.clock.fastForward(61000);
    await act.waitFor();
    assert.equal(await editor.count(),0);
    assert.equal(state.calls.length,requests);
    state.ttl=600000;
    await activate(real);
    assert.equal(await editor.inputValue(),"Rascunho antes de expirar");
    await page.clock.resume();
    await open(unavailable);
    await panel.getByText(/indisponível nesta conversa/).waitFor();
    assert.equal(await act.count(),0);
    assert.equal(await editor.count(),0);

    // Exercise the actual packaged BFF and its byte limits, independent of textarea limits.
    const base=origin+"/api/v2/conversations/"+real.id+"/attendance";
    const headers={Origin:origin,"X-V2-Context":testContext};
    const grant=await context.request.post(base,{headers,data:{confirm:true,mode:"real"}});
    assert.equal(grant.status(),200);
    const {ticket}=await grant.json();
    const largeJson=bytes=>{
      const body=JSON.stringify({ticket,text:"a"});
      return body+" ".repeat(bytes-Buffer.byteLength(body));
    };
    const sendHeaders={...headers,"Content-Type":"application/json","Idempotency-Key":"fixture-size"};
    assert.equal((await context.request.post(base+"/messages",{headers:sendHeaders,data:largeJson(32768)})).status(),200);
    assert.equal((await context.request.post(base+"/messages",{headers:sendHeaders,data:largeJson(32769)})).status(),413);
    assert.equal((await context.request.post(base,{headers:sendHeaders,data:largeJson(8193)})).status(),413);
    assert.equal((await context.request.post(base+"/messages",{headers,data:{ticket,text:"Teste"}})).status(),400);
    assert.equal((await context.request.get(base+"/messages",{headers})).status(),404);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({width,revision,confirmedDestination:true,simulated:true,realModeOnFixture:true,
      accepted:true,sending:true,uncertain:true,replayedSameKey:true,duplicateBubbles:0,maxBytes:32768}));
  } finally {await context.close();await close();}
}
try {for (const width of [1440,390]) await scenario(width);}
finally {await browser.close();}
