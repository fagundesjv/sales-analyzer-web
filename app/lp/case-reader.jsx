"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { ProductVisual } from "../product-visual";
import s from "./sales-story.module.css";

export function CaseReader({ cases }) {
  const [selected, setSelected] = useState(0);
  const [showDraft, setShowDraft] = useState(false);
  const tabs = useRef([]);
  const current = cases[selected];

  function select(index) {
    setSelected(index);
    setShowDraft(false);
  }

  function navigate(event, index) {
    const positions = {
      ArrowRight: (index + 1) % cases.length,
      ArrowLeft: (index + cases.length - 1) % cases.length,
      Home: 0,
      End: cases.length - 1,
    };
    if (!(event.key in positions)) return;
    event.preventDefault();
    select(positions[event.key]);
    tabs.current[positions[event.key]].focus();
  }

  return (
    <section id="demonstracao" className={s.radar} aria-label="Demonstração do Radar da Zoe">
      <div className={s.radarHeader}>
        <span><img src="/assets/idle_thumbnail.png" width="29" height="29" alt="" /> Radar da Zoe</span>
        <small>Loja Aurora · Exemplo</small>
      </div>
      <div role="tablist" aria-label="Oportunidades da loja" className={s.tabs}>
        {cases.map((item, index) => (
          <button type="button" role="tab" key={item.id} id={"tab-" + item.id}
            aria-selected={selected === index} aria-controls="painel-caso" tabIndex={selected === index ? 0 : -1}
            ref={(node) => { tabs.current[index] = node; }}
            onClick={() => select(index)} onKeyDown={(event) => navigate(event, index)}>
            {item.label}
          </button>
        ))}
      </div>
      <div id="painel-caso" role="tabpanel" aria-labelledby={"tab-" + current.id} className={s.casePanel}>
        <div className={s.caseTop}>
          <div><strong>{current.value}</strong><h2>{current.stakes}</h2></div>
          <div className={s.thumb}><ProductVisual contact={current} /></div>
        </div>
        <div className={s.message} id="mensagem-zoe" aria-live="polite" aria-atomic="true">
          <div className={s.sender}>
            {showDraft ? <><img src="/assets/idle_thumbnail.png" alt="" width="20" height="20" /> Sugestão para {current.owner} revisar</>
              : <><img src="/assets/whatsapp.svg" alt="WhatsApp" width="16" height="16" /> {current.name} <span>· {current.at}</span></>}
          </div>
          <blockquote>“{showDraft ? current.reply : current.quote}”</blockquote>
        </div>
        <div className={s.caseActions}>
          <button type="button" aria-controls="mensagem-zoe" aria-expanded={showDraft} onClick={() => setShowDraft(!showDraft)}>
            {showDraft && <ArrowLeft size={15} aria-hidden="true" />}
            {showDraft ? "Voltar à mensagem" : "Ver como retomar a venda"}
            {!showDraft && <ArrowRight size={15} aria-hidden="true" />}
          </button>
          {showDraft && <a href={current.href}>Abrir atendimento <ArrowUpRight size={14} aria-hidden="true" /></a>}
        </div>
      </div>
    </section>
  );
}
