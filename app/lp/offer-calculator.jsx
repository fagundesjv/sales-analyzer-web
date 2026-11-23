"use client";

import { useState } from "react";
import { terms, estimate, digits } from "../../lib/seat-pricing";
import { money } from "../../lib/operation";
import s from "./sales-story.module.css";

export function OfferCalculator() {
  const [quantity, setQuantity] = useState("1");
  const [margin, setMargin] = useState("125");
  const seats = Number(quantity);
  const validSeats = /^\d{1,3}$/.test(quantity) && seats >= 1;
  const marginCents = Math.round(Number(margin.replace(",", ".")) * 100);
  const validMargin = /^\d{1,8}([,.]\d{1,2})?$/.test(margin) && marginCents > 0;
  const quote = validSeats ? estimate(seats) : null;
  const counts = quote && validMargin ? {
    monthly: Math.ceil(quote.monthly / marginCents),
    first: Math.ceil(quote.first / marginCents),
  } : null;
  const href = "/lp/contratar/equipe/" + (seats === 1 ? "" : "?vendedores=" + seats);
  const sales = (n) => digits(n) + (n === 1 ? " venda" : " vendas");

  return (
    <div className={s.calculator}>
      <h3>Faça a conta para sua equipe</h3>
      <div className={s.fields}>
        <label htmlFor="equipe-lp">Vendedores
          <input id="equipe-lp" type="number" inputMode="numeric" min="1" max="999" step="1"
            value={quantity} onChange={(event) => setQuantity(event.target.value)} aria-invalid={!validSeats} />
        </label>
        <label htmlFor="margem-lp">Margem por venda (R$)
          <input id="margem-lp" type="text" inputMode="decimal" value={margin} maxLength={11}
            onChange={(event) => setMargin(event.target.value)} aria-describedby="definicao-margem" aria-invalid={!validMargin} />
        </label>
      </div>
      <p id="definicao-margem" className={s.help}>Use o que sobra de uma venda depois dos custos variáveis.</p>
      <div aria-live="polite" aria-atomic="true">
        {quote ? <>
          <dl className={s.quoteLines}>
            <div><dt>Mensalidade da equipe</dt><dd>{money(quote.monthly)}</dd></div>
            <div><dt>Primeiro mês, com implementação</dt><dd>{money(quote.first)}</dd></div>
          </dl>
          {counts ? <div className={s.payback}>
            <strong>{sales(counts.monthly)} por mês</strong>
            <p>{counts.monthly === 1 ? "cobre" : "cobrem"} a mensalidade com essa margem. No primeiro mês, seriam {sales(counts.first)} para cobrir também a implementação.</p>
          </div> : <p className={s.help}>Informe uma margem maior que zero para ver quantas vendas cobrem o plano.</p>}
        </> : <p className={s.inputError}>Informe de 1 a 999 vendedores para calcular o total.</p>}
      </div>
      {validSeats ? <a className={s.buy} href={href}>Continuar com {digits(seats)} {seats === 1 ? "vendedor" : "vendedores"}</a>
        : <button type="button" disabled className={s.buy}>Continuar com minha equipe</button>}
      <small className={s.purchaseNote}>Contratação de demonstração, sem cobrança.</small>
    </div>
  );
}
