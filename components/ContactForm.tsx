"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { track, type FailureClass } from "@/lib/analytics";
import { getCheckHandoff, getServerCheckHandoff, setCheckHandoff, subscribeCheckHandoff } from "@/lib/check-store";
import {
  NEEDS,
  NEED_LABEL,
  validateLead,
  type FieldErrors,
  type LeadApiResponse,
  type LeadField,
  type Need,
  type Utm,
} from "@/lib/lead";
import { COMPANY, LANDING_VARIANT } from "@/lib/public-config";
import { readUtm } from "@/lib/utm";
import { Arrow, Icon } from "./Icon";

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; mode: "close" | "mock" }
  | { kind: "error"; message: string; retry: boolean };

const HONEYPOT_FIELD = "company_website";
const FIELD_ORDER: LeadField[] = ["name", "company", "email", "phone", "need", "message"];

function newSubmissionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function errorMessage(code: FailureClass): { message: string; retry: boolean } {
  const phone = `Sie erreichen uns auch telefonisch unter ${COMPANY.phoneDisplay}.`;
  switch (code) {
    case "rate_limited":
      return {
        message: `Von Ihrem Anschluss sind gerade sehr viele Anfragen eingegangen. Bitte versuchen Sie es in einigen Minuten erneut. ${phone}`,
        retry: true,
      };
    case "not_configured":
      return {
        message: `Das Formular ist derzeit nicht an unser System angebunden. Ihre Anfrage wurde nicht übermittelt. ${phone}`,
        retry: false,
      };
    case "rejected":
    case "bad_request":
      return {
        message: `Ihre Anfrage konnte nicht verarbeitet werden und wurde nicht übermittelt. Bitte laden Sie die Seite neu und versuchen Sie es erneut. ${phone}`,
        retry: false,
      };
    default:
      return {
        message: `Ihre Anfrage konnte gerade nicht übermittelt werden. Ihre Eingaben bleiben erhalten – bitte versuchen Sie es erneut. ${phone}`,
        retry: true,
      };
  }
}

export function ContactForm({ leadMode }: { leadMode: "mock" | "close" | "disabled" }) {
  const handoff = useSyncExternalStore(subscribeCheckHandoff, getCheckHandoff, getServerCheckHandoff);

  const [values, setValues] = useState({ name: "", company: "", email: "", phone: "", message: "" });
  const [need, setNeed] = useState<Need>("unklar");
  const [honeypot, setHoneypot] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const inFlight = useRef(false);
  const formStarted = useRef(false);
  const submissionId = useRef<string | null>(null);
  const utm = useRef<Utm>({});
  const successRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    utm.current = readUtm(window.location.search);
  }, []);

  // Ergebnis des Checks als Vorauswahl übernehmen.
  useEffect(() => {
    if (handoff) setNeed(handoff.check.check_route);
  }, [handoff]);

  useEffect(() => {
    if (status.kind === "success") successRef.current?.focus();
  }, [status.kind]);

  function onFormStart() {
    if (formStarted.current) return;
    formStarted.current = true;
    track("form_start", { route: handoff?.check.check_route });
  }

  function setField(field: keyof typeof values, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function focusFirstError(fieldErrors: FieldErrors) {
    const first = FIELD_ORDER.find((f) => fieldErrors[f]);
    if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    // Sperre gegen Doppelklicks – unabhängig vom (asynchronen) React-State.
    if (inFlight.current) return;

    // Dieselbe ID für alle Versuche derselben Anfrage: Der Server erkennt
    // Wiederholungen daran und legt keinen zweiten Lead an.
    submissionId.current ??= newSubmissionId();
    const payload = {
      submission_id: submissionId.current,
      landing_variant: LANDING_VARIANT,
      ...values,
      need,
      ...(handoff ? { check: handoff.check } : {}),
      utm: utm.current,
    };

    const local = validateLead(payload);
    if (!local.ok) {
      setErrors(local.fields);
      setStatus(
        local.reason === "fields"
          ? { kind: "idle" }
          : { kind: "error", ...errorMessage("bad_request") },
      );
      focusFirstError(local.fields);
      return;
    }
    setErrors({});

    inFlight.current = true;
    setStatus({ kind: "submitting" });
    const route = handoff?.check.check_route;

    let failure: FailureClass = "network";
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, [HONEYPOT_FIELD]: honeypot }),
        signal: AbortSignal.timeout(25_000),
      });
      const data = (await res.json().catch(() => null)) as LeadApiResponse | null;

      if (res.ok && data?.ok) {
        // Erfolg wird ausschließlich nach bestätigter Server-Antwort angezeigt.
        setStatus({ kind: "success", mode: data.mode });
        if (data.mode === "close") {
          track("lead_submit_success", { landing_variant: LANDING_VARIANT, route }, { eventId: data.event_id });
        }
        submissionId.current = null;
        inFlight.current = false;
        return;
      }

      failure = data && !data.ok ? data.error : "crm_unavailable";
      if (data && !data.ok && data.error === "validation" && data.fields) {
        setErrors(data.fields);
        setStatus({ kind: "idle" });
        focusFirstError(data.fields);
        track("lead_submit_failure", { error_class: failure });
        inFlight.current = false;
        return;
      }
    } catch {
      failure = "network";
    }

    track("lead_submit_failure", { error_class: failure });
    setStatus({ kind: "error", ...errorMessage(failure) });
    inFlight.current = false;
  }

  if (status.kind === "success") {
    return (
      <div className="form-card form-success" ref={successRef} tabIndex={-1} role="status" data-testid="form-success" data-mode={status.mode}>
        {status.mode === "close" ? (
          <>
            <span className="round-check">
              <Icon name="check" size={18} />
            </span>
            <h3>Vielen Dank – Ihre Anfrage ist bei uns eingegangen.</h3>
            <p>
              Wir melden uns persönlich bei Ihnen, um Ihre Situation zu besprechen. Die Anfrage ist unverbindlich und
              keine Inkasso-Beauftragung.
            </p>
          </>
        ) : (
          <>
            <h3>Demo-Modus: Es wurde nichts versendet.</h3>
            <p>
              Ihre Eingaben wurden geprüft, aber weder gespeichert noch an Pajisto oder ein CRM übermittelt. Im
              Live-Betrieb erscheint an dieser Stelle die Eingangsbestätigung.
            </p>
          </>
        )}
        <button type="button" className="back-btn" onClick={() => setStatus({ kind: "idle" })}>
          Weitere Anfrage stellen
        </button>
      </div>
    );
  }

  const submitting = status.kind === "submitting";
  const describedBy = (field: LeadField) => (errors[field] ? `contact-${field}-error` : undefined);
  const fieldError = (field: LeadField) =>
    errors[field] ? (
      <p className="field-error" id={`contact-${field}-error`} role="alert">
        {errors[field]}
      </p>
    ) : null;

  return (
    <form
      ref={formRef}
      id="contact-form"
      className="form-card"
      onSubmit={onSubmit}
      onFocus={onFormStart}
      noValidate
      aria-labelledby="contact-form-title"
      data-testid="contact-form"
    >
      <h3 id="contact-form-title">Unverbindliche Anfrage</h3>

      {leadMode === "mock" && (
        <p className="mode-notice" data-testid="mock-notice">
          <strong>Demo-Modus:</strong> Dieses Formular ist nicht mit Pajisto oder einem CRM verbunden. Es werden keine
          Daten versendet.
        </p>
      )}
      {leadMode === "disabled" && (
        <p className="mode-notice" data-testid="disabled-notice">
          <strong>Formular noch nicht angebunden:</strong> Anfragen können derzeit nicht übermittelt werden. Bitte rufen
          Sie uns an: {COMPANY.phoneDisplay}.
        </p>
      )}

      <div className="form-grid">
        <div className="contact-field">
          <label htmlFor="contact-name">Ihr Name *</label>
          <input
            id="contact-name"
            name="name"
            autoComplete="name"
            required
            aria-required="true"
            maxLength={120}
            value={values.name}
            onChange={(e) => setField("name", e.target.value)}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={describedBy("name")}
          />
          {fieldError("name")}
        </div>
        <div className="contact-field">
          <label htmlFor="contact-company">Unternehmen *</label>
          <input
            id="contact-company"
            name="company"
            autoComplete="organization"
            required
            aria-required="true"
            maxLength={160}
            value={values.company}
            onChange={(e) => setField("company", e.target.value)}
            aria-invalid={errors.company ? true : undefined}
            aria-describedby={describedBy("company")}
          />
          {fieldError("company")}
        </div>
        <div className="contact-field">
          <label htmlFor="contact-email">Geschäftliche E-Mail *</label>
          <input
            id="contact-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            aria-required="true"
            maxLength={254}
            placeholder="name@unternehmen.de"
            value={values.email}
            onChange={(e) => setField("email", e.target.value)}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={describedBy("email")}
          />
          {fieldError("email")}
        </div>
        <div className="contact-field">
          <label htmlFor="contact-phone">Telefon (optional)</label>
          <input
            id="contact-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={40}
            value={values.phone}
            onChange={(e) => setField("phone", e.target.value)}
            aria-invalid={errors.phone ? true : undefined}
            aria-describedby={describedBy("phone")}
          />
          {fieldError("phone")}
        </div>
        <div className="contact-field full">
          <label htmlFor="contact-need">Wobei können wir helfen?</label>
          <select
            id="contact-need"
            name="need"
            value={need}
            onChange={(e) => setNeed(e.target.value as Need)}
            aria-invalid={errors.need ? true : undefined}
            aria-describedby={describedBy("need")}
          >
            {NEEDS.map((n) => (
              <option key={n} value={n}>
                {NEED_LABEL[n]}
              </option>
            ))}
          </select>
          {fieldError("need")}
        </div>
        <div className="contact-field full">
          <label htmlFor="contact-message">Nachricht (optional)</label>
          <textarea
            id="contact-message"
            name="message"
            maxLength={2000}
            placeholder="Was sollten wir vor dem Gespräch wissen?"
            value={values.message}
            onChange={(e) => setField("message", e.target.value)}
            aria-invalid={errors.message ? true : undefined}
            aria-describedby={`contact-message-hint${errors.message ? " contact-message-error" : ""}`}
          />
          <p className="field-hint" id="contact-message-hint">
            Bitte nennen Sie hier noch keine Namen oder Adressen Ihrer Kunden und senden Sie keine Unterlagen.
          </p>
          {fieldError("message")}
        </div>
        {/* Honeypot gegen einfache Bots – für Menschen und Hilfstechnologien unsichtbar. */}
        <div className="hp-field" aria-hidden="true">
          <label htmlFor="contact-hp">Bitte dieses Feld leer lassen</label>
          <input
            id="contact-hp"
            name={HONEYPOT_FIELD}
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>
      </div>

      {handoff ? (
        <div className="form-summary" data-testid="form-summary">
          <span>
            <strong>Aus Ihrem Forderungscheck:</strong> {handoff.summary}. Diese Angaben senden wir mit.
          </span>
          <button type="button" className="link-btn" onClick={() => setCheckHandoff(null)}>
            Nicht mitsenden
          </button>
        </div>
      ) : (
        <div className="form-summary" data-testid="form-summary-empty">
          Sie können direkt anfragen. Der Forderungscheck ist freiwillig.
        </div>
      )}

      <button type="submit" className="btn btn-dark" disabled={submitting} aria-disabled={submitting} data-testid="submit">
        {submitting ? (
          <>
            <span className="spinner" aria-hidden="true" /> Wird gesendet …
          </>
        ) : status.kind === "error" && status.retry ? (
          <>
            Erneut senden <Arrow />
          </>
        ) : (
          <>
            Unverbindlich anfragen <Arrow />
          </>
        )}
      </button>

      <div aria-live="assertive">
        {status.kind === "error" && (
          <p className="form-error" role="alert" data-testid="form-error">
            {status.message}
          </p>
        )}
      </div>

      <p className="form-note">
        Mit dem Absenden übermitteln Sie Ihre Angaben an die {COMPANY.name}. Wir verwenden sie, um Ihre Anfrage zu
        bearbeiten und Sie dazu zu kontaktieren. Näheres in unserer{" "}
        <a href={COMPANY.privacyUrl} target="_blank" rel="noopener noreferrer">
          Datenschutzerklärung
        </a>
        . Die Anfrage ist unverbindlich und keine Inkasso-Beauftragung.
      </p>
    </form>
  );
}
