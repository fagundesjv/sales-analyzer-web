"use client";
import { useEffect, useState } from "react";
import {
  Activity,
  Building2,
  LogOut,
  MessageCircle,
  Moon,
  Phone,
  Radar,
  Sparkles,
  Sun,
  Wallet,
} from "lucide-react";
import {
  Button,
  ButtonLink,
  ThemeV3,
} from "@content-ventures/design-system/v3";
import { BarTitle, OsShell, SheetPage } from "../src/ui/os/shell/os-shell";
import { AccountButton } from "../src/ui/os/shell/column";
import skin from "../src/ui/os/os-theme.module.css";
import { PortalSession } from "./portal-session";
import { SellerInspection } from "./portal-seller-inspection";
import {
  LoadState,
  PortalConversation,
  PortalQueue,
} from "./portal-conversations";
import { PortalChat } from "./portal-chat";
import { PortalLines } from "./portal-lines";
import { WorkspaceUsage } from "./workspace-usage";
import { portalUsageReport } from "../lib/usage-report";
import { SeatPlan } from "./seat-plan";
import { useActivityPulse, usePortalData } from "./portal-data";
import s from "./portal.module.css";

const nav = (id, label, icon) => ({ id, label, icon, href: "#" + id });
const areas = [
  nav("radar", "Radar", Radar),
  nav("entrada", "Conversas", MessageCircle),
  nav("chat", "Chat da Zoe", Sparkles),
];
const account = nav("empresa", "Empresa", Building2);
const dailyRoutes = new Set([
  "relatorios",
  "relatorio-diario",
  "relatorios-diarios",
  "relatorio",
]);
const emptyThreads = {};

function LocalPlan({ identity, route }) {
  const key =
    "sa-plan-preview:" + identity.workspaceId + ":" + identity.user.id;
  const [revision, refresh] = useState(0);
  const roster = usePortalData("/api/portal/sellers", identity, revision);
  const bySeller = route.split("/")[1] === "vendedores";
  const usage = usePortalData(
    bySeller ? "/api/portal/usage?days=90" : null,
    identity,
    revision,
  );
  const [pricing, setPricing] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  });
  if (!roster.data || (bySeller && !usage.data))
    return (
      <LoadState
        error={roster.error || usage.error}
        retry={() => refresh((v) => v + 1)}
        text="Carregando equipe…"
      />
    );
  const ops = {
    members: roster.data.sellers,
    profile: { name: identity.company },
    pricingPreview: pricing,
    official: true,
    officialUsage: usage.data
      ? (portalUsageReport(usage.data)?.people ?? [])
      : [],
  };
  function change(update) {
    const next = typeof update === "function" ? update(ops) : update;
    if (next?.pricingPreview) {
      localStorage.setItem(key, JSON.stringify(next.pricingPreview));
      setPricing(next.pricingPreview);
    }
  }
  return (
    <section className={s.page}>
      <h1>Plano e créditos</h1>
      <p>
        Simulação local de licenças e créditos.{" "}
        <a href="#uso">Consultar uso e ganhos reais</a>
      </p>
      <SeatPlan
        ops={ops}
        route={route}
        threads={emptyThreads}
        change={change}
      />
    </section>
  );
}

function Workspace({
  identity,
  memberships,
  switchCompany,
  logout,
  theme,
  toggleTheme,
  inspectSeller,
  endInspection,
}) {
  const inspecting = identity.support?.active === true;
  const [showInspection, setShowInspection] = useState(false);
  const [route, setRoute] = useState("radar");
  useActivityPulse(identity);
  useEffect(() => {
    function read() {
      let next = location.hash.slice(1) || "radar";
      if (dailyRoutes.has(next.split("/")[0])) {
        next = "chat";
        history.replaceState(null, "", "#chat");
      }
      setRoute(next);
    }
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const [path, id] = route.split("/");
  const seller = identity.viewer.kind === "seller";
  const salesEnabled =
    identity.zoeReleased !== false &&
    (!seller || identity.sellerZoeOpen === true);
  const active =
    path === "conversa" ? "entrada" : path === "dashboard" ? "radar" : path;
  const links = [
    ...areas,
    account,
    ...(!inspecting ? [nav("uso", "Uso", Activity)] : []),
    ...(!seller ? [nav("whatsapps", "WhatsApps", Phone)] : []),
    ...(identity.viewer.canManageSellers
      ? [nav("plano", "Plano e créditos", Wallet)]
      : []),
  ];
  const title =
    links.find((l) => l.id === active)?.label || "Portal da empresa";
  let content;
  if (active === "empresa")
    content = (
      <section className={s.page}>
        <header className={s.heading}>
          <div>
            <p>Empresa</p>
            <h1>{identity.company}</h1>
          </div>
        </header>
        <dl className={s.metrics}>
          <div>
            <dt>Seu acesso</dt>
            <dd>
              {seller
                ? "Vendedor"
                : identity.viewer.canManageSellers
                  ? "Gestor"
                  : "Consulta"}
            </dd>
          </div>
          <div>
            <dt>WhatsApps vinculados</dt>
            <dd>{identity.connections.length}</dd>
          </div>
        </dl>
        <div className={s.stack}>
          <p>
            {identity.user.name} · {identity.user.email}
          </p>
          {memberships.length > 1 && (
            <label>
              Empresa ativa
              <select
                className="sales-select"
                value={identity.workspaceId}
                onChange={(e) => switchCompany(e.target.value)}
              >
                {memberships.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className={s.actions}>
            {links
              .filter((l) => ["uso", "plano", "whatsapps"].includes(l.id))
              .map((l) => (
                <ButtonLink key={l.id} href={l.href} icon={l.icon}>
                  {l.label}
                </ButtonLink>
              ))}
          </div>
          {identity.supportAdmin && !inspecting && (showInspection
            ? <SellerInspection identity={identity} onInspect={inspectSeller} />
            : <Button onClick={() => setShowInspection(true)}>Abrir como vendedor</Button>)}
          {!inspecting && <Button onClick={logout}>Sair da conta</Button>}
        </div>
      </section>
    );
  else if (active === "uso" && !inspecting)
    content = (
      <section className={s.page}>
        <h1>Uso da plataforma</h1>
        <WorkspaceUsage identity={identity} />
      </section>
    );
  else if (active === "whatsapps" && !seller)
    content = (
      <section className={s.page}>
        <PortalLines identity={identity} />
      </section>
    );
  else if (active === "plano" && identity.viewer.canManageSellers)
    content = <LocalPlan identity={identity} route={route} />;
  else if (
    active === "chat" &&
    identity.zoeChatReleased !== false &&
    identity.zoeReleased !== false
  )
    content = <PortalChat identity={identity} />;
  else if (salesEnabled && path === "conversa" && id)
    content = <PortalConversation key={id} identity={identity} id={id} />;
  else if (salesEnabled && ["entrada", "radar"].includes(active))
    content = (
      <PortalQueue
        key={active}
        identity={identity}
        radar={active === "radar"}
      />
    );
  else
    content = (
      <section className={s.page}>
        <h1>Área indisponível</h1>
        <p>Esta área ainda não está disponível para seu acesso.</p>
        <ButtonLink href="#empresa">Ver minha empresa</ButtonLink>
      </section>
    );
  const main = areas.filter((l) =>
    l.id === "chat"
      ? identity.zoeChatReleased !== false && identity.zoeReleased !== false
      : salesEnabled,
  );
  return (
    <OsShell
      product="Sales Analyzer"
      mark={<img src="/assets/sales-mark.svg" alt="" width="28" />}
      home="#radar"
      areas={main}
      lower={[account]}
      phoneAreas={[...main, account]}
      location={route}
      active={active}
      notice={identity.company}
      onBack={() => history.back()}
      onForward={() => history.forward()}
      onSearch={() => {
        location.hash = "entrada";
        requestAnimationFrame(() =>
          document
            .querySelector('input[aria-label="Buscar conversa"]')
            ?.focus(),
        );
      }}
      account={
        <AccountButton
          name={identity.user.name}
          sections={[
            {
              label: identity.company,
              items: [
                {
                  label: "Minha empresa",
                  icon: Building2,
                  onSelect: () => {
                    location.hash = "empresa";
                  },
                },
                {
                  label:
                    theme === "dark" ? "Usar tema claro" : "Usar tema escuro",
                  icon: theme === "dark" ? Sun : Moon,
                  onSelect: toggleTheme,
                },
                ...(inspecting ? [] : [{ label: "Sair", icon: LogOut, onSelect: logout }]),
              ],
            },
          ]}
        />
      }
    >
      <BarTitle>{title}</BarTitle>
      <SheetPage docked={false}><div data-stable-phone-tabs>
        {inspecting && <aside className={s.inspectionBar}>
          <span><strong>{identity.supportTarget?.sellerName || "Visão do vendedor"}</strong> · {identity.company} · Somente leitura</span>
          <Button onClick={endInspection}>Encerrar consulta</Button>
        </aside>}
        {content}</div></SheetPage>
    </OsShell>
  );
}

export function PortalWorkspace() {
  const [theme, setTheme] = useState("dark");
  useEffect(() => {
    const value = localStorage.getItem("sales-v2-theme");
    if (value === "light") setTheme(value);
  }, []);
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    localStorage.setItem("sales-v2-theme", next);
    setTheme(next);
  };
  return (
    <ThemeV3 className={skin.brand} mode={theme}>
      <ThemeV3 className={skin.mono + " sales-surface"}>
        <PortalSession>
          {(identity, memberships, switchCompany, logout, inspectSeller, endInspection) => (
            <Workspace
              key={[identity.user.id, identity.workspaceId, identity.support?.sessionId].join(":")}
              {...{
                identity,
                memberships,
                switchCompany,
                logout,
                inspectSeller,
                endInspection,
                theme,
                toggleTheme,
              }}
            />
          )}
        </PortalSession>
      </ThemeV3>
    </ThemeV3>
  );
}
