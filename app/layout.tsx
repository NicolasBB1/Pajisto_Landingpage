import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
import type { ReactNode } from "react";
import { ALLOW_INDEXING, SITE_URL } from "@/lib/public-config";
import "./globals.css";

// Markenschriften laut Brand Board. next/font lädt sie beim Build herunter und
// liefert sie von der eigenen Domain aus – der Browser der Besucher spricht
// nie mit Google.
const montserrat = Montserrat({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-montserrat", display: "swap" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-inter", display: "swap" });

const title = "Offene Rechnungen? Wir übernehmen das. | Pajisto Forderungsmanagement";
const description =
  "Ob eine einzelne offene Rechnung oder wiederkehrende Zahlungsausfälle: Pajisto unterstützt Unternehmen bei der professionellen Durchsetzung ihrer Forderungen. Jetzt den kurzen Forderungscheck machen und unverbindlich anfragen.";

export const metadata: Metadata = {
  title,
  description,
  // Testdeployments bleiben noindex. Indexierung nur mit feststehender Domain
  // und ausdrücklicher Freigabe (NEXT_PUBLIC_ALLOW_INDEXING=true).
  robots: ALLOW_INDEXING ? { index: true, follow: true } : { index: false, follow: false },
  ...(SITE_URL
    ? {
        metadataBase: new URL(SITE_URL),
        alternates: { canonical: "/" },
        openGraph: { type: "website", locale: "de_DE", url: "/", siteName: "Pajisto", title, description },
      }
    : {}),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#363636",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" className={`${montserrat.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
