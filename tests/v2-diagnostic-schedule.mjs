import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";
import {startScheduleFixture} from "./fixtures/diagnostic-schedule.mjs";

const bundle=process.argv[2];
assert.ok(bundle,"Informe o pacote Web compilado.");
const shots=process.env.SA_EVIDENCE_DIR;
if (shots) await mkdir(shots,{recursive:true});
const browser=await chromium.launch({channel:"chrome"});
async function verify(width,role) {
  const fixture=await startScheduleFixture(bundle,{role});
  const {state,origin,line,diagnostic}=fixture;
  const ctx=await browser.newContext({viewport:{width,height:width===390?844:900},timezoneId:"UTC",serviceWorkers:"block"});
  const errors=[];
  await ctx.route(/^https?:/,route=>{
    if (new URL(route.request().url()).origin===origin) return route.continue();
    errors.push("Requisição externa");return route.abort();
  });
  const page=await ctx.newPage();
  page.on("pageerror",err=>errors.push(err.message));
  page.setDefaultTimeout(7000);
  const open=page.getByRole("button",{name:"Ver conexão de "+line.name});
  const panel=page.getByRole("region",{name:"Diagnóstico diário"});
  const text=value=>panel.getByText(value,{exact:true});
  const btn=name=>panel.getByRole("button",{name,exact:true});
  const toggle=panel.getByRole("switch",{name:"Agendar diagnóstico"});
  const time=panel.getByLabel("Horário local"), zone=panel.getByLabel("Fuso horário");
  async function reopen() {
    await page.reload();
    await open.click();
    await panel.waitFor();
  }
  async function save(name) {
    await btn(name).click(); await text("Agenda salva.").waitFor();
    await btn("Salvar alterações").waitFor();
    assert.ok(await btn("Salvar alterações").isDisabled());
  }
  async function shot(name) {
    assert.ok(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    if (shots) await page.screenshot({path:shots+"/"+name+"-"+width+".png",animations:"disabled"});
  }
  async function request(method,id,key) {
    return page.evaluate(async({method,id,context,key})=>{
      const headers={"X-V2-Context":context};
      if(key) headers["Idempotency-Key"]=key;
      const opts={method,headers};
      if(method==="PUT") {
        headers["Content-Type"]="application/json";
        opts.body=JSON.stringify({enabled:false,localTime:"08:00",timeZone:"UTC",version:0});
      }
      return (await fetch("/api/v2/connections/"+id+"/diagnostic-schedule",opts)).status;
    },{method,id,context:fixture.context,key});
  }
  try {
    await page.goto(origin+"/#whatsapps"); await open.click();
    await text("Desativado").waitFor(); await text("Sem execução agendada").waitFor();
    await text("Nenhuma avaliação ainda").waitFor();
    assert.equal(state.writes.length,0);
    if(role==="manager") {
      assert.equal(await toggle.getAttribute("aria-checked"),"false");
      assert.equal(await time.inputValue(),"06:00");assert.equal(await zone.inputValue(),"America/Sao_Paulo");
      assert.equal(await request("PUT",line.id,null),400);assert.equal(state.writes.length,0);
      await toggle.click();await time.fill("08:20");await zone.selectOption("America/Manaus");
      assert.equal(state.writes.length,0);
      await save("Ativar agenda");await text("Ativo").waitFor();
      assert.deepEqual(state.writes[0].body,{enabled:true,localTime:"08:20",timeZone:"America/Manaus",version:0});
      assert.match(state.writes[0].key,/^[0-9a-f-]{36}$/);
      await panel.getByText(/06\/01\/2026.*08:20/).waitFor();await shot("gestor-ativa");
      await reopen();await text("Ativo").waitFor();
      await time.fill("10:45");await zone.selectOption("America/Sao_Paulo");await save("Salvar alterações");
      await panel.getByText(/06\/01\/2026.*10:45/).waitFor();
      assert.deepEqual(state.writes[1].body,{enabled:true,localTime:"10:45",timeZone:"America/Sao_Paulo",version:1});
      state.schedule={...state.schedule,localTime:"07:10",version:3};
      await time.fill("18:45");await btn("Salvar alterações").click();
      await btn("Recarregar agenda").waitFor();assert.ok(await btn("Salvar alterações").isDisabled());
      assert.equal(await time.inputValue(),"18:45");assert.equal(state.schedule.localTime,"07:10");
      await btn("Recarregar agenda").click();await page.waitForFunction(()=>document.querySelector('input[type=time]')?.value==="07:10");
      await toggle.click();await save("Pausar agenda");await text("Pausado").waitFor();
      assert.deepEqual(state.writes[3].body,{enabled:false,localTime:"07:10",timeZone:"America/Sao_Paulo",version:3});
      assert.equal(new Set(state.writes.map(w=>w.key)).size,4);
      await reopen();await text("Pausado").waitFor();await text("Sem execução agendada").waitFor();
      await shot("gestor-pausada");
      state.readError=true;await reopen();await panel.getByRole("alert").waitFor();assert.equal(await toggle.count(),0);
      await page.getByRole("button",{name:"Gerar QR Code"}).click();
      await page.getByRole("img",{name:"QR Code de pareamento do WhatsApp"}).waitFor();
      assert.equal(state.pairings,1);
      state.readError=false;await btn("Tentar novamente").click();await text("Pausado").waitFor();
    } else {
      await text("06:00 · America/Sao_Paulo").waitFor();
      assert.equal(await toggle.count(),0);assert.equal(await time.count(),0);assert.equal(await zone.count(),0);
      assert.equal(await request("PUT",line.id,randomUUID()),403);
      assert.equal(await request("GET",randomUUID()),404);
      assert.equal(await page.getByRole("button",{name:"Gerar QR Code"}).count(),0);
      for(const [decision,label] of Object.entries({
        skipped_connection:"Conexão indisponível no horário agendado",skipped_budget:"Execução ignorada por falta de orçamento",
        missed_slot:"Horário da execução perdido",queued:"Diagnóstico na fila",covered:"Período já coberto por um diagnóstico",
      })) {
        const hasJob=decision==="queued" || decision==="covered";
        state.schedule={...state.schedule,enabled:true,version:1,localTime:"06:00",timeZone:"America/Sao_Paulo",
          nextRunAt:"2026-01-06T09:00:00Z",lastEvaluatedAt:"2026-01-05T09:00:00Z",lastDecision:decision,lastDiagnosticId:hasJob?diagnostic.id:null};
        await reopen();await panel.getByText(label,{exact:false}).waitFor();
        await panel.getByText(/06\/01\/2026.*06:00/).waitFor();
        assert.equal(await panel.getByRole("link",{name:"Abrir diagnóstico"}).count(),hasJob?1:0);
      }
      await shot("vendedor-ultima-avaliacao");
      await panel.getByRole("link",{name:"Abrir diagnóstico"}).click();
      await page.getByRole("heading",{name:"Acompanhamento"}).waitFor();
      assert.ok(page.url().endsWith("#diagnosticos/"+diagnostic.id));
      assert.equal(state.writes.length,0);
    }
    assert.deepEqual(errors,[]);
    console.log("OK",role,width,fixture.revision);
  } finally {await ctx.close();await fixture.close();}
}
try {for(const width of [1440,390]) for (const role of ["manager","seller"]) await verify(width,role);}
finally {await browser.close();}
