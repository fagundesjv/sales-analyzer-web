"use client";
import { useRef, useState } from "react";
import { Button, Input } from "@content-ventures/design-system/v3";
import { usePortalData } from "./portal-data";
import s from "./portal.module.css";

const searchable = (name) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function SellerInspection({ identity, onInspect }) {
  const [query, setQuery] = useState("");
  const [company, setCompany] = useState("");
  const [seller, setSeller] = useState("");
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const portfolio = usePortalData("/api/admin/accounts", identity, revision);
  const account = portfolio.data?.accounts.find((item) => item.id === company);
  const detail = usePortalData(account && !account.portalSellers ? "/api/admin/accounts/" + encodeURIComponent(company) : null, identity, revision);
  const matches = (portfolio.data?.accounts || []).filter((account) =>
    searchable(account.name).includes(searchable(query.trim())));
  const roster = account?.portalSellers || detail.data?.portalSellers;
  const sellers = (roster || []).filter((person) => person.active && person.linked);
  async function submit(event) {
    event.preventDefault();
    if (lock.current || !sellers.some((person) => person.id === seller)) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try { await onInspect(company, seller); }
    catch (cause) { setError(cause.message); }
    finally { lock.current = false; setBusy(false); }
  }
  return (
    <form className={s.insight} onSubmit={submit}>
      <h2>Abrir como vendedor</h2>
      <p>Consulte o Radar e as conversas que o vendedor pode ver.</p>
      <label>Buscar empresa
        <Input type="search" value={query} disabled={busy} onChange={(e) => {
          setQuery(e.target.value); setCompany(""); setSeller(""); setError("");
        }} />
      </label>
      {portfolio.data && (matches.length ? (
        <label>Empresa do cliente
          <select aria-label="Empresa do cliente" className="sales-select" value={company} disabled={busy} onChange={(e) => {
            setCompany(e.target.value); setSeller(""); setError("");
          }}>
            <option value="">Selecione uma empresa</option>
            {matches.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
      ) : <p>Nenhuma empresa encontrada.</p>)}
      {roster && (sellers.length ? (
        <label>Vendedor
          <select aria-label="Vendedor" className="sales-select" value={seller} disabled={busy} onChange={(e) => { setSeller(e.target.value); setError(""); }}>
            <option value="">Selecione um vendedor</option>
            {sellers.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.email}</option>)}
          </select>
        </label>
      ) : <p>Esta empresa ainda não tem vendedor com acesso ativo vinculado.</p>)}
      {(!portfolio.data && !portfolio.error || company && !roster && !detail.error) && <p role="status">Carregando…</p>}
      {(error || detail.error || portfolio.error) && <p role="alert">{error || detail.error || portfolio.error}</p>}
      {(detail.error || portfolio.error) && <Button type="button" onClick={() => setRevision((n) => n + 1)}>Tentar novamente</Button>}
      <div><Button type="submit" variant="primary" disabled={busy || !seller || !roster}>
        {busy ? "Abrindo…" : "Consultar Radar do vendedor"}
      </Button></div>
    </form>
  );
}
