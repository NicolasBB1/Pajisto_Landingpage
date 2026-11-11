/**
 * Verarbeitung einer Anfrage, unabhängig vom Web-Framework (gut testbar).
 * Der Route Handler in app/api/lead/route.ts ist nur eine dünne Hülle.
 */
import { CloseError, submitLeadToClose, type CloseConfig } from "../close";
import { validateLead, type LeadApiResponse } from "../lead";
import type { LeadMode } from "./config";
import type { IdempotencyStore, RateLimiter } from "./guards";

export const HONEYPOT_FIELD = "company_website";
export const MAX_BODY_BYTES = 16_000;

export interface LeadDeps {
  mode: LeadMode;
  close: CloseConfig | null;
  rateLimiter: RateLimiter;
  idempotency: IdempotencyStore<LeadApiResponse & { ok: true }>;
  log?: (message: string) => void;
  now?: () => Date;
}

export interface LeadHttpResult {
  status: number;
  body: LeadApiResponse;
}

export async function handleLead(rawBody: string, clientKey: string, deps: LeadDeps): Promise<LeadHttpResult> {
  const log = deps.log ?? ((m: string) => console.error(m));

  if (rawBody.length > MAX_BODY_BYTES) return { status: 413, body: { ok: false, error: "bad_request" } };

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { ok: false, error: "bad_request" } };
  }

  // Honeypot: Das Feld ist für Menschen unsichtbar. Ist es gefüllt, wird die
  // Anfrage verworfen – ohne Erfolgsmeldung, damit ein versehentlich
  // betroffener echter Besucher nicht fälschlich "Vielen Dank" liest.
  if (json && typeof json === "object" && typeof (json as Record<string, unknown>)[HONEYPOT_FIELD] === "string") {
    if (((json as Record<string, unknown>)[HONEYPOT_FIELD] as string).trim() !== "") {
      return { status: 400, body: { ok: false, error: "rejected" } };
    }
  }

  const result = validateLead(json);
  if (!result.ok) {
    return result.reason === "fields"
      ? { status: 400, body: { ok: false, error: "validation", fields: result.fields } }
      : { status: 400, body: { ok: false, error: "bad_request" } };
  }
  const lead = result.lead;

  if (deps.mode === "disabled" || (deps.mode === "close" && !deps.close)) {
    return { status: 503, body: { ok: false, error: "not_configured" } };
  }

  // Erst nach der Validierung zählen: Tippfehler verbrauchen kein Kontingent.
  if (!deps.rateLimiter.take(clientKey)) {
    return { status: 429, body: { ok: false, error: "rate_limited" } };
  }

  try {
    const body = await deps.idempotency.run(lead.submission_id, async () => {
      if (deps.mode === "mock") {
        return { ok: true as const, mode: "mock" as const, event_id: lead.submission_id };
      }
      await submitLeadToClose(lead, deps.close!, (deps.now ?? (() => new Date()))());
      return { ok: true as const, mode: "close" as const, event_id: lead.submission_id };
    });
    return { status: 200, body };
  } catch (err) {
    // Nur Fehlerklasse und Status protokollieren – keine Anfrageinhalte.
    const kind = err instanceof CloseError ? `${err.kind}${err.status ? `/${err.status}` : ""}` : "unexpected";
    log(`[lead] CRM-Einsendung fehlgeschlagen: ${kind}`);
    return { status: 502, body: { ok: false, error: "crm_unavailable" } };
  }
}
