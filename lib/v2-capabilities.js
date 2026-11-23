// The build flag permits a rollout. Only the authenticated API can declare readiness.
export function canCreateWhatsApp(manager, connections) {
  return manager === true && process.env.NEXT_PUBLIC_SALES_WHATSAPP_SELF_SERVE === "enabled" &&
    connections?.capabilities?.whatsappSelfServe === true;
}

export function isWhatsAppLine(line) {
  return line?.channel === "whatsapp" || line?.source === "whatsapp" || line?.source === "evolution";
}
