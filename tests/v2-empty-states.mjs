// Compiled V2, synthetic session and zero data. No production API is contacted.
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";
import {json,startFixtureWeb} from "./fixtures/web-bff.mjs";

const bundle=process.argv[2];
assert.ok(bundle,"Informe o pacote Web compilado.");
const selfServe=process.env.SA_EXPECT_WHATSAPP_SELF_SERVE==="1";
const shots=process.env.SA_EVIDENCE_DIR;
if (shots) await mkdir(shots,{recursive:true});
const browser=await chromium.launch({channel:"chrome"});
const empty={items:[],nextCursor:null};

async function scenario(role,width) {
  const user={id:randomUUID(),name:"Pessoa de teste",email:"teste@example.test"};
  const workspace={id:randomUUID(),name:"Empresa de teste",role};
  const context=user.id+"/"+workspace.id;
  const wonId=randomUUID(), nextCursor=randomUUID(), pipelineId=randomUUID();
  const state={line:null,conversations:[],wins:true,pipeline:false,loggedIn:true};
  const web=await startFixtureWeb(bundle,0,async (req,res,path)=>{
    if(path==="session" && !state.loggedIn) return json(res,401,{});
    if(path==="session") return json(res,200,{user,workspace,workspaces:[workspace]});
    if(req.headers["x-v2-context"]!==context) return json(res,403,{});
    if(path==="conversations" && new URL(req.url,"http://localhost").searchParams.get("outcome")==="won")
      return json(res,200,!state.wins || new URL(req.url,"http://localhost").searchParams.has("cursor") ? empty :
        {items:[{id:wonId,title:"Venda anterior",summary:"Confirmada",priority:"low",
          outcome:{status:"won",amountCents:"28000",confirmedAt:"2026-11-18T12:00:00Z"}}],nextCursor});
    if(path==="conversations") {
      if (state.delayList) await state.delayList;
      const params=new URL(req.url,"http://localhost").searchParams;
      const rows=state.conversations.filter(item=>!params.get("q") || item.title.toLowerCase().includes(params.get("q").toLowerCase()));
      return json(res,200,{items:rows,nextCursor:null});
    }
    if(path==="connections" && state.connectionError) return json(res,state.connectionError,{error:{
      code:state.connectionError===403 ? "forbidden" : "temporarily_unavailable",message:"Falha ao carregar conexões."}});
    if(path==="connections") return json(res,200,{items:state.line?[state.line]:[],nextCursor:null});
    if (state.pipeline && path==="team") return json(res,200,{items:[{id:user.id,name:"Equipe A",role:"seller"}],nextCursor:null});
    if (state.pipeline && path==="pipelines") return json(res,200,{items:[{id:pipelineId,name:"Comercial"}],defaultPipelineId:null,nextCursor:null});
    if (state.pipeline && path==="pipelines/"+pipelineId) {
      const filtered=new URL(req.url,"http://localhost").searchParams.has("assigneeId");
      return json(res,200,{id:pipelineId,name:"Comercial",stages:[{id:nextCursor,name:"Proposta",total:filtered?0:1,
        items:filtered?[]:[{id:wonId,title:"Negociação de teste",summary:"Proposta solicitada",ownerName:"Equipe A"}],nextCursor:null}]});
    }
    if (path==="budget/usage") {
      const period=new URL(req.url,"http://localhost").searchParams.get("period");
      return json(res,200,{workspaceId:workspace.id,period,mode:"local_simulated",scope:"diagnostic_analysis",
        commercial:{limitCalls:null,reservedCalls:0,consumedCalls:0},cost:{limitMicros:null,availableMicros:null,
          settledMicros:"0",reservedMicros:"0",indeterminateMicros:"0",authorizedCount:0,indeterminateCount:0,settledCount:0}});
    }
    if(["radar","returns","catalog/items","alerts","team","diagnostics","zoe/history"].includes(path))
      return json(res,200,empty);
    if(path==="pipelines") return json(res,200,{...empty,defaultPipelineId:null});
    if(path==="summary") return json(res,200,{conversations:state.conversations.length,opportunities:0,
      pendingWins:{count:0,amountCents:"0"},confirmedWins:{count:0,amountCents:"0"}});
    if(path==="focus") return json(res,200,{round:null});
    if(path==="zoe/session") return json(res,200,{mode:"deterministic",queryTypes:["summary","radar","conversation"]});
    if(path==="credits") return json(res,200,{workspaceId:workspace.id,limitCalls:0,consumedCalls:0,
      reservedCalls:0,availableCalls:0,nextCycleStartsOn:"2026-12-01"});
    return json(res,404,{});
  });
  const ctx=await browser.newContext({viewport:{width,height:width===390?844:900},serviceWorkers:"block"});
  const page=await ctx.newPage();
  const errors=[];
  page.setDefaultTimeout(9000);
  page.on("pageerror",error=>errors.push(error.message));
  page.on("requestfailed",request=>{
    if(request.resourceType()==="stylesheet") errors.push("Stylesheet: "+request.url());
  });
  async function open(hash,title,capture=true) {
    await page.goto(web.origin+"/#"+hash);
    await page.getByText(title,{exact:true}).first().waitFor();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),hash+" tem overflow");
    assert.doesNotMatch(await page.locator("body").innerText(),/evolution/i);
    if(shots && capture && !hash.includes("/"))
      await page.screenshot({path:shots+"/vazio-"+role+"-"+hash+"-"+width+".png",animations:"disabled"});
  }
  try {
    await open("dashboard","Sua próxima oportunidade começa com uma análise");
    await page.getByRole("link",{name:"Ver WhatsApps"}).click();
    await page.getByText(role==="manager" ? selfServe ? "Conecte seu primeiro WhatsApp" :
      "WhatsApp ainda não configurado" : "Nenhum número atribuído",{exact:true}).waitFor();
    if(role==="manager" && !selfServe)
      assert.equal(await page.getByRole("button",{name:"Conectar WhatsApp"}).count(),0);
    await open("radar","Ainda não há oportunidades analisadas");
    await page.getByPlaceholder("Buscar contato ou sinal…").fill("inexistente");
    await page.getByText("Nenhuma oportunidade neste recorte",{exact:true}).waitFor();
    await page.getByRole("button",{name:"Limpar filtros"}).click();
    await page.getByText("Ainda não há oportunidades analisadas",{exact:true}).waitFor();
    let release;
    state.delayList=new Promise(resolve=>{release=resolve;});
    try {
      const request=page.waitForRequest(req=>req.url().includes("/api/v2/conversations?"));
      await page.goto(web.origin+"/#entrada");
      await request;
      await page.getByText("Carregando…",{exact:true}).first().waitFor();
      assert.equal(await page.locator('[data-preview="inbox"]').count(),0);
    } finally {release();state.delayList=null;}
    await open("entrada","Toda conversa começa com uma conexão");
    await page.locator('[data-preview="inbox"]').waitFor();
    const panel=page.getByRole("region",{name:"Toda conversa começa com uma conexão"});
    const bounds=await panel.boundingBox();
    const art=await panel.locator('[data-preview="inbox"]').boundingBox();
    const cta=await panel.getByRole("link").boundingBox();
    assert.ok(Math.abs(art.x+art.width/2-bounds.x-bounds.width/2)<2,"Centralizar a miniatura no painel");
    assert.ok(Math.abs((art.y+cta.y+cta.height)/2-bounds.y-bounds.height/2)<3,"Centralizar o conjunto no painel");
    assert.ok(art.width>=Math.min(280,width-50) && art.width<=355);
    assert.ok(cta.height >= (width<600 ? 44 : 40));
    assert.ok(cta.y+cta.height<=bounds.y+bounds.height);
    assert.equal(await page.getByPlaceholder("Buscar conversas…").count(),0);
    assert.equal(await page.getByText("Foco da Zoe",{exact:true}).count(),0);
    assert.equal(await page.getByRole("region",{name:"Lista de atendimentos"}).count(),0);
    await page.getByRole("link",{name:role==="manager" ? selfServe ? "Conectar WhatsApp" :
      "Ver orientações de conexão" : "Ver meus WhatsApps"}).waitFor();
    for (const code of [403,503]) {
      state.connectionError=code;
      await page.reload();
      await page.getByRole("alert").filter({hasText:code===403 ? "não tem permissão" : "Falha ao carregar"}).waitFor();
      assert.equal(await page.locator('[data-preview="inbox"]').count(),0);
      if(code===503) {
        state.connectionError=null;
        await page.getByRole("button",{name:"Tentar novamente"}).click();
        await page.getByRole("heading",{name:"Toda conversa começa com uma conexão"}).waitFor();
      }
    }
    state.line={id:randomUUID(),name:"Linha de teste",channel:"whatsapp",status:"provisioning"};
    await page.reload();
    await page.getByText("Seu WhatsApp está em preparação",{exact:true}).waitFor();
    state.line.status="disconnected";
    await page.reload();
    await page.getByText("Confira a conexão do WhatsApp",{exact:true}).waitFor();
    state.line.status="connected";
    await page.reload();
    await page.getByText("Sua linha está pronta para a primeira análise",{exact:true}).waitFor();
    await page.getByRole("link",{name:"Iniciar diagnóstico"}).waitFor();
    state.conversations=[{id:randomUUID(),title:"Marina Costa",summary:"Pedido de orçamento",priority:"high"}];
    await page.reload();
    await page.getByPlaceholder("Buscar conversas…").waitFor();
    await page.getByText("Foco da Zoe",{exact:true}).waitFor();
    await page.getByRole("link",{name:/Marina Costa/}).waitFor();
    assert.equal(await page.getByText("Sua linha está pronta para a primeira análise",{exact:true}).count(),0);
    await page.getByPlaceholder("Buscar conversas…").fill("inexistente");
    await page.getByText("Nenhuma conversa encontrada",{exact:true}).waitFor();
    assert.equal(await page.getByText("Sua linha está pronta para a primeira análise",{exact:true}).count(),0);
    assert.equal(await page.locator('[data-preview="inbox"]').count(),0);
    await page.getByRole("button",{name:"Mostrar todas"}).click();
    await page.getByRole("link",{name:/Marina Costa/}).waitFor();
    await open("dashboard","Nenhuma oportunidade no Radar",false);
    await page.getByRole("link",{name:"Abrir conversas",exact:true}).click();
    await page.getByRole("link",{name:/Marina Costa/}).waitFor();
    state.conversations=[];
    await page.goto(web.origin+"/#conversa/invalid");
    await page.getByText("Conversa inválida.",{exact:false}).waitFor();
    assert.equal(await page.getByText("Sua linha está pronta para a primeira análise",{exact:true}).count(),0);
    state.line=null;
    await open("tarefas","Agenda livre");
    await open("catalogo","Seu catálogo começa aqui");
    await page.getByPlaceholder("Buscar item…").fill("inexistente");
    await page.getByText("Nenhum item encontrado",{exact:true}).waitFor();
    await page.getByRole("button",{name:"Limpar filtros"}).click();
    await page.getByText("Seu catálogo começa aqui",{exact:true}).waitFor();
    if(role==="manager") {
      await page.getByRole("button",{name:"Adicionar produto"}).click();
      await page.getByRole("dialog").getByText("Adicionar produto",{exact:true}).first().waitFor();
    }
    await open("crm","Organize as negociações por etapa");
    if(role==="manager") {
      await page.getByRole("button",{name:"Criar funil"}).click();
      await page.getByRole("dialog").getByText("Novo funil",{exact:true}).waitFor();
    } else assert.equal(await page.getByRole("button",{name:"Criar funil"}).count(),0);
    await open("alertas","Nenhum alerta por enquanto");
    await open("diagnosticos","Nenhuma conexão disponível");
    await page.goto(web.origin+"/#resultados");
    await page.getByRole("link",{name:/Venda anterior/}).waitFor();
    await page.getByRole("navigation",{name:"Páginas de negociações"}).getByRole("button",{name:"Próxima"}).click();
    await page.getByText("Esta página está vazia",{exact:true}).waitFor();
    await page.getByRole("button",{name:"Página anterior"}).first().click();
    await page.getByRole("link",{name:/Venda anterior/}).waitFor();
    if(width===390) {
      await page.goto(web.origin+"/#chat");
      await page.getByText("Consulta local por regras",{exact:true}).waitFor();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      if(shots) await page.screenshot({path:shots+"/vazio-"+role+"-chat-"+width+".png",animations:"disabled"});
    } else await open("chat","Sua história com a Zoe começa aqui");
    if(role==="manager") {
      await open("equipe","Sua equipe começa aqui");
      await page.getByRole("button",{name:/Convidar/}).first().click();
      await page.getByRole("dialog").waitFor();
    } else {
      await open("equipe","Equipe disponível para gestores");
      await open("uso","Uso disponível para gestores");
      await open("plano","Plano disponível para gestores");
    }
    if(role==="manager" && width===390) {
      await open("catalogo","Seu catálogo começa aqui");
      await page.getByRole("switch",{name:"Tema escuro"}).click();
      assert.equal(await page.getByRole("switch",{name:"Tema escuro"}).getAttribute("aria-checked"),"true");
      assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('[data-color-scheme="dark"]')).backgroundColor),"rgb(0, 0, 0)");
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      if(shots) await page.screenshot({path:shots+"/vazio-manager-catalogo-dark-390.png",animations:"disabled"});
      await open("entrada","Toda conversa começa com uma conexão",false);
      assert.equal(await page.locator('section[aria-labelledby="inbox-first-title"]').evaluate(el=>getComputedStyle(el).backgroundColor),"rgb(0, 0, 0)");
      if(shots) await page.screenshot({path:shots+"/vazio-manager-entrada-dark-390.png",animations:"disabled"});
    }
    const visible = text => page.getByText(text,{exact:true}).first().waitFor();
    const clickLink = label => page.getByRole("link",{name:label,exact:true}).last().click();
    const button = label => page.getByRole("button",{name:label,exact:true});
    if(role==="manager" && width===390) await page.getByRole("switch",{name:"Tema escuro"}).click();
    await open("oportunidades","Nenhuma negociação identificada");
    await page.locator('[data-preview="deals"]').waitFor();
    await clickLink("Abrir diagnósticos");
    await visible("Nenhuma conexão disponível");
    await clickLink("Ver WhatsApps");
    await page.locator('[data-preview="channels"]').waitFor();
    await open("conexao","WhatsApp");
    await clickLink(role==="manager" ? "Gerenciar WhatsApps" : "Ver meus WhatsApps");
    await page.locator('[data-preview="channels"]').waitFor();

    await open("tarefas","Agenda livre",false);
    await button("Até hoje").click();
    await visible("Tudo em dia por hoje");
    await button("Ver todos em aberto").click();
    await visible("Agenda livre");
    await button("Concluídos").click();
    await visible("Nenhum retorno concluído");
    await clickLink("Abrir conversas");
    await visible("Toda conversa começa com uma conexão");
    await open("alertas","Nenhum alerta por enquanto",false);
    await page.getByLabel("Tipo de alerta").selectOption("loss");
    await visible("Nenhum alerta com estes filtros");
    assert.equal(await page.locator('[data-preview="alerts"]').count(),0);
    await button("Limpar filtros").click();
    await clickLink("Abrir Radar");
    await visible("Ainda não há oportunidades analisadas");

    await open("catalogo","Seu catálogo começa aqui",false);
    await button("Serviços").click();
    await visible("Os serviços da equipe começam aqui");
    await page.locator('[data-preview="services"]').waitFor();
    if(role==="manager"){
      await button("Adicionar serviço").click();
      await page.getByRole("dialog").waitFor();
    } else assert.equal(await button("Adicionar serviço").count(),0);
    state.wins=false;
    await open("resultados","Ganhos aparecerão aqui");
    await clickLink("Abrir Radar");
    await visible("Ainda não há oportunidades analisadas");
    await page.goto(web.origin+"/#conversa/"+wonId);
    await visible("Conversa indisponível");
    await clickLink("Voltar às conversas");
    await visible("Toda conversa começa com uma conexão");
    await open("diagnosticos/"+wonId,"Leitura indisponível");
    await clickLink("Voltar aos diagnósticos");
    await page.waitForURL("**/#diagnosticos");
    await visible("Nenhuma conexão disponível");
    await open("zoe/"+wonId,"Consulta indisponível para esta conta");
    await clickLink("Nova pergunta");
    await visible("Consulta local por regras");
    await page.getByRole("button",{name:/Resumo da operação|Escolher consulta/}).click();
    await page.getByText("Analisar conversa",{exact:true}).last().click();
    await page.getByRole("dialog").getByText("Nenhuma conversa disponível",{exact:true}).waitFor();
    await page.getByRole("dialog").getByRole("link",{name:"Abrir conversas"}).click();
    await visible("Toda conversa começa com uma conexão");

    if(role==="manager") {
      await open("uso","Nenhuma execução neste ciclo");
      await page.getByLabel("Mês de referência (UTC)").fill("2020-05");
      await visible("Sem uso registrado neste mês");
      await button("Ver mês atual").click();
      await visible("Nenhuma execução neste ciclo");
      await clickLink("Ver diagnósticos");
      await visible("Nenhuma conexão disponível");
      await open("plano","Saldo esgotado");
      await clickLink("Ver uso da empresa");
      await visible("Nenhuma execução neste ciclo");
      state.pipeline=true;
      await page.goto(web.origin+"/#crm");
      await page.getByRole("link",{name:"Negociação de teste"}).waitFor();
      await page.getByLabel("Responsável",{exact:true}).selectOption(user.id);
      await visible("Nenhuma negociação deste responsável");
      await button("Mostrar toda a equipe").click();
      await page.getByRole("link",{name:"Negociação de teste"}).waitFor();
    } else {
      await open("plano","Plano disponível para gestores",false);
      await clickLink("Abrir Dashboard");
      await visible("Sua próxima oportunidade começa com uma análise");
      await open("equipe","Equipe disponível para gestores",false);
      await clickLink("Abrir empresa");
      await visible("Empresa ativa nesta sessão");
    }
    await open("ajustes","Empresa ativa nesta sessão");
    await clickLink("Aceitar convite de outra empresa");
    await visible("Aceitar convite");
    await clickLink("Voltar à minha empresa");
    await visible("Empresa ativa nesta sessão");
    state.loggedIn=false;
    await page.reload();
    await visible("Entrar no Sales Analyzer");
    await clickLink("Esqueci minha senha");
    await visible("Recuperar senha");
    assert.doesNotMatch(await page.locator("body").innerText(),/evolution/i);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({role,width,revision:web.revision,overflow:false}));
  } finally {await ctx.close();await web.close();}
}
try {for(const width of [1440,390]) for(const role of ["manager","seller"]) await scenario(role,width);}
finally {await browser.close();}
