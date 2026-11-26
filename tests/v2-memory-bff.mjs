import assert from "node:assert/strict";
import {test} from "node:test";
import {randomUUID} from "node:crypto";
import {createServer} from "node:http";
import {createV2Bff} from "../server/v2-bff.mjs";
const listen=s=>new Promise(ok=>s.listen(0,"127.0.0.1",()=>ok("http://127.0.0.1:"+s.address().port)));
const stop=s=>new Promise(ok=>s.close(ok));
test("BFF memória mantém contexto, DELETE JSON e limites seletivos de importação",async()=>{
  const serviceKey=randomUUID(),token=randomUUID(),scope=randomUUID()+"/"+randomUUID(),sourceId=randomUUID();let count=0;
  const api=createServer(async(req,res)=>{
    count++;assert.equal(req.headers["x-service-key"],serviceKey);assert.equal(req.headers.authorization,"Bearer "+token);assert.equal(req.headers["x-v2-context"],scope);
    let raw="";for await(const part of req)raw+=part;
    if(req.method==="DELETE"){assert.equal(req.url,"/v1/memory/documents/"+sourceId);assert.deepEqual(JSON.parse(raw),{expectedVersion:2});assert.ok(req.headers["idempotency-key"]);return res.writeHead(204).end();}
    res.writeHead(200,{"Content-Type":"application/json"});res.end(JSON.stringify({received:raw.length}));
  });
  const apiOrigin=await listen(api);let handler;const web=createServer((req,res)=>handler(req,res)),webOrigin=await listen(web);
  handler=createV2Bff({apiOrigin,webOrigin,serviceKey});
  const call=(path,method="GET",body,key=randomUUID())=>fetch(webOrigin+"/api/v2/"+path,{method,headers:{Cookie:"sa2_session="+token,Origin:webOrigin,"X-V2-Context":scope,"Content-Type":"application/json",...(key?{"Idempotency-Key":key}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  try {
    assert.equal((await call("memory/materials","POST",{sourceId,content:"A".repeat(16000),format:"txt",expectedVersion:1})).status,200);
    assert.equal((await call("memory/documents/"+sourceId,"DELETE",{expectedVersion:2})).status,204);
    assert.equal((await call("memory/search?scope=customer&conversationId="+randomUUID()+"&opportunityId="+randomUUID()+"&q="+"a".repeat(200)+"&limit=20")).status,200);
    const before=count;
    for(const path of ["memory/search?scope=all","memory/search?scope=company&limit=51","memory/search?scope=company&lineId="+randomUUID()])assert.equal((await call(path)).status,400);
    assert.equal((await call("memory/documents/"+sourceId,"DELETE",{expectedVersion:2},null)).status,400);
    assert.equal((await call("catalog/items","POST",{title:"a".repeat(9000)})).status,413);
    assert.equal(count,before);
  } finally {await stop(web);await stop(api);}
});
