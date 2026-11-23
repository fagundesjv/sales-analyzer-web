import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {createServer, request} from "node:http";
import {test} from "node:test";
import {createV2Bff} from "../server/v2-bff.mjs";

const listen = server => new Promise(resolve =>
  server.listen(0,"127.0.0.1",() => resolve(server.address().port)));
const close = server => new Promise(resolve => server.close(resolve));

function send(port, method, path, host, origin, cookie) {
  const body = method === "POST" ? JSON.stringify({email:"test@example.test",password:"example"}) : undefined;
  const headers = {Host:host};
  if (origin) headers.Origin = origin;
  if (cookie) headers.Cookie = cookie;
  if (body) headers["Content-Type"] = "application/json";
  return new Promise((resolve,reject) => {
    const req = request({hostname:"127.0.0.1",port,path,method,headers},res => {
      res.resume();
      res.on("end",() => resolve({status:res.statusCode,cookie:res.headers["set-cookie"]?.[0]}));
    });
    req.on("error",reject);
    req.end(body);
  });
}

for (const [webOrigin,secure] of [
  ["https://v2.salesanalyzer.app",true],
  ["http://127.0.0.1:4349",false],
]) {
  test("Sessão na origem " + webOrigin,async () => {
    const token = "fixture-token";
    const upstream = createServer((req,res) => {
      res.setHeader("Content-Type","application/json");
      if (req.url === "/v1/auth/session" && req.method === "POST") {
        res.end(JSON.stringify({token,session:{workspace:{id:"11111111-1111-4111-8111-111111111111"}}}));
        return;
      }
      if (req.url === "/v1/auth/session" && req.method === "DELETE") {
        res.statusCode = 204;
        res.end();
        return;
      }
      res.statusCode = 401;
      res.end(JSON.stringify({error:{code:"session_expired",message:"Sessão expirada."}}));
    });
    const apiPort = await listen(upstream);
    const bff = createServer(createV2Bff({
      apiOrigin:"http://127.0.0.1:" + apiPort,
      webOrigin,
      serviceKey:"a".repeat(32),
    }));
    const webPort = await listen(bff);
    const host = new URL(webOrigin).host;
    try {
      const login = await send(webPort,"POST","/api/v2/auth/session",host,webOrigin);
      assert.equal(login.status,200);
      assert.match(login.cookie,/sa2_session=fixture-token; HttpOnly; SameSite=Strict; Path=\/api\/v2/);
      assert.equal(login.cookie.includes("; Secure"),secure);

      const wrongOrigin = await send(webPort,"POST","/api/v2/auth/session",host,"https://other.example.test");
      assert.equal(wrongOrigin.status,403);
      const wrongHost = await send(webPort,"POST","/api/v2/auth/session","other.example.test",webOrigin);
      assert.equal(wrongHost.status,403);

      const expired = await send(webPort,"GET","/api/v2/session",host,undefined,"sa2_session="+token);
      assert.equal(expired.status,401);
      assert.match(expired.cookie,/Max-Age=0/);
      assert.equal(expired.cookie.includes("; Secure"),secure);

      const logout = await send(webPort,"DELETE","/api/v2/auth/session",host,webOrigin,"sa2_session="+token);
      assert.equal(logout.status,204);
      assert.match(logout.cookie,/Max-Age=0/);
      assert.equal(logout.cookie.includes("; Secure"),secure);
    } finally {
      await close(bff);
      await close(upstream);
    }
  });
}

test("Origem pública explícita exige HTTPS sem caminho",() => {
  for (const origin of ["http://v2.salesanalyzer.app","https://v2.salesanalyzer.app/portal"]) {
    const result = spawnSync(process.execPath,["server/private-web.mjs"],{
      env:{...process.env,SA_WEB_ORIGIN:origin,SALES_WEB_PUBLIC_PORT:"4319"},
      encoding:"utf8",
    });
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/SA_WEB_ORIGIN deve conter apenas a origem pública HTTPS/);
  }
});
