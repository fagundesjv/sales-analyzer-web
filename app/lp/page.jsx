import { ArrowUpRight } from "lucide-react";
import { signals } from "../../lib/demo";
import { inboxHref, primaryThread } from "../../lib/inbox";
import { money } from "../../lib/operation";
import { digits, terms } from "../../lib/seat-pricing";
import { CaseReader } from "./case-reader";
import { OfferCalculator } from "./offer-calculator";
import { monthlyOffer } from "./offer";
import s from "./landing.module.css";
import story from "./sales-story.module.css";

export const metadata = {
  title: "Venda mais para quem já chamou no WhatsApp · Sales Analyzer",
  description: "Encontre pedidos de pagamento esquecidos, propostas sem retorno e clientes esperando reposição. Veja quem chamar, quanto está em jogo e como retomar a venda.",
};

const scenarios = [
  { id: "marina", label: "Pagamento", stakes: "em um pedido à espera do link há 42 minutos." },
  { id: "clara", label: "Reposição", stakes: "em uma poltrona que voltou ao estoque. Clara pediu para ser avisada." },
  { id: "rafael", label: "Proposta", stakes: "em uma proposta. O dia combinado para o retorno chegou." },
].map((scenario) => {
  const c = signals.find(({ id }) => id === scenario.id);
  return { ...scenario, name: c.name, owner: c.owner, at: c.at, quote: c.quote, reply: c.reply,
    value: money(c.cents), href: "/?demo=loja" + inboxHref(primaryThread(c)) };
});

const views = [
  { id: "foco", role: "Para quem vende", name: "Abra o WhatsApp sabendo quem chamar.", text: "Em uma rodada de dez minutos, o vendedor recebe a fila de retornos com a conversa e uma sugestão de resposta. Ele revisa, envia e registra o desfecho.", action: "Experimentar uma rodada", href: "/?demo=loja#entrada/rodada", alt: "Foco da Zoe com a conversa de Marina e a sugestão de retomada." },
  { id: "panorama", role: "Para quem lidera", name: "Veja quais oportunidades viraram vendas.", text: "Acompanhe os valores em risco e os ganhos que a equipe confirmou. Abra a conversa para entender por que uma negociação parou ou voltou a andar.", action: "Explorar o panorama comercial", href: "/?demo=loja#dashboard", alt: "Dashboard da Loja Aurora com o fluxo de conversas por canal e a oportunidade de Marina." },
];

export default function LandingPage() {
  return (
    <div className={s.page} id="inicio">
      <a className={s.skip} href="#conteudo">Ir para o conteúdo</a>
      <header className={s.header}>
        <div className={s.wrapper + " " + s.headerRow}>
          <a className={s.brand} href="#inicio" aria-label="Sales Analyzer, início">
            <img src="/assets/logo-horizontal-on-light.svg" width="152" height="31" alt="" />
          </a>
          <nav className={s.mainNav} aria-label="Navegação principal">
            <a href="#demonstracao">Radar da Zoe</a><a href="#plataforma">Como funciona</a><a href="#assinatura">Preço</a>
          </nav>
          <div className={s.headerActions}>
            <a className={s.enter} href="/#dashboard">Abrir o app</a>
            <a className={s.solid} href="#assinatura">Assinar</a>
          </div>
        </div>
      </header>
      <main id="conteudo">
        <div className={s.wrapper + " " + story.hero}>
          <section className={story.pitch} aria-labelledby="headline">
            <h1 id="headline">Antes de comprar mais leads, venda para quem já chamou.</h1>
            <p>Tem cliente no seu WhatsApp esperando só o link para pagar. A Zoe encontra a conversa, mostra quanto está em jogo e deixa a resposta pronta para o vendedor.</p>
            <a className={s.solid} href="#assinatura">{monthlyOffer.preview ? "Calcular o plano da minha equipe" : "Ver preço e assinar"}</a>
            <p className={story.priceHint}>{monthlyOffer.price}{monthlyOffer.preview ? " por vendedor/mês" : " por mês"}{monthlyOffer.preview && <> · Implementação única de {money(terms.setup)}</>}</p>
          </section>
          <CaseReader cases={scenarios} />
        </div>
        <section className={s.connections} id="conexoes" aria-labelledby="connections-title">
          <div className={s.wrapper + " " + s.connectionRow}>
            <h2 id="connections-title">Conexões da plataforma</h2>
            <ul>
              <li><img src="/assets/whatsapp.svg" alt="" width="24" height="24" />WhatsApp</li>
              <li><img src="/assets/nowz.png" alt="" width="24" height="24" />Nowz</li>
              <li><img src="/assets/datacrazy.png" alt="" width="24" height="24" />DataCrazy</li>
            </ul>
            <a href="/?demo=loja#conexao">Ver conectores <ArrowUpRight size={15} aria-hidden="true" /></a>
          </div>
        </section>
        <section id="plataforma" className={s.wrapper + " " + s.platform} aria-label="Como o Sales Analyzer ajuda a sua equipe">
          <div className={s.views}>
            {views.map((view) => (
              <a key={view.id} className={s.view} href={view.href}>
                <div className={story.viewHeading}><small>{view.role}</small><h2>{view.name}</h2></div>
                <div className={s.screen} data-view={view.id}>
                  <picture>
                    <source media="(max-width: 620px)" srcSet={"/landing/" + view.id + "-mobile.webp"} />
                    <img src={"/landing/" + view.id + ".webp"} alt={view.alt} width="1440" height={view.id === "foco" ? 925 : 960} loading="lazy" />
                  </picture>
                </div>
                <div className={s.viewCaption}><p>{view.text}</p><span className={story.viewLink}>{view.action} <ArrowUpRight size={15} aria-hidden="true" /></span></div>
              </a>
            ))}
          </div>
        </section>
        <section id="assinatura" className={story.offer} aria-labelledby="offer-title">
          <div className={s.wrapper + " " + story.offerInner}>
            <div className={story.offerCopy}>
              <h2 id="offer-title">{monthlyOffer.preview ? "Quantas vendas pagam a assinatura?" : "Leve o Radar para a sua equipe."}</h2>
              <div className={story.unitPrice}><strong>{monthlyOffer.price}</strong><span>{monthlyOffer.preview ? "por vendedor ao mês" : "por mês"}</span></div>
              {monthlyOffer.preview ? <>
                <p>Cada vendedor recebe o Radar, o Foco da Zoe e {digits(terms.included)} créditos de IA por mês. A implementação custa {money(terms.setup)}, uma única vez por equipe.</p>
                <details className={story.creditDetail}><summary>E se um vendedor precisar de mais créditos?</summary>
                  <p>O pacote adicional oferece {digits(terms.packSize)} créditos por {money(terms.packPrice)}. A simulação ao lado considera os créditos incluídos no plano.</p>
                </details>
              </> : <p>Acompanhe as negociações em risco, prepare os retornos da equipe e confira os ganhos confirmados.</p>}
            </div>
            {monthlyOffer.preview ? <OfferCalculator /> : <div className={story.liveOffer}><a className={story.buy} href="/lp/contratar/">Assinar agora</a><a className={story.demoOffer} href="/lp/contratar/equipe/">Simular plano por vendedor</a></div>}
          </div>
        </section>
      </main>
      <footer className={s.footer}>
        <div className={s.wrapper + " " + s.footerRow}>
          <a href="#inicio" className={s.brand} aria-label="Sales Analyzer, voltar ao início"><img src="/assets/logo-horizontal-on-light.svg" width="152" height="31" alt="" /></a>
          <nav aria-label="Navegação de rodapé"><a href="#demonstracao">Radar da Zoe</a><a href="#assinatura">Preço</a><a href="/#dashboard">Abrir o app</a></nav>
        </div>
      </footer>
    </div>
  );
}
