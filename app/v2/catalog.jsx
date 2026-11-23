"use client";
import {useEffect, useState} from "react";
import {Button, Input, SearchField} from "@content-ventures/design-system/v3";
import {ChevronLeft, Package, Plus, SearchX, SlidersHorizontal} from "lucide-react";
import {CatalogItems, CatalogViewSwitch} from "../catalog-browser";
import {reaisFromCents, ReaisField} from "../operation-fields";
import {DetailPage, DetailRows} from "../../src/ui/os/detail";
import {Pills} from "../../src/ui/os/pills";
import {ResponsiveDialog} from "../../src/ui/os/responsive-dialog";
import {EmptyState} from "../../src/ui/os/empty-state";
import {parseMoney} from "../../lib/operation";
import {useV2Action, useV2Page} from "../../lib/v2-client";
import {CursorNav, ReadState} from "./read-state";
import s from "../directory.module.css";
import css from "./catalog.module.css";

const itemsPath = "catalog/items";
const kinds = [{value:"product", label:"Produtos"}, {value:"service", label:"Serviços"}];
const availability = {
  available:"Disponível", on_request:"Sob consulta", unavailable:"Indisponível", archived:"Arquivado",
};
const priceOptions = {allowZero:true, maxCents:Number.MAX_SAFE_INTEGER};
const noun = kind => kind === "service" ? "serviço" : "produto";
const price = item => item.priceCents === null ? "Preço a definir" :
  "R$ " + reaisFromCents(item.priceCents) + (item.billingUnit ? " / " + item.billingUnit : "");

function CatalogEditor({item, kind, manager, context, close, saved, reload}) {
  const action = useV2Action(context);
  const [form,setForm] = useState(() => ({
    kind:item?.kind || kind, name:item?.name || "", sku:item?.sku || "", category:item?.category || "",
    billingUnit:item?.billingUnit || "", aliases:item?.aliases.join("\n") || "",
    amount:item?.priceCents != null ? reaisFromCents(item.priceCents) : "", availability:item?.availability || "on_request",
  }));
  const change = (key,value) => setForm(old => ({...old,[key]:value}));
  const title = noun(form.kind);
  const aliases = form.aliases.split("\n").map(value => value.trim()).filter(Boolean);
  const invalidAliases = aliases.length > 16 || aliases.some(a => a.length > 80);
  const cents = form.amount.trim() ? parseMoney(form.amount,priceOptions) : null;
  const fields = {kind:form.kind, name:form.name.trim(), sku:form.sku.trim() || null, category:form.category.trim() || null,
    aliases, priceCents:cents, billingUnit:form.billingUnit.trim() || null, availability:form.availability};
  const edits = item ? Object.fromEntries(Object.entries(fields).filter(([key,value]) =>
    key === "aliases" ? JSON.stringify(value) !== JSON.stringify(item.aliases) : value !== item[key])) : fields;
  const conflict = ["catalog_version_conflict","not_found"].includes(action.errorCode);
  const valid = fields.name && !invalidAliases && (!form.amount.trim() || cents !== null) && Object.keys(edits).length > 0;
  const archiving = item && fields.availability === "archived" && item.availability !== "archived";
  const submitLabel = archiving ? "Arquivar " + title : item ? "Salvar alterações" : "Adicionar " + title;

  function submit(event) {
    event.preventDefault();
    if (!manager || !valid || conflict || action.pending) return;
    action.run(item ? itemsPath + "/" + item.id : itemsPath, item ? "PATCH" : "POST",
      item ? {...edits,version:item.version} : fields, result => saved(result,archiving));
  }
  if (!manager) return <ResponsiveDialog open size="sm" onClose={close} title={item.name}
    description={kind === "service" ? "Serviço" : "Produto"}>
    <DetailRows items={[
      {label:"Disponibilidade",value:availability[item.availability]}, {label:"Preço",value:price(item)},
      {label:"SKU",value:item.sku || "Sem código"}, {label:"Categoria",value:item.category || "Sem categoria"},
      {label:"Unidade de cobrança",value:item.billingUnit || "A definir"},
      {label:"Outros nomes",value:item.aliases.join(" · ") || "Nenhum"},
    ]} />
  </ResponsiveDialog>;
  return <ResponsiveDialog open size="md" title={(item ? "Editar " : "Adicionar ") + title} onClose={close}
    footer={<Button type="submit" form="v2-catalog-item" variant="primary" disabled={!valid || conflict || action.pending}>
      {action.pending ? "Salvando…" : submitLabel}</Button>}>
    <form className={css.fields} id="v2-catalog-item" onSubmit={submit}>
      <label className={css.full}>Nome<Input required maxLength={160} value={form.name} onChange={e => change("name",e.target.value)} /></label>
      <label>Tipo<select aria-label="Tipo" value={form.kind} onChange={e => change("kind",e.target.value)}>
        <option value="product">Produto</option><option value="service">Serviço</option></select></label>
      <label>Disponibilidade<select aria-label="Disponibilidade" value={form.availability} onChange={e => change("availability",e.target.value)}>
        {Object.entries(availability).filter(([value]) => item || value !== "archived").map(([value,label]) =>
          <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Código (SKU)<Input maxLength={64} value={form.sku} onChange={e => change("sku",e.target.value)} /></label>
      <label>Categoria<Input maxLength={80} value={form.category} onChange={e => change("category",e.target.value)} /></label>
      <label>Preço<ReaisField aria-label="Preço" {...priceOptions} value={form.amount} onValueChange={v => change("amount",v)} /></label>
      <label>Unidade de cobrança<Input maxLength={40} placeholder={form.kind === "service" ? "Ex. hora" : "Ex. unidade"}
        value={form.billingUnit} onChange={e => change("billingUnit",e.target.value)} /></label>
      <label className={css.full}>Outros nomes<textarea rows={2} value={form.aliases} placeholder="Um nome por linha"
        aria-invalid={invalidAliases} onChange={e => change("aliases",e.target.value)} /></label>
      {invalidAliases && <p className={css.full} role="alert">Use até 16 nomes de até 80 caracteres cada.</p>}
      {archiving && <p className={css.full}>Após salvar, você encontra este item no filtro Arquivados.</p>}
      {action.error && <div className={css.full} role="alert"><p>{conflict ?
        "Este item mudou desde que você o abriu. Reabra o cadastro atualizado antes de salvar." : action.error}</p>
        {conflict && <Button type="button" variant="secondary" onClick={reload}>Atualizar catálogo</Button>}</div>}
    </form>
  </ResponsiveDialog>;
}

function CatalogPage({path, context, kind, manager, view, open, filtered, clear, onInventory}) {
  const page = useV2Page(path,context);
  useEffect(() => {
    if (page.data) onInventory(filtered || !!page.previous || page.data.items.length > 0);
  },[page.data,filtered,page.previous,onInventory]);
  return <>
    <ReadState read={page}>{({items}) => <div className={s.inventoryScroll} data-view={view}
      aria-label="Resultados do catálogo" role="region" tabIndex={0}>
      {items.length ? <CatalogItems service={kind === "service"} view={view} price={price}
        rows={items.map((item,index) => ({item:{...item,stock:availability[item.availability]},index}))}
        onOpen={index => open(items[index])} actionLabel={manager ? "Editar" : "Ver"} /> :
        <EmptyState size="section" icon={filtered ? SearchX : Package} preview={filtered || page.previous ? undefined : kind === "service" ? "services" : "catalog"}
          title={filtered ? "Nenhum item encontrado" : page.previous ? "Esta página está vazia" :
            kind === "service" ? "Os serviços da equipe começam aqui" : "Seu catálogo começa aqui"}
          description={filtered ? "Tente outro nome ou disponibilidade para encontrar o que procura." :
            page.previous ? "Volte para conferir os itens da página anterior." :
            manager ? "Cadastre o primeiro " + noun(kind) + " para a equipe consultar durante o atendimento." :
            "O gestor ainda não cadastrou " + (kind === "service" ? "serviços" : "produtos") + " para esta empresa."}
          action={filtered ? <Button size="sm" variant="secondary" onClick={clear}>Limpar filtros</Button> :
            page.previous ? <Button size="sm" variant="secondary" icon={ChevronLeft} onClick={page.previous}>Página anterior</Button> :
            manager ? <Button size="sm" variant="primary" icon={Plus} onClick={() => open(null)}>
              Adicionar {noun(kind)}</Button> : null} />}
    </div>}</ReadState>
    <CursorNav label="Páginas do catálogo" page={page} className={s.pager} />
  </>;
}

export function ConnectedCatalog({context,session}) {
  const manager = session.workspace.role === "manager";
  const [kind,setKind] = useState("product");
  const [status,setStatus] = useState("");
  const [text,setText] = useState("");
  const [q,setQ] = useState("");
  const [view,setView] = useState("table");
  const [filtersOpen,setFiltersOpen] = useState(false);
  const [editor,setEditor] = useState(null);
  const [revision,setRevision] = useState(0);
  const [catalogHasItems,setCatalogHasItems] = useState(true);
  const [notice,setNotice] = useState("");
  const term = text.trim();
  useEffect(() => {
    if (term === q) return;
    const timer = setTimeout(() => setQ(term),term ? 180 : 0);
    return () => clearTimeout(timer);
  },[term,q]);
  const params = new URLSearchParams({kind});
  if (status) params.set("status",status);
  if (q) params.set("q",q);
  const path = itemsPath + "?" + params;
  function clear() {setText("");setQ("");setStatus("");setNotice("");}
  function reload() {setRevision(old => old + 1);setEditor(null);}
  return <div data-stable-phone-tabs><DetailPage title="Produtos e serviços" icon={Package} description={session.workspace.name}>
    <section className={s.directory} aria-label="Catálogo"><div className={s.head}>
      <Pills label="Tipo de item" items={kinds} value={kind} onChange={value => {setKind(value);clear();}} />
      {manager && catalogHasItems && <Button icon={Plus} variant="primary" aria-label={"Adicionar " + noun(kind)}
        onClick={() => {setEditor({item:null});setNotice("");}}>Adicionar<span className={s.addNoun}>{" " + noun(kind)}</span></Button>}
    </div>
    <div className={s.catalogTools} data-open={filtersOpen}>
      <SearchField label="Buscar no catálogo" placeholder="Buscar item…" value={text} maxLength={80} enterKeyHint="search"
        onValueChange={value => {setText(value);setNotice("");}} />
      <button type="button" className={s.filterToggle} aria-expanded={filtersOpen} aria-controls="v2-catalog-filter"
        onClick={() => setFiltersOpen(old => !old)}><SlidersHorizontal size={15} />Filtros{status && " · 1"}</button>
      <div className={s.filterFields} id="v2-catalog-filter">
        <select aria-label="Filtrar disponibilidade" value={status} onChange={e => {setStatus(e.target.value);setNotice("");}}>
          <option value="">Todos os ativos</option>
          {Object.entries(availability).map(([value,label]) => <option value={value} key={value}>{value === "archived" ? "Arquivados" : label}</option>)}
        </select>
      </div>
      <CatalogViewSwitch view={view} onChange={setView} />
    </div>
    {notice && <p role="status" className={css.notice}>{notice}</p>}
    {term !== q ? <p role="status">Buscando itens…</p> : <CatalogPage key={revision + path} path={path} context={context}
      kind={kind} manager={manager} view={view} open={item => {setEditor({item});setNotice("");}}
      filtered={!!(q || status)} clear={clear} onInventory={setCatalogHasItems} />}
    </section>
    {editor && <CatalogEditor item={editor.item} kind={kind} manager={manager} context={context}
      close={() => setEditor(null)} saved={(result,archived) => {
        setNotice(result.name + (archived ? " foi arquivado." : editor.item ? " foi atualizado." : " foi adicionado."));
        reload();
      }} reload={reload} />}
  </DetailPage></div>;
}
