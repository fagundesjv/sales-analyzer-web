import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";
import {json,startFixtureWeb} from "./fixtures/web-bff.mjs";
const bundle=process.argv[2];assert.ok(bundle,"Informe o pacote compilado.");
const shots=process.env.SA_EVIDENCE_DIR;if(shots)await mkdir(shots,{recursive:true});
const browser=await chromium.launch({channel:"chrome"});
async function scenario(width,enabled=true){
  const user={id:randomUUID(),name:"Gestora sintética",email:"manager@example.test"},workspace={id:randomUUID(),name:"Empresa sintética",role:"manager"};
  const source={id:randomUUID(),version:1,scope:"private",kind:"note",title:"Preferência de entrega",text:"Consultar o CEP antes de informar prazo.",metadata:{},evidenceIds:[]};
  const turns=[],jobs=new Map(),actions=new Map();let paused=false,questions=0,uploads=0,mutations=0,polls=0,revoked=false,failNext=false;
  const config=()=>({mode:"grounded_ai",tools:[],commands:["pausar_zoe","retomar_zoe","atualizar_leitura","empresa"],paused,daily:{used:questions,limit:30},attachments:{maxCount:4,maxBytes:12582912,expiresHours:24,mimes:["text/plain"]}});
  const fixture=await startFixtureWeb(bundle,0,async(req,res,path)=>{
    if(path==="session")return json(res,200,{user,workspace,workspaces:[workspace],capabilities:{...(enabled?{zoeChat:true}:{}),memory:true}});
    assert.equal(req.headers["x-v2-context"],user.id+"/"+workspace.id);
    let body;if(req.method!=="GET"){let raw="";for await(const part of req)raw+=part;body=JSON.parse(raw);assert.ok(req.headers["idempotency-key"]);}
    if(path==="zoe/session")return json(res,200,{id:randomUUID(),mode:"deterministic",queryTypes:["summary","radar","conversation"]});
    if(path==="zoe/history")return json(res,200,{items:[],nextCursor:null});
    if(path==="zoe/chat")return json(res,200,config());
    if(path==="zoe/chat/history")return json(res,200,{items:turns,nextCursor:null});
    if(path==="zoe/attachments"){uploads++;assert.ok(Buffer.from(body.content,"base64").length>8192);return json(res,201,{id:randomUUID(),name:body.name,mime:body.mime,bytes:Buffer.from(body.content,"base64").length,expiresAt:new Date(Date.now()+86400000).toISOString()});}
    if(path==="zoe/turns"){
      questions++;if(questions===1)assert.equal(body.attachmentIds.length,1);const id=randomUUID(),turn={id:randomUUID(),createdAt:new Date().toISOString(),query:{type:"chat",...body},answer:"Conversas analisadas: 2",citations:[{ref:"numero:leitura.conversas",label:"Conversas analisadas",value:2,unit:"count"},{ref:`kb:${source.id}:v1`,label:source.title,value:source.text,unit:"text",kind:"memory",scope:"private",sourceId:source.id,version:1}],result:{type:"chat",actions:[]}};
      jobs.set(id,{id,state:"queued",turn,error:failNext,count:0});failNext=false;return json(res,202,{id,state:"queued"});
    }
    if(path.startsWith("zoe/chat/runs/")){
      polls++;const j=jobs.get(path.split("/").at(-1));j.count++;
      if(j.count<2)return json(res,202,{id:j.id,state:"running"});
      if(j.error)return json(res,200,{id:j.id,state:"failed",errorCode:"indeterminate"});
      if(!turns.some(t=>t.id===j.turn.id))turns.unshift(j.turn);return json(res,200,{id:j.id,state:"done",turn:j.turn});
    }
    if(path.startsWith("zoe/chat/turns/")){
      const id=path.split("/")[3],turn=turns.find(t=>t.id===id);if(!turn)return json(res,404,{error:{code:"not_found",message:"Consulta indisponível."}});
      if(path.includes("/sources/"))return json(res,revoked?404:200,revoked?{error:{code:"not_found",message:"Fonte indisponível."}}:turn.citations[Number(path.split("/").at(-1))]);
      return json(res,200,turn);
    }
    if(path==="memory/sources/"+source.id)return json(res,200,source);
    if(path==="zoe/actions"){
      const action={id:randomUUID(),command:body.command,target:null,label:({pausar_zoe:"Pausar leituras da Zoe",retomar_zoe:"Retomar leituras da Zoe",atualizar_leitura:"Pedir uma leitura agora",empresa:"Abrir empresa"})[body.command],revision:"a".repeat(64),state:"prepared",response:null,requiresConfirmation:body.command!=="empresa"};actions.set(action.id,action);return json(res,201,action);
    }
    if(path.startsWith("zoe/actions/")&&path.endsWith("/confirm")){
      const a=actions.get(path.split("/")[2]);assert.deepEqual(body,{expectedRevision:a.revision,confirmed:true});mutations++;paused=a.command==="pausar_zoe";
      return json(res,200,{...a,state:"executed",response:{kind:"operation_changed",executed:true,paused,version:mutations}});
    }
    return json(res,404,{error:{code:"not_found",message:"Indisponível"}});
  });
  const context=await browser.newContext({viewport:{width,height:width<600?844:900},reducedMotion:"reduce"}),page=await context.newPage();page.setDefaultTimeout(12000);
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  try{
    await page.goto(fixture.origin+"/#chat");
    if(!enabled){await page.getByText("Consulta local por regras",{exact:true}).waitFor();assert.equal(await page.getByRole("button",{name:"Anexar",exact:true}).count(),0);assert.deepEqual(errors,[]);console.log(JSON.stringify({width,legacyModeUnchanged:true}));return;}
    await page.getByRole("button",{name:"Anexar",exact:true}).click();
    const upload=page.getByRole("dialog",{name:"Anexar arquivo privado",exact:true});await upload.getByLabel("Arquivo para a Zoe",{exact:true}).setInputFiles({name:"nota.txt",mimeType:"text/plain",buffer:Buffer.from("Nota privada sintética. ".repeat(500))});
    await upload.getByRole("button",{name:"Anexar à pergunta",exact:true}).click();await upload.waitFor({state:"hidden"});assert.equal(uploads,1);
    await page.getByRole("textbox",{name:"Pergunta para a Zoe",exact:true}).fill("Quantas conversas temos?");await page.getByRole("button",{name:"Consultar Zoe",exact:true}).click();
    await page.getByText("Conversas analisadas: 2",{exact:true}).waitFor();assert.equal(questions,1);assert.ok(polls>=2);
    await page.getByText("Preferência de entrega",{exact:true}).click();const memory=page.getByRole("dialog",{name:"Fonte de conhecimento",exact:true});await memory.getByText(source.text,{exact:true}).waitFor();await memory.getByText("Sua memória privada",{exact:true}).waitFor();await page.keyboard.press("Escape");
    revoked=true;await page.getByText("Preferência de entrega",{exact:true}).click();const unavailable=page.getByRole("dialog",{name:"Fonte da resposta",exact:true});await unavailable.getByText("Fonte indisponível",{exact:true}).waitFor();assert.equal(await unavailable.getByText(source.text,{exact:true}).count(),0);await page.keyboard.press("Escape");
    await page.getByRole("button",{name:"Ações",exact:true}).click();await page.getByRole("menuitem",{name:"Pausar leituras da Zoe",exact:true}).click();assert.equal(mutations,0);
    let confirm=page.getByRole("dialog",{name:"Pausar leituras da Zoe",exact:true});await confirm.getByRole("button",{name:"Confirmar ação",exact:true}).click();await confirm.getByText("Leituras pausadas.",{exact:true}).waitFor();assert.equal(mutations,1);await confirm.getByRole("button",{name:"Concluir",exact:true}).click();
    await page.getByText("As leituras estão pausadas. Use as ações para retomar.",{exact:true}).waitFor();assert.equal(await page.getByRole("button",{name:"Ações",exact:true}).isEnabled(),true);
    await page.getByRole("button",{name:"Ações",exact:true}).click();await page.getByRole("menuitem",{name:"Retomar leituras da Zoe",exact:true}).click();confirm=page.getByRole("dialog",{name:"Retomar leituras da Zoe",exact:true});await confirm.getByRole("button",{name:"Confirmar ação",exact:true}).click();await confirm.getByRole("button",{name:"Concluir",exact:true}).click();assert.equal(mutations,2);
    await confirm.waitFor({state:"hidden"});
    if(shots)await page.screenshot({path:shots+`/chat-${width}.png`,fullPage:true});
    await page.goto(fixture.origin+"/#chat");failNext=true;await page.getByRole("textbox",{name:"Pergunta para a Zoe",exact:true}).fill("Outra pergunta");await page.getByRole("button",{name:"Consultar Zoe",exact:true}).click();await page.getByText("A execução ficou sem confirmação. O consumo segue em conferência; esta pergunta não será repetida automaticamente.",{exact:true}).waitFor();assert.equal(questions,2);
    const internal=await page.evaluate(()=>fetch('/api/v2/internal/zoe/chat/'+crypto.randomUUID(),{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.status));assert.equal(internal,404);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
    console.log(JSON.stringify({width,queuedPoll:true,privateAttachment:true,privateMemorySource:true,revokedSourceHidden:true,confirmationRequired:true,resumeAccessibleWhilePaused:true,uncertainNotRepeated:true,internalRpcBlocked:true}));
  }catch(error){if(shots)await page.screenshot({path:shots+`/chat-failure-${width}.png`,fullPage:true});throw error;}finally{await context.close();await fixture.close();}
}
try{for(const width of [1440,390]){await scenario(width);await scenario(width,false);}}finally{await browser.close();}
