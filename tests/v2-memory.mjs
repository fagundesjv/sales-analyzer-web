import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";
import {json,startFixtureWeb} from "./fixtures/web-bff.mjs";
const bundle=process.argv[2];assert.ok(bundle,"Informe o pacote compilado.");
const shots=process.env.SA_EVIDENCE_DIR;if(shots)await mkdir(shots,{recursive:true});
const browser=await chromium.launch({channel:"chrome"});
async function scenario(width){
  const user={id:randomUUID(),name:"Gestora sintética",email:"manager@example.test"},workspace={id:randomUUID(),name:"Empresa sintética",role:"manager"};
  const source={id:randomUUID(),version:1,scope:"company",kind:"policy",title:"Política comercial",text:"Condições da loja. "+"Texto original. ".repeat(400)+"FIM DO DOCUMENTO",metadata:{},evidenceIds:[]};
  const customer={id:randomUUID(),version:1,scope:"customer",kind:"summary",title:"Histórico do cliente",text:"O cliente já comprou uma vez.",metadata:{generated:true},evidenceIds:[]};
  const negotiation={...customer,id:randomUUID(),scope:"opportunity",title:"Pedido deste mês",text:"O cliente aguarda entrega deste novo pedido."};
  const chunk={...source,id:randomUUID(),title:"Trecho comercial",text:"Trecho do material.",metadata:{contentRole:"chunk",parentSourceId:source.id,chunkIndex:0}};
  const sources=[source,customer,negotiation,chunk],talk={id:randomUUID(),title:"Cliente recorrente",source:"nowz",summary:"Novo pedido",pendingRevision:false,evidence:[{externalId:"m1",direction:"inbound",occurredAt:new Date().toISOString(),text:"Qual é o prazo?"}],analysis:{memorySources:[{...source,reference:"kb:"+source.id+":v1"},{id:"c1",version:1,title:"Fonte inventada",reference:"c1"}],reply:{state:"ready",text:"Vou conferir o prazo da entrega para você.",evidenceIds:["m1","kb:"+source.id+":v1"]}}};
  const op={id:randomUUID(),conversationId:talk.id,customerId:randomUUID(),title:"Pedido atual",legacy:false,status:"open",outcome:null,version:0};
  let imports=0,deleted=0,nowz=0;const jobs=new Map();
  const fixture=await startFixtureWeb(bundle,0,async(req,res,path)=>{
    if(path==="session")return json(res,200,{user,workspace,workspaces:[workspace],capabilities:{memory:true,opportunities:true}});
    assert.equal(req.headers["x-v2-context"],user.id+"/"+workspace.id);
    let body=null;if(req.method!=="GET"){let raw="";for await(const part of req)raw+=part;body=JSON.parse(raw);assert.ok(req.headers["idempotency-key"]);}
    if(path==="memory/search"){
      const params=new URL(req.url,"http://local").searchParams,scope=params.get("scope");
      if(params.has("opportunityId")){assert.equal(params.get("conversationId"),talk.id);assert.equal(params.get("opportunityId"),op.id);}
      return json(res,200,{version:"synthetic",sources:sources.filter(s=>!s.deleted&&s.scope===scope).map(s=>({...s,text:s.text.slice(0,4000)})),dependencies:[]});
    }
    if(path.startsWith("memory/sources/")){const s=sources.find(s=>s.id===path.split("/").at(-1)&&!s.deleted);return json(res,s?200:404,s||{error:{code:"not_found",message:"Fonte indisponível."}});}
    if(path==="memory/documents"){
      const s={...body,id:randomUUID(),version:1,metadata:{},evidenceIds:[]};sources.push(s);return json(res,201,s);
    }
    if(path.startsWith("memory/documents/")){
      const s=sources.find(s=>s.id===path.split("/").at(-1));assert.equal(body.expectedVersion,s.version);
      if(req.method==="DELETE"){s.deleted=true;deleted++;return json(res,204);}
      assert.ok(body.text.endsWith("FIM DO DOCUMENTO"),"Editing must use full source, never a truncated retrieval snippet");Object.assign(s,body,{version:s.version+1});return json(res,200,s);
    }
    if(path==="memory/materials"){
      assert.ok(body.content.length>8192,"Material must cross the dedicated BFF body limit");imports++;const s=sources.find(s=>s.id===body.sourceId);assert.equal(body.expectedVersion,s.version);
      s.version++;s.text=Buffer.from(body.content,"base64").toString("utf8");const id=randomUUID();jobs.set(id,{id,source_id:s.id,state:"ready",critical:false,coverage:{complete:true},deadline_at:new Date().toISOString(),error_code:null});return json(res,202,{job_id:id,state:"pending",deadline_at:new Date().toISOString()});
    }
    if(path.startsWith("memory/materials/"))return json(res,200,jobs.get(path.split("/").at(-1)));
    if(path==="conversations")return json(res,200,{items:[talk],nextCursor:null});
    if(path==="conversations/"+talk.id)return json(res,200,talk);
    if(path.endsWith("/attendance"))return json(res,200,{available:false,messages:[]});
    if(path==="focus")return json(res,200,{round:null});
    if(path==="conversations/"+talk.id+"/opportunities")return json(res,200,{items:[op],nextCursor:null});
    if(path==="opportunities/"+op.id)return json(res,200,{...op,history:{items:[],limited:false}});
    if(path==="opportunities/summary")return json(res,200,{sales:0,salesWithoutAmount:0,amountCents:"0"});
    if(path==="sources/capabilities")return json(res,200,{items:[],providers:[{id:"evolution"},{id:"nowz",setup:"verified_binding"},{id:"datacrazy",available:false}]});
    if(path==="sources/nowz"){nowz++;assert.equal(body.credentialRef,"prepared-binding");return json(res,201,{id:randomUUID(),provider:"nowz",coverage:{state:"partial",historyComplete:false},sending:false});}
    return json(res,404,{error:{message:"Indisponível"}});
  });
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();page.setDefaultTimeout(12000);
  const errors=[];page.on("pageerror",error=>errors.push(error.message));
  await context.route(/^https?:/,route=>new URL(route.request().url()).origin===fixture.origin?route.continue():route.abort());
  const dialog=()=>page.getByRole("dialog",{name:"Fonte de conhecimento",exact:true});
  const choose=async(label,option)=>{await page.getByRole("combobox",{name:label,exact:true}).click();await page.getByRole("option",{name:option,exact:true}).click();};
  try {
    await page.goto(fixture.origin+"/#empresa");await page.getByRole("region",{name:"Trecho comercial",exact:true}).getByRole("button",{name:"Abrir fonte completa",exact:true}).click();
    await dialog().getByText("Trecho de um material maior. Edições e remoções são feitas na fonte original.",{exact:true}).waitFor();assert.equal(await dialog().getByRole("button",{name:"Editar fonte completa",exact:true}).count(),0);
    await dialog().getByRole("button",{name:"Abrir fonte original",exact:true}).click();
    await dialog().getByRole("button",{name:"Editar fonte completa",exact:true}).click();assert.ok((await dialog().getByLabel("Conteúdo da fonte",{exact:true}).inputValue()).endsWith("FIM DO DOCUMENTO"));
    await dialog().getByRole("button",{name:"Salvar fonte",exact:true}).click();await dialog().getByText("FIM DO DOCUMENTO",{exact:false}).waitFor();assert.equal(source.version,2);
    await page.keyboard.press("Escape");
    await page.getByRole("button",{name:"Adicionar conhecimento da empresa",exact:true}).click();await choose("Tipo da fonte","Documento");
    const create=page.getByRole("dialog",{name:"Conhecimento da empresa",exact:true});await create.getByLabel("Título da fonte",{exact:true}).fill("Lista importada");await create.getByRole("button",{name:"Salvar fonte",exact:true}).click();
    await dialog().getByText("Lista importada",{exact:true}).waitFor();await dialog().getByText("Importar ou substituir material desta fonte",{exact:true}).click();
    await dialog().getByLabel("Arquivo de conhecimento",{exact:true}).setInputFiles({name:"conhecimento.txt",mimeType:"text/plain",buffer:Buffer.from("Material autorizado. ".repeat(1000))});
    await dialog().getByRole("button",{name:"Importar material",exact:true}).click();await dialog().getByText("Material importado",{exact:true}).waitFor();assert.equal(imports,1);
    await dialog().getByRole("button",{name:"Conferir conteúdo e versão importados",exact:true}).click();await dialog().getByText("Material autorizado.",{exact:false}).waitFor();
    await dialog().getByRole("button",{name:"Remover fonte",exact:true}).click();await dialog().getByRole("button",{name:"Confirmar remoção da fonte",exact:true}).click();await dialog().waitFor({state:"hidden"});assert.equal(deleted,1);
    await page.getByRole("button",{name:"Sua memória privada",exact:true}).click();await page.getByRole("button",{name:"Adicionar nota privada",exact:true}).click();
    const note=page.getByRole("dialog",{name:"Nova nota privada",exact:true});await note.getByLabel("Título da fonte",{exact:true}).fill("Preferência pessoal");await note.getByLabel("Conteúdo da fonte",{exact:true}).fill("Nota exclusiva desta conta");await note.getByRole("button",{name:"Salvar fonte",exact:true}).click();await dialog().getByText("Nota exclusiva desta conta",{exact:true}).waitFor();assert.equal(sources.at(-1).scope,"private");await page.keyboard.press("Escape");
    await page.goto(fixture.origin+"/#conversa/"+talk.id);await page.getByRole("button",{name:"Ver Política comercial",exact:true}).click();
    await dialog().getByText("Esta fonte foi atualizada desde a sugestão. Atualize a leitura antes de aplicar o texto.",{exact:true}).waitFor();assert.equal(await dialog().getByRole("button",{name:"Editar fonte completa",exact:true}).count(),0);await page.keyboard.press("Escape");assert.equal(await page.getByRole("button",{name:"Ver Fonte inventada",exact:true}).count(),0);
    const memory=page.getByRole("region",{name:"Memória deste relacionamento",exact:true});await memory.getByText("O cliente já comprou uma vez.",{exact:true}).waitFor();
    await memory.getByRole("button",{name:"Negociação",exact:true}).click();await memory.getByText("O cliente aguarda entrega deste novo pedido.",{exact:true}).waitFor();
    source.deleted=true;await page.getByRole("button",{name:"Ver Política comercial",exact:true}).click();await dialog().getByText("Esta fonte foi removida, mudou de acesso ou não está mais disponível.",{exact:true}).waitFor();assert.equal(await dialog().getByText("FIM DO DOCUMENTO",{exact:false}).count(),0);await page.keyboard.press("Escape");
    if(shots)await page.screenshot({path:shots+`/memoria-${width}.png`,fullPage:true});
    await page.goto(fixture.origin+"/#conexao");await page.getByRole("button",{name:"Conectar Nowz",exact:true}).click();const connect=page.getByRole("dialog",{name:"Conectar Nowz",exact:true});
    await connect.getByLabel("Nome da conexão",{exact:true}).fill("Atendimento da empresa");await connect.getByLabel("Identificador do vínculo preparado",{exact:true}).fill("prepared-binding");await connect.getByLabel("Identificadores dos canais",{exact:true}).fill("channel-synthetic");await connect.getByRole("button",{name:"Conferir e conectar Nowz",exact:true}).click();await connect.waitFor({state:"hidden"});assert.equal(nowz,1);
    assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    console.log(JSON.stringify({width,companyPrivateSeparate:true,customerOpportunitySeparate:true,fullSourceEdit:true,importOver8kb:true,deleteJson:true,currentSourceVersion:true,revokedSourceHidden:true,nowzVerifiedBinding:true}));
  } finally {await context.close();await fixture.close();}
}
try {for(const width of [1440,390])await scenario(width);} finally {await browser.close();}
