import http from "node:http";
import {createV2Bff} from "./v2-bff.mjs";

const port = Number(process.env.SALES_WEB_PORT || 4319);
const hostname = "127.0.0.1";
const origin = "http://" + hostname + ":" + port;
const handleApi = createV2Bff({
  apiOrigin: process.env.SA_API_URL || "http://127.0.0.1:4331",
  webOrigin: origin,
  serviceKey: process.env.SA_SERVICE_KEY,
});
process.env.SALES_WEB_MODE = "integrated";
const {default: next} = await import("next");
const app = next({dev: process.env.NODE_ENV !== "production", hostname, port});
await app.prepare();
const handleWeb = app.getRequestHandler();
const server = http.createServer((req, res) => {
  if (req.headers.host !== new URL(origin).host) {
    res.writeHead(403).end();
    return;
  }
  if (req.url.startsWith("/api/v2/")) return handleApi(req, res);
  const path = new URL(req.url, origin).pathname;
  if (path === "/" || path === "/portal/" || /^\/(?:_next|assets|zoe-avatar)\//.test(path) || path === "/favicon.ico")
    return handleWeb(req, res);
  res.writeHead(404).end();
});
const upgrade = app.getUpgradeHandler();
server.on("upgrade", (req, socket, head) => {
  if (req.headers.host !== new URL(origin).host || req.headers.origin !== origin) return socket.destroy();
  return upgrade(req, socket, head);
});
server.on("error", error => {
  console.error("Falha ao abrir o Web V2:", error.code);
  process.exit(1);
});
server.listen(port, hostname, () => console.log("Sales Analyzer V2 integrada em " + origin));
