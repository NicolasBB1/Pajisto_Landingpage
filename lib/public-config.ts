/**
 * Öffentliche Konfiguration (wird ins Browser-Bundle eingebettet).
 * Hier dürfen ausschließlich NEXT_PUBLIC_-Werte stehen – keine Geheimnisse.
 */
const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);

export const LANDING_VARIANT: "A" | "B" = clean(process.env.NEXT_PUBLIC_LANDING_VARIANT) === "A" ? "A" : "B";
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
