import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";
import {startConnectionFixture} from "./fixtures/whatsapp-connection.mjs";

const bundle=process.argv[2];
assert.ok(bundle,"Informe o pacote Web compilado.");
const shots=process.env.SA_EVIDENCE_DIR;
if (shots) await mkdir(shots,{recursive:true});
const preview=process.argv.includes("--preview");
const browser=preview ? null : await chromium.launch({channel:"chrome"});
async function verify(width,role) {
  const fixture=await startConnectionFixture(bundle,{role});
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},serviceWorkers:"block"});
  const page=await context.newPage();
  const errors=[];
  const scheduleRequests=[];
  page.on("request",req=>{
    if (new URL(req.url()).pathname.endsWith("/diagnostic-schedule")) scheduleRequests.push(req.method());
  });
  page.setDefaultTimeout(8000);
  page.on("pageerror",error=>errors.push(error.message));
  await context.route(/^https?:/,route=>{
    if (new URL(route.request().url()).origin===fixture.origin) return route.continue();
    errors.push("Requisição externa");return route.abort();
  });
  const noVendor=async() => assert.doesNotMatch(await page.locator("body").innerText(),/Evolution|instância|backend/i);
  const layout=async(name) => {
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await noVendor();
    if (shots) await page.screenshot({path:shots+"/whatsapp-"+role+"-"+name+"-"+width+".png",animations:"disabled"});
  };
  try {
    await page.goto(fixture.origin+"/#whatsapps");
    const state=fixture.state;
    const connect=page.getByRole("button",{name:"Conectar WhatsApp",exact:true});
    const dialog=page.getByRole("dialog");
    const schedule=dialog.getByRole("region",{name:"Diagnóstico diário"});
    await page.getByRole("heading",{name:role==="manager" ? "Conecte seu primeiro WhatsApp":"Nenhum número atribuído"}).waitFor();
    await layout("vazio");
    if (role==="seller") {
      assert.equal(await connect.count(),0);
      // Even a malformed upstream that says yes to a seller cannot enable management.
      state.capability=true;
      const own=fixture.addLine({name:"WhatsApp atribuído",status:"provisioning"});
      fixture.addLine({name:"Linha de outra pessoa",ownerId:state.seller.id});
      fixture.addLine({name:"Linha de outra empresa",workspaceId:randomUUID()});
      await page.reload();
      await page.getByRole("button",{name:"Ver conexão de WhatsApp atribuído"}).click();
      await dialog.getByText("Esta linha está em preparação.",{exact:false}).waitFor();
      assert.doesNotMatch(await page.locator("body").innerText(),/Linha de outra/);
      assert.equal(await connect.count(),0);
      assert.equal(await dialog.getByRole("button",{name:"Continuar preparação"}).count(),0);
      own.status="disconnected";
      await dialog.getByRole("button",{name:"Atualizar estado"}).click();
      await dialog.getByText("Peça ao gestor para escanear o QR Code desta linha.").waitFor();
      assert.equal(await schedule.count(),0);
      assert.deepEqual(scheduleRequests,[]);
      assert.equal(await dialog.getByRole("button",{name:"Gerar QR Code"}).count(),0);
      assert.deepEqual([state.creates.length,state.provisions.length,state.pairings,state.teamReads],[0,0,0,0]);
      await layout("atribuido");
      return console.log("OK",role,width,fixture.revision);
    }

    // A page containing only samples must keep the real-lines empty state usable.
    fixture.addLine({name:"Exemplo",source:"synthetic",channel:"synthetic",status:"connected"});
    for (const capability of [undefined,false,"true",true]) {
      state.capability=capability;
      await page.reload();
      await page.getByRole("heading",{name:"Fontes de teste"}).waitFor();
      await page.getByText(capability===true ? "Conecte seu primeiro WhatsApp":"WhatsApp ainda não configurado",{exact:true}).waitFor();
      assert.equal(await connect.count(),capability===true ? 1 : 0);
    }
    await connect.click();
    const name=dialog.getByLabel("Nome da linha");
    const submit=dialog.getByRole("button",{name:"Continuar para o QR Code"});
    await name.fill("!");
    assert.equal(await submit.isDisabled(),true);
    await name.fill("Não criar");
    await page.keyboard.press("Escape");
    await dialog.waitFor({state:"hidden"});
    assert.equal(state.creates.length,0);
    await connect.click();
    await name.fill("  Comercial  Sul  ");
    await dialog.getByRole("button",{name:"Carregar mais pessoas"}).click();
    await dialog.getByLabel("Responsável pelo número").selectOption(state.seller.id);
    await layout("criacao");
    state.limitReached=true;
    await submit.click();
    await dialog.getByRole("alert").getByText("Limite de linhas de WhatsApp atingido.").waitFor();
    assert.equal(await name.isEnabled(),true);
    state.limitReached=false;
    state.loseReceipt=true;
    await submit.click();
    const retry=dialog.getByRole("button",{name:"Retomar criação"});
    await retry.waitFor();
    assert.equal(await name.isDisabled(),true);
    const original=state.creates.at(-1);
    await page.reload();
    await connect.click();
    await retry.click();
    const resume=dialog.getByRole("button",{name:"Continuar preparação"});
    await resume.waitFor();
    assert.deepEqual(state.creates.at(-1),original);
    assert.match(original.key,/^[0-9a-f-]{36}$/);
    assert.deepEqual(original.body,{name:"Comercial Sul",ownerId:state.seller.id});
    assert.equal(state.lines.filter(line=>line.name==="Comercial Sul").length,1);
    await layout("preparando");
    await page.keyboard.press("Escape");
    await page.getByRole("button",{name:"Continuar conexão de Comercial Sul"}).click();
    state.provisionStatus="provisioning";
    await resume.click();
    await dialog.getByText("A preparação continua.",{exact:false}).waitFor();
    state.provisionStatus="disconnected";
    await resume.click();
    const generate=dialog.getByRole("button",{name:"Gerar QR Code"});
    await generate.waitFor();
    assert.deepEqual(state.provisions.map(x=>x.body),[{},{}]);
    state.pairingFails=true;
    await generate.click();
    await dialog.getByText("Não foi possível consultar o WhatsApp. Tente novamente em instantes.").waitFor();
    await noVendor();
    state.pairingFails=false;
    await generate.click();
    const qrImage=dialog.getByRole("img",{name:"QR Code de pareamento do WhatsApp"});
    await qrImage.waitFor();
    await dialog.getByRole("button",{name:"Renovar QR Code"}).click();
    await qrImage.waitFor();
    assert.equal(state.pairings,3);
    await dialog.getByText("Aguardando conexão",{exact:true}).waitFor();
    assert.equal(await schedule.count(),0,"O pareamento deve mostrar apenas os controles da conexão.");
    assert.deepEqual(scheduleRequests,[],"A agenda só pode ser consultada depois de conectar a linha.");
    await layout("qr");
    state.lines.find(line=>line.name==="Comercial Sul").status="connected";
    await dialog.getByText("Conectado",{exact:true}).waitFor({timeout:12000});
    await schedule.getByRole("switch",{name:"Agendar diagnóstico"}).waitFor();
    assert.deepEqual(scheduleRequests,["GET"]);
    assert.equal(await qrImage.count(),0);
    assert.equal(state.pairings,3);
    await layout("conectado");
    await page.keyboard.press("Escape");
    // A 201 response can skip preparation. Omitting ownerId assigns the manager.
    state.creationStatus="disconnected";
    await connect.click();
    await name.fill("Atendimento");
    await submit.click();
    await generate.waitFor();
    assert.deepEqual(state.creates.at(-1).body,{name:"Atendimento"});
    assert.equal(state.lines.at(-1).ownerId,state.user.id);
    console.log("OK",role,width,fixture.revision);
  } finally {await context.close();await fixture.close();assert.deepEqual(errors,[]);}
}
if (preview) {
  const fixture=await startConnectionFixture(bundle,{role:process.argv.includes("--seller") ? "seller":"manager",port:Number(process.env.SA_PREVIEW_PORT || 0)});
  console.log("Prévia local · "+fixture.origin+"/#whatsapps");
} else {
  try {for (const width of [1440,390]) for (const role of ["manager","seller"]) await verify(width,role);}
  finally {await browser.close();}
}
