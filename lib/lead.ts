/**
 * Übergabemodell der Anfrage und dessen Validierung.
 *
 * Dieselbe Funktion `validateLead` läuft im Browser (sofortige Rückmeldung)
 * und im Server-Endpunkt (maßgebliche Prüfung). Der Server vertraut keinem
 * Wert aus dem Browser – auch das berechnete Volumen wird neu berechnet.
 */
import {
  MAX_AMOUNT,
  MAX_COUNT,
  PERIOD_BY_ROUTE,
  calculateVolume,
  isDebtorType,
  isRoute,
  isStage,
  type DebtorType,
  type Period,
  type Route,
  type Stage,
} from "./check";

export const LEAD_SOURCE = "Pajisto Landingpage Forderungscheck V2";

export const NEEDS = ["einzeln", "gelegentlich", "regelmaessig", "unklar"] as const;
export type Need = (typeof NEEDS)[number];

export const NEED_LABEL: Record<Need, string> = {
  einzeln: "Einzelne offene Forderung",
  gelegentlich: "Gelegentliche Zahlungsausfälle",
  regelmaessig: "Laufendes Forderungsmanagement",
  unklar: "Ich bin noch unsicher",
};

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
export type UtmKey = (typeof UTM_KEYS)[number];
export type Utm = Partial<Record<UtmKey, string>>;

export interface CheckContext {
  check_route: Route;
  claim_count: number;
  claim_period: Period;
  average_claim_amount_eur: number;
  claim_stage: Stage;
  debtor_customer_type: DebtorType;
  calculated_volume_eur: number;
}

export interface Lead {
  submission_id: string;
  source: typeof LEAD_SOURCE;
  landing_variant: "A" | "B";
  name: string;
  company: string;
  email: string;
  phone?: string;
  message?: string;
  need: Need;
  /** Fehlt vollständig, wenn der Besucher den Check übersprungen hat. */
  check?: CheckContext;
  utm: Utm;
}

export type LeadField = "name" | "company" | "email" | "phone" | "message" | "need";
export type FieldErrors = Partial<Record<LeadField, string>>;

export type LeadValidation =
  | { ok: true; lead: Lead }
  | { ok: false; fields: FieldErrors; reason: "fields" | "malformed" };

const LIMITS = { name: 120, company: 160, email: 254, phone: 40, message: 2000, utm: 200 };

// Steuerzeichen entfernen (Zeilenumbrüche bleiben nur in der Nachricht erhalten).
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function cleanLine(v: unknown): string {
  return typeof v === "string" ? v.replace(CONTROL, "").replace(/\s+/g, " ").trim() : "";
}
function cleanText(v: unknown): string {
  return typeof v === "string" ? v.replace(CONTROL, "").replace(/\r\n?/g, "\n").trim() : "";
}

// Pragmatische Syntaxprüfung; die Zustellbarkeit lässt sich ohnehin nicht prüfen.
const EMAIL_RE = /^[^\s@<>()[\],;:"]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
const SUBMISSION_ID_RE = /^[A-Za-z0-9-]{16,64}$/;

function parseCheck(raw: unknown): CheckContext | undefined | "invalid" {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object") return "invalid";
  const c = raw as Record<string, unknown>;
  const count = c.claim_count;
  const amount = c.average_claim_amount_eur;
  if (!isRoute(c.check_route) || !isStage(c.claim_stage) || !isDebtorType(c.debtor_customer_type)) return "invalid";
  if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 1 || count > MAX_COUNT) return "invalid";
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) return "invalid";
  const rounded = Math.round(amount * 100) / 100;
  return {
    check_route: c.check_route,
    claim_count: count,
    claim_period: PERIOD_BY_ROUTE[c.check_route],
    average_claim_amount_eur: rounded,
    claim_stage: c.claim_stage,
    debtor_customer_type: c.debtor_customer_type,
    // Nie den Wert aus dem Browser übernehmen.
    calculated_volume_eur: calculateVolume(c.check_route, count, rounded),
  };
}

function parseUtm(raw: unknown): Utm {
  const utm: Utm = {};
  if (!raw || typeof raw !== "object") return utm;
  for (const key of UTM_KEYS) {
    const v = cleanLine((raw as Record<string, unknown>)[key]).slice(0, LIMITS.utm);
    if (v) utm[key] = v;
  }
  return utm;
}

export function validateLead(raw: unknown): LeadValidation {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, fields: {}, reason: "malformed" };
  }
  const r = raw as Record<string, unknown>;
  const fields: FieldErrors = {};

  const name = cleanLine(r.name);
  if (!name) fields.name = "Bitte geben Sie Ihren Namen an.";
  else if (name.length < 2) fields.name = "Bitte geben Sie Ihren vollständigen Namen an.";
  else if (name.length > LIMITS.name) fields.name = `Bitte kürzen Sie den Namen auf höchstens ${LIMITS.name} Zeichen.`;

  const company = cleanLine(r.company);
  if (!company) fields.company = "Bitte geben Sie Ihr Unternehmen an.";
  else if (company.length < 2) fields.company = "Bitte geben Sie den Namen Ihres Unternehmens an.";
  else if (company.length > LIMITS.company)
    fields.company = `Bitte kürzen Sie den Firmennamen auf höchstens ${LIMITS.company} Zeichen.`;

  const email = cleanLine(r.email).toLowerCase();
  if (!email) fields.email = "Bitte geben Sie Ihre geschäftliche E-Mail-Adresse an.";
  else if (email.length > LIMITS.email || !EMAIL_RE.test(email))
    fields.email = "Bitte prüfen Sie die E-Mail-Adresse, zum Beispiel name@unternehmen.de.";

  const phone = cleanLine(r.phone);
  if (phone) {
    const digits = phone.replace(/\D/g, "").length;
    if (phone.length > LIMITS.phone || !/^[0-9+()\/\s.-]+$/.test(phone) || digits < 6 || digits > 20) {
      fields.phone = "Bitte prüfen Sie die Telefonnummer oder lassen Sie das Feld leer.";
    }
  }

  const message = cleanText(r.message);
  if (message.length > LIMITS.message)
    fields.message = `Bitte kürzen Sie die Nachricht auf höchstens ${LIMITS.message} Zeichen.`;

  const need = r.need === undefined || r.need === "" ? "unklar" : r.need;
  if (typeof need !== "string" || !(NEEDS as readonly string[]).includes(need)) {
    fields.need = "Bitte wählen Sie eine der Möglichkeiten aus.";
  }

  if (Object.keys(fields).length > 0) return { ok: false, fields, reason: "fields" };

  const check = parseCheck(r.check);
  const submissionId = typeof r.submission_id === "string" ? r.submission_id : "";
  if (check === "invalid" || !SUBMISSION_ID_RE.test(submissionId)) {
    return { ok: false, fields: {}, reason: "malformed" };
  }

  return {
    ok: true,
    lead: {
      submission_id: submissionId,
      source: LEAD_SOURCE,
      landing_variant: r.landing_variant === "A" ? "A" : "B",
      name,
      company,
      email,
      ...(phone ? { phone } : {}),
      ...(message ? { message } : {}),
      need: need as Need,
      ...(check ? { check } : {}),
      utm: parseUtm(r.utm),
    },
  };
}

/** Antwortformat von POST /api/lead. Enthält nie personenbezogene Daten. */
export type LeadErrorCode =
  | "validation"
  | "rejected"
  | "rate_limited"
  | "not_configured"
  | "crm_unavailable"
  | "bad_request";

export type LeadApiResponse =
  | { ok: true; mode: "close" | "mock"; event_id: string }
  | { ok: false; error: LeadErrorCode; fields?: FieldErrors };
