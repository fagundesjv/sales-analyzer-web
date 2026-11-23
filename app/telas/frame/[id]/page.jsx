import { PreviewEntry } from "./preview-entry";

const frames = [
  "portal-radar",
  "portal-inicio",
  "portal-vendedor",
  "portal-vendedor-conversas",
  "portal-conversas",
  "portal-empresa",
  "portal-produtos",
  "portal-equipe",
  "portal-whatsapps",
  "portal-diagnosticos",
  "portal-relatorio",
];
export const dynamicParams = false;
export const metadata = { title: "Sales Analyzer" };
export function generateStaticParams() {
  return frames.map((id) => ({ id }));
}
export default async function Page({ params }) {
  const { id } = await params;
  return <PreviewEntry id={id} />;
}
