/**
 * Close-CRM-Adapter (nur serverseitig verwenden).
 *
 * Grundlage: developer.close.com – HTTP Basic Auth (API-Key als Benutzername,
 * leeres Passwort), POST /lead/, POST /activity/note/, POST /data/search/.
 *
 * Strategie gegen Dubletten und ungewollte Zusammenführung:
 *  1. Suche nach Leads, die einen Kontakt mit exakt dieser E-Mail haben.
 *  2. Treffer  → am bestehenden Lead wird NUR eine Notiz angelegt. Es werden
 *                keine Felder überschrieben. Weicht der Firmenname ab oder gibt
 *                es mehrere Treffer, trägt die Notiz einen Prüfhinweis.
 *  3. Kein Treffer → neuer Lead mit Kontakt. Existiert bereits ein Lead mit
 *                gleichem Firmennamen, wird NICHT zusammengeführt, sondern ein
 *                Dublettenhinweis in die Beschreibung geschrieben.
 *
 * Jeder Pfad endet in genau einem schreibenden Aufruf – es gibt also keinen
 * Zustand "Lead angelegt, aber Kontext verloren". Es werden keine
 * Opportunities, Aufgaben oder E-Mails erzeugt.
 *
 * In Logs und Fehlern landen ausschließlich Fehlerklasse und HTTP-Status,
 * niemals API-Key, Kontaktdaten oder Antwortinhalte von Close.
 */
import { DEBTOR_LABEL, STAGE_LABEL, countPhrase, formatEuro, type Route } from "./check";
import { NEED_LABEL, type Lead } from "./lead";

export const CLOSE_API_BASE = "https://api.close.com/api/v1";

export interface CloseFieldMap {
  /** Vorhandenes Auswahlfeld "Wie oft kommen bei Ihnen offene Forderungen vor?" */
  frequencyChoice?: string;
  checkRoute?: string;
  claimsPeriod?: string;
  avgAmount?: string;
  stage?: string;
  debtorType?: string;
  landingVariant?: string;
  utmSource?: string;
  utmCampaign?: string;
}

export interface CloseConfig {
  apiKey: string;
  baseUrl?: string;
  leadStatusId?: string;
  fields?: CloseFieldMap;
  /** Für Tests austauschbar. */
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  /** Obergrenze, wie lange bei 429 insgesamt gewartet wird. */
  maxRateLimitWaitMs?: number;
}

export type CloseErrorKind =
  | "bad_request" // 400 – Anfrage/Schema passt nicht
  | "auth" // 401 – Key fehlt/ungültig
  | "forbidden" // 403 – Key hat keine Berechtigung
  | "rate_limited" // 429 – auch nach Backoff
  | "server" // 5xx
  | "network" // Timeout/Verbindungsfehler
  | "unexpected";

export class CloseError extends Error {
  constructor(
    public readonly kind: CloseErrorKind,
    public readonly status?: number,
  ) {
    super(`Close API: ${kind}${status ? ` (${status})` : ""}`);
    this.name = "CloseError";
  }
}

export type CloseOutcome =
  | "lead_created"
  | "lead_created_possible_duplicate"
  | "note_on_existing_lead"
  | "note_on_existing_lead_review";

export interface CloseResult {
  outcome: CloseOutcome;
  leadId: string;
}

/** Werte des bereits vorhandenen Close-Auswahlfelds (Schreibweise exakt wie im Konto). */
export const FREQUENCY_CHOICE: Record<Route, string> = {
  einzeln: "Einmalig oder selten",
  gelegentlich: "Mehrmals im jahr",
  regelmaessig: "Mehrmals im Monat",
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function authHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

function classify(status: number): CloseErrorKind {
  if (status === 400) return "bad_request";
  if (status === 401) return "auth";
  if (status === 403) return "forbidden";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server";
  return "unexpected";
}

/** Wartezeit bei 429: bevorzugt `rate_reset` aus dem Body, sonst `retry-after`. */
function rateResetMs(res: Response, body: unknown): number {
  const fromBody = (() => {
    if (!body || typeof body !== "object") return NaN;
    const b = body as Record<string, unknown>;
    const nested = b.error && typeof b.error === "object" ? (b.error as Record<string, unknown>).rate_reset : undefined;
    return Number(nested ?? b.rate_reset);
  })();
  const fromHeader = Number(res.headers.get("retry-after"));
  const seconds = Number.isFinite(fromBody) && fromBody >= 0 ? fromBody : fromHeader;
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds * 1000) : 1000;
}

async function request(cfg: CloseConfig, method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
  const doFetch = cfg.fetchImpl ?? fetch;
  const sleep = cfg.sleep ?? defaultSleep;
  const maxWait = cfg.maxRateLimitWaitMs ?? 6000;
  let waited = 0;

  for (;;) {
    let res: Response;
    try {
      res = await doFetch(`${cfg.baseUrl ?? CLOSE_API_BASE}${path}`, {
        method,
        headers: {
          Authorization: authHeader(cfg.apiKey),
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(cfg.timeoutMs ?? 8000),
        cache: "no-store",
      });
    } catch {
      throw new CloseError("network");
    }

    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      /* Body ist optional bzw. kein JSON */
    }

    if (res.ok) return json;

    if (res.status === 429) {
      // Laut Close-Doku wurde die Anfrage nicht verarbeitet → Wiederholung ist sicher.
      const wait = rateResetMs(res, json);
      if (waited + wait <= maxWait) {
        waited += wait;
        await sleep(wait);
        continue;
      }
    }
    // 5xx wird bewusst NICHT automatisch wiederholt: Bei einem POST ist unklar,
    // ob der Lead bereits angelegt wurde. Der Besucher kann erneut senden; die
    // E-Mail-Suche verhindert dann einen zweiten Lead.
    throw new CloseError(classify(res.status), res.status);
  }
}

function normalizeCompany(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(gmbh|mbh|ug|ag|kg|ohg|gbr|e\.?\s?k\.?|e\.?\s?v\.?|co|haftungsbeschrankt)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

interface FoundLead {
  id: string;
  display_name: string;
}

function parseLeads(json: unknown): FoundLead[] {
  const data = json && typeof json === "object" ? (json as { data?: unknown }).data : undefined;
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const o = item as Record<string, unknown>;
    return typeof o.id === "string" ? [{ id: o.id, display_name: typeof o.display_name === "string" ? o.display_name : "" }] : [];
  });
}

export function emailSearchQuery(email: string) {
  return {
    query: {
      type: "and",
      queries: [
        { type: "object_type", object_type: "lead" },
        {
          type: "has_related",
          this_object_type: "lead",
          related_object_type: "contact",
          related_query: {
            type: "has_related",
            this_object_type: "contact",
            related_object_type: "contact_email",
            related_query: {
              type: "field_condition",
              field: { type: "regular_field", object_type: "contact_email", field_name: "email" },
              condition: { type: "text", mode: "exact_value", value: email },
            },
          },
        },
      ],
    },
    _fields: { lead: ["id", "display_name"] },
    _limit: 5,
  };
}

export function companySearchQuery(company: string) {
  return {
    query: {
      type: "and",
      queries: [
        { type: "object_type", object_type: "lead" },
        {
          type: "field_condition",
          field: { type: "regular_field", object_type: "lead", field_name: "name" },
          condition: { type: "text", mode: "exact_value", value: company },
        },
      ],
    },
    _fields: { lead: ["id", "display_name"] },
    _limit: 3,
  };
}

/** Strukturierter Kontext als lesbarer Text für Beschreibung bzw. Notiz. */
export function buildContextText(lead: Lead, extraLines: string[] = []): string {
  const lines: string[] = [`Quelle: ${lead.source}`, `Landing Variant: ${lead.landing_variant}`];
  lines.push(`Anliegen: ${NEED_LABEL[lead.need]}`);
  if (lead.check) {
    const c = lead.check;
    lines.push(
      `Check Route: ${c.check_route}`,
      `Fälle/Zeitraum: ${countPhrase(c.check_route, c.claim_count)}`,
      `Ø Forderung: ${formatEuro(c.average_claim_amount_eur)}`,
      `Stadium: ${STAGE_LABEL[c.claim_stage]}`,
      `Kundentyp: ${DEBTOR_LABEL[c.debtor_customer_type]}`,
      `Rechnerisches Volumen: ${formatEuro(c.calculated_volume_eur)}${c.claim_period === "month" ? " (Hochrechnung 12 Monate)" : ""}`,
    );
  } else {
    lines.push("Forderungscheck: nicht ausgefüllt (Direktanfrage)");
  }
  const utm = Object.entries(lead.utm).map(([k, v]) => `${k}=${v}`);
  if (utm.length) lines.push(`UTM: ${utm.join(" · ")}`);
  lines.push(...extraLines);
  if (lead.message) lines.push("", "Nachricht:", lead.message);
  return lines.join("\n");
}

export function buildCustomFields(lead: Lead, map: CloseFieldMap = {}): Record<string, string> {
  const out: Record<string, string> = {};
  const set = (id: string | undefined, value: string | undefined) => {
    if (id && value) out[`custom.${id}`] = value;
  };
  set(map.landingVariant, lead.landing_variant);
  set(map.utmSource, lead.utm.utm_source);
  set(map.utmCampaign, lead.utm.utm_campaign);
  if (lead.check) {
    const c = lead.check;
    set(map.frequencyChoice, FREQUENCY_CHOICE[c.check_route]);
    set(map.checkRoute, c.check_route);
    set(map.claimsPeriod, countPhrase(c.check_route, c.claim_count));
    set(map.avgAmount, formatEuro(c.average_claim_amount_eur));
    set(map.stage, c.claim_stage);
    set(map.debtorType, c.debtor_customer_type);
  }
  return out;
}

export async function submitLeadToClose(lead: Lead, cfg: CloseConfig): Promise<CloseResult> {
  const byEmail = parseLeads(await request(cfg, "POST", "/data/search/", emailSearchQuery(lead.email)));

  if (byEmail.length > 0) {
    const target = byEmail[0]!;
    const sameCompany = normalizeCompany(target.display_name) === normalizeCompany(lead.company);
    const review: string[] = [];
    if (!sameCompany) {
      review.push(
        `BITTE PRÜFEN: Die E-Mail-Adresse ist bereits diesem Lead zugeordnet, in der Anfrage wurde aber das Unternehmen "${lead.company}" angegeben. Es wurde nichts überschrieben.`,
      );
    }
    if (byEmail.length > 1) {
      review.push(`BITTE PRÜFEN: Die E-Mail-Adresse kommt in ${byEmail.length} Leads vor (mögliche Dubletten).`);
    }
    const contact = [`Kontakt laut Anfrage: ${lead.name}, ${lead.email}${lead.phone ? `, ${lead.phone}` : ""}`];
    await request(cfg, "POST", "/activity/note/", {
      lead_id: target.id,
      note: `Neue Anfrage über die Landingpage\n\n${buildContextText(lead, [...contact, ...review])}`,
    });
    return {
      outcome: review.length ? "note_on_existing_lead_review" : "note_on_existing_lead",
      leadId: target.id,
    };
  }

  // Firmenabgleich ist nur ein Hinweis für den Vertrieb und darf die Anlage nie blockieren.
  let duplicateHint: string[] = [];
  try {
    const byCompany = parseLeads(await request(cfg, "POST", "/data/search/", companySearchQuery(lead.company)));
    if (byCompany.length > 0) {
      duplicateHint = [
        `BITTE PRÜFEN: Es existiert bereits ein Lead mit gleichem Firmennamen (${byCompany.map((l) => l.id).join(", ")}). Nicht automatisch zusammengeführt.`,
      ];
    }
  } catch (err) {
    if (err instanceof CloseError && (err.kind === "auth" || err.kind === "forbidden")) throw err;
  }

  const basePayload = {
    name: lead.company,
    description: buildContextText(lead, duplicateHint),
    ...(cfg.leadStatusId ? { status_id: cfg.leadStatusId } : {}),
    contacts: [
      {
        name: lead.name,
        emails: [{ email: lead.email, type: "office" }],
        ...(lead.phone ? { phones: [{ phone: lead.phone, type: "office" }] } : {}),
      },
    ],
  };
  const custom = buildCustomFields(lead, cfg.fields);

  let created: unknown;
  try {
    created = await request(cfg, "POST", "/lead/", { ...basePayload, ...custom });
  } catch (err) {
    // Ein falsch konfiguriertes Custom Field (ID, Feldtyp, Auswahlwert) oder
    // eine nicht parsebare Telefonnummer darf keine Anfrage kosten: einmal ohne
    // diese optionalen Angaben wiederholen. Der vollständige Kontext inklusive
    // Telefonnummer steht dann in der Beschreibung.
    const hasOptional = Object.keys(custom).length > 0 || Boolean(lead.phone);
    if (!(err instanceof CloseError) || err.kind !== "bad_request" || !hasOptional) throw err;
    console.warn("[close] Lead-Anlage mit optionalen Feldern abgelehnt (400) – Wiederholung ohne Custom Fields/Telefon.");
    const fallbackHints = [...duplicateHint, ...(lead.phone ? [`Telefon laut Anfrage: ${lead.phone}`] : [])];
    created = await request(cfg, "POST", "/lead/", {
      ...basePayload,
      description: buildContextText(lead, fallbackHints),
      contacts: [{ name: lead.name, emails: [{ email: lead.email, type: "office" }] }],
    });
  }

  const id = created && typeof created === "object" ? (created as { id?: unknown }).id : undefined;
  if (typeof id !== "string") throw new CloseError("unexpected");
  return { outcome: duplicateHint.length ? "lead_created_possible_duplicate" : "lead_created", leadId: id };
}
