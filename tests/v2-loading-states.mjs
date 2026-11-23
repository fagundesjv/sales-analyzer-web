// Run against a locally compiled V2. The two API sessions and all records are synthetic.
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";
import {json,startFixtureWeb} from "./fixtures/web-bff.mjs";

const bundle = process.argv[2];
assert.ok(bundle,"Informe o pacote local da V2.");
const evidence = process.env.SA_EVIDENCE_DIR;
if (evidence) await mkdir(evidence,{recursive:true});
const browser = await chromium.launch({channel:"chrome"});
const empty = {items:[],nextCursor:null};

async function scenario(role,width) {
  const user = {id:randomUUID(),name:"Pessoa de teste",email:"teste@example.test"};
  const workspace = {id:randomUUID(),name:"Empresa A",role};
  const second = {...workspace,id:randomUUID(),name:"Empresa B"};
  let active = workspace;
  let populated = false;
  let analyzed = false;
  let failure = false;
  const gates = new Map();
  const row = {id:randomUUID(),title:"Negociação da empresa A",priority:"high",summary:"Pedido de orçamento"};
  const web = await startFixtureWeb(bundle,0,async (req,res,path) => {
    const requestWorkspace = active;
    const key = req.headers["x-v2-context"];
    const query = new URL(req.url,"http://localhost").searchParams;
    const term = query.get("q") || "";
    const gate = gates.get(path + term);
    if (gate) {gate.arrived(); await gate.wait;}
    if (path === "session") return json(res,200,{user,workspace:active,workspaces:[workspace,second]});
    if (key !== user.id+"/"+requestWorkspace.id) return json(res,403,{error:{code:"forbidden"}});
    if (path === "radar" && failure) return json(res,503,{error:{message:"Falha ao consultar oportunidades."}});
    if (path === "radar" && populated && !["vazio","erro"].includes(term))
      return json(res,200,{...empty,items:[{...row,title:term || (requestWorkspace === workspace ? row.title : "Negociação da empresa B")}]});
    if (path === "summary") return json(res,200,{conversations:analyzed || populated ? 1 : 0,opportunities:populated ? 1 : 0,pendingWins:{count:0,amountCents:"0"},confirmedWins:{count:0,amountCents:"0"}});
    if (path === "focus") return json(res,200,{round:null});
    if (path === "pipelines") return json(res,200,{...empty,defaultPipelineId:null});
    return json(res,200,empty);
  });
  function hold(key) {
    const reached = Promise.withResolvers(), pending = Promise.withResolvers();
    const timer = setTimeout(()=>reached.reject(new Error("A requisição não chegou: "+key)),8000);
    reached.promise.then(()=>clearTimeout(timer),()=>clearTimeout(timer));
    gates.set(key,{arrived:reached.resolve,wait:pending.promise});
    return {reached:reached.promise,release() {gates.delete(key);pending.resolve();}};
  }
  const context = await browser.newContext({viewport:{width,height:width===390?844:900},serviceWorkers:"block"});
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on("pageerror",error=>errors.push(error.message));
  const capture = async name => {
    if (evidence) await page.screenshot({path:evidence+"/"+role+"-"+width+"-"+name+".png"});
  };
  try {
    for (const [hash,endpoint,preview,selector] of [
      ["tarefas","returns","returns",'button'],
      ["radar","radar","radar",'input[placeholder="Buscar contato ou sinal…"]'],
      ["oportunidades","radar","deals",'input[placeholder="Buscar contato ou sinal…"]'],
      ["alertas","alerts","alerts",'select[aria-label="Tipo de alerta"]'],
      ["dashboard","summary","dashboard",'[aria-label="Operação comercial"]'],
      ["resultados","conversations","gains",'[aria-label="Operação comercial"]'],
      ["catalogo","catalog/items","catalog",'input[placeholder="Buscar item…"]'],
      ["entrada","conversations","inbox",'input[placeholder="Buscar conversas…"]'],
      ["whatsapps","connections","channels",'h1'],
      ["diagnosticos","connections","diagnostics",'h1'],
      ["crm","pipelines","pipeline",'select[aria-label="Funil"]'],
      ...(role==="manager" ? [["equipe","team","team",'h1']] : []),
    ]) {
      // Across initial and secondary reads, watch the DOM at every commit, not just at the end.
      await page.goto("about:blank");
      await page.addInitScript(({hash,selector})=>{
        if(location.hash!=="#"+hash) return;
        window.premature = [];
        const check = () => {
          if(document.querySelector("[data-first-access]")) return;
          const candidates = document.querySelectorAll(selector);
          for(const el of candidates) {
            if(selector==="button" && el.textContent.trim()!=="Até hoje") continue;
            if(selector==="h1" && !["Equipe","WhatsApps","Diagnósticos"].includes(el.textContent.trim())) continue;
            window.premature.push(el.textContent.trim() || el.getAttribute("placeholder") || el.tagName);
            break;
          }
        };
        new MutationObserver(check).observe(document,{childList:true,subtree:true});
      },{hash,selector});
      const primary = hold(endpoint);
      const lookup = ["radar","oportunidades","alertas","entrada"].includes(hash) ? hold("connections") : null;
      try {
        await page.goto(web.origin+"/#"+hash);
        await primary.reached;
        if (evidence && (hash==="tarefas" || hash==="radar")) {
          const loader=page.getByRole("status",{name:"Carregando dados"});
          if (await loader.count()) await page.waitForFunction(()=>{
            const mark=document.querySelector('[aria-label="Carregando dados"] > [aria-hidden]');
            return mark && Number(getComputedStyle(mark).opacity)>.95;
          });
          await capture(hash+"-carregando");
        }
        assert.deepEqual(await page.evaluate(()=>window.premature),[],hash+": controles durante a leitura inicial");
        primary.release();
        if (lookup) {
          await lookup.reached;
          assert.equal(await page.locator("[data-first-access]").count(),0);
          lookup.release();
        }
        await page.locator('[data-first-access] [data-preview="'+preview+'"]').waitFor();
        assert.deepEqual(await page.evaluate(()=>window.premature),[],hash+": controles antes do primeiro acesso");
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
        if(hash==="radar") await capture("radar-vazio");
      } finally {primary.release();lookup?.release();}
    }

    // Visit all three tabs through the same navigation that customers use.
    analyzed=true;
    await page.goto(web.origin+"/#radar");
    const tabs=page.getByRole("navigation",{name:"Seções de Radar"});
    await page.getByRole("heading",{name:"Nenhuma conversa para priorizar"}).waitFor();
    await tabs.getByRole("link",{name:"Negociações"}).click();
    await page.getByRole("heading",{name:"Nenhuma negociação identificada"}).waitFor();
    await page.getByRole("link",{name:"Abrir conversas",exact:true}).waitFor();
    await capture("negociacoes-sem-sinais");
    await tabs.getByRole("link",{name:"Alertas"}).click();
    await page.getByRole("heading",{name:"Nenhum alerta por enquanto"}).waitFor();
    assert.equal(await page.getByRole("button",{name:"Regras de alerta"}).count(),role==="manager" ? 1 : 0);
    await capture("alertas-sem-sinais");

    // Simulate a transport that delivers the old response even after the UI cancels it.
    await page.addInitScript(()=>{
      const fetch = window.fetch.bind(window);
      window.fetch = (input,init) => ["lenta","empresa-anterior"].includes(new URL(input,location.href).searchParams.get("q"))
        ? fetch(input,{...init,signal:undefined}) : fetch(input,init);
    });
    populated=true;
    await page.goto("about:blank");
    await page.goto(web.origin+"/#radar");
    const search=page.getByPlaceholder("Buscar contato ou sinal…");
    const old=page.locator("a").filter({hasText:"Negociação da empresa A"});
    await old.first().waitFor();
    const slow=hold("radarlenta"), fast=hold("radarrápida");
    try {
      await search.fill("lenta");
      await slow.reached;
      await page.locator('[aria-busy="true"] [inert]').first().waitFor();
      assert.ok(await old.evaluateAll(links=>links.length>0 && links.every(el=>!!el.closest("[inert]"))));
      assert.ok(await search.evaluate(el=>el===document.activeElement),"A busca deve preservar o foco.");
      const hit=await old.last().boundingBox();
      await page.mouse.click(hit.x+hit.width/2,hit.y+hit.height/2);
      assert.equal(new URL(page.url()).hash,"#radar","Um toque em resultado antigo não pode abrir a conversa.");
      await search.focus();
      await old.first().evaluate(el=>el.focus());
      assert.ok(await search.evaluate(el=>el===document.activeElement));
      await capture("radar-atualizando");
      await search.fill("rápida");
      await fast.reached;
      fast.release();
      await page.getByRole("link",{name:/rápida/}).first().waitFor();
      const late=page.waitForResponse(response=>new URL(response.url()).searchParams.get("q")==="lenta");
      slow.release();
      await (await late).finished();
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await page.getByRole("link",{name:/rápida/}).first().waitFor();
      assert.equal(await page.getByRole("link",{name:/lenta/}).count(),0);
    } finally {slow.release();fast.release();}
    await search.fill("vazio");
    await page.getByRole("button",{name:"Limpar filtros"}).waitFor();
    assert.equal(await page.locator("[data-first-access]").count(),0);
    await capture("radar-filtro-vazio");
    failure=true;
    await search.fill("erro");
    await page.getByRole("alert").filter({hasText:"Falha ao consultar oportunidades."}).waitFor();
    await capture("radar-erro");
    failure=false;
    await page.getByRole("button",{name:"Tentar novamente"}).click();
    await page.getByRole("button",{name:"Limpar filtros"}).click();
    await old.first().waitFor();
    await capture("radar-populado");
    const switching=hold("session"), pastWorkspace=hold("radarempresa-anterior");
    try {
      await search.fill("empresa-anterior");
      await pastWorkspace.reached;
      active=second;
      await page.evaluate(()=>window.dispatchEvent(new Event("sa2-session-changed")));
      await switching.reached;
      assert.equal(await old.count(),0,"Dados anteriores devem sair assim que a sessão muda.");
      switching.release();
      const fresh=page.getByRole("link",{name:/Negociação da empresa B/}).first();
      await fresh.waitFor();
      const late=page.waitForResponse(response=>new URL(response.url()).searchParams.get("q")==="empresa-anterior");
      pastWorkspace.release();
      const discarded=await late;
      assert.equal(discarded.status(),200);
      await discarded.finished();
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await fresh.waitFor();
      assert.equal(await old.count(),0);
      assert.equal(await page.getByRole("link",{name:/empresa-anterior/}).count(),0);
    } finally {switching.release();pastWorkspace.release();}
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({role,width,loading:true,filters:true,retry:true,outOfOrder:true,workspaceSwitch:true}));
  } finally {
    await context.close();
    await web.close();
  }
}
try {
  for(const width of [1440,390]) for(const role of ["manager","seller"]) await scenario(role,width);
} finally {await browser.close();}
