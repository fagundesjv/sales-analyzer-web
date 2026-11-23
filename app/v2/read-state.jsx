import {Button} from "@content-ventures/design-system/v3";

export function ReadState({read, children}) {
  if (read.error) return <div role="alert" className="flow"><p>{read.error.message}</p>
    <Button size="sm" variant="secondary" onClick={read.retry}>Tentar novamente</Button></div>;
  if (read.loading) return <p role="status" aria-live="polite">Carregando…</p>;
  return children(read.data);
}

export function CursorNav({page, label, className}) {
  if (!page.next && !page.previous) return null;
  return <nav aria-label={label} className={className}>
    <Button variant="ghost" size="sm" disabled={!page.previous} onClick={page.previous}>Anterior</Button>
    <span aria-live="polite">Página {page.number}</span>
    <Button variant="ghost" size="sm" disabled={!page.next} onClick={page.next}>Próxima</Button>
  </nav>;
}
