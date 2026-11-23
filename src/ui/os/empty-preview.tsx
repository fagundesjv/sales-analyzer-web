import {Activity, Bell, BriefcaseBusiness, Bot, CalendarCheck, ChartNoAxesColumn, Check, CircleDollarSign, Gauge, Handshake, LayoutGrid, MessageCircle, Package, PanelsTopLeft, Radar, Search, Smartphone, UserRound, Users} from "lucide-react";
import s from "./empty-preview.module.css";

const glyphs = {
  inbox: MessageCircle, dashboard: ChartNoAxesColumn, gains: CircleDollarSign,
  radar: Radar, deals: Handshake, catalog: Package, services: BriefcaseBusiness, usage: Gauge, pipeline: PanelsTopLeft, returns: CalendarCheck,
  channels: Smartphone, diagnostics: Activity, alerts: Bell, team: Users, zoe: Bot,
};
export type PreviewKind = keyof typeof glyphs;

function PreviewBody({kind}: {kind: PreviewKind}) {
  const Glyph = glyphs[kind];
  switch (kind) {
    case "radar":
      return <div className={s.radar}><i/><i/><i/><b/></div>;
    case "usage":
    case "dashboard":
    case "gains":
    case "diagnostics":
      return <div className={s.chart}>{(kind === "diagnostics" ? [24,60,32,72,40,85,60] :
        kind === "gains" ? [20,26,40,38,59,74,95] : [38,55,44,79,60,95,78]).map((height,index) =>
        <i key={index} style={{height:height+"%"}}/>)}</div>;
    case "catalog":
    case "pipeline":
      return <div className={kind === "catalog" ? s.gallery : s.board}>{[0,1,2].map(i =>
        <div key={i}>{kind === "catalog" ? <Package/> : <b/>}<i/><i/></div>)}</div>;
    case "returns":
      return <div className={s.calendar}>{Array.from({length:14},(_,i) => <i key={i}>{i === 3 || i === 9 ? <Check/> : null}</i>)}</div>;
    default:
      return <div className={s.rows}>{[0,1,2].map(i =>
        <div key={i}><span>{kind === "inbox" ? null : kind === "team" ? <UserRound/> : <Glyph/>}</span>
          <div><i/><i/></div><b/></div>)}</div>;
  }
}

/** Decorative miniature of the current screen. Never contains live controls or customer data. */
export function EmptyPreview({kind}: {kind: PreviewKind}) {
  const Glyph = glyphs[kind];
  return <div className={s.preview} aria-hidden="true" data-preview={kind}>
    <div className={s.window}>
      <div className={s.rail}><img src="/assets/sales-mark.svg" alt=""/><ChartNoAxesColumn/><Radar/>
        <span><Glyph/></span><CalendarCheck/></div>
      <div className={s.body}><div className={s.toolbar}>{kind === "inbox" ? <Search/> :
        kind === "catalog" ? <LayoutGrid/> : <Glyph/>}<i/></div>
        <PreviewBody kind={kind}/></div>
    </div>
  </div>;
}
