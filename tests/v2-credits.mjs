import assert from "node:assert/strict";
import {setTimeout as delay} from "node:timers/promises";
import {browser,createPage,errors,origin,shot,visible} from "./v2-browser.mjs";

const capped=process.argv[2]==="capped";
const watchdog=setTimeout(()=>{console.error("Tempo total do ensaio excedido.");process.exit(124);},90000).unref();
async function signIn(role,width){
  for(let attempt=1;attempt<=3;attempt++) {
    const active=new Set(browser.contexts());
    try {return await createPage(role,width,"plano");}
    catch(error){
      for(const ctx of browser.contexts())
        if(!active.has(ctx))await Promise.race([ctx.close(),delay(1200)]);
      if(![500,503].includes(error.actual) || attempt===3)throw error;
      console.log("Falha transitória no login fictício",error.actual,role,width);
      await delay(attempt*1000);
    }
  }
}
async function checkEstimate(page, width, list) {
  const estimate = page.getByRole("region", {name:"Simular contratação"});
  const seats = estimate.getByRole("spinbutton", {name:"Vendedores"});
  const allowance = await list.innerText();
  const writes = [];
  const record = req => {
    if (req.url().includes("/api/v2/") && !["GET","HEAD"].includes(req.method())) writes.push(req.method());
  };
  page.on("request", record);
  try {
    await visible(estimate.getByText("1.000 créditos/mês", {exact:true}));
    await seats.fill("");
    await visible(estimate.getByRole("status").filter({hasText:"Informe um número inteiro"}));
    await seats.fill("4");
    await estimate.getByRole("button", {name:"Aumentar vendedores"}).click();
    assert.equal(await seats.inputValue(), "5");
    await visible(estimate.getByText("5.000 créditos de IA na equipe", {exact:true}));
    await visible(estimate.getByText("R$ 3.250", {exact:true}));
    await visible(estimate.getByText("R$ 1.250 / mês", {exact:true}));
    await visible(estimate.getByText("Inclui R$ 2.000 de implementação única.", {exact:true}));
    assert.equal(await estimate.getByRole("link").count(),0);
    assert.equal(await list.innerText(),allowance);
    await seats.scrollIntoViewIfNeeded();
    await shot(page,"plano-franquia-"+width);
    assert.deepEqual(writes,[]);
  } finally { page.off("request",record); }
}
try {
  const widths=[1440,390];
  for(const width of widths){
    const {ctx,page,session}=await signIn("manager",width);
    try {
      const list=page.getByRole("list",{name:"Créditos do ciclo mensal"});
      await visible(list);
      const res=await ctx.request.get(origin+"/api/v2/credits",{headers:{"X-V2-Context":session.user.id+"/"+session.workspace.id}});
      assert.equal(res.status(),200);
      const data=await res.json();
      const available=list.getByRole("listitem").filter({hasText:"Disponíveis"});
      await visible(available.getByText(String(data.availableCalls),{exact:true}));
      if(capped)await visible(page.getByText("Saldo esgotado",{exact:true}));
      else assert.equal(await page.getByText("Saldo esgotado",{exact:true}).count(),0);
      assert.equal(data.availableCalls===0,capped);
      for (const [label,field] of [["Limite do mês","limitCalls"],["Consumidos","consumedCalls"],["Reservados","reservedCalls"],["Disponíveis","availableCalls"]]) {
        const tile=list.getByRole("listitem").filter({hasText:label});
        await visible(tile.getByText(data[field].toLocaleString("pt-BR"),{exact:true}));
      }
      await checkEstimate(page,width,list);
      await shot(page,"creditos-"+(capped?"sem-saldo":"com-saldo")+"-"+width);
      await page.getByRole("link",{name:"Ver uso da empresa",exact:true}).click();
      await visible(page.getByRole("heading",{name:"Uso da empresa",exact:true}));
    } finally {await ctx.close();}
    console.log(JSON.stringify({width,capped,renderedFromLedger:true,usageLinkWorks:true}));
  }
  {
    const seller=await signIn("seller",390);
    try {
      await visible(seller.page.getByText("Somente gestores podem consultar a franquia da empresa.",{exact:true}));
      await visible(seller.page.getByRole("region",{name:"Simular contratação"}));
      assert.equal(await seller.page.getByRole("list",{name:"Créditos do ciclo mensal"}).count(),0);
    } finally {await seller.ctx.close();}
  }
  assert.deepEqual(errors,[]);
} finally {await browser.close();clearTimeout(watchdog);}
