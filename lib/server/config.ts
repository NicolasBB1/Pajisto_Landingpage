/**
 * Serverseitige Konfiguration aus Environment-Variablen.
 * Diese Datei darf nie in Client-Komponenten importiert werden.
 */
import type { CloseConfig } from "../close";

export type LeadMode = "mock" | "close" | "disabled";

type Env = Record<string, string | undefined>;

const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);

/**
 * - LEAD_MODE=mock  → Demo, es wird nichts versendet.
 * - LEAD_MODE=close → Close CRM; ohne CLOSE_API_KEY gilt das Formular als
 *                     nicht angebunden ("disabled").
 * - nicht gesetzt   → lokal "mock", im Produktions-Build "disabled". Es gibt
 *                     also nie einen stillen Demo-Betrieb in Produktion.
 */
export function getLeadMode(env: Env = process.env): LeadMode {
  const mode = clean(env.LEAD_MODE)?.toLowerCase();
  if (mode === "mock") return "mock";
  if (mode === "close") return clean(env.CLOSE_API_KEY) ? "close" : "disabled";
  return env.NODE_ENV === "production" ? "disabled" : "mock";
}

export function getCloseConfig(env: Env = process.env): CloseConfig | null {
  const apiKey = clean(env.CLOSE_API_KEY);
  if (!apiKey) return null;
  // Abweichende Basis-URL ausschließlich für lokale Tests gegen einen Mock-Server.
  const baseUrl = env.NODE_ENV === "production" ? undefined : clean(env.CLOSE_API_BASE_URL);
  return {
    apiKey,
    ...(baseUrl ? { baseUrl } : {}),
    leadStatusId: clean(env.CLOSE_LEAD_STATUS_ID),
    fields: {
      frequencyChoice: clean(env.CLOSE_CF_FREQUENCY_CHOICE),
      checkRoute: clean(env.CLOSE_CF_CHECK_ROUTE),
      claimsPeriod: clean(env.CLOSE_CF_CLAIMS_PERIOD),
      avgAmount: clean(env.CLOSE_CF_AVG_AMOUNT),
      stage: clean(env.CLOSE_CF_STAGE),
      debtorType: clean(env.CLOSE_CF_DEBTOR_TYPE),
      landingVariant: clean(env.CLOSE_CF_LANDING_VARIANT),
      utmSource: clean(env.CLOSE_CF_UTM_SOURCE),
      utmCampaign: clean(env.CLOSE_CF_UTM_CAMPAIGN),
    },
  };
}
