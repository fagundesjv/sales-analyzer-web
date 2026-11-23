"use client";

import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink, ThemeV3 } from "@content-ventures/design-system/v3";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { SellerCount, maxSeats, validSeats } from "../../../seller-count";
import { money } from "../../../../lib/operation";
import { digits, estimate, terms } from "../../../../lib/seat-pricing";
import skin from "../../../../src/ui/os/os-theme.module.css";
import s from "./purchase.module.css";

export function TeamPurchase() {
  const [quantity, setQuantity] = useState("1");
  const [confirmed, setConfirmed] = useState(false);
  const [theme, setTheme] = useState("system");
  const [ready, setReady] = useState(false);
  const input = useRef(null);
  const heading = useRef(null);
  const submittedHere = useRef(false);
  const valid = validSeats(quantity);
  const seats = Number(quantity);
  const price = valid ? estimate(seats) : null;
  const seatLabel = seats === 1 ? "vendedor" : "vendedores";

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sales-v2-theme");
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {
      /* The public quote also works with browser storage disabled. */
    }
    function readLocation(moveFocus) {
      const url = new URL(window.location.href);
      const count = url.searchParams.get("vendedores") || "";
      const complete = validSeats(count) && url.hash === "#confirmacao";
      setQuantity(validSeats(count) ? String(Number(count)) : "1");
      setConfirmed(complete);
      if (moveFocus) requestAnimationFrame(() => (complete ? heading : input).current?.focus());
    }
    readLocation(false);
    setReady(true);
    const navigate = () => readLocation(true);
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);

  function confirm(event) {
    event.preventDefault();
    if (!valid) return;
    const url = new URL(window.location.href);
    url.searchParams.set("vendedores", String(seats));
    url.hash = "";
    window.history.replaceState(window.history.state, "", url);
    submittedHere.current = true;
    window.location.hash = "confirmacao";
  }

  function edit() {
    if (submittedHere.current) {
      window.history.back();
      return;
    }
    const url = new URL(window.location.href);
    url.hash = "";
    window.history.replaceState(window.history.state, "", url);
    setConfirmed(false);
    requestAnimationFrame(() => input.current?.focus());
  }

  return (
    <ThemeV3 mode={theme} className={[skin.brand, skin.mono, s.page].join(" ")}>
      <header className={s.header}>
        <div className={s.headerInner}>
          <a className={s.brand} href="/lp/" aria-label="Sales Analyzer, início">
            <img
              className={s.lightLogo}
              src="/assets/logo-horizontal-on-light.svg"
              width="160"
              height="32"
              alt=""
            />
            <img
              className={s.darkLogo}
              src="/assets/logo-horizontal-on-dark.svg"
              width="160"
              height="32"
              alt=""
            />
          </a>
          <a href="/lp/#assinatura" className={s.back}>
            <ArrowLeft size={15} aria-hidden="true" />
            Voltar à oferta
          </a>
        </div>
      </header>
      <main className={s.main}>
        <div className={s.layout}>
          <section className={s.selection} aria-labelledby="purchase-title">
            {confirmed && (
              <span className={s.check}>
                <Check size={23} aria-hidden="true" />
              </span>
            )}
            <h1 id="purchase-title" tabIndex={-1} ref={heading}>
              {confirmed ? "Contratação simulada" : "Configure sua assinatura"}
            </h1>
            <p className={s.lead}>
              {confirmed
                ? "Sua simulação inclui " + digits(seats) + " " + seatLabel + "."
                : "Escolha quantos vendedores vão usar o Sales Analyzer."}
            </p>
            {!confirmed && (
              <form id="team-order" onSubmit={confirm} noValidate>
                <div className={s.fieldRow}>
                  <div>
                    <label htmlFor="buyer-seats">Número de vendedores</label>
                    <small>{money(terms.seatPrice)} por vendedor ao mês</small>
                  </div>
                  <SellerCount id="buyer-seats" inputRef={input} quantity={quantity} onChange={setQuantity}
                    disabled={!ready} hintId="quantity-hint" />
                </div>
                {!valid && (
                  <p id="quantity-hint" className={s.error} role="status">
                    Informe um número inteiro de 1 a {maxSeats}.
                  </p>
                )}
              </form>
            )}
            <div className={s.credits}>
              <img src="/assets/idle_thumbnail.png" alt="" width="42" height="42" />
              <div>
                <h2>Créditos de IA da Zoe</h2>
                <p>
                  <strong>{digits(terms.included)}</strong> por vendedor, por mês
                </p>
                <small>
                  {valid
                    ? digits(seats * terms.included) + " créditos na equipe, com saldo individual."
                    : "O total da equipe depende da quantidade de vendedores."}
                </small>
              </div>
            </div>
          </section>
          <section className={s.summary} aria-labelledby="summary-title">
            <h2 id="summary-title">Resumo da assinatura</h2>
            <div aria-live="polite" aria-atomic="true">
              <dl className={s.lines}>
                <div>
                  <dt>
                    {valid
                      ? digits(seats) + " " + seatLabel + " × " + money(terms.seatPrice)
                      : "Licenças da equipe"}
                  </dt>
                  <dd>{price ? money(price.monthly) : "—"}</dd>
                </div>
                <div>
                  <dt>Implementação única</dt>
                  <dd>{money(terms.setup)}</dd>
                </div>
              </dl>
              <dl className={s.totals}>
                <div>
                  <dt>Primeiro mês</dt>
                  <dd>{price ? money(price.first) : "—"}</dd>
                </div>
                <div>
                  <dt>A partir do 2º mês</dt>
                  <dd>
                    {price ? money(price.monthly) : "—"} <small>/ mês</small>
                  </dd>
                </div>
              </dl>
            </div>
            <div className={s.actions}>
              {confirmed ? (
                <>
                  <ButtonLink
                    href="/?demo=loja#conexao"
                    variant="primary"
                    size="lg"
                    trailingIcon={ArrowRight}
                  >
                    Configurar WhatsApp de exemplo
                  </ButtonLink>
                  <Button variant="ghost" onClick={edit}>
                    Editar quantidade
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="submit"
                    form="team-order"
                    variant="primary"
                    size="lg"
                    disabled={!ready || !valid}
                    trailingIcon={ArrowRight}
                  >
                    Confirmar simulação
                  </Button>
                  <p>Demonstração sem cobrança.</p>
                </>
              )}
            </div>
          </section>
        </div>
      </main>
    </ThemeV3>
  );
}
