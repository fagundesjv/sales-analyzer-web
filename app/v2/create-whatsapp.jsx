"use client";
import {useEffect,useState} from "react";
import {Button,Input} from "@content-ventures/design-system/v3";
import {ArrowRight} from "lucide-react";
import {ResponsiveDialog} from "../../src/ui/os/responsive-dialog";
import {useV2Action,useV2Page} from "../../lib/v2-client";
import s from "./channels.module.css";

const uuid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
const normalizeName = name => name.normalize("NFC").trim().replace(/\s+/gu," ");
const validName = name => name.length >= 2 && name.length <= 60 && /^[\p{L}\p{N}][\p{L}\p{N} ._()\-]+$/u.test(name);
const states = new Set(["provisioning","unknown","disconnected","connecting","connected"]);

export function isLineReceipt(result) {
  return uuid.test(result?.connectionId) && uuid.test(result.ownerId) && result.channel === "whatsapp" &&
    typeof result.name === "string" && states.has(result.status);
}

function recoverIntent(context) {
  try {
    const item = JSON.parse(sessionStorage.getItem("v2/whatsapp/create/"+context));
    if (uuid.test(item?.key) && typeof item.name === "string" && validName(item.name) &&
        (!item.ownerId || uuid.test(item.ownerId))) return item;
  } catch {}
  return null;
}
function storeIntent(context,item) {
  try {
    const key = "v2/whatsapp/create/"+context;
    if (item) sessionStorage.setItem(key,JSON.stringify(item));
    else sessionStorage.removeItem(key);
  } catch {}
}

export function CreateConnection({session,context,allowed,onClose,onCreated,refresh}) {
  const [intent,setIntent] = useState(()=>recoverIntent(context));
  const [name,setName] = useState(intent?.name || "");
  const [ownerId,setOwnerId] = useState(intent?.ownerId || "");
  const [members,setMembers] = useState([]);
  const [uncertain,setUncertain] = useState(!!intent);
  const [conflict,setConflict] = useState(false);
  const action = useV2Action(context);
  const team = useV2Page("team",context,0,100);
  useEffect(() => {
    if (team.data) setMembers(current => [...new Map([...current,...team.data.items].map(m=>[m.id,m])).values()]);
  },[team.data]);
  const normalized = normalizeName(name);
  const invalid = !validName(normalized);
  const locked = action.pending || uncertain || conflict;
  function remember(value) {storeIntent(context,value);setIntent(value);}
  function submit(event) {
    event.preventDefault();
    if (invalid || action.pending || !allowed || conflict) return;
    const pending = intent || {name:normalized,ownerId,key:crypto.randomUUID()};
    remember(pending);
    action.run("connections","POST",{name:pending.name,...(pending.ownerId ? {ownerId:pending.ownerId} : {})},result=>{
      if (!isLineReceipt(result) || result.ownerId !== (pending.ownerId || session.user.id)) {
        setUncertain(true);refresh();return;
      }
      remember(null);
      onCreated({id:result.connectionId,name:result.name,ownerId:result.ownerId,channel:"whatsapp",status:result.status});
    },{retryKey:pending.key,onFailure:error=>{
      if (error.code === "whatsapp_conflict" || error.code === "idempotency_conflict") {
        remember(null);setUncertain(false);setConflict(true);refresh();
      } else if (!error.status || (error.status >= 200 && error.status < 300) || error.status >= 500 || [408,429].includes(error.status)) {
        setUncertain(true);refresh();
      } else {
        remember(null);setUncertain(false);
      }
    }});
  }
  const owner = members.find(m=>m.id===ownerId);
  return <ResponsiveDialog open size="sm" title="Conectar WhatsApp"
    description="Escolha como a linha aparecerá para a equipe e quem vai atendê-la."
    dismissible={!action.pending} onClose={() => {if (!action.pending) onClose();}}
    footer={conflict ? <Button variant="secondary" onClick={onClose}>Voltar às linhas</Button> :
      <Button type="submit" form="v2-create-whatsapp" variant="primary" icon={ArrowRight}
        disabled={invalid || action.pending || !allowed}>
        {action.pending ? "Conferindo linha…" : uncertain ? "Retomar criação" : "Continuar para o QR Code"}</Button>}>
    <form id="v2-create-whatsapp" className={s.create} onSubmit={submit}>
      <label>Nome da linha<Input autoFocus={!intent} required maxLength={60} value={name} disabled={locked}
        aria-invalid={!!name && invalid} aria-describedby={name && invalid ? "v2-line-name-help" : undefined}
        placeholder="Ex.: Comercial Sul" onChange={event => setName(event.target.value)} /></label>
      {name && invalid && <p id="v2-line-name-help">Use de 2 a 60 caracteres. Comece com letra ou número. Espaço, ponto, hífen, parênteses e sublinhado são aceitos.</p>}
      <label>Responsável pelo número<select value={ownerId} disabled={locked} onChange={event=>setOwnerId(event.target.value)}>
        <option value="">Minha conta (gestor)</option>
        {ownerId && !owner && <option value={ownerId}>Responsável da solicitação</option>}
        {members.filter(m=>m.id!==session.user.id).map(m=><option key={m.id} value={m.id}>
          {m.name} · {m.role === "manager" ? "Gestor" : "Vendedor"}</option>)}
      </select></label>
      {team.loading && <p role="status">Carregando equipe…</p>}
      {team.error && <div className={s.feedback}><p>Não foi possível consultar a equipe.</p>
        <Button type="button" variant="secondary" size="sm" onClick={team.retry}>Tentar carregar equipe</Button></div>}
      {team.next && <Button type="button" variant="ghost" size="sm" disabled={locked} onClick={team.next}>Carregar mais pessoas</Button>}
      {uncertain && <p role="status">A criação ainda precisa de confirmação. Retome a mesma solicitação para conferir a linha.</p>}
      {action.error && <p role="alert">{action.error}</p>}
      {conflict && <p>Confira o estado da linha na lista de WhatsApps e peça ajuda à implantação.</p>}
    </form>
  </ResponsiveDialog>;
}
