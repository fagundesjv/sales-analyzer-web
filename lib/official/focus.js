/** Proposed review-round semantics. This module does not collect or persist employee telemetry. */
export const FOCUS_DURATION_MS = 10 * 60_000;
export const FOCUS_IDLE_MS = 90_000;
export const FOCUS_HOURS = [8, 9, 10, 11, 13, 14, 15, 16];
export function emptyFocusRound() {
    return { phase: "idle", elapsedMs: 0, activeMs: 0, lastTick: 0, lastInteraction: 0, reason: null, opened: [], replies: [], concluded: [], wins: {} };
}
function advance(round, now) {
    if (round.phase !== "running" || !Number.isFinite(now) || now <= round.lastTick)
        return round;
    const elapsed = Math.min(now - round.lastTick, FOCUS_DURATION_MS - round.elapsedMs);
    const active = Math.min(elapsed, Math.max(0, round.lastInteraction + FOCUS_IDLE_MS - round.lastTick));
    const elapsedMs = round.elapsedMs + elapsed;
    return { ...round, elapsedMs, activeMs: round.activeMs + active, lastTick: now, phase: elapsedMs >= FOCUS_DURATION_MS ? "completed" : "running" };
}
export function focusRoundReducer(round, event) {
    if (!Number.isFinite(event.now) || event.now < round.lastTick)
        return round;
    if (event.type === "start")
        return round.phase === "running" || round.phase === "paused" ? round : { ...emptyFocusRound(), phase: "running", lastTick: event.now, lastInteraction: event.now };
    if (event.type === "resume")
        return round.phase !== "paused" ? round : { ...round, phase: "running", lastTick: event.now, lastInteraction: event.now, reason: null };
    // Hidden tabs accrue nothing after the last observed foreground tick.
    if (event.type === "away")
        return round.phase !== "running" ? round : { ...round, phase: "paused", lastTick: event.now, reason: "away" };
    const next = advance(round, event.now);
    if (event.type === "end")
        return next.phase === "running" || next.phase === "paused" ? { ...next, phase: "interrupted" } : next;
    if (event.type === "pause")
        return next.phase !== "running" ? next : { ...next, phase: "paused", reason: "manual" };
    if (next.phase !== "running")
        return next;
    if (event.type === "activity")
        return { ...next, lastInteraction: event.now };
    if (event.type !== "action" || !event.id.trim())
        return next;
    const result = { ...next, lastInteraction: event.now };
    if (event.kind === "won") {
        const cents = event.amountCents;
        return !Number.isSafeInteger(cents) || cents <= 0 ? result : { ...result, wins: { ...result.wins, [event.id]: cents } };
    }
    return next[event.kind].includes(event.id) ? result : { ...result, [event.kind]: [...next[event.kind], event.id] };
}
export function focusClock(elapsedMs) {
    const seconds = Math.max(0, Math.ceil((FOCUS_DURATION_MS - elapsedMs) / 1000));
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
export const focusDayTargetMinutes = (hours = FOCUS_HOURS.length) => Math.max(0, Math.trunc(hours)) * 10;
export function focusWindow(hour, minute) {
    const start = hour * 60 + minute, end = start + 10;
    const label = (total) => `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
    return `${label(start)}–${label(end)}`;
}
