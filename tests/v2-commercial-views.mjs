import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {mkdir,readFile} from "node:fs/promises";
import {chromium} from "playwright";
import {json,startFixtureWeb} from "./fixtures/web-bff.mjs";
import {commercialFilters,commercialSignals} from "../lib/commercial-views.js";
const bundle=process.argv[2];assert.ok(bundle,"Informe o pacote compilado.");
const evidence=process.env.SA_EVIDENCE_DIR;if(evidence)await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({channel:"chrome"});
async function scenario(width){
  const user={id:randomUUID(),name:"Gestora sintética",email:"manager@example.test"},seller={id:randomUUID(),name:"Vendedora sintética",role:"seller",assignedConnectionCount:1},workspace={id:randomUUID(),name:"Empresa de aceite",role:"manager"};
  const line={id:randomUUID(),name:"Linha sintética",source:"whatsapp"},conversationId=randomUUID();
  const talk={id:conversationId,title:"Cliente recorrente",summary:"Novo pedido em atendimento",connectionId:line.id,source:"whatsapp",revision:"r1",pendingRevision:false,evidence:[],analysis:null,outcome:null,favorite:true};
  const opA={id:randomUUID(),conversationId,customerId:randomUUID(),title:"Pedido A",legacy:false,version:1,status:"won",outcome:{status:"won",amountCents:12500,origin:"manual",recordedAt:"2026-11-25T14:00:00Z",confirmedAt:"2026-11-25T14:00:00Z",credit:{by:"team"}}};
  const opB={...opA,id:randomUUID(),title:"Pedido B",outcome:{...opA.outcome,amountCents:null,recordedAt:"2026-11-26T14:00:00Z",confirmedAt:"2026-11-26T14:00:00Z",credit:{by:"unknown"}}};
  const foreign={...opB,id:randomUUID(),conversationId:randomUUID(),title:"Pedido de outro cliente"};
  const counts=Object.fromEntries(commercialFilters.map((f,i)=>[f.id,f.id==="todas"?7:1+i%3]));
  const cursor="signed.page-token_+opaque==",calls=[],filters=new Set();let reportReads=0,foreignActions=0;
  const common=params=>({scope:{from:new Date(Date.parse("2026-11-26T12:00:00Z")-Number(params.get("windowDays")||7)*86400000).toISOString(),through:"2026-11-26T12:00:00Z",windowDays:Number(params.get("windowDays")||7),timeZone:"America/Sao_Paulo",connectionId:params.get("connectionId"),ownerId:params.get("ownerId")},takenAt:"2026-11-26T12:00:00Z",coverage:{state:"partial",reasons:["missing_sources"],unread:1,stale:1,missingSources:1}});
  const fixture=await startFixtureWeb(bundle,0,async(req,res,path)=>{
    if(path==="session")return json(res,200,{user,workspace,workspaces:[workspace],capabilities:{commercialViews:true,commercialEngine:true,opportunities:true}});
    assert.equal(req.headers["x-v2-context"],user.id+"/"+workspace.id);const params=new URL(req.url,"http://local").searchParams;calls.push({path,params:Object.fromEntries(params)});
    if(path==="connections")return json(res,200,{items:[line],nextCursor:null});
    if(path==="team")return json(res,200,{items:[{...user,role:"manager",assignedConnectionCount:1},seller],nextCursor:null});
    if(path==="commercial/inbox"){
      const filter=params.get("filter")||"todas";assert.ok(commercialFilters.some(f=>f.id===filter));filters.add(filter);
      if(params.has("cursor"))assert.equal(params.get("cursor"),cursor);
      return json(res,200,{...common(params),items:[talk],nextCursor:params.has("cursor")?null:cursor,counts});
    }
    if(path==="commercial/sales"){const {coverage,...period}=common(params);return json(res,200,{...period,items:[opA,opB].map(op=>({opportunityId:op.id,opportunityTitle:op.title,conversationId,customerId:op.customerId,title:talk.title,lineId:line.id,lineName:line.name,recordedAt:op.outcome.recordedAt,confirmedAt:op.outcome.confirmedAt,amountCents:op.outcome.amountCents===null?null:String(op.outcome.amountCents),origin:"manual",credit:op.outcome.credit})),nextCursor:null,summary:{sales:2,salesWithoutAmount:1,amountCents:"12500"}});}
    if(path==="commercial/report"){
      reportReads++;return json(res,200,{...common(params),title:"Raio-X comercial de aceite",metrics:[{id:"conversations",label:"Conversas analisadas",value:7,unit:"count",filter:"todas"},{id:"risk",label:"Em risco",value:3,unit:"count",filter:"em_risco"},{id:"sales",label:"Vendas confirmadas",value:2,unit:"count"},{id:"amountCents",label:"Valor conhecido",value:"12500",unit:"cents"}],signals:commercialSignals.map((s,i)=>({id:s.id,label:s.name,count:i%4,base:7,signal:s.id})),temperatures:[{id:"quente",label:"Quentes",count:3},{id:"morno",label:"Mornos",count:2},{id:"frio",label:"Frios",count:1},{id:"inconclusivo",label:"Sem temperatura",count:1}],series:[{day:"2026-11-25",conversations:4,sales:1,amountCents:"12500"},{day:"2026-11-26",conversations:3,sales:1,amountCents:"0"}],priority:{items:[talk],total:3}});
    }
    if(path==="conversations/"+conversationId)return json(res,200,talk);
    if(path==="conversations/"+conversationId+"/opportunities")return json(res,200,{items:[opA,opB],nextCursor:null});
    if(path==="opportunities/summary")return json(res,200,{sales:2,salesWithoutAmount:1,amountCents:"12500"});
    if(path.startsWith("opportunities/")){
      const id=path.split("/")[1],op=[opA,opB,foreign].find(op=>op.id===id);if(!op)return json(res,404,{error:{code:"not_found",message:"Pedido indisponível"}});
      if(id===foreign.id&&path!=="opportunities/"+id)foreignActions++;
      if(path.endsWith("/reading"))return json(res,200,{opportunityId:id,reading:null});
      if(path.endsWith("/actions")||path.endsWith("/followups"))return json(res,200,{items:[]});
      return json(res,200,{...op,history:{items:[],limited:false}});
    }
    if(path.endsWith("/attendance"))return json(res,200,{available:false,messages:[]});
    if(path==="focus")return json(res,200,{round:null});
    return json(res,404,{error:{code:"not_found",message:"Indisponível"}});
  });
  const context=await browser.newContext({viewport:{width,height:width<600?844:1000},reducedMotion:"reduce"}),page=await context.newPage();page.setDefaultTimeout(16000);
  const errors=[];page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error"&&/same key|unique.*key/i.test(m.text()))errors.push("duplicate_row_key");});
  try{
    await page.goto(fixture.origin+"/#entrada");await page.getByRole("combobox",{name:"Recorte das conversas",exact:true}).waitFor();
    for(const f of commercialFilters){
      const result=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith("/commercial/inbox")&&new URL(r.url()).searchParams.get("filter")===f.id);
      await page.getByRole("combobox",{name:"Recorte das conversas",exact:true}).click();await page.getByRole("option",{name:`${f.name} (${counts[f.id]})`,exact:true}).click();
      // The first item may already be selected; no redundant fetch is required.
      if(f.id!=="todas")await result;else result.catch(()=>{});
      await page.getByRole("combobox",{name:"Recorte das conversas",exact:true}).waitFor();
    }
    assert.equal(filters.size,22);
    await page.getByRole("button",{name:"Conferir cobertura do recorte",exact:true}).click();await page.getByRole("dialog",{name:"Cobertura do recorte",exact:true}).getByText("Parte das fontes não está disponível.",{exact:true}).waitFor();await page.getByRole("button",{name:"Voltar às conversas",exact:true}).click();
    await page.getByText("Período, linhas e responsáveis",{exact:true}).click();
    await page.getByRole("combobox",{name:"Período do relatório",exact:true}).click();await page.getByRole("option",{name:"Período personalizado",exact:true}).click();
    await page.getByLabel("Dias do relatório",{exact:true}).fill("41");await page.getByRole("button",{name:"Aplicar período",exact:true}).click();
    await page.getByRole("combobox",{name:"Linha de atendimento",exact:true}).click();await page.getByRole("option",{name:line.name,exact:true}).click();
    await page.getByRole("combobox",{name:"Responsável pela linha",exact:true}).click();await page.getByRole("option",{name:seller.name,exact:true}).click();
    await page.getByRole('dialog',{name:'Escopo das conversas',exact:true}).getByRole('button',{name:'Ver conversas',exact:true}).click();
    await page.getByRole("checkbox",{name:"Somente favoritas",exact:true}).click();await page.waitForFunction(()=>new URLSearchParams(location.hash.split('?')[1]).get('favorite')==='true');await page.getByLabel("Buscar conversas",{exact:true}).fill("mensagem teste");
    await page.waitForResponse(r=>new URL(r.url()).pathname.endsWith("/commercial/inbox")&&new URL(r.url()).searchParams.get("q")==="mensagem teste");
    const last=calls.filter(c=>c.path==="commercial/inbox").at(-1).params;assert.equal(last.windowDays,"41");assert.equal(last.connectionId,line.id);assert.equal(last.ownerId,seller.id);assert.equal(last.favorite,"true");
    const next=page.waitForResponse(r=>new URL(r.url()).searchParams.get("cursor")===cursor);await page.getByRole("button",{name:"Próxima",exact:true}).click();await next;assert.equal(calls.filter(c=>c.path==="commercial/inbox").at(-1).params.windowDays,"41");
    if(evidence)await page.screenshot({path:evidence+`/inbox-${width}.png`,fullPage:true});
    await page.goto(fixture.origin+"/#resultados?windowDays=41&connectionId="+line.id+"&ownerId="+seller.id);
    await page.getByText("Vendas sem valor informado",{exact:true}).waitFor();await page.getByText(/^Período de /).waitFor();assert.equal(await page.getByRole("link",{name:talk.title}).count(),2);await page.getByText("Valor não informado",{exact:true}).waitFor();
    if(evidence)await page.screenshot({path:evidence+`/sales-${width}.png`,fullPage:true});
    await page.getByRole("link",{name:talk.title+" · "+opB.title,exact:true}).click();await page.getByRole("region",{name:"Pedido selecionado",exact:true}).getByText("Pedido B",{exact:true}).first().waitFor();assert.ok(page.url().includes(opB.id));
    await page.goto(fixture.origin+"/#conversa/"+conversationId+"/pedido/"+foreign.id);await page.getByText("Este pedido não pertence a esta conversa.",{exact:true}).waitFor();assert.equal(foreignActions,0);
    await page.goto(fixture.origin+"/#raio-x?windowDays=41&connectionId="+line.id+"&ownerId="+seller.id);await page.getByRole("article",{name:"Raio-X comercial autorizado",exact:true}).waitFor();await page.getByRole("article",{name:"Raio-X comercial autorizado",exact:true}).getByText("1 exibida de 3 no conjunto autorizado",{exact:true}).waitFor();
    const signal=page.waitForResponse(r=>new URL(r.url()).searchParams.get("signal")===commercialSignals[0].id);await page.getByRole("link",{name:commercialSignals[0].name,exact:true}).click();await signal;assert.ok(page.url().includes("windowDays=41"));
    await page.goto(fixture.origin+"/#raio-x?windowDays=41&connectionId="+line.id+"&ownerId="+seller.id);await page.getByRole("button",{name:"Imprimir ou salvar PDF",exact:true}).waitFor();
    if(evidence){await page.screenshot({path:evidence+`/report-${width}.png`,fullPage:true});if(width===1440){
      await page.evaluate(()=>window.addEventListener('beforeprint',()=>{const report=document.querySelector('[data-commercial-print-root]');window.__nativePrintProof={armed:document.body.dataset.commercialPrint==='1',text:report.textContent};},{once:true}));
      const path=evidence+"/report-native.pdf";await page.pdf({path,format:"A4",printBackground:true,preferCSSPageSize:true});const bytes=await readFile(path);assert.equal(bytes.subarray(0,5).toString(),"%PDF-");assert.ok(bytes.length>10000,'O relatório nativo não pode ser uma página vazia.');const proof=await page.evaluate(()=>window.__nativePrintProof);assert.equal(proof.armed,true);assert.ok(proof.text.includes('Conversas analisadas'));assert.equal(await page.evaluate(()=>document.body.hasAttribute('data-commercial-print')),false);await page.emulateMedia({media:"screen"});}}
    await page.clock.install();await page.getByRole("link",{name:"Abrir TV",exact:true}).click();await page.getByRole("region",{name:"TV da operação",exact:true}).waitFor();assert.equal(await page.getByText(talk.title,{exact:true}).count(),0);
    const before=reportReads,refreshed=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith("/commercial/report"));await page.clock.fastForward(31000);await refreshed;assert.ok(reportReads>before);
    if(evidence)await page.screenshot({path:evidence+`/tv-${width}.png`,fullPage:true});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
    console.log(JSON.stringify({width,all22Filters:true,globalCounts:true,scopeAndFavorites:true,opaqueCursor:true,twoSalesSameConversation:true,unknownAmount:true,correctOrderDeepLink:true,foreignOrderBlocked:true,scenarioDrilldown:true,realReport:true,nativePdf:width===1440&&!!evidence,tvRefresh:true,tvNamesHidden:true}));
  }catch(error){console.error(JSON.stringify({width,browserErrors:errors}));if(evidence)await page.screenshot({path:evidence+`/failure-${width}.png`,fullPage:true});throw error;}finally{await context.close();await fixture.close();}
}
async function disabled(width,incompatible=false){
  const user={id:randomUUID(),name:"Gestora sintética",email:"manager@example.test"},workspace={id:randomUUID(),name:"Empresa sintética",role:"manager"},calls=[];
  const fixture=await startFixtureWeb(bundle,0,(req,res,path)=>{
    calls.push(path);
    if(path==="session")return json(res,200,{user,workspace,workspaces:[workspace],capabilities:incompatible?{commercialViews:true}:{}});
    if(path==="summary")return json(res,200,{conversations:4,opportunities:1,pendingWins:{count:0,amountCents:"0"},confirmedWins:{count:1,amountCents:"900"},lost:0,resolved:0,source:"whatsapp"});
    if(path==="conversations")return json(res,200,{items:[],nextCursor:null});
    if(path==="connections"||path==="team")return json(res,200,{items:[],nextCursor:null});
    return json(res,404,{error:{code:"not_found",message:"Relatório indisponível nesta versão."}});
  });
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:"reduce"}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    if(!incompatible){await page.goto(fixture.origin+'/#resultados');await page.getByRole('heading',{name:'Ganhos',exact:true}).waitFor();assert.ok(calls.includes('summary'));assert.ok(calls.includes('conversations'));}
    for(const route of ['tv','raio-x']){await page.goto(fixture.origin+'/#'+route);await page.getByText(incompatible?'Relatório indisponível nesta versão.':'Esta área ainda não está disponível.',{exact:true}).waitFor();assert.equal(await page.getByRole('article',{name:'Raio-X comercial autorizado',exact:true}).count(),0);}
    if(!incompatible)assert.equal(calls.some(path=>path.startsWith('commercial/')),false);else assert.equal(calls.includes('summary'),false);
    assert.deepEqual(errors,[]);console.log(JSON.stringify({width,commercialViewsEnabled:false,incompatible,legacyRealApi:!incompatible,noDemoFallback:true}));
  }finally{await context.close();await fixture.close();}
}
try{for(const width of [1440,390]){await scenario(width);await disabled(width);await disabled(width,true);}}finally{await browser.close();}
