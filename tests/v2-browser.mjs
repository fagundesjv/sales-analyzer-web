// Local acceptance test. Only synthetic identities and the loopback Web BFF may be used.
import assert from "node:assert/strict";
import {readFile, mkdir} from "node:fs/promises";
import {chromium} from "playwright";

export const origin = new URL(process.env.SA_WEB_URL || "http://127.0.0.1:4319").origin;
assert.equal(new URL(origin).hostname, "127.0.0.1");
const accounts = JSON.parse(await readFile(process.env.SA_TEST_ACCOUNTS || "../sales-analyzer-backend/.local/accounts.json","utf8"));
const screenshots = process.env.SA_EVIDENCE_DIR;
if (screenshots) await mkdir(screenshots, {recursive:true});
export const browser = await chromium.launch({channel:process.env.SA_TEST_BROWSER === "bundled" ? undefined : "chrome",timeout:18000});
export const errors = [];
export async function createPage(role, width, hash) {
  const ctx = await browser.newContext({viewport:{width,height:width < 600 ? 844 : 900}});
  await ctx.route(/^https?:/, route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    errors.push("Requisição externa no Web integrado");
    return route.abort();
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(14000);
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(origin + "/#" + hash);
  await page.getByLabel("E-mail",{exact:true}).fill(accounts[role].email);
  await page.getByLabel("Senha",{exact:true}).fill(accounts[role].password);
  const login = page.waitForResponse(r => r.url().endsWith("/api/v2/auth/session") && r.request().method() === "POST");
  await page.getByRole("button",{name:"Entrar",exact:true}).click();
  const response = await login;
  assert.equal(response.status(),200, "Login da conta sintética " + role);
  const session = await response.json();
  assert.ok(!Object.hasOwn(session, "token"));
  assert.equal((await ctx.cookies()).find(c => c.name === "sa2_session")?.httpOnly,true);
  return {page,ctx,session};
}
export async function visible(locator) { await locator.first().waitFor({state:"visible"}); }
export async function widthFits(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert.ok(overflow <= 1, "Overflow " + overflow);
}
export async function shot(page, name) {
  await widthFits(page);
  if (screenshots) await page.screenshot({path:screenshots + "/" + name + ".png", animations:"disabled"});
}
