"use client";
import {useEffect,useRef,useState} from "react";
import {Button,Checkbox,Input,Select,Textarea} from "@content-ventures/design-system/v3";
import {DetailRows,DetailText} from "../../src/ui/os/detail";
import {ResponsiveDialog} from "../../src/ui/os/responsive-dialog";
import {useV2Action,useV2Read} from "../../lib/v2-client";
import {ReadState} from "./read-state";
import css from "./central-ai.module.css";

export const scopeNames={company:"Empresa",line:"Linha de atendimento",customer:"Cliente",opportunity:"Negociação",private:"Sua memória privada"};
const kindNames={policy:"Regra da empresa",note:"Nota",document:"Documento",link:"Página da web"};
const formats=["txt","md","html","csv","xlsx","docx","pdf","png","jpg","webp"];
const safeRef=ref=>/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/.test(ref?.id||"") && Number.isSafeInteger(ref.version) && ref.version>0 && ref.reference==="kb:"+ref.id+":v"+ref.version;
export const memoryReferences=sources=>Array.isArray(sources)?sources.filter(safeRef):[];
export function MemoryLinks({sources=[],context}) {
  const [selected,setSelected]=useState(null),valid=memoryReferences(sources);
  if(!valid.length)return null;
  return <><nav aria-label="Fontes da memória usadas na sugestão">{valid.map(source=><Button key={source.id+"/"+source.version} size="sm" variant="ghost" onClick={()=>setSelected(source)}>Ver {source.title||scopeNames[source.scope]||"fonte de contexto"}</Button>)}</nav>
    {selected&&<MemorySource sourceId={selected.id} expectedVersion={selected.version} context={context} close={()=>setSelected(null)} />}</>;
}
export function MemoryEditor({source,scope="company",context,close,saved}) {
  const action=useV2Action(context);
  const [kind,setKind]=useState(source?.kind||"note");
  const conflict=action.errorCode==="version_conflict";
  return <form className={css.form} onSubmit={event=>{
    event.preventDefault();if(conflict)return;const form=new FormData(event.currentTarget);
    action.run("memory/documents"+(source?"/"+source.id:""),source?"PUT":"POST",{scope:source?.scope||scope,kind,title:form.get("title").trim(),text:form.get("text"),...(source?{expectedVersion:source.version}:{})},saved);
  }}>
    {!source&&<Select label="Tipo da fonte" value={kind} onChange={setKind} options={Object.entries(kindNames).map(([value,label])=>({value,label}))} />}
    <label>Título da fonte<Input name="title" required maxLength={160} defaultValue={source?.title||""} /></label>
    <label>Conteúdo da fonte<Textarea aria-label="Conteúdo da fonte" name="text" maxLength={200000} rows={10} defaultValue={source?.text||""} /></label>
    <DetailText>{scopeNames[source?.scope||scope]}. Para importar um arquivo ou link, salve a fonte e abra a opção de importação.</DetailText>
    {action.error&&<p role="alert">{action.error}</p>}
    <div className={css.actions}><Button type="submit" disabled={action.pending||conflict}>Salvar fonte</Button><Button type="button" variant="ghost" disabled={action.pending} onClick={close}>Cancelar edição</Button></div>
  </form>;
}
function ImportMaterial({source,context,changed}) {
  const action=useV2Action(context),[kind,setKind]=useState("file"),[file,setFile]=useState(null),[error,setError]=useState("");
  const [jobId,setJob]=useState(null),[loading,setLoading]=useState(false),[critical,setCritical]=useState(false);
  const job=useV2Read(jobId?"memory/materials/"+jobId:null,context);
  const retry=useRef(job.retry);retry.current=job.retry;
  const pending=job.data&&["pending","running"].includes(job.data.state);
  const sourcePending=["pending","running"].includes(source.metadata?.etlState);
  useEffect(()=>{if(!pending)return;const timer=setInterval(()=>retry.current(),3000);return()=>clearInterval(timer);},[pending]);
  async function enqueue(event){
    event.preventDefault();setError("");const form=new FormData(event.currentTarget);let data;
    if(kind==="file"){
      const format=file?.name.split(".").at(-1).toLowerCase().replace("jpeg","jpg");
      if(!file||file.size>5*1024*1024||!formats.includes(format)){setError("Escolha um arquivo de até 5 MB em um formato aceito.");return;}
      setLoading(true);
      try {const bytes=new Uint8Array(await file.arrayBuffer());let binary="";for(let at=0;at<bytes.length;at+=32768)binary+=String.fromCharCode(...bytes.subarray(at,at+32768));data={format,content:btoa(binary)};}
      catch {setError("Não foi possível ler o arquivo.");return;}finally{setLoading(false);}
    }else data={url:form.get("url").trim()};
    action.run("memory/materials","POST",{sourceId:source.id,expectedVersion:source.version,...data,critical},value=>setJob(value.job_id));
  }
  const status={pending:"Importação na fila",running:"Importação em andamento",ready:"Material importado",partial:"Importação parcial; confira a cobertura",failed:"Não foi possível importar"};
  return <div className={css.form}>
    <form className={css.form} onSubmit={enqueue}>
      <Select label="Material a importar" value={kind} onChange={setKind} options={[{value:"file",label:"Arquivo"},{value:"url",label:"Link público"}]} />
      {kind==="file"?<label>Arquivo de conhecimento<Input type="file" accept=".txt,.md,.html,.csv,.xlsx,.docx,.pdf,.png,.jpg,.jpeg,.webp" onChange={event=>setFile(event.target.files?.[0]||null)} /></label>:
        <label>Link público do material<Input name="url" type="url" required placeholder="https://..." maxLength={2048} /></label>}
      <Checkbox label="Material essencial para a próxima leitura" checked={critical} onChange={event=>setCritical(event.target.checked)} />
      <DetailText>Até 5 MB. O conteúdo será conferido e ficará associado somente a esta fonte.</DetailText>
      {(error||action.error)&&<p role="alert">{error||action.error}</p>}
      <Button type="submit" disabled={loading||action.pending||Boolean(jobId)||sourcePending}>{loading?"Lendo arquivo…":action.pending?"Registrando…":"Importar material"}</Button>
    </form>
    {jobId&&<ReadState read={job}>{data=><><p role="status">{status[data.state]||data.state}</p>
      {data.coverage?.reason&&<p>O material precisa de conferência. A leitura disponível pode estar incompleta.</p>}
      <Button size="sm" variant="ghost" onClick={job.retry}>Atualizar importação</Button></>}</ReadState>}
    {job.data&&!pending&&<Button variant="secondary" onClick={changed}>Conferir conteúdo e versão importados</Button>}
  </div>;
}
export function MemorySource({sourceId,expectedVersion,context,session,close,changed=()=>{}}) {
  const [currentId,setCurrentId]=useState(sourceId);
  const read=useV2Read("memory/sources/"+currentId,context),action=useV2Action(context);
  const [mode,setMode]=useState("view"),[notice,setNotice]=useState("");
  const refresh=()=>{read.retry();changed();};
  return <ResponsiveDialog open title="Fonte de conhecimento" size="md" onClose={close} dismissible={!action.pending}>
    <ReadState read={read} notFound={<p>Esta fonte foi removida, mudou de acesso ou não está mais disponível.</p>}>{source=>{
      const chunk=source.metadata?.contentRole==="chunk";
      const editable=session&&!chunk&&!source.metadata?.generated&&["policy","note","document","link"].includes(source.kind)&&(source.scope==="private"||source.scope==="company"&&session.workspace.role==="manager");
      if(mode==="edit")return <MemoryEditor key={source.version} source={source} context={context} close={()=>setMode("view")} saved={()=>{setMode("view");refresh();}} />;
      return <div className={css.form}>
        <DetailRows items={[{label:"Fonte",value:source.title},{label:"Silo",value:scopeNames[source.scope]||source.scope},{label:"Versão atual",value:source.version}]} />
        {expectedVersion&&currentId===sourceId&&source.version!==expectedVersion&&<p role="status">Esta fonte foi atualizada desde a sugestão. Atualize a leitura antes de aplicar o texto.</p>}
        {chunk&&<><p>Trecho de um material maior. Edições e remoções são feitas na fonte original.</p>
          {/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/.test(source.metadata?.parentSourceId||"")&&<Button size="sm" variant="secondary" onClick={()=>{setMode("view");setCurrentId(source.metadata.parentSourceId);}}>Abrir fonte original</Button>}</>}
        <p style={{whiteSpace:"pre-wrap"}}>{source.text||"Fonte sem conteúdo de texto disponível."}</p>
        {["pending","running"].includes(source.metadata?.etlState)&&<p role="status">Material em processamento. Confira a versão novamente para acompanhar o conteúdo disponível.</p>}
        {source.metadata?.etlState==="partial"&&<p role="status">A importação ficou parcial. Confira o conteúdo antes de usar esta fonte.</p>}
        {notice&&<p role="status">{notice}</p>}
        {editable&&<div className={css.actions}><Button size="sm" variant="secondary" onClick={()=>setMode("edit")}>Editar fonte completa</Button>
          <Button size="sm" variant="ghost" onClick={()=>setMode("delete")}>Remover fonte</Button></div>}
        {mode==="delete"&&<div className={css.form}><p>Remover esta fonte da base da Zoe? Leituras que dependem dela precisarão ser atualizadas.</p>
          {action.error&&<p role="alert">{action.error}</p>}
          <Button disabled={action.pending} onClick={()=>action.run("memory/documents/"+source.id,"DELETE",{expectedVersion:source.version},()=>{changed();close();})}>Confirmar remoção da fonte</Button>
          <Button variant="ghost" disabled={action.pending} onClick={()=>setMode("view")}>Manter fonte</Button></div>}
        {editable&&["document","link"].includes(source.kind)&&<details><summary>Importar ou substituir material desta fonte</summary><ImportMaterial source={source} context={context} changed={refresh} /></details>}
        <Button size="sm" variant="ghost" onClick={()=>{setNotice("");refresh();}}>Conferir versão e acesso</Button>
      </div>;
    }}</ReadState>
  </ResponsiveDialog>;
}
