"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { loadTracking, revokeTracking } from "@/lib/analytics";
import { getConsent, getServerConsent, setConsent, subscribeConsent } from "@/lib/consent";
import { COMPANY, GA4_MEASUREMENT_ID, META_PIXEL_ID, TRACKING_CONFIGURED } from "@/lib/public-config";

const OPEN_EVENT = "pajisto:open-consent";

/**
 * Einwilligungsabfrage für Meta Pixel / GA4. Erscheint nur, wenn überhaupt
 * eine Tracking-ID konfiguriert ist. "Ablehnen" und "Akzeptieren" sind
 * gleichwertig gestaltet; ohne Entscheidung wird nichts geladen.
 *
 * Hinweis: Text und Ausgestaltung sind ein technischer Stand und müssen vor
 * dem Livegang rechtlich geprüft bzw. durch ein CMP ersetzt werden.
 */
export function ConsentBanner() {
  const consent = useSyncExternalStore(subscribeConsent, getConsent, getServerConsent);
  const [mounted, setMounted] = useState(false);
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    setMounted(true);
    const open = () => setReopened(true);
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  useEffect(() => {
    if (consent === "granted") loadTracking();
  }, [consent]);

  if (!TRACKING_CONFIGURED || !mounted) return null;
  if (consent !== "unset" && !reopened) return null;

  const services = [META_PIXEL_ID ? "Meta Pixel" : null, GA4_MEASUREMENT_ID ? "Google Analytics 4" : null]
    .filter(Boolean)
    .join(" und ");

  function decide(value: "granted" | "denied") {
    if (value === "denied") revokeTracking();
    setConsent(value);
    setReopened(false);
  }

  return (
    <div className="consent" role="dialog" aria-modal="false" aria-labelledby="consent-title" data-testid="consent-banner">
      <div className="consent-text">
        <strong id="consent-title">Messung mit Ihrer Einwilligung</strong>
        <p>
          Wir möchten {services} einsetzen, um zu messen, welche Anzeigen zu Anfragen führen – nur mit Ihrer
          Einwilligung. Jederzeit änderbar über „Cookie-Einstellungen“ am Seitenende.{" "}
          <a href={COMPANY.privacyUrl} target="_blank" rel="noopener noreferrer">
            Datenschutzerklärung
          </a>
        </p>
      </div>
      <div className="consent-actions">
        <button type="button" className="btn btn-outline" onClick={() => decide("denied")} data-testid="consent-deny">
          Ablehnen
        </button>
        <button type="button" className="btn btn-outline" onClick={() => decide("granted")} data-testid="consent-accept">
          Akzeptieren
        </button>
      </div>
    </div>
  );
}

export function ConsentSettingsButton() {
  if (!TRACKING_CONFIGURED) return null;
  return (
    <button type="button" className="footer-link-btn" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
      Cookie-Einstellungen
    </button>
  );
}
