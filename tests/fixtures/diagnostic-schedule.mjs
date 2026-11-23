// This fixture only schedules in memory. No worker or WhatsApp provider is contacted.
import {randomUUID} from "node:crypto";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {json,startFixtureWeb} from "./web-bff.mjs";

export async function startScheduleFixture(bundle,{role="manager",port=0}={}) {
  const user={id:randomUUID(),name:"Pessoa de teste",email:"teste@example.test"};
  const workspace={id:randomUUID(),role,name:"Operação fictícia"};
  const context=user.id+"/"+workspace.id;
  const line={id:randomUUID(),name:"Linha de homologação",source:"evolution",status:"disconnected"};
  const diagnostic={id:randomUUID(),connectionId:line.id,status:"failed",error:"source_unavailable",createdAt:"2026-01-05T13:00:00Z"};
  const state={schedule:{connectionId:line.id,enabled:false,localTime:"06:00",timeZone:"America/Sao_Paulo",version:0,
    nextRunAt:null,lastEvaluatedAt:null,lastDecision:null,lastDiagnosticId:null},writes:[],reads:0,pairings:0,readError:false};
  const receipts=new Map();
  const web=await startFixtureWeb(bundle,port,async(req,res,path) => {
    if (path==="session") return json(res,200,{user,workspace,workspaces:[workspace]});
    if (req.headers["x-v2-context"]!==context) return json(res,403,{});
    if (path==="connections") return json(res,200,{items:[line],nextCursor:null});
    if (path==="diagnostics") return json(res,200,{items:[diagnostic],nextCursor:null});
    if (path==="diagnostics/"+diagnostic.id) return json(res,200,diagnostic);
    if (path==="connections/"+line.id+"/status") return json(res,200,{...line,connectionId:line.id});
    if (path==="connections/"+line.id+"/pairing" && role==="manager" && req.method==="POST") {
      state.pairings++;
      return json(res,200,{connectionId:line.id,source:"evolution",status:"connecting",
        qrDataUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK0sAAAAASUVORK5CYII="});
    }
    if (path!=="connections/"+line.id+"/diagnostic-schedule") return json(res,404,{});
    if (req.method==="GET") {
      state.reads++;
      return state.readError ? json(res,503,{error:{message:"A agenda está temporariamente indisponível."}}) : json(res,200,state.schedule);
    }
    if (req.method!=="PUT" || role!=="manager") return json(res,403,{});
    const chunks=[];
    for await (const chunk of req) chunks.push(chunk);
    const body=JSON.parse(Buffer.concat(chunks).toString());
    const key=req.headers["idempotency-key"];
    state.writes.push({body,key});
    if (!key || Object.keys(body).sort().join()!=="enabled,localTime,timeZone,version") return json(res,400,{});
    if (receipts.has(key)) return json(res,200,receipts.get(key));
    if (body.version!==state.schedule.version) return json(res,409,{error:{code:"schedule_version_conflict",message:"A agenda foi alterada."}});
    // Stable sample dates for asserting the receipt is displayed in the saved time zone.
    const offset=new Intl.DateTimeFormat("en",{timeZone:body.timeZone,timeZoneName:"longOffset"})
      .formatToParts(new Date("2026-01-06T12:00:00Z")).find(part=>part.type==="timeZoneName").value.slice(3) || "Z";
    const nextRunAt=body.enabled ? "2026-01-06T"+body.localTime+":00"+offset : null;
    state.schedule={...state.schedule,...body,version:body.version+1,nextRunAt};
    receipts.set(key,state.schedule);
    return json(res,200,state.schedule);
  });
  return {...web,state,line,diagnostic,context};
}
if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const fixture=await startScheduleFixture(process.argv[2],{port:Number(process.argv[3] || 4402)});
  console.log(fixture.origin+"/#whatsapps");
}
