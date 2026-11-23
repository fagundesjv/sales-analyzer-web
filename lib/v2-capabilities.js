// Opt in only after the deployed API, provisioner and credential isolation are verified.
export const selfServeWhatsApp = process.env.NEXT_PUBLIC_SALES_WHATSAPP_SELF_SERVE === "enabled";
