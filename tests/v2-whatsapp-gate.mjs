// Production-default capability: existing lines may pair; new line creation stays hidden.
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {chromium} from "playwright";
import {startConnectionFixture} from "./fixtures/whatsapp-connection.mjs";

const bundle=process.argv[2];
assert.ok(bundle,"Informe o pacote Web compilado.");
const browser=await chromium.launch({channel:"chrome"});
try {
  for(const width of [1440,390]) for(const role of ["manager","seller"]) {
    const fixture=await startConnectionFixture(bundle,{role});
    fixture.state.line={id:randomUUID(),name:"Linha cadastrada",source:"evolution",status:"disconnected"};
    const ctx=await browser.newContext({viewport:{width,height:width===390?844:900},serviceWorkers:"block"});
    const page=await ctx.newPage();
    page.setDefaultTimeout(8000);
    try {
      await page.goto(fixture.origin+"/#whatsapps");
      await page.getByText("Linha cadastrada",{exact:true}).waitFor();
      assert.equal(await page.getByRole("button",{name:"Conectar WhatsApp"}).count(),0);
      await page.getByRole("button",{name:"Ver conexão de Linha cadastrada"}).click();
      if(role==="manager") {
        await page.getByRole("dialog").getByRole("button",{name:"Gerar QR Code"}).click();
        await page.getByRole("img",{name:"QR Code de pareamento do WhatsApp"}).waitFor();
        assert.equal(fixture.state.pairings,1);
      } else {
        await page.getByText("Peça ao gestor para escanear o QR Code desta linha.").waitFor();
        assert.equal(await page.getByRole("button",{name:"Gerar QR Code"}).count(),0);
      }
      assert.equal(fixture.state.creates.length,0);
      assert.equal(fixture.state.provisions.length,0);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      console.log(JSON.stringify({role,width,pairing:fixture.state.pairings,creation:0}));
    } finally {await ctx.close();await fixture.close();}
  }
} finally {await browser.close();}
