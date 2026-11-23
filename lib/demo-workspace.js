import { portalEnabled } from "./official-portal";

// The small shop and the larger network keep independent saved edits.
export function isShowroom() {
  return typeof window !== "undefined" && !portalEnabled &&
    new URLSearchParams(window.location.search).get("demo") !== "loja";
}
export function workspaceKey(key) {
  return isShowroom() ? "aurora-rede." + key : key;
}
