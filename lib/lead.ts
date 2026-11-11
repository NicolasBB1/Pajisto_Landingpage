/**
 * Übergabemodell der Anfrage und dessen Validierung.
 *
 * Dieselbe Funktion `validateLead` läuft im Browser (sofortige Rückmeldung)
 * und im Server-Endpunkt (maßgebliche Prüfung). Der Server vertraut keinem
 * Wert aus dem Browser: Segment und Quelle werden serverseitig gesetzt.
 */
import {
  LEAD_SOURCE,
  isAmount,
  isContactPreference,
  isDebtor,
  isFrequency,
  isFunnelVariant,
  isIndustry,
  isStage,
  segmentOf,
  type Amount,
  type ContactPreference,
  type Debtor,
  type Frequency,
  type FunnelVariant,
  type Industry,
  type Segment,
  type Stage,
} from "./funnel";

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
export type UtmKey = (typeof UTM_KEYS)[number];
export type Utm = Partial<Record<UtmKey, string>>;

/** Herkunft ohne Personenbezug: nur Seitenpfad und Hostname der verweisenden Seite. */
export interface Origin {
  page_path?: string;
  referrer_host?: string;
}

export interface Lead {
  submission_id: string;
  source: typeof LEAD_SOURCE;
  landing_variant: string;
  funnel_variant: FunnelVariant;
  segment: Segment;
  frequency: Frequency;
  amount: Amount;
  debtor: Debtor;
  stage: Stage;
  industry?: Industry;
  name: string;
  company: string;
  email: string;
  phone?: string;
  contact_preference: ContactPreference;
  utm: Utm;
  origin: Origin;
}

export type LeadField = "name" | "company" | "email" | "phone" | "contact_preference";
export type FieldErrors = Partial<Record<LeadField, string>>;

export type LeadValidation =
  | { ok: true; lead: Lead }
  | { ok: false; fields: FieldErrors; reason: "fields" | "malformed" };

const LIMITS = { name: 120, company: 160, email: 254, phone: 40, utm: 200 };

// Steuerzeichen entfernen.
const CONTROL = /[\u0000-\u001F\u007F]/g;
const cleanLine = (v: unknown) => (typeof v === "string" ? v.replace(CONTROL, " ").replace(/\s+/g, " ").trim() : "");

// Pragmatische Syntaxprüfung; die Zustellbarkeit lässt sich ohnehin nicht prüfen.
const EMAIL_RE = /^[^\s@<>()[\],;:"]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
const SUBMISSION_ID_RE = /^[A-Za-z0-9-]{16,64}$/;
const VARIANT_RE = /^[A-Za-z0-9_-]{1,24}$/;
const HOST_RE = /^[a-z0-9.-]{1,253}$/;

function parseUtm(raw: unknown): Utm {
  const utm: Utm = {};
  if (!raw || typeof raw !== "object") return utm;
  for (const key of UTM_KEYS) {
    const v = cleanLine((raw as Record<string, unknown>)[key]).slice(0, LIMITS.utm);
    if (v) utm[key] = v;
  }
  return utm;
}

function parseOrigin(raw: unknown): Origin {
  const origin: Origin = {};
  if (!raw || typeof raw !== "object") return origin;
  const r = raw as Record<string, unknown>;
  // Nur der Pfad – Query-Parameter könnten Klick-IDs enthalten.
  const path = cleanLine(r.page_path).split(/[?#]/)[0]!.slice(0, 120);
  if (path.startsWith("/")) origin.page_path = path;
  const host = cleanLine(r.referrer_host).toLowerCase();
  if (HOST_RE.test(host)) origin.referrer_host = host;
  return origin;
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

  const preference = r.contact_preference === undefined || r.contact_preference === "" ? "email" : r.contact_preference;
  if (!isContactPreference(preference)) {
    fields.contact_preference = "Bitte wählen Sie, wie wir Sie erreichen sollen.";
  }

  const phone = cleanLine(r.phone);
  if (phone) {
    const digits = phone.replace(/\D/g, "").length;
    if (phone.length > LIMITS.phone || !/^[0-9+()\/\s.-]+$/.test(phone) || digits < 6 || digits > 20) {
      fields.phone =
        preference === "rueckruf"
          ? "Bitte prüfen Sie die Telefonnummer."
          : "Bitte prüfen Sie die Telefonnummer oder lassen Sie das Feld leer.";
    }
  } else if (preference === "rueckruf") {
    fields.phone = "Für einen Rückruf benötigen wir Ihre Telefonnummer.";
  }

  if (Object.keys(fields).length > 0) return { ok: false, fields, reason: "fields" };

  const submissionId = typeof r.submission_id === "string" ? r.submission_id : "";
  const landingVariant = typeof r.landing_variant === "string" ? r.landing_variant : "";
  const industry = r.industry === undefined || r.industry === null || r.industry === "" ? undefined : r.industry;
  if (
    !SUBMISSION_ID_RE.test(submissionId) ||
    !VARIANT_RE.test(landingVariant) ||
    !isFunnelVariant(r.funnel_variant) ||
    !isFrequency(r.frequency) ||
    !isAmount(r.amount) ||
    !isDebtor(r.debtor) ||
    !isStage(r.stage) ||
    (industry !== undefined && !isIndustry(industry))
  ) {
    return { ok: false, fields: {}, reason: "malformed" };
  }

  return {
    ok: true,
    lead: {
      submission_id: submissionId,
      source: LEAD_SOURCE,
      landing_variant: landingVariant,
      funnel_variant: r.funnel_variant,
      // Nie aus dem Browser übernehmen.
      segment: segmentOf(r.frequency),
      frequency: r.frequency,
      amount: r.amount,
      debtor: r.debtor,
      stage: r.stage,
      ...(industry ? { industry: industry as Industry } : {}),
      name,
      company,
      email,
      ...(phone ? { phone } : {}),
      contact_preference: preference as ContactPreference,
      utm: parseUtm(r.utm),
      origin: parseOrigin(r.origin),
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
