import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";
import {startConnectionFixture} from "./fixtures/whatsapp-connection.mjs";

const bundle=process.argv[2];
assert.ok(bundle,"Informe o pacote Web compilado.");
const shots=process.env.SA_EVIDENCE_DIR;
if (shots) await mkdir(shots,{recursive:true});
const browser=await chromium.launch({channel:"chrome"});
async function verify(width,role) {
  const fixture=await startConnectionFixture(bundle,{role});
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},serviceWorkers:"block"});
  const page=await context.newPage();
  const errors=[];
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
    await page.getByRole("heading",{name:"Números de WhatsApp"}).waitFor();
    await layout("vazio");
    const connect=page.getByRole("button",{name:"Conectar WhatsApp"});
    if (role==="seller") {
      assert.equal(await connect.count(),0);
      await page.getByText(/Peça ao gestor da empresa para conectar ou atribuir uma linha/).waitFor();
      assert.equal(fixture.state.creates.length,0);
      fixture.state.line={id:randomUUID(),name:"WhatsApp atribuído",channel:"whatsapp",status:"provisioning"};
      await page.reload();
      await page.getByRole("button",{name:"Ver conexão de WhatsApp atribuído"}).click();
      await page.getByText("Esta linha está em preparação.",{exact:false}).waitFor();
      assert.equal(await page.getByRole("button",{name:"Verificar conexão"}).count(),0);
      await layout("atribuido");
      return console.log("OK",role,width,fixture.revision);
    }
    await connect.click();
    const dialog=page.getByRole("dialog");
    await dialog.getByRole("heading",{name:"Conectar WhatsApp"}).waitFor();
    await dialog.getByRole("textbox",{name:"Nome da linha"}).fill("Comercial Sul");
    await dialog.getByRole("button",{name:"Carregar mais pessoas"}).click();
    await dialog.getByLabel("Responsável pelo número").selectOption(fixture.state.seller.id);
    await layout("criacao");
    await dialog.getByRole("button",{name:"Continuar para o QR Code"}).click();
    await dialog.getByRole("button",{name:"Verificar conexão"}).waitFor();
    assert.deepEqual(fixture.state.creates.map(x=>x.body),[{name:"Comercial Sul",ownerId:fixture.state.seller.id}]);
    assert.match(fixture.state.creates[0].key,/^[0-9a-f-]{36}$/);
    await layout("preparando");
    await page.reload();
    await page.getByRole("button",{name:"Continuar conexão de Comercial Sul"}).click();
    await dialog.getByRole("button",{name:"Verificar conexão"}).click();
    await dialog.getByRole("button",{name:"Gerar QR Code"}).waitFor();
    assert.deepEqual(fixture.state.provisions.map(x=>x.body),[{}]);
    assert.match(fixture.state.provisions[0].key,/^[0-9a-f-]{36}$/);
    fixture.state.pairingFails=true;
    await dialog.getByRole("button",{name:"Gerar QR Code"}).click();
    await dialog.getByText("Não foi possível consultar o WhatsApp. Tente novamente em instantes.").waitFor();
    await noVendor();
    fixture.state.pairingFails=false;
    await dialog.getByRole("button",{name:"Gerar QR Code"}).click();
    await dialog.getByRole("img",{name:"QR Code de pareamento do WhatsApp"}).waitFor();
    assert.equal(fixture.state.pairings,2);
    await layout("qr");
    fixture.state.line.status="connected";
    await dialog.getByRole("button",{name:"Atualizar estado"}).click();
    await dialog.getByText("Conectado",{exact:true}).waitFor();
    await layout("conectado");
    console.log("OK",role,width,fixture.revision);
  } finally {assert.deepEqual(errors,[]);await context.close();await fixture.close();}
}
try {for (const width of [1440,390]) for (const role of ["manager","seller"]) await verify(width,role);}
finally {await browser.close();}
