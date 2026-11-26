// Exact packaged Web + local API/worker/PostgreSQL. No response fixtures or business writes.
import assert from "node:assert/strict";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {resolve,join} from "node:path";
import {chromium} from "playwright";
import {commercialFilters,commercialSignals} from "../lib/commercial-views.js";
const bundle=resolve(process.argv[2]||"");assert.ok(process.argv[2],"Informe o pacote empacotado.");
const origin=process.env.SA_ENGINE_EXTERNAL_ORIGIN||process.env.SA_MOTOR_EXTERNAL_ORIGIN;assert.ok(origin);
const local=new URL(origin);assert.equal(local.hostname,"127.0.0.1");assert.equal(local.protocol,"http:");assert.equal(local.origin,origin);
const state=process.env.SA_INTEGRADO_DIR;assert.ok(state);
const account=JSON.parse(await readFile(join(state,"contas.json"),"utf8")).gestora;
assert.ok(account?.email?.endsWith(".test")&&(account.senha||account.password),"Somente a identidade sintética local.");
const revision=(await readFile(join(bundle,"REVISION"),"utf8")).trim(),health=await fetch(origin+"/healthz",{signal:AbortSignal.timeout(10000)});
assert.equal(health.status,200);assert.deepEqual(await health.json(),{status:"ok",revision});
const evidence=process.env.SA_EVIDENCE_DIR;if(evidence)await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({channel:"chrome"}),results=[];
const cents=value=>{const n=BigInt(value),r=n%100n;return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(n/100n)+(r?','+String(r).padStart(2,'0'):'');};
const normalized=value=>String(value).replaceAll('\u00a0',' ').replaceAll(/\s+/g,' ').trim();
async function scenario(width){
  const context=await browser.newContext({viewport:{width,height:width<600?844:1000},reducedMotion:"reduce"}),page=await context.newPage();page.setDefaultTimeout(30000);
  const errors=[],writes=[];page.on("pageerror",error=>errors.push(error.message));
  page.on("request",request=>{if(request.method()!=="GET"&&request.method()!=="HEAD"&&!request.url().endsWith('/api/v2/auth/session'))writes.push(request.method()+" "+new URL(request.url()).pathname);});
  await context.route(/^https?:/,route=>{if(new URL(route.request().url()).origin===origin)return route.continue();errors.push("request_outside_local_runtime");return route.abort();});
  let identity;
  const wait=(path,expected={})=>page.waitForResponse(response=>{const url=new URL(response.url());return url.pathname==="/api/v2/"+path&&response.request().method()==="GET"&&Object.entries(expected).every(([key,value])=>url.searchParams.get(key)===String(value));});
  const value=async response=>{assert.equal(response.status(),200,"Consulta real autorizada deve responder200.");return response.json();};
  const navigate=async(hash,path)=>{const read=wait(path,Object.fromEntries(new URLSearchParams(hash.split("?")[1]||"")));await page.goto(origin+"/#"+hash);return value(await read);};
  const read=async path=>{const result=await page.evaluate(async({path,identity})=>{const r=await fetch('/api/v2/'+path,{headers:{'X-V2-Context':identity},cache:'no-store'});return {status:r.status,data:await r.json()};},{path,identity});assert.equal(result.status,200);return result.data;};
  const tile=async(list,label,expected)=>{const row=page.getByRole('list',{name:list,exact:true}).locator('li').filter({has:page.getByText(label,{exact:true})});await row.waitFor();assert.equal(normalized(await row.locator(':scope > * > span').nth(1).innerText()),normalized(expected));};
  const shot=async name=>{if(evidence)await page.screenshot({path:join(evidence,`normal-${name}-${width}.png`),fullPage:true});};
  try{
    await page.goto(origin+"/#entrada");await page.getByLabel("E-mail",{exact:true}).fill(account.email);await page.getByLabel("Senha",{exact:true}).fill(account.senha||account.password);
    const login=page.waitForResponse(r=>r.url().endsWith('/api/v2/auth/session')&&r.request().method()==='POST');await page.getByRole('button',{name:'Entrar',exact:true}).click();
    const session=await value(await login);assert.equal(Object.hasOwn(session,'token'),false);assert.equal(session.capabilities?.commercialViews,true);
    assert.equal((await context.cookies()).find(c=>c.name==='sa2_session')?.httpOnly,true);identity=session.user.id+'/'+session.workspace.id;
    let inbox=await navigate('entrada?windowDays=90','commercial/inbox');
    for(const [index,filter] of commercialFilters.entries()){
      const combo=page.getByRole('combobox',{name:'Recorte das conversas',exact:true});await combo.click();
      const options=page.getByRole('option');await options.first().waitFor();assert.equal(await options.count(),22);
      for(const item of commercialFilters)await page.getByRole('option',{name:`${item.name} (${inbox.counts[item.id]})`,exact:true}).waitFor();
      const pending=index?wait('commercial/inbox',{filter:filter.id,windowDays:90}):null;await page.getByRole('option',{name:`${filter.name} (${inbox.counts[filter.id]})`,exact:true}).click();
      if(pending)inbox=await value(await pending);assert.equal(inbox.scope.windowDays,90);assert.ok(Number.isInteger(inbox.counts[filter.id]));
    }
    const connections=await read('connections?limit=100');assert.ok(connections.items.length,'O exemplo normal deve conter uma linha autorizada.');const line=connections.items[0];
    await page.getByRole('button',{name:'Período, linhas e responsáveis',exact:true}).click();
    const advanced=page.getByRole('dialog',{name:'Escopo das conversas',exact:true});await advanced.getByRole('combobox',{name:'Período do relatório',exact:true}).click();await page.getByRole('option',{name:'Último dia',exact:true}).click();
    await advanced.getByRole('combobox',{name:'Linha de atendimento',exact:true}).click();const scoped=wait('commercial/inbox',{connectionId:line.id,windowDays:1});await page.getByRole('option',{name:line.name,exact:true}).click();const scopedInbox=await value(await scoped);assert.equal(scopedInbox.scope.connectionId,line.id);assert.equal(scopedInbox.scope.windowDays,1);
    await advanced.getByRole('button',{name:'Ver conversas',exact:true}).click();await shot('inbox');
    const sales=await navigate('resultados?windowDays=90','commercial/sales');assert.ok(sales.summary.sales>=1,'O exemplo normal precisa de pelo menos um pedido confirmado.');
    await tile('Ganhos de todo o período autorizado','Vendas confirmadas',sales.summary.sales);await tile('Ganhos de todo o período autorizado','Valor conhecido',cents(sales.summary.amountCents));await tile('Ganhos de todo o período autorizado','Vendas sem valor informado',sales.summary.salesWithoutAmount);
    assert.equal(new Set(sales.items.map(item=>item.opportunityId)).size,sales.items.length);
    for(const sale of sales.items){const link=page.locator(`a[href*="/pedido/${sale.opportunityId}"]`);await link.waitFor();assert.equal(await link.count(),1);const row=link.locator('xpath=ancestor::tr');assert.ok(normalized(await row.innerText()).includes(sale.amountCents===null?'Valor não informado':normalized(cents(sale.amountCents))));}
    const repeated=sales.items.some((item,index)=>sales.items.slice(0,index).some(other=>other.conversationId===item.conversationId));await shot('sales');
    const order=sales.items[0];assert.ok(order);await page.locator(`a[href*="/pedido/${order.opportunityId}"]`).click();const selected=page.getByRole('region',{name:'Pedido selecionado',exact:true});await selected.waitFor();assert.ok(page.url().includes(order.conversationId)&&page.url().includes(order.opportunityId));
    const actualOrder=await read('opportunities/'+order.opportunityId);assert.equal(actualOrder.conversationId,order.conversationId);await selected.getByText(actualOrder.title,{exact:true}).first().waitFor();
    const report=await navigate('raio-x?windowDays=90','commercial/report'),article=page.getByRole('article',{name:'Raio-X comercial autorizado',exact:true});await article.waitFor();await article.getByText(`${report.priority.items.length} ${report.priority.items.length===1?"exibida":"exibidas"} de ${report.priority.total} no conjunto autorizado`,{exact:true}).waitFor();
    for(const metric of report.metrics){const expected=metric.value==null?'Sem medição':metric.unit==='cents'?cents(metric.value):metric.unit==='minutes'?metric.value+' min':metric.value;await tile('Indicadores comerciais do período',metric.label,expected);}
    assert.deepEqual(report.signals.map(s=>s.signal).sort(),commercialSignals.map(s=>s.id).sort());
    for(const signal of report.signals){const row=article.getByRole('row').filter({has:page.getByRole('link',{name:signal.label,exact:true})});await row.waitFor();const cells=await row.getByRole('cell').allTextContents();assert.equal(normalized(cells[1]),String(signal.count));assert.equal(normalized(cells[2]),String(signal.base));}
    const signal=report.signals[0],drilldown=wait('commercial/inbox',{signal:signal.signal,windowDays:90});await article.getByRole('link',{name:signal.label,exact:true}).click();const drilled=await value(await drilldown);assert.equal(new URL(page.url()).hash.includes('signal='+signal.signal),true);assert.equal(drilled.scope.windowDays,90);
    const printSnapshot=await navigate('raio-x?windowDays=90','commercial/report');await page.getByRole('button',{name:'Imprimir ou salvar PDF',exact:true}).waitFor();await shot('report');
    let pdf=false;if(width===1440){
      await page.evaluate(()=>window.addEventListener('beforeprint',()=>{const root=document.querySelector('[data-commercial-print-root]');window.__commercialPdfProof={armed:document.body.dataset.commercialPrint==='1',text:root.textContent,metrics:Array.from(root.querySelectorAll('[aria-label="Indicadores comerciais do período"] li'),row=>Array.from(row.querySelectorAll(':scope > * > span'),span=>span.textContent))};},{once:true}));
      const bytes=await page.pdf({...(evidence?{path:join(evidence,'normal-report.pdf')}:{ }),format:'A4',preferCSSPageSize:true,printBackground:true});assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert.ok(bytes.length>10000);assert.ok(bytes.toString('latin1').includes('%%EOF'));
      const proof=await page.evaluate(()=>window.__commercialPdfProof);assert.equal(proof.armed,true);for(const [index,item] of printSnapshot.metrics.entries()){const expected=item.value==null?'Sem medição':item.unit==='cents'?cents(item.value):item.unit==='minutes'?item.value+' min':String(item.value);assert.equal(proof.metrics[index][0],item.label);assert.equal(normalized(proof.metrics[index][1]),normalized(expected));}for(const item of printSnapshot.signals)assert.ok(proof.text.includes(item.label));assert.ok(proof.text.includes('Atividade e vendas registradas'));assert.equal(await page.evaluate(()=>document.body.hasAttribute('data-commercial-print')),false);await page.emulateMedia({media:'screen'});pdf=true;
    }
    await page.clock.install();const tvRead=wait('commercial/report');await page.getByRole('link',{name:'Abrir TV',exact:true}).click();await value(await tvRead);const tv=page.getByRole('region',{name:'TV da operação',exact:true});await tv.waitFor();assert.equal(await tv.getByRole('region',{name:'Prioridades para atendimento',exact:true}).count(),0);
    const refresh=wait('commercial/report');await page.clock.fastForward(31000);await value(await refresh);await shot('tv');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);return {width,revision,packagedRuntime:true,realLocalIdentity:true,officialFilters:22,authorizedLineScope:true,salesComparedWithLedger:true,sameCustomerRepeatVisible:repeated,unknownSales:sales.summary.salesWithoutAmount,reportComparedWithAuthorizedFacts:true,signalDrilldown:true,tvActualReadRefresh:true,pdf,noBusinessWrites:true};
  }catch(error){await shot('failure');throw error;}finally{await context.close();}
}
try{for(const width of [1440,390]){const result=await scenario(width);results.push(result);console.log(JSON.stringify(result));}if(evidence)await writeFile(join(evidence,'normal-commercial-results.json'),JSON.stringify(results,null,2)+'\n');}finally{await browser.close();}
