import SalesAnalyzer from "../page";

export default async function Portal() {
  // Only the loopback API test harness mounts the contract-test client.
  if (process.env.NEXT_PUBLIC_SALES_MODE === "legacy-pilot") {
    const { PortalWorkspace } = await import("../portal-workspace");
    return <PortalWorkspace />;
  }
  return <SalesAnalyzer />;
}
