import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ALLOW_INDEXING, SITE_URL } from "@/lib/public-config";
import "./globals.css";

const title = "Offene Rechnungen? Wir kümmern uns. | Pajisto Forderungsmanagement";
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
  themeColor: "#f7f8f2",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
