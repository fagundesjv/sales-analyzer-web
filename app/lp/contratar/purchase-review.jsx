import { ArrowLeft } from "lucide-react";
import s from "../landing.module.css";

export function PurchaseReview({ offer }) {
  return (
    <main className={s.page + " " + s.checkout}>
      <header>
        <a className={s.brand} href="/lp/" aria-label="Sales Analyzer, página inicial">
          <img src="/assets/logo-horizontal-on-light.svg" width="152" height="31" alt="" />
        </a>
      </header>
      <div className={s.order}>
        <a className={s.returnLink} href="/lp/#assinatura">
          <ArrowLeft size={15} aria-hidden="true" /> Voltar à oferta
        </a>
        <p className={s.testMode}>Contratação online</p>
        <h1>Revise sua assinatura.</h1>
        <dl className={s.summary}>
          <div>
            <dt>Produto</dt>
            <dd>Sales Analyzer</dd>
          </div>
          <div>
            <dt>Assinatura mensal</dt>
            <dd>{offer.price}</dd>
          </div>
        </dl>
        <p>Continue para o checkout para escolher como pagar e concluir a assinatura.</p>
        <a className={s.solid} href={offer.checkoutUrl}>
          Ir para pagamento
        </a>
      </div>
    </main>
  );
}
