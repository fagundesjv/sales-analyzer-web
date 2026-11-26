import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";
import {staffWeb,json} from "./fixtures/staff-web.mjs";

const bundle=process.argv[2];assert.ok(bundle,"Informe o pacote compilado.");
const shots=process.env.SA_EVIDENCE_DIR;if(shots)await mkdir(shots,{recursive:true});
const browser=await chromium.launch({channel:"chrome"});
async function scenario(width,owner){
  const id=randomUUID(),workspaceId=randomUUID(),conversationId=randomUUID();
  const session={staff:{id,name:"Equipe sintética",role:owner?"owner":"viewer"},secondFactor:{state:"verified"}};
  const data={canEdit:owner,protocols:["openai","gemini","typesafe","firecrawl"],stages:["draft","classify","transcribe","image","document","chat","link"],
    providers:[{id:"openai",label:"OpenAI",protocol:"openai",host:"api.openai.com",credentialRef:"openai",enabled:true,version:1}],
    models:[{provider:"openai",model:"main-test",label:"Principal sintético",stages:["draft"],enabled:true,shadowOnly:false,version:1},
      {provider:"openai",model:"candidate-test",label:"Candidato sintético",stages:["draft"],enabled:true,shadowOnly:false,version:1}],
    prices:[{provider:"openai",model:"main-test",validFrom:"2020-01-01",verifiedAt:"2020-01-01",rates:{tipo:"tokens",entrada:1,saida:2},source:"https://prices.example.test"}],
    settings:{version:1,shadowMonthlyMicros:"1000000"}};
  let current={stage:"draft",version:null,principal:"openai:main-test",reserve:null,shadow:null,shadowPercent:0,timeoutMs:15000},history=[];
  const draft={workspaceId,conversationId,revision:"revision-test",state:"no_quota",reason:"ai_cost_limit"};
  const overview={calls:[{mode:"local_simulated",stage:"draft",provider:"openai",model:"main-test",lane:"principal",state:"settled",calls:3,settledMicros:"321",reservedMicros:"0",latencyMs:120}],
    failures:[],queue:{drafts:2,diagnostics:1,oldestDraft:null},budgets:[{workspaceId,name:"Empresa sintética",monthlyMicros:"10000000",settledMicros:"321",reservedMicros:"0",blockedReason:null}],draftFailures:[draft]};
  let writes=0,promotions=0,reprocessed=0;
  const fixture=await staffWeb(bundle,(req,res,path,body,token)=>{
    if(path==="auth/session")return json(res,200,{token,session});
    if(path==="session")return req.method==="DELETE"?json(res,204):json(res,200,session);
    if(req.method!=="GET"){assert.ok(owner);writes++;}
    if(path==="ai/catalog"){
      if(req.method==="GET")return json(res,200,data);
      if(body.kind==="tariff"){data.prices.unshift({...body.item,verifiedAt:new Date().toISOString()});assert.equal(body.item.verified,true);}
      if(body.kind==="provider")data.providers.push({...body.item,version:1});
      if(body.kind==="shadowBudget"){assert.equal(body.item.expectedVersion,data.settings.version);data.settings={shadowMonthlyMicros:body.item.monthlyMicros,version:data.settings.version+1};}
      return json(res,201,{saved:true});
    }
    if(path==="ai/routes/draft"){
      if(req.method==="GET")return json(res,200,{current,history,problem:null,evaluation:current.shadow?{calls:12,agreement:{accepted:1},missing:["amostra da sombra: 12 de 200"]}:null});
      assert.equal(body.expectedVersion,current.version);
      if(body.action==="promote"){promotions++;return json(res,409,{error:{code:"ai_route_rejected",message:"Não promove: amostra da sombra: 12 de 200; menos de 7 dias de sombra"}});}
      if(body.action==="rollback")current={...current,shadow:null,shadowPercent:0,version:"2"};
      else current={...current,...body.route,version:"1"};
      history.unshift({...current,kind:body.action,reason:body.reason,author:session.staff.name,at:new Date().toISOString()});
      return json(res,200,{version:current.version,route:current});
    }
    if(path==="ai/overview")return json(res,200,overview);
    if(path==="ai/budgets/"+workspaceId){assert.equal(body.expectedMonthlyMicros,"10000000");overview.budgets[0].monthlyMicros=body.monthlyMicros;return json(res,200,{saved:true});}
    if(path==="ai/reprocess"){assert.equal(body.revision,draft.revision);reprocessed++;overview.draftFailures=[];return json(res,202,{queued:true});}
    return json(res,404,{error:{message:"Indisponível"}});
  });
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();page.setDefaultTimeout(12000);
  const errors=[];page.on("pageerror",error=>errors.push(error.message));
  await context.route(/^https?:/,route=>new URL(route.request().url()).origin===fixture.origin?route.continue():route.abort());
  const choose=async(label,text)=>{await page.getByRole("combobox",{name:label,exact:true}).click();await page.getByRole("option",{name:text,exact:true}).click();};
  const dialog=name=>page.getByRole("dialog",{name,exact:true});
  try {
    await page.goto(fixture.origin+"/#central-ia");
    await page.getByLabel("E-mail",{exact:true}).fill("staff@example.test");await page.getByLabel("Senha",{exact:true}).fill("synthetic-pass");
    await page.getByRole("button",{name:"Entrar na Central",exact:true}).click();
    await page.getByRole("heading",{name:"Central de IA",exact:true}).waitFor();
    await page.getByRole("combobox",{name:"Modelo de reserva",exact:true}).waitFor();
    assert.equal(await context.cookies().then(items=>items.filter(item=>item.name==="sa2_staff").every(item=>item.httpOnly)),true);
    if(owner){
      await page.getByRole("button",{name:"Biblioteca",exact:true}).click();await page.getByRole("button",{name:"Registrar tarifa",exact:true}).click();
      await choose("Modelo da tarifa","Candidato sintético · openai:candidate-test");
      const tariff=dialog("Registrar tarifa");
      await tariff.getByLabel("Entrada USD por milhão",{exact:true}).fill("1");await tariff.getByLabel("Saída USD por milhão",{exact:true}).fill("2");
      await tariff.getByLabel("Fonte oficial da tarifa").fill("https://prices.example.test/synthetic");await tariff.getByLabel("Vigência (horário local)").fill("2026-01-01T09:00");
      await tariff.getByRole("checkbox",{name:"Conferi valores e condições na fonte oficial"}).check();await tariff.getByLabel("Motivo da alteração").fill("Validação sintética de tarifas");
      await tariff.getByRole("button",{name:"Salvar cadastro",exact:true}).click();await tariff.waitFor({state:"hidden"});
      await page.getByRole("button",{name:"Modelos por função",exact:true}).click();
      await choose("Modelo em sombra","Candidato sintético · openai:candidate-test");
      await page.getByLabel("Percentual de sombra",{exact:true}).fill("10");await page.getByLabel("Motivo e avaliação de prazo e custo",{exact:true}).fill("Comparar qualidade e custo em sombra");
      await page.getByRole("button",{name:"Salvar reserva e sombra",exact:true}).click();await page.getByText("amostra da sombra: 12 de 200",{exact:true}).waitFor();
      await page.getByLabel("Motivo e avaliação de prazo e custo",{exact:true}).fill("Verificar bloqueio por amostra pequena");
      await page.getByRole("button",{name:"Promover modelo avaliado",exact:true}).click();const promote=dialog("Promover modelo avaliado");
      for(const [label,value] of [["Conversas rotuladas por pessoas","60"],["Acertos da principal","58"],["Acertos do candidato","59"]])await promote.getByLabel(label,{exact:true}).fill(value);
      await promote.getByRole("button",{name:"Validar e promover",exact:true}).click();await promote.getByRole("alert").filter({hasText:"Não promove"}).waitFor();
      assert.equal(promotions,1);assert.equal(current.principal,"openai:main-test");
      await page.keyboard.press("Escape");
      await page.getByRole("button",{name:"Reverter última mudança",exact:true}).click();
      await page.getByText("Versão 2",{exact:true}).waitFor();
    }else {assert.equal(await page.getByRole("button",{name:"Salvar reserva e sombra",exact:true}).count(),0);}
    await page.getByRole("button",{name:"Custo e operação",exact:true}).click();await page.getByText("Custo liquidado USD",{exact:true}).waitFor();
    if(owner){
      await page.getByRole("button",{name:"Alterar orçamento de Empresa sintética",exact:true}).click();const budget=dialog("Orçamento de IA da empresa");
      await budget.getByLabel("Limite mensal em USD").fill("20");await budget.getByLabel("Motivo",{exact:true}).fill("Novo teto sintético");await budget.getByRole("button",{name:"Salvar orçamento",exact:true}).click();await budget.waitFor({state:"hidden"});
      await page.getByRole("button",{name:"Reprocessar sugestão",exact:true}).click();const retry=dialog("Reprocessar sugestão elegível");
      await retry.getByLabel("Motivo",{exact:true}).fill("Saldo restaurado no teste");await retry.getByRole("button",{name:"Enfileirar sugestão",exact:true}).click();await retry.waitFor({state:"hidden"});
      assert.equal(reprocessed,1);assert.equal(overview.budgets[0].monthlyMicros,"20000000");
    }else assert.equal(writes,0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(errors,[]);
    if(shots)await page.screenshot({path:shots+`/central-ia-${width}-${owner?"owner":"viewer"}.png`,fullPage:true});
    await page.getByRole("button",{name:"Sair da Central",exact:true}).click();await page.getByRole("button",{name:"Entrar na Central",exact:true}).waitFor();
    console.log("Central IA browser passou",width,owner?"owner":"viewer");
  } finally {await context.close();await fixture.close();}
}
try {for(const width of [1440,390]){await scenario(width,true);await scenario(width,false);}} finally {await browser.close();}
