// Local WhatsApp contract fixture. It never contacts a messaging provider.
import {randomUUID} from "node:crypto";
import {deflateSync} from "node:zlib";
import qr from "qrcode-generator";
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
export async function startConnectionFixture(bundle,{role="manager"}={}) {
  const user={id:randomUUID(),name:"Pessoa de teste",email:"teste@example.test"};
  const workspace={id:randomUUID(),role,name:"Operação fictícia"};
  const seller={id:randomUUID(),name:"Ana Vendedora",role:"seller"};
  const context=user.id+"/"+workspace.id;
  const state={line:null,seller,creates:[],provisions:[],pairings:0,pairingFails:false};
  const web=await startFixtureWeb(bundle,0,async(req,res,path) => {
    if (path==="session") return json(res,200,{user,workspace,workspaces:[workspace]});
    if (req.headers["x-v2-context"]!==context) return json(res,403,{});
    if (path==="team" && req.method==="GET") {
      const after=new URL(req.url,"http://localhost").searchParams.has("cursor");
      return json(res,200,after ? {items:[seller],nextCursor:null} :
        {items:[{id:user.id,name:user.name,role}],nextCursor:user.id});
    }
    if (path==="connections" && req.method==="GET")
      return json(res,200,{items:state.line?[state.line]:[],nextCursor:null});
    if (path==="connections" && req.method==="POST") {
      if (role!=="manager") return json(res,403,{});
      const body=await bodyOf(req);
      state.creates.push({body,key:req.headers["idempotency-key"]});
      if (!state.line) state.line={id:randomUUID(),name:body.name,channel:"whatsapp",status:"provisioning"};
      return json(res,202,{connectionId:state.line.id,name:state.line.name,channel:"whatsapp",status:"provisioning"});
    }
    if (!state.line) return json(res,404,{});
    const prefix="connections/"+state.line.id;
    if (path===prefix+"/provision" && req.method==="POST") {
      if (role!=="manager") return json(res,403,{});
      state.provisions.push({body:await bodyOf(req),key:req.headers["idempotency-key"]});
      state.line.status="disconnected";
      return json(res,201,{connectionId:state.line.id,name:state.line.name,channel:"whatsapp",status:state.line.status});
    }
    if (path===prefix+"/status" && req.method==="GET")
      return json(res,200,{connectionId:state.line.id,channel:"whatsapp",status:state.line.status});
    if (path===prefix+"/pairing" && req.method==="POST") {
      if (role!=="manager") return json(res,403,{});
      state.pairings++;
      if (state.pairingFails) return json(res,502,{error:{code:"evolution_unavailable",message:"Falha na instância Evolution da V2."}});
      state.line.status="connecting";
      return json(res,200,{connectionId:state.line.id,channel:"whatsapp",status:"connecting",qrDataUrl});
    }
    if (path===prefix+"/diagnostic-schedule" && req.method==="GET")
      return json(res,200,{connectionId:state.line.id,enabled:false,localTime:"09:00",
        timeZone:"America/Sao_Paulo",version:0,nextRunAt:null,lastEvaluatedAt:null,lastDecision:null,lastDiagnosticId:null});
    return json(res,404,{});
  });
  return {...web,state,context};
}
