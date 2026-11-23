"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@content-ventures/design-system/v3";
import s from "./directory.module.css";

export function useDirectoryPage(items, sizes = [10, 25, 50]) {
  const [size, setSize] = useState(sizes[0]);
  const [requested, setPage] = useState(1);
  const count = items.length,
    pages = Math.max(1, Math.ceil(count / size)),
    page = Math.min(requested, pages);
  const start = (page - 1) * size;
  return {
    rows: items.slice(start, start + size),
    page,
    pages,
    count,
    start,
    size,
    sizes,
    setPage,
    setSize(value) {
      setSize(value);
      setPage(1);
    },
    reset() {
      setPage(1);
    },
  };
}

export function DirectoryPager({ list, noun, onNavigate }) {
  if (!list.count) return null;
  const go = page => { list.setPage(page); onNavigate?.(); };
  return (
    <nav className={s.pager} aria-label={"Paginação de " + noun}>
      <small role="status">
        {list.start + 1}–{Math.min(list.start + list.size, list.count)} de{" "}
        {list.count} {noun}
      </small>
      {list.count > list.sizes[0] && (
        <div className={s.pageOptions}>
          {list.sizes.length > 1 && <select
            aria-label="Itens por página"
            value={list.size}
            onChange={(e) => { list.setSize(Number(e.target.value)); onNavigate?.(); }}
          >
            {list.sizes.map((n) => (
              <option key={n} value={n}>
                {n} por página
              </option>
            ))}
          </select>}
          {list.pages > 1 && (
            <>
              <IconButton
                icon={ChevronLeft}
                size="sm"
                label="Anterior"
                disabled={list.page === 1}
                onClick={() => go(list.page - 1)}
              />
              <select
                aria-label="Ir para página"
                value={list.page}
                onChange={(e) => go(Number(e.target.value))}
              >
                {Array.from({ length: list.pages }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1} / {list.pages}
                  </option>
                ))}
              </select>
              <IconButton
                icon={ChevronRight}
                size="sm"
                label="Próxima"
                disabled={list.page === list.pages}
                onClick={() => go(list.page + 1)}
              />
            </>
          )}
        </div>
      )}
    </nav>
  );
}
export function Status({ children, tone = "neutral" }) {
  return (
    <span className={s.status} data-tone={tone}>
      {children}
    </span>
  );
}
