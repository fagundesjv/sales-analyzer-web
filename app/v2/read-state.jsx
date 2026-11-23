import {memo, useEffect, useState} from "react";
import {Button} from "@content-ventures/design-system/v3";
import s from "./read-state.module.css";

export function LoadingSurface({full=false}) {
  return <div className={full ? s.surface : s.inline} role="status" aria-label="Carregando dados" aria-busy="true">
    <div className={s.skeleton} aria-hidden="true"><i /><i /><i /></div>
  </div>;
}

// Keep the last confirmed render, including its labels, while filters remain editable.
const Result = memo(function Result({data,render}) { return render(data); },
  (before,after) => after.frozen && before.data === after.data);

// A secondary lookup can distinguish a truly empty workspace from one empty tab.
// Once the user is browsing, keep the controls mounted throughout that lookup.
export function useListSurface(page, checking, empty) {
  const [wasBrowsing,setWasBrowsing] = useState(false);
  const ready = !!page.data && !checking;
  useEffect(() => {
    if (ready) setWasBrowsing(!empty);
  },[ready,empty]);
  return ready ? !empty : page.confirmed && wasBrowsing;
}

export function ReadState({read, children, notFound, retain=false, pending=false, full=!children}) {
  if (read.error?.status === 404 && notFound) return notFound;
  if (read.error) {
    const denied = read.error.status === 403 && ["forbidden","permission_denied","insufficient_permissions"].includes(read.error.code);
    return <div className={full ? s.surface : s.inline} role="alert"><div className={s.error}>
      <p>{denied ? "Seu perfil não tem permissão para acessar estes dados." : read.error.message}</p>
      {!denied && <Button size="sm" variant="secondary" onClick={read.retry}>Tentar novamente</Button>}
    </div></div>;
  }
  const data = read.data ?? (retain ? read.previousData : undefined);
  if (read.loading && data === undefined) return <LoadingSurface full={full} />;
  if (!children) return null;
  if (!retain) return children(read.data);
  const frozen = pending || read.loading;
  return <div className={s.results} aria-busy={frozen}>
    {frozen && <span className={s.progress} role="status" aria-label="Atualizando resultados" />}
    <div inert={frozen || undefined}><Result data={data} render={children} frozen={frozen} /></div>
  </div>;
}

export function CursorNav({page, label, className, pending=false}) {
  if (!page.next && !page.previous && !page.previousData?.nextCursor) return null;
  const busy = page.loading || pending;
  return <nav aria-label={label} className={className}>
    <Button variant="ghost" size="sm" disabled={busy || !page.previous} onClick={page.previous}>Anterior</Button>
    <span aria-live="polite">Página {page.number}</span>
    <Button variant="ghost" size="sm" disabled={busy || !page.next} onClick={page.next}>Próxima</Button>
  </nav>;
}
