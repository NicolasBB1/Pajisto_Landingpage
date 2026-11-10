/**
 * Typsichere Event-Schnittstelle.
 *
 * Regeln:
 *  - Ohne Einwilligung wird nichts geladen und nichts gesendet; Events vor der
 *    Einwilligung werden verworfen, nicht nachgereicht.
 *  - Die Parameter sind auf Kategorien beschränkt. Namen, E-Mail, Telefon,
 *    Firmen, Beträge, Fallzahlen oder Freitext können über diese Typen gar
 *    nicht übergeben werden.
 *  - Das Meta-Standardevent "Lead" wird ausschließlich bei
 *    `lead_submit_success` ausgelöst, also nach bestätigter CRM-Speicherung.
 */
import type { Period, Route, Stage } from "./check";
import { getConsent } from "./consent";
import type { LeadErrorCode } from "./lead";
import { GA4_MEASUREMENT_ID, META_PIXEL_ID } from "./public-config";

export type FailureClass = LeadErrorCode | "network";

export interface AnalyticsEvents {
  check_start: { landing_variant: "A" | "B" };
  check_step_2: { route: Route };
  check_complete: { route: Route; stage: Stage; period: Period };
  result_cta_click: { route: Route };
  form_start: { route?: Route };
  lead_submit_success: { landing_variant: "A" | "B"; route?: Route };
  lead_submit_failure: { error_class: FailureClass };
}

export type AnalyticsEventName = keyof AnalyticsEvents;

type Fbq = ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown; callMethod?: (...a: unknown[]) => void };

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    /** Protokoll der tatsächlich ausgelösten Events (nur Kategorien) – für Tests und Debugging. */
    __pajistoEvents?: { name: string; params: Record<string, unknown> }[];
  }
}

let loaded = false;

function loadScript(src: string): void {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

/** Lädt die konfigurierten Tracking-Skripte. Nur nach erteilter Einwilligung aufrufen. */
export function loadTracking(): void {
  if (loaded || typeof window === "undefined" || getConsent() !== "granted") return;
  loaded = true;

  if (META_PIXEL_ID) {
    if (!window.fbq) {
      const fbq: Fbq = (...args: unknown[]) => {
        if (fbq.callMethod) fbq.callMethod(...args);
        else fbq.queue!.push(args);
      };
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = "2.0";
      fbq.queue = [];
      window.fbq = fbq;
      window._fbq = fbq;
      loadScript("https://connect.facebook.net/en_US/fbevents.js");
    }
    window.fbq!("consent", "grant");
    window.fbq!("init", META_PIXEL_ID);
    window.fbq!("track", "PageView");
  }

  if (GA4_MEASUREMENT_ID) {
    window.dataLayer = window.dataLayer ?? [];
    window.gtag = function gtag() {
      // gtag.js erwartet das arguments-Objekt, kein Array.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", GA4_MEASUREMENT_ID);
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_MEASUREMENT_ID)}`);
  }
}

/** Nach Widerruf: keine weiteren Events; bereits geladene Skripte werden stillgelegt. */
export function revokeTracking(): void {
  if (typeof window === "undefined") return;
  window.fbq?.("consent", "revoke");
  if (GA4_MEASUREMENT_ID) {
    (window as unknown as Record<string, unknown>)[`ga-disable-${GA4_MEASUREMENT_ID}`] = true;
  }
}

export function track<K extends AnalyticsEventName>(
  name: K,
  params: AnalyticsEvents[K],
  options: { eventId?: string } = {},
): void {
  if (typeof window === "undefined" || getConsent() !== "granted") return;
  loadTracking();

  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined));
  (window.__pajistoEvents ??= []).push({ name, params: clean });

  if (META_PIXEL_ID && window.fbq) {
    window.fbq("trackCustom", name, clean);
    if (name === "lead_submit_success") {
      // eventID ermöglicht die spätere Deduplizierung mit der Conversions API.
      window.fbq("track", "Lead", {}, options.eventId ? { eventID: options.eventId } : undefined);
    }
  }
  if (GA4_MEASUREMENT_ID && window.gtag) {
    window.gtag("event", name, clean);
  }
}
