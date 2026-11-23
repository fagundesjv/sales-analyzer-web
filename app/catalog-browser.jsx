"use client";
import { useRef, useState } from "react";
import {
  Button,
  DataTable,
  SearchField,
} from "@content-ventures/design-system/v3";
import {
  Armchair,
  BriefcaseBusiness,
  Lamp,
  LayoutGrid,
  Package,
  Plus,
  SlidersHorizontal,
  Shapes,
  Archive,
  Table2,
  TableProperties,
} from "lucide-react";
import { Pills } from "../src/ui/os/pills";
import { billingUnit, catalogKind, matchesCatalogSearch } from "../lib/catalog";
import { foldText } from "../lib/conversation-queue";
import { money } from "../lib/operation";
import { ProductVisual } from "./product-visual";
import { DirectoryPager, Status, useDirectoryPage } from "./directory";
import s from "./directory.module.css";

const categories = {
  Estofados: [Armchair, "#af927b"],
  Assentos: [Armchair, "#baa46b"],
  Mesas: [Table2, "#959d71"],
  Organização: [Archive, "#9c8cbb"],
  Iluminação: [Lamp, "#c49e60"],
  Decoração: [Shapes, "#849db1"],
};
const availabilityTone = (stock) =>
  stock === "Disponível"
    ? "good"
    : /Esgotado|Indisponível/.test(stock)
      ? "bad"
      : "warn";

function ItemIcon({ item, service }) {
  const [Icon, tint] = Object.hasOwn(categories,item.category) ? categories[item.category] : [service ? BriefcaseBusiness : Package, "#91a67d"];
  return <span className={s.tileIcon} style={{ "--tint": tint }} aria-hidden="true">
    {item.scene ? <ProductVisual contact={{ id: item.scene }} /> : <Icon size={17} />}
  </span>;
}

export function CatalogViewSwitch({view, onChange}) {
  return (
    <div
      className={s.viewSwitch}
      role="group"
      aria-label="Visualização do catálogo"
    >
      {[
        [LayoutGrid, "grid", "Grade"],
        [TableProperties, "table", "Tabela"],
      ].map(([Icon, key, label]) => (
        <button
          key={key}
          aria-label={label}
          title={label}
          aria-pressed={view === key}
          onClick={() => onChange(key)}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  );
}

export function CatalogItems({rows, service, view, onOpen, price, mentions, demand, showDemand = false, actionLabel = "Editar"}) {
  return view === "grid" ? (
    <div className={s.grid}>
      {rows.map(({ item, index }) => {
        const [Glyph, tint] = Object.hasOwn(categories,item.category) ? categories[item.category] : [
          service ? BriefcaseBusiness : Package,
          service ? "#a18eba" : "#91a67d",
        ];
        const linked =
          demand?.get(item.name.trim().toLocaleLowerCase("pt-BR")) || [];
        const photo =
          item.scene ||
          linked.find((c) =>
            ["clara", "marina", "rafael", "bia"].includes(c.id),
          )?.id;
        return (
          <button
            key={item.id || index}
            className={s.itemCard}
            onClick={() => onOpen(index)}
          >
            <span className={s.cardTop}>
              <span
                className={s.tileIcon}
                data-photo={!!photo}
                style={{ "--tint": tint }}
              >
                {photo ? (
                  <ProductVisual contact={{ id: photo }} />
                ) : (
                  <Glyph size={20} aria-hidden="true" />
                )}
              </span>
              <small className={s.sub}>{item.sku}</small>
            </span>
            <span>
              <strong>{item.name}</strong>
              {item.category && (
                <small className={s.sub}>{item.category}</small>
              )}
            </span>
            <span className={s.cardFoot}>
              <b>{price(item)}</b>
              <Status tone={availabilityTone(item.stock)}>
                {item.stock}
              </Status>
              {showDemand && linked.length > 0 && (
                <small className={s.sub}>
                  {linked.length}{" "}
                  {linked.length === 1 ? "conversa" : "conversas"}
                </small>
              )}
            </span>
          </button>
        );
      })}
    </div>
  ) : (
    <DataTable
      label="Itens do catálogo"
      stack={false}
      rows={rows}
      density="compact"
      onRowClick={({ index }) => onOpen(index)}
      rowLabel={({ item }) => actionLabel + " " + item.name}
      rowKey={({ item, index }) => String(item.id ?? index)}
      columns={[
        {
          key: "item",
          header: service ? "Serviço" : "Produto",
          pinned: true,
          render: ({ item, index }) => (
            <div className={s.identity}>
              <ItemIcon item={item} service={service} />
              <span>
                <button tabIndex={-1} className={s.name} onClick={() => onOpen(index)}>{item.name}</button>
                <small className={s.sub}>{[item.sku, item.category].filter(Boolean).join(" · ")}</small>
              </span>
            </div>
          ),
        },
        {
          key: "price",
          header: "Preço",
          numeric: true,
          render: ({ item }) => <div className={s.price}><b>{price(item)}</b><span><Status tone={availabilityTone(item.stock)}>{item.stock}</Status></span></div>,
        },
        ...(mentions ? [{
          key: "demand",
          header: "Procura",
          numeric: true,
          render: ({ item }) => mentions(item),
        }] : []),
        {
          key: "stock",
          header: "Disponibilidade",
          render: ({ item }) => (
            <Status tone={availabilityTone(item.stock)}>
              {item.stock}
            </Status>
          ),
        },
      ]}
    />
  );
}

export function CatalogBrowser({ data, demand, kind, onKind, onEdit }) {
  const resultsRef = useRef(null);
  const [query, setQuery] = useState(""),
    [stock, setStock] = useState(""),
    [category, setCategory] = useState("");
  const [sort, setSort] = useState("demand"),
    [view, setView] = useState("table");
  const [filterOpen, setFilterOpen] = useState(false);
  const service = kind === "service",
    noun = service ? "serviços" : "produtos";
  const typed = data
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => catalogKind(item) === kind);
  const groups = [
    ...new Set(typed.map(({ item }) => item.category).filter(Boolean)),
  ].sort();
  const mentions = (item) =>
    demand.get(item.name.trim().toLocaleLowerCase("pt-BR"))?.length || 0;
  const term = foldText(query.trim());
  const rows = typed
    .filter(
      ({ item }) =>
        (!stock || item.stock === stock) &&
        (!category || item.category === category) &&
        matchesCatalogSearch(item, term),
    )
    .sort(
      (a, b) =>
        (sort === "price"
          ? (a.item.price ?? Infinity) - (b.item.price ?? Infinity)
          : sort === "demand"
            ? mentions(b.item) - mentions(a.item)
            : 0) ||
        a.item.name.localeCompare(b.item.name, "pt-BR", { numeric: true }),
    );
  const list = useDirectoryPage(rows, [30, 60, 120]);
  const price = (item) =>
    item.price == null
      ? "Preço a definir"
      : money(item.price) + (service ? " / " + billingUnit(item) : "");
  return (
    <section className={s.directory} aria-label="Catálogo">
      <div className={s.head}>
        <Pills
          label="Tipo de item"
          value={kind}
          onChange={(v) => {
            onKind(v);
            setStock("");
            setQuery("");
            setCategory("");
            list.reset();
          }}
          items={["product", "service"].map((v) => ({
            value: v,
            label: v === "product" ? "Produtos" : "Serviços",
            count: data.filter((x) => catalogKind(x) === v).length,
          }))}
        />
        <Button icon={Plus} variant="primary" aria-label={service ? "Adicionar serviço" : "Adicionar produto"} onClick={() => onEdit(-1)}>
          <span>Adicionar<span className={s.addNoun}>{service ? " serviço" : " produto"}</span></span>
        </Button>
      </div>
      <div className={s.catalogTools} data-open={filterOpen}>
        <SearchField
          label={service ? "Buscar serviço" : "Buscar produto"}
          placeholder="Nome ou código"
          value={query}
          enterKeyHint="search"
          onValueChange={(v) => {
            setQuery(v);
            list.reset();
          }}
        />
        <button
          className={s.filterToggle}
          aria-expanded={filterOpen}
          aria-controls="catalog-options"
          onClick={() => setFilterOpen((v) => !v)}
        >
          <SlidersHorizontal size={15} />
          Filtros
          {(category || stock) &&
            " · " + [category, stock].filter(Boolean).length}
        </button>
        <div id="catalog-options" className={s.filterFields}>
          {groups.length > 0 && (
            <select
              aria-label="Categoria do catálogo"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                list.reset();
              }}
            >
              <option value="">Categorias</option>
              {groups.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          )}
          <select
            aria-label="Filtrar disponibilidade"
            value={stock}
            onChange={(e) => {
              setStock(e.target.value);
              list.reset();
            }}
          >
            <option value="">Disponibilidade</option>
            {[
              ...new Set(typed.map(({ item }) => item.stock).filter(Boolean)),
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <select
            aria-label="Ordenar catálogo"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              list.reset();
            }}
          >
            <option value="name">Nome · A–Z</option>
            <option value="price">Menor preço</option>
            <option value="demand">Maior procura</option>
          </select>
        </div>
        <CatalogViewSwitch view={view} onChange={setView} />
      </div>
      <div key={[list.page, list.size, kind, stock, category, sort, view, query].join("|")} ref={resultsRef} className={s.inventoryScroll} data-view={view} aria-label="Resultados do catálogo" role="region" tabIndex={0}>
      {rows.length > 0 && <CatalogItems rows={list.rows} service={service} view={view} onOpen={onEdit}
        price={price} mentions={mentions} demand={demand} showDemand={sort === "demand"} />}
      {!rows.length && (
        <div className={s.empty} role="status">
          {query || stock || category ? <>
            <p>Nenhum item corresponde à busca.</p>
            <Button size="sm" variant="secondary" onClick={() => {
              setQuery(""); setStock(""); setCategory(""); list.reset();
            }}>Limpar filtros</Button>
          </> : service ? "Nenhum serviço cadastrado." : "Nenhum produto cadastrado."}
        </div>
      )}
      </div>
      <DirectoryPager list={list} noun={noun} onNavigate={() => {
        requestAnimationFrame(() => {
          const results = resultsRef.current;
          if (results && results.getBoundingClientRect().top < 0)
            results.scrollIntoView({ block: "start", behavior: "instant" });
        });
      }} />
    </section>
  );
}
