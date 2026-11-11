/**
 * Öffentliche Konfiguration (wird ins Browser-Bundle eingebettet).
 * Hier dürfen ausschließlich NEXT_PUBLIC_-Werte stehen – keine Geheimnisse.
 */
const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);

/**
 * Kennung dieser Landingpage für die Attribution (A = Aufwand-Rechner,
 * B = Forderungscheck, C = Multistep-Anfrage).
 */
const variant = clean(process.env.NEXT_PUBLIC_LANDING_VARIANT);
export const LANDING_VARIANT: string = variant && /^[A-Za-z0-9_-]{1,24}$/.test(variant) ? variant : "C";

/**
 * A/B-Test der Funnel-Länge:
 *  kurz         – vier Fragen + Kontakt (Standard)
 *  ausfuehrlich – zusätzlich die Branchenfrage
 *  split        – je Seitenaufruf zufällig 50/50
 * Unabhängig davon erzwingt ?fv=kurz bzw. ?fv=ausfuehrlich in der URL eine
 * Variante (z. B. je Anzeigengruppe).
 */
const funnelMode = clean(process.env.NEXT_PUBLIC_FUNNEL_VARIANT);
export const FUNNEL_VARIANT_MODE: "kurz" | "ausfuehrlich" | "split" =
  funnelMode === "ausfuehrlich" || funnelMode === "split" ? funnelMode : "kurz";

/** Optionaler Terminlink für die Bestätigungsansicht. Nur https-Adressen. */
const booking = clean(process.env.NEXT_PUBLIC_BOOKING_URL);
export const BOOKING_URL = booking && /^https:\/\/[^\s"'<>]+$/.test(booking) ? booking : undefined;
export const META_PIXEL_ID = clean(process.env.NEXT_PUBLIC_META_PIXEL_ID);
export const GA4_MEASUREMENT_ID = clean(process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID);
export const TRACKING_CONFIGURED = Boolean(META_PIXEL_ID || GA4_MEASUREMENT_ID);

export const SITE_URL = clean(process.env.NEXT_PUBLIC_SITE_URL)?.replace(/\/+$/, "");
export const ALLOW_INDEXING = clean(process.env.NEXT_PUBLIC_ALLOW_INDEXING) === "true" && Boolean(SITE_URL);
export const SHOW_PREVIEW_BAR =
  process.env.NODE_ENV !== "production" || clean(process.env.NEXT_PUBLIC_SHOW_PREVIEW_BAR) === "true";

/** Verifiziert am 10.11.2026 gegen https://www.pajisto.de/impressum. */
export const COMPANY = {
  name: "Pajisto Forderungsmanagement GmbH",
  street: "Karl-Grillenberger-Straße 1",
  city: "90402 Nürnberg",
  phoneDisplay: "0911 88187939",
  phoneHref: "tel:+4991188187939",
  imprintUrl: "https://www.pajisto.de/impressum",
  privacyUrl: "https://www.pajisto.de/datenschutz",
} as const;
