import assert from "node:assert/strict";
import {randomBytes, randomUUID} from "node:crypto";
import {execFileSync} from "node:child_process";
import {readFile, rename, writeFile} from "node:fs/promises";
import {setTimeout as wait} from "node:timers/promises";
import {chromium} from "playwright";

// Dedicated local stage. This test changes two synthetic passwords and records the new fixtures privately.
const origin = "http://127.0.0.1:4396";
const project = "sa-v2-stage-recoveryqa";
const accountsPath = process.env.SA_TEST_ACCOUNTS;
assert(accountsPath?.endsWith("/qa-recovery-stage/accounts.json"));
const accounts = JSON.parse(await readFile(accountsPath, "utf8"));
assert(Object.values(accounts).every(a => a.email.endsWith("@v2.example.test")));
const api = project + "-api-1";
assert.equal(execFileSync("docker", ["inspect", "-f", '{{index .Config.Labels "com.docker.compose.project"}}', api], {encoding:"utf8"}).trim(), project);
const post = (path, body, override = {}) => fetch(`${origin}/api/v2/${path}`, {
  method: "POST", headers: {Origin:origin, "Content-Type":"application/json", ...override},
  body: JSON.stringify(body), signal: AbortSignal.timeout(22000),
});
const check = (cookie) => fetch(`${origin}/api/v2/session`, {headers:{cookie}, signal:AbortSignal.timeout(12000)});
async function login(account) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await post("auth/session", {email:account.email, password:account.password});
    if (response.status !== 503 || attempt === 2) return response;
    await response.body?.cancel();
    await wait(800);
  }
}
function codeFromMail(email, requestedAt) {
  const script = `const email = process.argv[1]; const base = "http://mailpit:8025/api/v1/";
    const list = (await (await fetch(base + "messages")).json()).messages;
    const item = list.find(m => m.Subject === "Código de recuperação do Sales Analyzer V2" &&
      Date.parse(m.Created) >= Number(process.argv[2]) && m.To.some(a => a.Address === email));
    if (item) {
      const message = await (await fetch(base + "message/" + item.ID)).json();
      process.stdout.write(message.HTML.match(/id="recovery-code">([0-9]{6})</)?.[1] ?? "");
    }`;
  return execFileSync("docker", ["exec", api, "node", "--input-type=module", "-e", script, email, String(requestedAt - 2500)],
    {encoding:"utf8", timeout:20000});
}
async function replaceFixture(role, password) {
  accounts[role].password = password;
  const next = accountsPath + "." + randomUUID();
  await writeFile(next, JSON.stringify(accounts, null, 2) + "\n", {mode:0o600, flag:"wx"});
  await rename(next, accountsPath);
}
async function clickWithResponse(page, button, endpoint) {
  const result = page.waitForResponse(response => new URL(response.url()).pathname === "/api/v2/" + endpoint && response.request().method() === "POST", {timeout:26000});
  await page.getByRole("button", {name:button, exact:true}).click();
  return result;
}

const guardian = await login(accounts.manager);
assert.equal(guardian.status, 200);
const guardianCookie = guardian.headers.get("set-cookie").split(";")[0];
await guardian.body?.cancel();
const unknown = await post("auth/recovery", {email:randomUUID() + "@v2.example.test"});
assert.equal(unknown.status, 202);
const accepted = await unknown.json();
assert.deepEqual(accepted, {status:"accepted"});
assert.equal((await post("auth/recovery", {email:accounts.manager.email}, {Origin:"http://other.example.test"})).status, 403);
const evidence = [];
const browser = await chromium.launch();
try {
  for (const [role,width] of [["seller",1440],["secondManager",390]]) {
    const {email,password} = accounts[role];
    const before = await login({email,password});
    assert.equal(before.status, 200);
    const oldCookie = before.headers.get("set-cookie").split(";")[0];
    await before.body?.cancel();
    const ctx = await browser.newContext({viewport:{width,height:width === 390 ? 844 : 900}});
    const external = [];
    await ctx.route(/^https?:/, route => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      external.push(new URL(route.request().url()).origin);
      return route.abort();
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(20000);
    try {
      await page.goto(origin + "/#dashboard");
      await page.getByRole("link", {name:"Esqueci minha senha"}).click();
      await page.getByRole("heading", {name:"Recuperar senha"}).waitFor();
      await page.getByLabel("E-mail", {exact:true}).fill(email);
      const requestedAt = Date.now();
      const requested = await clickWithResponse(page, "Solicitar código", "auth/recovery");
      assert.equal(requested.status(), 202);
      assert.deepEqual(await requested.json(), accepted);
      const screen = page.getByLabel("Código do e-mail", {exact:true});
      await screen.waitFor();
      let code;
      for (let attempt = 0; attempt < 10 && !code; attempt++) {
        code = codeFromMail(email, requestedAt);
        if (!code) await wait(500);
      }
      assert.match(code, /^[0-9]{6}$/);
      const replacement = randomBytes(24).toString("hex");
      await screen.fill(code === "000000" ? "000001" : "000000");
      await page.getByLabel("Nova senha", {exact:true}).fill(replacement);
      await page.getByLabel("Confirmar nova senha", {exact:true}).fill(replacement);
      const bad = await clickWithResponse(page, "Atualizar senha", "auth/recovery/confirm");
      assert.equal(bad.status(), 400);
      assert.equal((await bad.json()).error.code, "recovery_invalid_code");
      assert.equal((await check(oldCookie)).status, 200);
      await screen.fill(code);
      const updated = await clickWithResponse(page, "Atualizar senha", "auth/recovery/confirm");
      assert.equal(updated.status(), 204);
      await replaceFixture(role, replacement);
      assert.equal((await ctx.cookies()).some(cookie => cookie.name === "sa2_session"), false);
      await page.getByRole("heading", {name:"Senha atualizada"}).waitFor();
      assert.equal((await check(oldCookie)).status, 401);
      assert.equal((await check(guardianCookie)).status, 200);
      assert.equal((await login({email,password})).status, 401);
      const replay = await post("auth/recovery/confirm", {email,code,password:replacement});
      assert.equal(replay.status, 400);
      assert.equal((await replay.json()).error.code, "recovery_invalid_code");
      assert.equal(new URL(page.url()).hash, "#recuperar");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth <= 1));
      await page.getByRole("link", {name:"Voltar ao login"}).click();
      await page.getByLabel("E-mail", {exact:true}).fill(email);
      await page.getByLabel("Senha", {exact:true}).fill(replacement);
      let signedIn;
      let signInAttempts = 0;
      do {
        if (signInAttempts) await wait(800);
        signInAttempts++;
        signedIn = await clickWithResponse(page, "Entrar", "auth/session");
      } while (signedIn.status() === 503 && signInAttempts < 3);
      assert.equal(signedIn.status(), 200);
      assert.equal(Object.hasOwn(await signedIn.json(), "token"), false);
      await page.getByRole("heading", {name:"Panorama comercial", exact:true}).waitFor();
      assert.deepEqual(external, []);
      evidence.push({width,mailpit:true,invalidCodeRejected:true,previousSessionRevoked:true,
        otherAccountUnaffected:true,oldPasswordRejected:true,replayRejected:true,newPasswordSignsIn:true,signInAttempts});
      console.error(`Recuperação verificada em ${width}px com ${signInAttempts} tentativa(s) de login.`);
    } finally {
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(evidence,null,2));
