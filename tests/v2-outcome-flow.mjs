// Regression through the compiled Web and its BFF with a local upstream.
import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import {chromium} from "playwright";
import {json,startFixtureWeb} from "./fixtures/web-bff.mjs";

const shots=process.env.SA_EVIDENCE_DIR;
if (shots) await mkdir(shots,{recursive:true});
const browser=await chromium.launch({channel:"chrome"});
try {
  for (const width of [1440,390]) {
    const workspace={id:randomUUID(),name:"Empresa de teste"};
    const seller={id:randomUUID(),name:"Vendedor",email:"vendedor@example.test"};
    const manager={id:randomUUID(),name:"Gestor",email:"gestor@example.test"};
    const item={id:randomUUID(),title:"Contato de homologação",summary:"Pedido de orçamento",priority:"high",source:"synthetic",evidence:[
      {externalId:randomUUID(),occurredAt:"2026-11-20T13:20:00Z",text:"Podem enviar o orçamento?",direction:"inbound"},
    ]};
    const pair=await Promise.all([[seller,"seller"],[manager,"manager"]].map(([user,role])=>
      startFixtureWeb(process.argv[2],0,async(req,res,path)=>{
        if(path==="session") return json(res,200,{workspace:{...workspace,role},user,workspaces:[{...workspace,role}]});
        if(req.headers["x-v2-context"]!==user.id+"/"+workspace.id) return json(res,403,{});
        if(path==="focus") return json(res,200,{round:null});
        if(["radar","conversations"].includes(path)) return json(res,200,{items:[item],nextCursor:null});
        if(path==="conversations/"+item.id) return json(res,200,item);
        if(path.endsWith("/attendance")) return json(res,200,{available:false,messages:[]});
        if(path==="summary") return json(res,200,{conversations:1,opportunities:1,pendingWins:{count:0,amountCents:"0"},confirmedWins:{count:item.outcome?.confirmedAt ? 1 : 0,amountCents:item.outcome?.confirmedAt ? item.outcome.amountCents : "0"}});
        if(req.method==="PUT" && path.startsWith("conversations/"+item.id+"/outcome")){
          let text=""; for await(const part of req) text+=part;
          const data=JSON.parse(text);
          if(path.endsWith("/confirmation")){
            if(role!=="manager" || data.recordedAt!==item.outcome.recordedAt) return json(res,403,{});
            item.outcome.confirmedAt=new Date().toISOString();
          }else{
            assert.equal(role,"seller");
            assert.equal(data.amountCents,124735);
            item.outcome={...data,recordedAt:new Date().toISOString()};
          }
          return json(res,200,item.outcome);
        }
        return json(res,404,{});
      })));
    const context=await browser.newContext({viewport:{width,height:width===390?844:900}});
    const page=await context.newPage(); page.setDefaultTimeout(7000);
    try {
      async function openFromRadar(web){
        await page.goto(web.origin+"/#radar");
        await page.getByRole("region",{name:"Fila de recuperação"}).getByRole("link",{name:/Contato de homologação/}).click();
        await page.getByText("Podem enviar o orçamento?",{exact:true}).waitFor();
      }
      await openFromRadar(pair[0]);
      await page.getByRole("button",{name:"Desfecho",exact:true}).click();
      await page.getByRole("button",{name:"Venda ganha",exact:true}).click();
      await page.getByRole("textbox",{name:"Valor da venda"}).fill("1.247,35");
      await page.getByRole("button",{name:"Registrar desfecho"}).click();
      await page.getByText(/Aguardando confirmação do gestor/).waitFor();
      assert.equal(await page.getByRole("button",{name:"Revisar ganho"}).count(),0);
      await openFromRadar(pair[1]);
      await page.getByRole("button",{name:"Revisar ganho"}).click();
      await page.getByRole("dialog").getByRole("button",{name:"Confirmar ganho",exact:true}).click();
      await page.getByText(/Ganho confirmado/).waitFor();
      await page.reload();
      await page.getByText(/Ganho confirmado/).waitFor();
      if (shots) await page.screenshot({path:shots+"/ganho-fixture-"+width+".png"});
      await page.goto(pair[1].origin+"/#resultados");
      await page.getByRole("region",{name:"Vendas ganhas"}).getByRole("link",{name:/Contato de homologação.*Confirmada/}).waitFor();
      console.log("OK",width,"Radar → Conversa → Ganho do vendedor → confirmação do gestor → Ganhos (dados locais)");
    } finally {await context.close();await Promise.all(pair.map(web=>web.close()));}
  }
} finally {await browser.close();}
