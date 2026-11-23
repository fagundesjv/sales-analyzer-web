// Local static Web + compiled BFF with an authenticated, in-memory upstream.
import {createServer} from "node:http";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {resolve, extname, sep} from "node:path";
import {pathToFileURL} from "node:url";

const listen=(server,port) => new Promise((ok,fail) => {
  server.once("error",fail);
  server.listen(port,"127.0.0.1",() => ok("http://127.0.0.1:"+server.address().port));
});
export function json(res,status,data) {
  res.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store"});
  res.end(JSON.stringify(data));
}
export async function startFixtureWeb(bundle,port,handle) {
  const root=resolve(bundle);
  const site=resolve(root,"site");
  const revision=(await readFile(resolve(root,"REVISION"),"utf8")).trim();
  const {createV2Bff}=await import(pathToFileURL(resolve(root,"server/v2-bff.mjs")));
  const serviceKey=randomUUID(), token=randomUUID();
  const api=createServer(async (req,res) => {
    if (req.headers["x-service-key"]!==serviceKey || req.headers.authorization!=="Bearer "+token) return json(res,401,{});
    const path=new URL(req.url,"http://localhost").pathname.slice("/v1/".length);
    await handle(req,res,path);
  });
  const apiOrigin=await listen(api,0);
  let bff;
  const mime={".js":"text/javascript",".css":"text/css",".html":"text/html",".svg":"image/svg+xml",
    ".png":"image/png",".woff2":"font/woff2",".json":"application/json"};
  const web=createServer(async(req,res) => {
    if (req.url.startsWith("/api/v2/")) return bff(req,res);
    if (req.url==="/healthz") return json(res,200,{fixture:true,revision});
    const pathname=new URL(req.url,"http://localhost").pathname;
    const file=resolve(site,"."+ (pathname==="/" ? "/index.html" : pathname));
    if (!file.startsWith(site+sep) || !mime[extname(file)]) return res.writeHead(404).end();
    try {
      const bytes=await readFile(file);
      if (pathname==="/") res.setHeader("Set-Cookie","sa2_session="+token+"; HttpOnly; SameSite=Strict; Path=/api/v2");
      res.writeHead(200,{"Content-Type":mime[extname(file)]});res.end(bytes);
    } catch {res.writeHead(404).end();}
  });
  const origin=await listen(web,port);
  bff=createV2Bff({apiOrigin,webOrigin:origin,serviceKey});
  return {origin,revision,close:() => Promise.all([web,api].map(s=>new Promise(ok=>s.close(ok))))};
}
