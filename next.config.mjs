const integrated = process.env.SALES_WEB_MODE === "integrated";
const packaging = integrated && Boolean(process.env.SALES_PACKAGE_ROOT);
const legacyPilot = !integrated && process.env.SALES_PORTAL_PILOT === "1" && process.env.NODE_ENV === "development";
export default {
  ...(integrated && !packaging ? {distDir: ".next-integrated"} : {output: "export"}),
  env: {NEXT_PUBLIC_SALES_MODE: integrated ? "integrated" : legacyPilot ? "legacy-pilot" : "demo"},
  ...(legacyPilot ? {distDir:".next-portal-pilot"} : {}),
  trailingSlash: true,
  transpilePackages: ["@content-ventures/design-system"],
  turbopack: {root: packaging ? process.env.SALES_PACKAGE_ROOT : import.meta.dirname},
  agentRules:false,
  devIndicators:false
};
