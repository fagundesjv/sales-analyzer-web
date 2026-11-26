import {createServer} from "node:http";
import {randomBytes} from "node:crypto";
import {readFile} from "node:fs/promises";
import {resolve,extname,sep} from "node:path";
import {pathToFileURL} from "node:url";
const listen=server=>new Promise(ok=>server.listen(0,"127.0.0.1",()=>ok("http://127.0.0.1:"+server.address().port)));
export function json(res,status,data){res.writeHead(status,{"Content-Type":"application/json"});res.end(data===undefined?undefined:JSON.stringify(data));}
export async function staffWeb(bundle,handle){
  const root=resolve(bundle),site=resolve(root,"site"),key=()=>randomBytes(32).toString("hex");
  const serviceKey=key(),adminKey=key(),token=key();
  const {createV2Bff}=await import(pathToFileURL(resolve(root,"server/v2-bff.mjs")));
  const api=createServer(async(req,res)=>{
    if(req.headers["x-service-key"]!==serviceKey||req.headers["x-admin-key"]!==adminKey)return json(res,401,{error:{message:"Entre na Central."}});
    if(req.url!=="/v1/admin/auth/session"&&req.headers.authorization!=="Bearer "+token)return json(res,401,{error:{message:"Entre na Central."}});
    const path=req.url.slice("/v1/admin/".length);let body="";for await(const chunk of req)body+=chunk;
    return handle(req,res,path,body?JSON.parse(body):null,token);
  });
  const apiOrigin=await listen(api);let bff;
  const mime={".js":"text/javascript",".css":"text/css",".svg":"image/svg+xml",".png":"image/png",".woff2":"font/woff2",".json":"application/json"};
  const web=createServer(async(req,res)=>{
    if(req.url.startsWith("/api/v2/"))return bff(req,res);
    const path=new URL(req.url,"http://local").pathname;
    const file=resolve(site,"."+(path==="/"?"/index.html":path));
    if(!file.startsWith(site+sep))return res.writeHead(404).end();
    try {res.writeHead(200,{"Content-Type":path==="/"?"text/html":mime[extname(file)]||"application/octet-stream"});res.end(await readFile(file));}
    catch {res.end();}
  });
  const origin=await listen(web);bff=createV2Bff({apiOrigin,webOrigin:origin,serviceKey,adminKey});
  return {origin,close:()=>Promise.all([web,api].map(server=>new Promise(ok=>server.close(ok))))};
}
