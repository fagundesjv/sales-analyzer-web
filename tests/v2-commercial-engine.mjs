import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";
import {json,startFixtureWeb} from "./fixtures/web-bff.mjs";
const bundle=process.argv[2];assert.ok(bundle,"Informe o pacote compilado.");
const shots=process.env.SA_EVIDENCE_DIR;if(shots)await mkdir(shots,{recursive:true});
const browser=await chromium.launch({channel:"chrome"});
async function scenario(width){
  const user={id:randomUUID(),name:"Operadora sintética",email:"operator@example.test"},workspace={id:randomUUID(),name:"Empresa sintética",role:"manager"};
  const line={id:randomUUID(),name:"Linha sintética",source:"evolution",status:"connected"};
  const talk={id:randomUUID(),title:"Cliente recorrente",summary:"Pedido atual",source:"whatsapp",pendingRevision:false,evidence:[{externalId:"m-current",text:"Qual o frete para entrega?",direction:"inbound",occurredAt:new Date().toISOString()}],analysis:{reply:{state:"ready",text:"Sugestão antiga da conversa",evidenceIds:["m-current"]}}};
  const op={id:randomUUID(),conversationId:talk.id,customerId:randomUUID(),legacy:false,title:"Pedido atual",status:"open",outcome:null,version:0};
  let r={revision:"revision-1",summary:"Cliente aguarda o frete deste pedido",step:{writes:true,title:"Informar o frete",action:"Responder o CEP",kind:"answer"},state:"pending",draftState:"ready",draftText:"Me passa o CEP para eu calcular a entrega deste pedido?",evidenceIds:["m-current"],stale:false};
  let round=null,actions=[],followups=[],sends=0,internals=0,consents=0;const receiptKeys=new Set();
  let settings={version:0,cadenceMinutes:60,dailyTime:"08:00",windowDays:7,effective:{cadenceMinutes:60,windowDays:7,reason:null},cadences:[5,10,15,30,60,120,360,720,1440].map(minutes=>({minutes,allowed:true,readsAs:minutes})),windows:[1,7,15,30,60,90].map(days=>({days})),coverage:{read:1,total:1},estimate:{measured:false}};
  let touch={version:0,touchDelaysMinutes:[1440,2880,4320]};
  let policy={connectionId:line.id,version:0,enabled:false,categories:["reply"],timezone:"America/Sao_Paulo",startTime:"08:00",endTime:"18:00",weekdays:[1,2,3,4,5],dailyLimit:20,minGapMinutes:30};
  const fixture=await startFixtureWeb(bundle,0,async(req,res,path)=>{
    if(path==="session")return json(res,200,{user,workspace,workspaces:[workspace],capabilities:{opportunities:true,commercialEngine:true,readingSettings:true}});
    assert.equal(req.headers["x-v2-context"],user.id+"/"+workspace.id);
    let body=null;if(req.method!=="GET"){let raw="";for await(const chunk of req)raw+=chunk;body=raw?JSON.parse(raw):null;assert.ok(req.headers["idempotency-key"]);}
    if(path==="conversations")return json(res,200,{items:[talk],nextCursor:null});
    if(path==="conversations/"+talk.id)return json(res,200,talk);
    if(path.endsWith("/attendance"))return json(res,200,{available:false,messages:[]});
    if(path==="focus"){
      if(req.method==="POST"){round={id:randomUUID(),conversationId:talk.id,status:"running",version:1,activeMs:0,openedCount:1};return json(res,201,round);}
      return json(res,200,{round});
    }
    if(path.startsWith("focus/")){round={...round,status:"finished",version:2};return json(res,200,round);}
    if(path==="conversations/"+talk.id+"/opportunities")return json(res,200,{items:[op],nextCursor:null});
    if(path==="opportunities/summary")return json(res,200,{period:"all_time",scope:"authorized_opportunities",customerIdentity:"source_conversation",opportunities:1,customers:1,sales:0,salesWithoutAmount:0,amountCents:"0"});
    if(path==="opportunities/"+op.id)return json(res,200,{...op,history:{items:[],limited:false}});
    if(path==="opportunities/"+op.id+"/reading")return json(res,200,{opportunityId:op.id,status:op.status,reading:r});
    if(path==="opportunities/"+op.id+"/actions")return json(res,200,{items:actions});
    if(path==="opportunities/"+op.id+"/resolve"){
      assert.equal(body.expectedRevision,r.revision);assert.equal(r.stale,false);
      if(receiptKeys.has(req.headers["idempotency-key"]))return json(res,200,actions[0]);receiptKeys.add(req.headers["idempotency-key"]);
      const send=body.kind==="send";assert.equal(send,r.step.writes);if(send)sends++;else internals++;
      const receipt={id:randomUUID(),opportunityId:op.id,revision:r.revision,kind:body.kind,origin:"manual",state:send?"uncertain":"resolved",reason:send?"delivery_unknown":null};actions.unshift(receipt);
      if(!send)r.state="resolved";return json(res,200,receipt);
    }
    if(path==="opportunities/"+op.id+"/followups"){
      if(body){followups.push({id:randomUUID(),...body,status:"open",version:1});return json(res,201,followups.at(-1));}
      return json(res,200,{items:followups});
    }
    if(path.startsWith("commercial/actions/")){assert.equal(body.providerMessageId,"imported-id");actions[0].state="accepted";r.state="watching";return json(res,200,actions[0]);}
    if(path==="reading-settings"){
      if(body){assert.equal(body.version,settings.version);settings={...settings,...body,version:settings.version+1,effective:{cadenceMinutes:body.cadenceMinutes,windowDays:body.windowDays,reason:null}};}
      return json(res,200,settings);
    }
    if(path==="commercial/settings"){if(body)touch={...body,version:touch.version+1};return json(res,200,touch);}
    if(path==="connections")return json(res,200,{items:[line],nextCursor:null});
    if(path==="connections/"+line.id+"/status")return json(res,200,line);
    if(path.endsWith("/diagnostic-schedule"))return json(res,200,{connectionId:line.id,version:0,enabled:false,localTime:"08:00",timeZone:"America/Sao_Paulo"});
    if(path==="automation/policies/"+line.id){if(body){assert.equal(body.version,policy.version);consents++;policy={...body,connectionId:line.id,version:policy.version+1};}return json(res,200,policy);}
    return json(res,404,{error:{message:"Indisponível"}});
  });
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();page.setDefaultTimeout(12000);
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await context.route(/^https?:/,route=>new URL(route.request().url()).origin===fixture.origin?route.continue():route.abort());
  const choose=async(label,option)=>{await page.getByRole("combobox",{name:label,exact:true}).click();await page.getByRole("option",{name:option,exact:true}).click();};
  const work=page.getByRole("region",{name:"Trabalho da Zoe neste pedido",exact:true});
  try {
    await page.goto(fixture.origin+"/#conversa/"+talk.id);await work.getByText(r.draftText,{exact:true}).waitFor();
    assert.equal(await page.getByText("Sugestão antiga da conversa",{exact:true}).count(),0);assert.equal(sends,0);
    await page.getByRole("button",{name:"Iniciar Foco da Zoe",exact:true}).click();await page.getByRole("button",{name:"Encerrar rodada",exact:true}).click();
    await page.getByRole("button",{name:"Confirmar encerramento",exact:true}).click();await page.getByText(/Rodada encerrada/).waitFor();assert.equal(sends+internals,0);
    await work.getByRole("button",{name:"Resolver e enviar sugestão",exact:true}).click();let dialog=page.getByRole("dialog",{name:"Enviar a sugestão da Zoe?",exact:true});
    await dialog.getByRole("button",{name:"Confirmar Resolver e enviar",exact:true}).dblclick();await dialog.waitFor({state:"hidden"});
    await work.getByText("Entrega incerta",{exact:true}).waitFor();assert.equal(sends,1);assert.equal(await work.getByRole("button",{name:"Resolver e enviar sugestão",exact:true}).count(),0);
    await work.getByRole("button",{name:"Conferir envio",exact:true}).click();dialog=page.getByRole("dialog",{name:"Conferir envio incerto",exact:true});
    await dialog.getByLabel("Identificador da mensagem no canal").fill("imported-id");await dialog.getByRole("button",{name:"Conferir mensagem importada",exact:true}).click();await dialog.waitFor({state:"hidden"});await work.getByText("Em acompanhamento",{exact:true}).waitFor();assert.equal(sends,1);
    r={...r,revision:"revision-2",state:"pending",step:{writes:false,title:"Conferir estoque internamente",action:"Consultar o responsável",kind:"internal"},draftText:"Não deve ser enviada"};
    await work.getByRole("button",{name:"Atualizar trabalho do pedido",exact:true}).click();await work.getByRole("button",{name:"Resolver ação interna",exact:true}).click();
    dialog=page.getByRole("dialog",{name:"Resolver a ação interna?",exact:true});await dialog.getByRole("button",{name:"Confirmar ação interna",exact:true}).click();await dialog.waitFor({state:"hidden"});assert.equal(internals,1);
    r={...r,revision:"revision-3",state:"pending",stale:true,step:{writes:true,title:"Não executar"},draftText:"Sugestão velha não pode aparecer"};
    await work.getByRole("button",{name:"Atualizar trabalho do pedido",exact:true}).click();await work.getByText("Sugestão desatualizada",{exact:true}).waitFor();assert.equal(await work.getByText(r.draftText,{exact:true}).count(),0);assert.equal(await work.getByRole("button",{name:"Resolver e enviar sugestão",exact:true}).count(),0);
    await work.getByRole("button",{name:"Agendar retorno do pedido",exact:true}).click();dialog=page.getByRole("dialog",{name:"Agendar retorno do pedido",exact:true});
    await dialog.getByLabel("Próxima ação",{exact:true}).fill("Conferir entrega deste pedido");await dialog.getByRole("button",{name:"Agendar para este pedido",exact:true}).click();await dialog.waitFor({state:"hidden"});await work.getByText("Conferir entrega deste pedido",{exact:true}).waitFor();
    if(shots)await page.screenshot({path:shots+`/pedido-motor-${width}.png`,fullPage:true});
    await page.goto(fixture.origin+"/#empresa");await page.getByRole("heading",{name:"Periodicidade e período de análise",exact:true}).waitFor();
    await choose("Conversas de qual período","Último dia");await choose("A cada quanto tempo analisar","A cada 15 minutos");
    await page.getByRole("button",{name:"Salvar periodicidade e período",exact:true}).click();await page.getByText("Periodicidade e período salvos.",{exact:true}).waitFor();assert.equal(settings.windowDays,1);
    await choose("Conversas de qual período","Escolher quantidade de dias");await page.getByLabel("Quantidade de dias da análise",{exact:true}).fill("45");
    await page.getByRole("button",{name:"Salvar periodicidade e período",exact:true}).click();await page.getByText("Últimos 45 dias",{exact:true}).waitFor();assert.equal(settings.windowDays,45);
    await page.getByLabel("Prazo do toque 1 em minutos",{exact:true}).fill("60");await page.getByRole("button",{name:"Salvar cadência de follow-ups",exact:true}).click();
    await page.goto(fixture.origin+"/#whatsapps");await page.getByRole("button",{name:"Ver conexão de Linha sintética",exact:true}).click();
    dialog=page.getByRole("dialog",{name:"Linha sintética",exact:true});await dialog.getByRole("switch",{name:"Envio automático da Zoe nesta linha",exact:true}).check();
    assert.equal(await dialog.getByRole("button",{name:"Ativar envio automático",exact:true}).isDisabled(),true);assert.equal(consents,0);
    await dialog.getByRole("checkbox",{name:"Autorizo a Zoe a enviar automaticamente nas condições acima",exact:true}).check();await dialog.getByRole("button",{name:"Ativar envio automático",exact:true}).click();await dialog.getByText("Consentimento e condições salvos.",{exact:true}).waitFor();assert.equal(policy.enabled,true);
    await dialog.getByRole("switch",{name:"Envio automático da Zoe nesta linha",exact:true}).uncheck();await dialog.getByRole("button",{name:"Salvar envio automático desligado",exact:true}).click();await dialog.getByText("Desligado. A Zoe só envia automaticamente após sua autorização.",{exact:true}).waitFor();assert.equal(policy.enabled,false);assert.equal(consents,2);
    assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(shots)await page.screenshot({path:shots+`/automacao-${width}.png`,fullPage:true});
    console.log(JSON.stringify({width,resolveExactlyOnce:true,focusNotResolve:true,internal:true,staleBlocked:true,followupByOrder:true,oneDayWindow:true,explicitConsent:true}));
  } finally {await context.close();await fixture.close();}
}
try {for(const width of [1440,390])await scenario(width);} finally {await browser.close();}
