import assert from "node:assert/strict";
import {test} from "node:test";
import {createServer} from "node:http";
import {randomBytes} from "node:crypto";
import {createV2Bff} from "../server/v2-bff.mjs";
const secret=()=>randomBytes(32).toString("hex");
const listen=server=>new Promise(ok=>server.listen(0,"127.0.0.1",()=>ok("http://127.0.0.1:"+server.address().port)));
const stop=server=>new Promise(ok=>server.close(ok));
test("Central IA separa sessão staff, chave de servidor e origem",async()=>{
  const serviceKey=secret(),adminKey=secret(),token=secret(),customer=secret();let calls=0;
  const session={staff:{id:"synthetic",name:"Equipe",role:"owner"},secondFactor:{state:"verified"}};
  const upstream=createServer(async(req,res)=>{
    calls++;assert.equal(req.headers["x-service-key"],serviceKey);assert.equal(req.headers["x-admin-key"],adminKey);
    assert.equal(req.headers["x-v2-context"],undefined);let body="";for await(const part of req)body+=part;
    const login=req.url==="/v1/admin/auth/session";
    if(!login)assert.equal(req.headers.authorization,"Bearer "+token);
    res.writeHead(req.method==="DELETE"?204:200,{"Content-Type":"application/json"});
    res.end(req.method==="DELETE"?undefined:JSON.stringify(login?{token,session}:{session,received:body?JSON.parse(body):null}));
  });
  const apiOrigin=await listen(upstream);let handler;
  const web=createServer((req,res)=>handler(req,res)),webOrigin=await listen(web);
  handler=createV2Bff({apiOrigin,webOrigin,serviceKey,adminKey});
  const call=(path,method="GET",body,cookie="sa2_staff="+token)=>fetch(webOrigin+"/api/v2/staff/"+path,{method,headers:{Cookie:cookie,Origin:webOrigin,"Content-Type":"application/json","X-V2-Context":"not-forwarded"},body:body?JSON.stringify(body):undefined});
  try {
    const login=await call("auth/session","POST",{email:"owner@example.test",password:"synthetic"});
    assert.equal(login.status,200);assert.deepEqual(await login.json(),session);
    assert.match(login.headers.get("set-cookie"),/sa2_staff=[a-f0-9]{64}; HttpOnly; SameSite=Strict; Path=\/api\/v2\/staff/);
    assert.ok(!(JSON.stringify(session).includes(token)));
    assert.equal((await call("ai/catalog")).status,200);
    assert.equal((await call("ai/routes/draft","POST",{action:"set",expectedVersion:null})).status,200);
    const before=calls;
    for(const path of ["ai/catalog?x=1","companies","ai/routes/unknown"]){const r=await call(path);assert.equal(r.status,404);await r.body?.cancel();}
    assert.equal((await call("../session")).status,401); // Fetch normalizes this to the customer route, which accepts no staff cookie.
    const impersonation=await call("ai/catalog","GET",undefined,"sa2_session="+customer);assert.equal(impersonation.status,401);
    const csrf=await fetch(webOrigin+"/api/v2/staff/ai/catalog",{method:"POST",headers:{Cookie:"sa2_staff="+token,Origin:"https://external.example.test","Content-Type":"application/json"},body:"{}"});assert.equal(csrf.status,403);
    assert.equal(calls,before);
    const logout=await call("session","DELETE");assert.equal(logout.status,204);assert.match(logout.headers.get("set-cookie"),/Max-Age=0/);
    handler=createV2Bff({apiOrigin,webOrigin,serviceKey});assert.equal((await call("ai/catalog")).status,404);
  } finally {await stop(web);await stop(upstream);}
});
