import {randomUUID} from "node:crypto";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {json,startFixtureWeb} from "./web-bff.mjs";

const uuid=n => "ab000000-0000-4000-8000-"+String(n).padStart(12,"0");
const workspace={id:uuid(1),name:"Empresa fictícia",role:"seller"};
const user={id:uuid(2),name:"Vendedor de teste",email:"vendedor@example.test"};
export const testContext=user.id+"/"+workspace.id;
export async function startFixture(bundle,port=0) {
  const lines=["simulated","real",null].map((mode,i) => ({
    id:uuid(i+10),mode,title:["Beatriz Teste","Rafael Teste","Clara Teste"][i],summary:"Proposta de exemplo",
    source:"evolution",priority:"high",favorite:false,pendingRevision:false,
    evidence:[{externalId:"inbound",direction:"inbound",occurredAt:"2026-01-01T10:00:00Z",text:"Podemos retomar a proposta?"}],
    messages:[],destination:mode ? "+55000000000"+i : null,lineName:"Comercial "+(i+1),
  }));
  const records=new Map(),tickets=new Map();
  const state={starts:0,calls:[],dispatches:0,nextStatus:"accepted",ttl:600000};
  const web=await startFixtureWeb(bundle,port,async (req,res,path) => {
    if (path==="session") return json(res,200,{user,workspace,workspaces:[workspace]});
    if (req.headers["x-v2-context"]!==testContext) return json(res,403,{});
    if (path==="focus") return json(res,200,{round:null});
    if (path==="conversations") return json(res,200,{items:lines.map(({id,title,summary})=>({id,title,summary})),nextCursor:null});
    const [family,id,action,child]=path.split("/");
    const line=lines.find(l => l.id===id);
    if (family!=="conversations" || !line) return json(res,404,{});
    if (!action) {
      const {messages,mode,destination,lineName,...conversation}=line;
      return json(res,200,conversation);
    }
    if (action!=="attendance") return json(res,404,{});
    if (req.method==="GET") return json(res,200,{available:!!line.mode,mode:line.mode,contactName:line.title,
      lineName:line.lineName,destination:line.destination,messages:line.messages});
    const chunks=[];
    for await (const chunk of req) chunks.push(chunk);
    const body=JSON.parse(Buffer.concat(chunks).toString());
    if (!child) {
      if (!line.mode || body.mode!==line.mode || body.confirm!==true) return json(res,403,{});
      state.starts++;
      const ticket=randomUUID(), expires=Date.now()+state.ttl;
      tickets.set(ticket,{id,expires});
      return json(res,200,{ticket,expiresAt:new Date(expires).toISOString()});
    }
    if (child!=="messages" || req.method!=="POST") return json(res,404,{});
    const permit=tickets.get(body.ticket);
    if (!permit || permit.id!==id || permit.expires<=Date.now()) return json(res,403,{error:{message:"Confirme o destino novamente."}});
    if (typeof body.text!=="string" || !body.text.trim() || body.text.length>4000) return json(res,400,{});
    const key=req.headers["idempotency-key"];
    state.calls.push({key,body});
    let receipt=records.get(key);
    if (!receipt) {
      const status=state.nextStatus;
      receipt={id:randomUUID(),text:body.text,status,createdAt:new Date().toISOString(),
        providerMessageId:status==="accepted" ? randomUUID() : null};
      records.set(key,receipt);line.messages.push(receipt);state.dispatches++;
    }
    json(res,receipt.status==="accepted"?200:202,receipt);
  });
  return {...web,lines,state};
}
if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const fixture=await startFixture(process.argv[2],Number(process.argv[3] || 4401));
  console.log(fixture.origin+"/#entrada/todos/"+fixture.lines[0].id);
}
