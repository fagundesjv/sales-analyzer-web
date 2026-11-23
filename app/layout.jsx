import { interV3 } from "@content-ventures/design-system/v3";
import "./globals.css";
import "./workspace.css";
export const metadata = {
  icons: {icon:"/assets/sales-mark.svg"},
  description:
    "Recupere vendas pela análise das conversas e dos retornos da operação comercial.",
  robots: { index: false, follow: false },
};
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};
export default function Layout({ children }) {
  return (
    <html lang="pt-BR" className={interV3.variable}>
      <body>{children}</body>
    </html>
  );
}
