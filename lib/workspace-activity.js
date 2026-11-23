import { workspaceKey } from "./demo-workspace";
import { localDate } from "./inbox";

const prefix = () => workspaceKey("sales-v2.atividade.");
export function dayKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
export function minutesOn(day, person = false) {
  try {
    return JSON.parse(localStorage.getItem(prefix() + day + (person ? ".self" : "")) || "[]").length;
  } catch {
    return 0;
  }
}
export function clearActivity() {
  try {
    for (const key of Object.keys(localStorage))
      if (key.startsWith(prefix())) localStorage.removeItem(key);
  } catch {
    /* Local storage may be disabled. */
  }
}
// Count distinct minutes with an interaction, including repeated visits in the same browser.
export function observeActivity() {
  let lastMinute = -1;
  function mark() {
    if (document.hidden) return;
    const now = new Date();
    const minute = Math.floor(now.getTime() / 60000);
    if (lastMinute === minute) return;
    lastMinute = minute;
    try {
      const key = prefix() + dayKey(now);
      for (const bucket of [key, key + ".self"]) {
        const minutes = new Set(JSON.parse(localStorage.getItem(bucket) || "[]"));
        minutes.add(minute);
        localStorage.setItem(bucket, JSON.stringify([...minutes]));
      }
      window.dispatchEvent(new Event("workspace-activity"));
    } catch {
      /* The rest of the operation also works in memory. */
    }
  }
  try {
    const oldest = prefix() + localDate(-90);
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(prefix()) && key < oldest) localStorage.removeItem(key);
    }
  } catch {
    /* Optional browser storage. */
  }
  document.addEventListener("pointerdown", mark);
  document.addEventListener("keydown", mark);
  document.addEventListener("scroll", mark, { capture: true, passive: true });
  return () => {
    document.removeEventListener("pointerdown", mark);
    document.removeEventListener("keydown", mark);
    document.removeEventListener("scroll", mark, true);
  };
}
