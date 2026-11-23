// Local WhatsApp contract fixture. It never contacts a messaging provider.
import {randomUUID} from "node:crypto";
import {deflateSync} from "node:zlib";
import qr from "qrcode-generator";
import {fixtureSchedule} from "./diagnostic-schedule.mjs";
import {json,startFixtureWeb} from "./web-bff.mjs";

const code=qr(0,"M");
code.addData("Sales Analyzer | pareamento local | " + randomUUID());
code.make();
function crc32(bytes) {
  let value=0xffffffff;
  for(const byte of bytes) {
    value^=byte;
    for(let bit=0;bit<8;bit++) value=(value>>>1) ^ (value&1 ? 0xedb88320 : 0);
  }
  return (value^0xffffffff)>>>0;
}
function chunk(type,data) {
  const label=Buffer.from(type),length=Buffer.alloc(4),checksum=Buffer.alloc(4);
  length.writeUInt32BE(data.length);checksum.writeUInt32BE(crc32(Buffer.concat([label,data])));
  return Buffer.concat([length,label,data,checksum]);
}
const scale=5,quiet=4,modules=code.getModuleCount(),size=(modules+quiet*2)*scale;
const pixels=Buffer.alloc((1+size*3)*size,255);
for(let y=0;y<size;y++) {
  const row=y*(1+size*3);pixels[row]=0;
  for(let x=0;x<size;x++) {
    const moduleX=Math.floor(x/scale)-quiet,moduleY=Math.floor(y/scale)-quiet;
    const dark=moduleX>=0 && moduleY>=0 && moduleX<modules && moduleY<modules && code.isDark(moduleY,moduleX);
    pixels.fill(dark?0:255,row+1+x*3,row+1+x*3+3);
  }
}
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=2;
const qrDataUrl="data:image/png;base64,"+Buffer.concat([Buffer.from("89504e470d0a1a0a","hex"),
  chunk("IHDR",ihdr),chunk("IDAT",deflateSync(pixels)),chunk("IEND",Buffer.alloc(0))]).toString("base64");
async function bodyOf(req) {
  const chunks=[];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString());
}
export async function startConnectionFixture(bundle,{role="manager",port=0,localhostAlias=false,workspaceId=randomUUID(),lines=[],schedules=new Map()}={}) {
  const user={id:randomUUID(),name:"Pessoa de teste",email:"teste@example.test"};
  const workspace={id:workspaceId,role,name:"Operação fictícia"};
  const seller={id:randomUUID(),name:"Ana Vendedora",role:"seller"};
  const context=user.id+"/"+workspace.id;
  const state={lines,user,workspace,seller,creates:[],provisions:[],pairings:0,teamReads:0,
    capability:role==="manager",creationStatus:"provisioning",provisionStatus:"disconnected"};
  const reservations=new Map();
  function addLine(fields={}) {
    const line={id:randomUUID(),name:"Linha de teste",source:"whatsapp",channel:"whatsapp",
      status:"disconnected",ownerId:user.id,workspaceId:workspace.id,...fields};
    state.lines.push(line);
    return line;
  }
  const visibleLines=()=>state.lines.filter(line=>line.workspaceId===workspace.id && (role==="manager" || line.ownerId===user.id));
  const receipt=line=>({connectionId:line.id,name:line.name,ownerId:line.ownerId,channel:line.channel,status:line.status});
  const denied=res=>json(res,403,{error:{code:"forbidden",message:"Acesso indisponível."}});
  const web=await startFixtureWeb(bundle,port,async(req,res,path) => {
    if (path==="session") return json(res,200,{user,workspace,workspaces:[workspace]});
    if (req.headers["x-v2-context"]!==context) return denied(res);
    if (path==="team" && req.method==="GET") {
      state.teamReads++;
      if (role!=="manager") return denied(res);
      const after=new URL(req.url,"http://localhost").searchParams.has("cursor");
      return json(res,200,after ? {items:[seller],nextCursor:null} :
        {items:[{id:user.id,name:user.name,role}],nextCursor:user.id});
    }
    if (path==="connections" && req.method==="GET") return json(res,200,{
      items:visibleLines().map(({workspaceId,...line})=>line),nextCursor:null,
      ...(state.capability===undefined ? {} : {capabilities:{whatsappSelfServe:state.capability}}),
    });
    if (req.method==="GET" && ["radar","alerts","conversations","diagnostics"].includes(path))
      return json(res,200,{items:[],nextCursor:null});
    if (path==="alerts/settings")
      return role==="manager" && req.method==="GET" ? json(res,200,{risk:true,loss:true,disconnected:true,version:1}) : denied(res);
    if (path==="summary") return json(res,200,{conversations:0,opportunities:0,
      pendingWins:{count:0,amountCents:"0"},confirmedWins:{count:0,amountCents:"0"}});
    if (path==="connections" && req.method==="POST") {
      if (role!=="manager" || state.capability!==true) return denied(res);
      const body=await bodyOf(req), key=req.headers["idempotency-key"];
      state.creates.push({body,key});
      if (state.limitReached) return json(res,409,{error:{code:"line_limit",message:"Limite de linhas de WhatsApp atingido."}});
      const old=reservations.get(key);
      if (old && (old.name!==body.name || old.ownerId!==(body.ownerId??user.id)))
        return json(res,409,{error:{code:"idempotency_conflict",message:"Solicitação já utilizada."}});
      const line=old || addLine({name:body.name,ownerId:body.ownerId??user.id,status:state.creationStatus});
      reservations.set(key,line);
      if (state.loseReceipt) {
        state.loseReceipt=false;
        return json(res,503,{error:{code:"temporarily_unavailable",message:"A confirmação está indisponível."}});
      }
      return json(res,line.status==="provisioning" ? 202 : 201,receipt(line));
    }
    const [,id,operation]=path.split("/");
    const line=visibleLines().find(item=>item.id===id);
    if (!line || !path.startsWith("connections/")) return json(res,404,{});
    if (operation==="provision" && req.method==="POST") {
      if (role!=="manager" || state.capability!==true) return denied(res);
      state.provisions.push({body:await bodyOf(req),key:req.headers["idempotency-key"]});
      line.status=state.provisionStatus;
      return json(res,line.status==="provisioning"?202:200,receipt(line));
    }
    if (operation==="status" && req.method==="GET")
      return json(res,200,{connectionId:line.id,source:line.source,channel:line.channel,status:line.status});
    if (operation==="pairing" && req.method==="POST") {
      if (role!=="manager") return denied(res);
      state.pairings++;
      if (state.pairingFails) return json(res,502,{error:{code:"evolution_unavailable",message:"Falha na instância Evolution da V2."}});
      line.status="connecting";
      return json(res,200,{connectionId:line.id,source:line.source,channel:"whatsapp",status:line.status,qrDataUrl});
    }
    if (operation==="diagnostic-schedule") {
      // A shared line has one schedule across roles. Check write access for the current viewer.
      if (req.method==="PUT" && role!=="manager") return denied(res);
      if (!schedules.has(id)) schedules.set(id,fixtureSchedule(id,"manager"));
      return schedules.get(id).handle(req,res);
    }
    return json(res,404,{});
  },{localhostAlias});
  return {...web,state,context,addLine};
}
