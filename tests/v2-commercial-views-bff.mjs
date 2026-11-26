import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {randomUUID} from "node:crypto";
import {createV2Bff} from "../server/v2-bff.mjs";
const listen=server=>new Promise(ok=>server.listen(0,"127.0.0.1",()=>ok("http://127.0.0.1:"+server.address().port)));
const close=server=>new Promise(ok=>server.close(ok));
test("Commercial views BFF keeps opaque cursors, context and narrow read-only query contracts",async()=>{
  const token=randomUUID(),serviceKey=randomUUID(),scope=randomUUID()+"/"+randomUUID(),calls=[];
  const api=createServer((req,res)=>{assert.equal(req.headers.authorization,"Bearer "+token);assert.equal(req.headers["x-service-key"],serviceKey);assert.equal(req.headers["x-v2-context"],scope);calls.push(new URL(req.url,"http://local"));res.writeHead(200,{"Content-Type":"application/json"}).end(JSON.stringify({items:[],nextCursor:null}));});
  const apiOrigin=await listen(api);let bff;const web=createServer((req,res)=>bff(req,res)),origin=await listen(web);bff=createV2Bff({apiOrigin,webOrigin:origin,serviceKey});
  const call=(path,method="GET")=>fetch(origin+"/api/v2/"+path,{method,headers:{Cookie:"sa2_session="+token,Origin:origin,"X-V2-Context":scope,"Content-Type":"application/json"},...(method==="POST"?{body:"{}"}:{})});
  try{
    const cursor="signed.token/+opaque==",params=new URLSearchParams({filter:"esperando_30",windowDays:"90",ownerId:randomUUID(),connectionId:randomUUID(),favorite:"true",order:"urgencia",signal:"sem_resposta",q:"mensagem de teste",limit:"60",cursor});
    assert.equal((await call("commercial/inbox?"+params)).status,200);assert.equal(calls.at(-1).searchParams.get("cursor"),cursor);assert.equal(calls.at(-1).searchParams.get("signal"),"sem_resposta");
    assert.equal((await call("commercial/sales?windowDays=1&limit=60&cursor="+encodeURIComponent(cursor))).status,200);
    assert.equal((await call("commercial/report?windowDays=41")).status,200);
    const before=calls.length;
    for(const path of ["commercial/inbox?filter=inventado","commercial/inbox?signal=inventado","commercial/inbox?order=inventado","commercial/inbox?windowDays=91","commercial/sales?limit=61","commercial/sales?cursor="+"x".repeat(2049),"commercial/inbox?cursor="+encodeURIComponent("token with spaces"),"commercial/report?companyId="+randomUUID(),"commercial/report?windowDays=1&windowDays=2"])
      assert.equal((await call(path)).status,400,path);
    assert.equal((await call("commercial/report","POST")).status,404);assert.equal(calls.length,before);
  }finally{await Promise.all([close(web),close(api)]);}
});
