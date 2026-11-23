import { emptyFocusRound, FOCUS_DURATION_MS, focusRoundReducer } from "./official/focus";
export function currentModel(f, now = Date.now()) {
  const saved = f?.model;
  if (saved && [saved.elapsedMs, saved.activeMs, saved.lastTick, saved.lastInteraction].every(Number.isFinite)) return saved;
  const start = focusRoundReducer(emptyFocusRound(), {type:"start", now});
  if (!f) return start;
  const remainingMs = f.paused && Number.isFinite(f.left) ? f.left * 1000 :
    Number.isFinite(f.end) ? f.end - now : FOCUS_DURATION_MS;
  const elapsedMs = Number.isFinite(saved?.elapsedMs) ? saved.elapsedMs : Math.max(0, Math.min(FOCUS_DURATION_MS, FOCUS_DURATION_MS - remainingMs));
  return {
    ...start, ...saved, phase:f.paused ? "paused" : "running", elapsedMs,
    activeMs: Number.isFinite(saved?.activeMs) ? Math.min(elapsedMs,saved.activeMs) : 0,
    lastTick: now, lastInteraction: now,
  };
}
export function focusUpdate(f, event) {
  const model = focusRoundReducer(currentModel(f, event.now), event);
  const remaining = Math.ceil((FOCUS_DURATION_MS - model.elapsedMs) / 1000);
  return {
    ...f,
    model,
    paused: model.phase === "paused",
    left: remaining,
    end: event.now + remaining * 1000,
  };
}
export function focusReceipt(f) {
  return { ...f.model, actor:"Você (prévia)", owner: f.owner || "Toda a equipe", at: Date.now() };
}
