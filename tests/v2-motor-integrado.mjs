// Compiled Web + its real BFF against the isolated integrated API, worker and Postgres.
// WhatsApp and model providers are internal deterministic services in that environment.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile, readdir, mkdir, writeFile} from "node:fs/promises";
import {resolve, join, extname} from "node:path";
import {pathToFileURL} from "node:url";
import {parseEnv} from "node:util";
import {chromium} from "playwright";

const bundle = resolve(process.argv[2] || "");
assert.ok(process.argv[2], "Informe o pacote Web compilado.");
const state = process.env.SA_INTEGRADO_DIR;
assert.ok(state, "Informe o diretório privado do ambiente integrado isolado.");
const accounts = JSON.parse(await readFile(join(state, "contas.json"), "utf8"));
const manager = accounts.gestora;
assert.ok(manager?.email.endsWith(".test") && manager.senha, "O ensaio exige a conta sintética da gestora.");
const port = Number(process.env.SA_MOTOR_WEB_PORT || 4619);
assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535);
const externalOrigin = process.env.SA_MOTOR_EXTERNAL_ORIGIN;
const origin = externalOrigin || "http://127.0.0.1:" + port;
assert.equal(new URL(origin).hostname, "127.0.0.1", "Este ensaio aceita apenas Web local.");
assert.equal(new URL(origin).protocol, "http:");
assert.equal(new URL(origin).origin, origin, "Informe apenas a origem local, sem caminho.");
const revision = (await readFile(join(bundle, "REVISION"), "utf8")).trim();
assert.match(revision, /^sha256:[0-9a-f]{64}$/);

async function startLocalWeb() {
  const settings = parseEnv(await readFile(join(state, "bff.env"), "utf8"));
  const api = new URL(settings.SA_API_URL);
  assert.equal(api.hostname, "127.0.0.1", "Este ensaio aceita apenas API local.");
  assert.equal(api.protocol, "http:");
  const {createV2Bff} = await import(pathToFileURL(join(bundle, "server/v2-bff.mjs")));
  const bff = createV2Bff({apiOrigin:api.origin, webOrigin:origin, serviceKey:settings.SA_SERVICE_KEY});
  const site = join(bundle, "site"), assets = new Map();
  const mime = {".js":"text/javascript", ".css":"text/css", ".png":"image/png", ".svg":"image/svg+xml",
    ".woff2":"font/woff2", ".woff":"font/woff", ".ttf":"font/ttf", ".json":"application/json"};
  async function index(directory) {
    for (const entry of await readdir(join(site, directory), {withFileTypes:true})) {
      const relative = directory + "/" + entry.name;
      if (entry.isDirectory()) await index(relative);
      else if (mime[extname(entry.name)]) assets.set("/" + relative, join(site, relative));
    }
  }
  await index("_next/static");
  await index("assets");
  await index("zoe-avatar");
  const html = await readFile(join(site, "index.html"));
  assert.ok(html.includes('data-sales-mode="integrated"'));
  const server = createServer(async (req, res) => {
    if (req.headers.host !== new URL(origin).host) return res.writeHead(403).end();
    if (req.url.startsWith("/api/v2/")) return bff(req, res);
    if (req.method !== "GET") return res.writeHead(405).end();
    const pathname = new URL(req.url, origin).pathname;
    if (pathname === "/healthz") return res.writeHead(200, {"Content-Type":"application/json"}).end(JSON.stringify({status:"ok", revision}));
    if (pathname === "/") return res.writeHead(200, {"Content-Type":"text/html"}).end(html);
    const file = assets.get(pathname);
    if (!file) return res.writeHead(404).end();
    res.writeHead(200, {"Content-Type":mime[extname(file)]});
    res.end(await readFile(file));
  });
  await new Promise((ok, fail) => {server.once("error", fail); server.listen(port, "127.0.0.1", ok);});
  return server;
}

const server = externalOrigin ? null : await startLocalWeb();
let browser;
const shots = process.env.SA_EVIDENCE_DIR;
if (shots) await mkdir(shots, {recursive:true});
const results = [];
try {
  const response = await fetch(origin + "/healthz", {signal:AbortSignal.timeout(10000)});
  assert.equal(response.status, 200, "Runtime local deve estar saudável.");
  assert.deepEqual(await response.json(), {status:"ok", revision}, "A revisão do runtime deve corresponder ao pacote informado.");
  browser = await chromium.launch({channel:"chrome"});
  for (const width of [1440, 390]) {
    const context = await browser.newContext({viewport:{width, height:width < 600 ? 844 : 900}});
    const page = await context.newPage();
    page.setDefaultTimeout(16000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await context.route(/^https?:/, route => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      errors.push("Requisição fora da Web local");
      return route.abort();
    });
    try {
      await page.goto(origin + "/#entrada");
      await page.getByLabel("E-mail", {exact:true}).fill(manager.email);
      await page.getByLabel("Senha", {exact:true}).fill(manager.senha);
      const login = page.waitForResponse(response => response.url().endsWith("/api/v2/auth/session") && response.request().method() === "POST");
      await page.getByRole("button", {name:"Entrar", exact:true}).click();
      const sessionResponse = await login;
      assert.equal(sessionResponse.status(), 200, "Login pela Web contra identidade local real.");
      const session = await sessionResponse.json();
      assert.equal(session.workspace.role, "manager");
      assert.equal(Object.hasOwn(session, "token"), false);
      assert.equal((await context.cookies()).find(cookie => cookie.name === "sa2_session")?.httpOnly, true);
      const scope = session.user.id + "/" + session.workspace.id;
      const published = await page.evaluate(async context => {
        const reply = await fetch("/api/v2/conversations?limit=100", {headers:{"X-V2-Context":context}, cache:"no-store"});
        if (!reply.ok) return {status:reply.status};
        return {status:reply.status, data:await reply.json()};
      }, scope);
      assert.equal(published.status, 200);
      const eligible = published.data.items.filter(item => item.analysis?.reply?.state === "ready" && !item.pendingRevision);
      assert.ok(eligible.length, "Worker deve ter publicado ao menos uma sugestão pronta.");
      const chosen = eligible[0];
      await page.goto(origin + "/#entrada/todos/" + chosen.id);
      const suggestion = page.getByRole("region", {name:"Sugestão da Zoe", exact:true});
      await suggestion.getByText(chosen.analysis.reply.text, {exact:true}).waitFor();
      const source = suggestion.getByRole("link", {name:"Ver fonte 1", exact:true});
      await source.waitFor();
      await source.click();
      await page.getByRole("group", {name:"Trecho citado pela Zoe"}).waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      if (shots) {
        await page.screenshot({path:join(shots, "motor-integrado-fonte-" + width + ".png"), animations:"disabled"});
        await suggestion.evaluate(element => element.scrollIntoView({block:"center"}));
        await page.screenshot({path:join(shots, "motor-integrado-" + width + ".png"), animations:"disabled"});
      }
      await page.reload();
      await suggestion.getByText(chosen.analysis.reply.text, {exact:true}).waitFor();
      assert.deepEqual(errors, []);
      const result = {width, webRevision:revision, webRuntime:externalOrigin ? "packaged-private-web" : "local-bff-harness",
        api:"integrated-local", database:"postgres", providers:"internal-deterministic",
        realLogin:true, publishedSuggestion:true, sourceOpened:true, persistedAfterReload:true, conversationId:chosen.id};
      results.push(result);
      console.log(JSON.stringify(result));
    } finally {
      await context.close();
    }
  }
  if (shots) await writeFile(join(shots, "motor-integrado-resultados.json"), JSON.stringify(results, null, 2) + "\n");
} finally {
  await browser?.close();
  if (server) await new Promise(ok => server.close(ok));
}
