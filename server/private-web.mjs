// Dependency-free runtime for the precompiled, private V2.
import http from "node:http";
import {readFile, readdir} from "node:fs/promises";
import {createReadStream} from "node:fs";
import {pipeline} from "node:stream/promises";
import {extname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {createV2Bff} from "./v2-bff.mjs";

const publicPort = Number(process.env.SALES_WEB_PUBLIC_PORT || 4319);
if (!Number.isInteger(publicPort) || publicPort < 1 || publicPort > 65535)
  throw new Error("Porta pública da homologação inválida.");
const configuredOrigin = process.env.SA_WEB_ORIGIN;
const origin = new URL(configuredOrigin || "http://127.0.0.1:" + publicPort);
if (configuredOrigin && (origin.protocol !== "https:" || origin.origin !== configuredOrigin))
  throw new Error("SA_WEB_ORIGIN deve conter apenas a origem pública HTTPS, sem caminho ou barra final.");
const site = fileURLToPath(new URL("../site/",import.meta.url));
const api = createV2Bff({
  network:"private", apiOrigin:process.env.SA_API_URL,
  webOrigin:origin.origin, serviceKey:process.env.SA_SERVICE_KEY,
});
const revision = (await readFile(new URL("../REVISION",import.meta.url),"utf8")).trim();
if (!/^sha256:[0-9a-f]{64}$/.test(revision)) throw new Error("Revisão do pacote inválida.");
const health = JSON.stringify({status:"ok",revision});
const html = await readFile(join(site,"index.html"));
if (!html.includes('data-sales-mode="integrated"')) throw new Error("Build integrado da V2 ausente.");

const types = {".js":"text/javascript",".css":"text/css",".woff2":"font/woff2",".woff":"font/woff",
  ".png":"image/png",".jpg":"image/jpeg",".webp":"image/webp",".svg":"image/svg+xml",".ico":"image/x-icon",
  ".json":"application/json",".ttf":"font/ttf"};
const assets = new Map();
async function index(directory) {
  for (const entry of await readdir(join(site,directory),{withFileTypes:true})) {
    const relative = directory + "/" + entry.name;
    if (entry.isDirectory()) await index(relative);
    else if (entry.isFile() && types[extname(entry.name)]) assets.set("/" + relative, join(site,relative));
  }
}
await index("_next/static");
await index("assets");
await index("zoe-avatar");

const server = http.createServer({requestTimeout:20000,headersTimeout:12000}, async (req,res) => {
  res.setHeader("Cache-Control","no-store");
  res.setHeader("X-Content-Type-Options","nosniff");
  res.setHeader("Referrer-Policy","same-origin");
  res.setHeader("X-Frame-Options","DENY");
  if (req.headers.host !== origin.host) return res.writeHead(403).end();
  if (req.url.startsWith("/api/v2/")) return api(req,res);
  if (!["GET","HEAD"].includes(req.method)) return res.writeHead(405,{Allow:"GET, HEAD"}).end();
  const path = req.url.split("?")[0];
  if (path === "/healthz") return res.writeHead(200,{"Content-Type":"application/json"}).end(health);
  if (path === "/" || path === "/portal/") {
    res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Content-Length":html.length});
    return res.end(req.method === "HEAD" ? undefined : html);
  }
  const file = assets.get(path);
  if (!file) return res.writeHead(404).end();
  res.setHeader("Content-Type",types[extname(file)]);
  res.setHeader("Cache-Control", path.startsWith("/_next/static/") ? "public, max-age=31536000, immutable" : "public, max-age=3600");
  if (req.method === "HEAD") return res.end();
  try { await pipeline(createReadStream(file),res); }
  catch { res.destroy(); }
});
server.listen(4319,"0.0.0.0",() => console.log("Web V2 privado pronto na porta interna 4319."));
for (const signal of ["SIGTERM","SIGINT"]) process.once(signal,() => server.close());
