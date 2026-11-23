"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Button, Popover, SearchField } from "@content-ventures/design-system/v3";
import { Activity, Building2, Check, ChevronDown, Package, Plug, Smartphone, Users, Wallet } from "lucide-react";
import { foldText } from "../lib/conversation-queue";
import { isShowroom } from "../lib/demo-workspace";
import { portalEnabled } from "../lib/official-portal";
import { BarTitle } from "../src/ui/os/shell/os-shell";
import s from "./settings.module.css";

export const settingsSections = [
  { id: "empresa", title: "Empresa", icon: Building2, group: "Organização",
    terms: "perfil nome identidade endereço cnpj site website instagram telefone contato cidade expediente horário rotina frequência leitura análise zoe janela pausar" },
  { id: "equipe", title: "Equipe", icon: Users, group: "Organização",
    terms: "vendedores pessoas atribuição responsável canal acesso e-mail" },
  { id: "whatsapps", title: "WhatsApps", icon: Smartphone, group: "Operação",
    terms: "whatsapp wpp aparelho telefone conectar escanear qr code conexão número pareamento" },
  { id: "conexao", title: "Conectores", icon: Plug, group: "Operação",
    terms: "integrar integrações plugins ferramentas fontes crm nowz helena datacrazy hubspot pipedrive meta anúncios webhook" },
  { id: "catalogo", title: "Produtos e serviços", icon: Package, group: "Operação",
    terms: "catálogo preço estoque disponibilidade reposição cadastro" },
  { id: "uso", title: "Uso", icon: Activity, group: "Uso e cobrança",
    terms: "atividade consumo utilização por usuário empresa tempo foco atendimentos" },
  { id: "plano", title: "Plano e créditos", icon: Wallet, group: "Uso e cobrança",
    terms: "mensalidade assinatura licença seat IA crédito franquia limite saldo consumo recarga implementação cobrança preço vendedor" },
];
const groups = [...new Set(settingsSections.map(section => section.group))];
const sectionHref = id => id === "uso" ? "#uso/ajustes" : "#" + id;

function SectionNavigation({ current, close }) {
  const [query, setQuery] = useState("");
  const words = foldText(query.trim()).split(/\s+/).filter(Boolean);
  const matches = settingsSections.filter(section => {
    const text = foldText([section.title, section.group, section.terms].join(" "));
    return words.every(word => text.includes(word));
  });
  return <nav className={s.navigation} aria-label="Seções de Ajustes">
    <SearchField label="Buscar ajuste" placeholder="Buscar ajuste" inputMode="search" enterKeyHint="search"
      value={query} onValueChange={setQuery} />
    {groups.map(group => {
      const entries = matches.filter(section => section.group === group);
      if (!entries.length) return null;
      return <div className={s.group} key={group}>
        <span>{group}</span>
        {entries.map(({id, title, icon: Icon}) =>
          <a key={id} href={sectionHref(id)} aria-current={id === current ? "page" : undefined}
            data-autofocus={id === current && close ? "" : undefined}
            onClick={event => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              setQuery("");
              close?.();
            }}>
            <Icon size={17} aria-hidden="true" />{title}
            {id === current && close && <Check size={15} className={s.selectedIcon} aria-hidden="true" />}
          </a>)}
      </div>;
    })}
    {!matches.length && <div className={s.noResults}>
      <p role="status">Nenhuma seção encontrada.</p>
      <Button size="sm" variant="ghost" onClick={() => setQuery("")}>Limpar busca</Button>
    </div>}
  </nav>;
}

export function SettingsWorkspace({ current, children, onReset }) {
  const content = useRef(null);
  const previous = useRef(current);
  useLayoutEffect(() => {
    if (previous.current === current) return;
    previous.current = current;
    const heading = content.current?.querySelector("h1");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({preventScroll: true});
      content.current.closest("main")?.scrollTo({top: 0, behavior:"instant"});
    }
  }, [current]);
  const section = settingsSections.find(item => item.id === current);
  return <div data-settings-screen={current} className="settings-layout">
    <BarTitle>
      <span className={s.desktopTitle}>{section?.title}</span>
      <div className={s.switcher}>
        <Popover label="Escolher seção de ajustes" width={292} align="start" className={s.picker}
          trigger={props => <button type="button" {...props} className={s.switchButton} aria-label="Trocar seção de ajustes">
            Ajustes <ChevronDown size={15} aria-hidden="true" />
          </button>}>
          {({ close }) => <SectionNavigation current={current} close={close} />}
        </Popover>
      </div>
    </BarTitle>
    <aside className={s.rail}>
      <div className={s.title}>Ajustes</div>
      <SectionNavigation current={current} />
    </aside>
    <div ref={content} className="settings-content" key={current}>
      {children}
      {current === "empresa" && onReset && !portalEnabled && <details className={s.example}>
        <summary>Dados da demonstração</summary>
        <div>
          <a href={isShowroom() ? "/?demo=loja#empresa" : "/#empresa"}>
            {isShowroom() ? "Abrir demonstração da loja" : "Explorar demonstração da rede"}
          </a>
          <Button size="sm" variant="ghost" onClick={onReset}>Reiniciar demonstração</Button>
        </div>
      </details>}
    </div>
  </div>;
}
