"use client";
import {useState} from "react";
import {Button, Checkbox, Input, Select, Textarea} from "@content-ventures/design-system/v3";
import {DetailRows, DetailSection, DetailText} from "../../src/ui/os/detail";
import {ResponsiveDialog} from "../../src/ui/os/responsive-dialog";
import {useV2Action} from "../../lib/v2-client";
import css from "./central-ai.module.css";

export const stageLabels={classify:"Classificação",draft:"Redação",transcribe:"Transcrição",image:"Imagem",document:"Documento",chat:"Chat da Zoe",link:"Leitura de links"};
const full=m=>m.provider+":"+m.model;
const options=items=>items.map(item=>({value:item.id,label:item.label}));
export const currentPrice=(data,name)=>data.prices.find(p=>p.provider+":"+p.model===name && new Date(p.validFrom)<=new Date());

function CatalogForm({kind,data,initial,close,saved}) {
  const action=useV2Action(), [error,setError]=useState("");
  const [protocol,setProtocol]=useState(initial?.protocol || "openai");
  const [provider,setProvider]=useState(initial?.provider || data.providers[0]?.id || "");
  const [stages,setStages]=useState(initial?.stages || ["draft"]);
  const [shadowOnly,setShadowOnly]=useState(initial?.shadowOnly || false), [enabled,setEnabled]=useState(initial?.enabled ?? true);
  const [selectedModel,setModel]=useState(initial?.model ? full(initial) : full(data.models[0]||{provider:"",model:""}));
  const [unit,setUnit]=useState("tokens"), [verified,setVerified]=useState(false);
  const titles={provider:initial?"Editar fornecedor":"Cadastrar fornecedor",model:initial?"Editar modelo":"Cadastrar modelo",tariff:"Registrar tarifa"};
  return <ResponsiveDialog open title={titles[kind]} size="md" onClose={close} dismissible={!action.pending}>
    <form className={css.form} onSubmit={event=>{
      event.preventDefault();setError("");const form=new FormData(event.currentTarget);let item;
      if(kind==="provider") item={id:initial?.id || form.get("id").trim(),label:form.get("label").trim(),protocol,host:form.get("host").trim(),credentialRef:form.get("credentialRef").trim(),enabled,expectedVersion:initial?.version || 0};
      if(kind==="model") item={provider:initial?.provider || provider,model:initial?.model || form.get("model").trim(),label:form.get("label").trim(),stages,shadowOnly,enabled,expectedVersion:initial?.version || 0};
      if(kind==="tariff") {
        const [p,m]=selectedModel.split(":");let rates={tipo:unit};
        const names=unit==="tokens"?["entrada","saida","cache"]:unit==="audio"?["porMinuto","minimoSegundos","saidaPorMinuto"]:["porPagina"];
        for(const name of names) if(form.get(name)!=="") rates[name]=Number(form.get(name));
        if(unit==="tokens") {rates.cacheWrites=form.get("cacheWrites")==="on";rates.longContext=form.get("longContext")==="on";
          if(form.get("tiers")) {try {rates.tierMultipliers=JSON.parse(form.get("tiers"));} catch {setError("Confira os multiplicadores JSON.");return;}}}
        item={provider:p,model:m,validFrom:new Date(form.get("validFrom")).toISOString(),rates,source:form.get("source").trim(),verified};
      }
      action.run("staff/ai/catalog","POST",{kind,item,reason:form.get("reason").trim()},saved);
    }}>
      {kind==="provider" && <>
        {!initial && <label>Identificador do fornecedor<Input name="id" required pattern="[a-z][a-z0-9_-]{0,39}" placeholder="meu_fornecedor" /></label>}
        <label>Nome do fornecedor<Input name="label" required defaultValue={initial?.label} minLength={2} maxLength={100} /></label>
        <Select label="Protocolo compatível" value={protocol} onChange={setProtocol} options={data.protocols.map(value=>({value,label:value}))} />
        <label>Host autorizado<Input key={protocol} name="host" required defaultValue={initial?.host || data.providers.find(p=>p.protocol===protocol)?.host} /></label>
        <label>Referência da credencial no servidor<Input name="credentialRef" required defaultValue={initial?.credentialRef} pattern="[a-z][a-z0-9_-]{0,39}" /></label>
        <DetailText>A credencial é instalada no servidor. Este formulário recebe apenas sua referência. O host precisa estar na lista autorizada.</DetailText>
      </>}
      {kind==="model" && <>
        {!initial && <><Select label="Fornecedor" value={provider} onChange={setProvider} options={options(data.providers)} />
          <label>Identificador do modelo<Input name="model" required maxLength={120} /></label></>}
        <label>Nome do modelo<Input name="label" required defaultValue={initial?.label} maxLength={140} /></label>
        <fieldset><legend>Funções compatíveis</legend><div className={css.choices}>
          {data.stages.map(stage=><Checkbox key={stage} label={stageLabels[stage]} checked={stages.includes(stage)}
            onChange={event=>setStages(old=>event.target.checked?[...old,stage]:old.filter(s=>s!==stage))} />)}
        </div></fieldset>
        <Checkbox label="Somente avaliação em sombra" checked={shadowOnly} onChange={event=>setShadowOnly(event.target.checked)} />
        <DetailText>Jev permanece restrito à classificação em sombra. Compatibilidade é validada pelo protocolo antes do cadastro.</DetailText>
      </>}
      {kind==="tariff" ? <>
        <Select label="Modelo da tarifa" searchable value={selectedModel} onChange={setModel} options={data.models.map(m=>({value:full(m),label:m.label+" · "+full(m)}))} />
        <Select label="Unidade da tarifa" value={unit} onChange={setUnit} options={[
          {value:"tokens",label:"Por milhão de tokens"},{value:"audio",label:"Por minuto de áudio"},{value:"pagina",label:"Por página ou crédito de extração"},
        ]} />
        {(unit==="tokens" ? [["entrada","Entrada USD por milhão",true],["saida","Saída USD por milhão",true],["cache","Leitura de cache USD por milhão",false]] :
          unit==="audio" ? [["porMinuto","Entrada USD por minuto",true],["saidaPorMinuto","Saída USD por minuto",false],["minimoSegundos","Cobrança mínima em segundos",false]] : [["porPagina","USD por página ou crédito",true]])
          .map(([name,label,required])=><label key={name}>{label}<Input name={name} type="number" min="0" max="1000000" step="any" required={required} /></label>)}
        {unit==="tokens" && <><Checkbox name="cacheWrites" label="Cobra escrita de cache (1,25x ou 2,5x)" />
          <Checkbox name="longContext" label="Contexto acima de 272 mil tokens tem tarifa especial" />
          <details><summary>Tarifas de níveis de serviço</summary><label>Multiplicadores confirmados (JSON)
            <Textarea name="tiers" placeholder={'{"flex":0.5,"priority":2}'} maxLength={300} />
          </label><DetailText>Um nível desconhecido mantém o custo indeterminado até conciliação.</DetailText></details></>}
        <label>Fonte oficial da tarifa<Input name="source" type="url" required placeholder="https://..." maxLength={500} /></label>
        <label>Vigência (horário local)<Input name="validFrom" type="datetime-local" required /></label>
        <Checkbox label="Conferi valores e condições na fonte oficial" checked={verified} onChange={event=>setVerified(event.target.checked)} />
        <DetailText>A tarifa cria uma nova versão. Chamadas anteriores conservam a versão usada em sua execução.</DetailText>
      </> : <Checkbox label="Disponível na biblioteca" checked={enabled} onChange={event=>setEnabled(event.target.checked)} />}
      <label>Motivo da alteração<Input name="reason" required minLength={3} maxLength={500} /></label>
      {(action.error || error) && <p role="alert">{error || action.error}</p>}
      <Button type="submit" disabled={action.pending || kind==="tariff"&&!verified || kind==="model"&&!stages.length}>{action.pending?"Salvando…":"Salvar cadastro"}</Button>
    </form>
  </ResponsiveDialog>;
}
export function AiCatalog({data,refresh}) {
  const [modal,setModal]=useState(null);
  const saved=()=>{setModal(null);refresh();};
  return <>
    <DetailSection title="Fornecedores" action={data.canEdit&&<Button size="sm" onClick={()=>setModal({kind:"provider"})}>Cadastrar fornecedor</Button>}>
      <DetailText>Protocolos centralizados, modelos por cadastro e credenciais somente no servidor.</DetailText>
      <div className={css.list}>{data.providers.map(p=><section key={p.id} aria-label={p.label}>
        <DetailRows items={[{label:"Fornecedor",value:p.label},{label:"Protocolo e host",value:p.protocol+" · "+p.host},
          {label:"Situação",value:p.enabled?"Disponível":"Desativado"}]} />
        {data.canEdit&&<Button size="sm" variant="ghost" onClick={()=>setModal({kind:"provider",initial:p})}>Editar {p.label}</Button>}
      </section>)}</div>
    </DetailSection>
    <DetailSection title="Modelos e tarifas" action={data.canEdit&&<div className={css.actions}>
      <Button size="sm" onClick={()=>setModal({kind:"model"})}>Cadastrar modelo</Button>
      <Button size="sm" variant="secondary" onClick={()=>setModal({kind:"tariff"})}>Registrar tarifa</Button>
    </div>}>
      <div className={css.list}>{data.models.map(m=>{
        const price=currentPrice(data,full(m));
        return <section key={full(m)} aria-label={full(m)}><DetailRows items={[
          {label:"Modelo",value:m.label+" · "+full(m)}, {label:"Funções",value:m.stages.map(s=>stageLabels[s]).join(", ")},
          {label:"Uso",value:!m.enabled?"Desativado":m.shadowOnly?"Somente sombra":"Principal, reserva ou sombra"},
          {label:"Tarifa vigente",value:price?.verifiedAt?"Verificada em "+new Date(price.verifiedAt).toLocaleString("pt-BR"):"Pendente de verificação"},
          ...(price?[{label:"Fonte",value:price.source.startsWith("https://")?<a href={price.source} target="_blank" rel="noreferrer">Consultar fonte da tarifa</a>:"Snapshot herdado, sem aprovação"},
            {label:"Valores USD",value:JSON.stringify(price.rates)}]:[]),
        ]} />{data.canEdit&&<Button size="sm" variant="ghost" onClick={()=>setModal({kind:"model",initial:m})}>Editar {m.label}</Button>}</section>;
      })}</div>
    </DetailSection>
    {modal && <CatalogForm key={modal.kind+"/"+(modal.initial?.id||modal.initial?.model||"new")} {...modal} data={data} close={()=>setModal(null)} saved={saved} />}
  </>;
}
