"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { track, type FailureClass } from "@/lib/analytics";
import {
  CONTACT_PREFERENCES,
  CONTACT_PREFERENCE_LABEL,
  contactIntro,
  questionContent,
  segmentOf,
  stepsFor,
  successText,
  type Answers,
  type ContactPreference,
  type QuestionKey,
  type StepKey,
} from "@/lib/funnel";
import {
  getFunnelVariant,
  getServerFunnelVariant,
  resolveFunnelVariant,
  subscribeFunnelVariant,
} from "@/lib/funnel-variant";
import { validateLead, type FieldErrors, type LeadApiResponse, type LeadField, type Utm } from "@/lib/lead";
import { BOOKING_URL, COMPANY, LANDING_VARIANT } from "@/lib/public-config";
import { readUtm } from "@/lib/utm";
import { Arrow, Icon } from "./Icon";

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; mode: "close" | "mock" }
  | { kind: "error"; message: string; retry: boolean };

const HONEYPOT_FIELD = "company_website";
const FIELD_ORDER: LeadField[] = ["name", "company", "email", "contact_preference", "phone"];
const ADVANCE_DELAY_MS = 170;

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

export function Funnel({ leadMode }: { leadMode: "mock" | "close" | "disabled" }) {
  const variant = useSyncExternalStore(subscribeFunnelVariant, getFunnelVariant, getServerFunnelVariant);
  const steps = stepsFor(variant);
  const questionCount = steps.length - 1;

  const [stepIndex, setStepIndex] = useState(0);
  // Beim ersten Laden keine Einblendung (kein Flackern, kein Layoutsprung).
  const [direction, setDirection] = useState<"forward" | "back" | "initial">("initial");
  const [answers, setAnswers] = useState<Answers>({});
  const [values, setValues] = useState({ name: "", company: "", email: "", phone: "" });
  const [preference, setPreference] = useState<ContactPreference>("email");
  const [honeypot, setHoneypot] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const cardRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const advancing = useRef(false);
  const inFlight = useRef(false);
  const submissionId = useRef<string | null>(null);
  const utm = useRef<Utm>({});
  const firstRender = useRef(true);
  // Zustand für das Tracking, bewusst außerhalb des React-States.
  const tracking = useRef({ started: false, done: false, abandoned: false, completed: new Set<StepKey>(), step: 0 });

  const step = steps[Math.min(stepIndex, steps.length - 1)]!;
  tracking.current.step = stepIndex;

  useEffect(() => {
    resolveFunnelVariant();
    utm.current = readUtm(window.location.search);

    // Alle „Anfrage starten“-Links führen hierher; danach Fokus in den Funnel.
    const onClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement | null)?.closest?.('a[href="#anfrage"]');
      if (link) window.setTimeout(() => headingRef.current?.focus({ preventScroll: true }), 60);
    };
    // Abbruch: Seite wird verlassen, nachdem begonnen, aber nicht gesendet wurde.
    const onLeave = () => {
      const t = tracking.current;
      if (!t.started || t.done || t.abandoned) return;
      t.abandoned = true;
      const all = stepsFor(getFunnelVariant());
      const index = Math.min(t.step, all.length - 1);
      track("funnel_abandon", { last_step: all[index]!, step_number: index + 1, funnel_variant: getFunnelVariant() });
    };
    document.addEventListener("click", onClick);
    window.addEventListener("pagehide", onLeave);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("pagehide", onLeave);
    };
  }, []);

  // Bei Schritt- oder Ansichtswechsel: Fokus auf die neue Überschrift und die
  // Karte unter dem fixierten Header ausrichten.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus({ preventScroll: true });
    const card = cardRef.current;
    if (card) {
      const top = card.getBoundingClientRect().top;
      const offset = window.innerWidth <= 720 ? 78 : 100;
      if (top < offset || top > window.innerHeight * 0.45) window.scrollBy({ top: top - offset });
    }
  }, [stepIndex, status.kind === "success"]);

  function completeStep(key: StepKey, index: number) {
    const t = tracking.current;
    if (!t.started) {
      t.started = true;
      track("funnel_start", { landing_variant: LANDING_VARIANT, funnel_variant: variant });
    }
    if (!t.completed.has(key)) {
      t.completed.add(key);
      track("funnel_step_complete", { step: key, step_number: index + 1, funnel_variant: variant });
    }
  }

  function go(next: number, dir: "forward" | "back") {
    setDirection(dir);
    setStepIndex(Math.max(0, Math.min(next, steps.length - 1)));
  }

  function choose(key: QuestionKey, value: string) {
    if (advancing.current) return;
    advancing.current = true;
    setAnswers((a) => ({ ...a, [key]: value }));
    completeStep(key, stepIndex);
    // Kurze Verzögerung, damit die Auswahl sichtbar wird, bevor es weitergeht.
    window.setTimeout(() => {
      advancing.current = false;
      go(stepIndex + 1, "forward");
    }, ADVANCE_DELAY_MS);
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
    let referrerHost = "";
    try {
      const ref = document.referrer ? new URL(document.referrer) : null;
      if (ref && ref.host !== window.location.host) referrerHost = ref.hostname;
    } catch {
      /* kein auswertbarer Referrer */
    }
    const payload = {
      submission_id: submissionId.current,
      landing_variant: LANDING_VARIANT,
      funnel_variant: variant,
      ...answers,
      ...values,
      contact_preference: preference,
      utm: utm.current,
      origin: { page_path: window.location.pathname, referrer_host: referrerHost },
    };

    const local = validateLead(payload);
    if (!local.ok) {
      setErrors(local.fields);
      if (local.reason === "fields") {
        setStatus({ kind: "idle" });
        focusFirstError(local.fields);
      } else {
        // Sollte nicht vorkommen (eine Antwort fehlt): zurück zur ersten offenen Frage.
        const missing = steps.findIndex((s) => s !== "contact" && !answers[s]);
        if (missing >= 0) go(missing, "back");
        else setStatus({ kind: "error", ...errorMessage("bad_request") });
      }
      return;
    }
    setErrors({});

    inFlight.current = true;
    setStatus({ kind: "submitting" });

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
        tracking.current.done = true;
        completeStep("contact", stepIndex);
        if (data.mode === "close") {
          track(
            "lead_submit_success",
            { landing_variant: LANDING_VARIANT, funnel_variant: variant, segment: segmentOf(local.lead.frequency) },
            { eventId: data.event_id },
          );
        }
        setStatus({ kind: "success", mode: data.mode });
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

  /* ───────────── Bestätigung ───────────── */
  if (status.kind === "success") {
    return (
      <section className="funnel funnel-done" id="anfrage" ref={cardRef} data-testid="funnel" data-state="success">
        <div role="status" data-testid="funnel-success" data-mode={status.mode}>
          {status.mode === "close" ? (
            <>
              <span className="round-check">
                <Icon name="check" size={20} />
              </span>
              <h2 ref={headingRef} tabIndex={-1}>
                Vielen Dank – Ihre Anfrage ist bei uns eingegangen.
              </h2>
              <p>{successText(answers, preference)}</p>
              {BOOKING_URL && (
                <div className="booking">
                  <p>Wenn Sie möchten, können Sie direkt einen Gesprächstermin wählen. Das ist freiwillig.</p>
                  <a
                    className="btn btn-outline"
                    href={BOOKING_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="booking-link"
                    onClick={() => track("booking_link_click", { funnel_variant: variant })}
                  >
                    Termin auswählen <Arrow />
                  </a>
                </div>
              )}
            </>
          ) : (
            <>
              <h2 ref={headingRef} tabIndex={-1}>
                Vorschau-Modus: Es wurde nichts versendet.
              </h2>
              <p>
                Ihre Eingaben wurden geprüft, aber weder gespeichert noch an Pajisto oder ein CRM übermittelt. Im
                Live-Betrieb erscheint an dieser Stelle die Eingangsbestätigung.
              </p>
            </>
          )}
        </div>
      </section>
    );
  }

  const isContact = step === "contact";
  const progress = Math.round(((stepIndex + (isContact ? 0.6 : 0)) / steps.length) * 100);
  const submitting = status.kind === "submitting";
  const describedBy = (field: LeadField) => (errors[field] ? `funnel-${field}-error` : undefined);
  const fieldError = (field: LeadField) =>
    errors[field] ? (
      <p className="field-error" id={`funnel-${field}-error`} role="alert">
        {errors[field]}
      </p>
    ) : null;
  const content = isContact ? null : questionContent(step, answers);
  const answered = !isContact && Boolean(answers[step]);

  return (
    <section
      className="funnel"
      id="anfrage"
      ref={cardRef}
      aria-label="Unverbindliche Anfrage"
      data-testid="funnel"
      data-step={step}
      data-variant={variant}
    >
      <div className="funnel-top">
        <span className="funnel-count" data-testid="funnel-count">
          {isContact ? "Letzter Schritt" : `Frage ${stepIndex + 1} von ${questionCount}`}
        </span>
        <div
          className="funnel-bar"
          role="progressbar"
          aria-label="Fortschritt der Anfrage"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <span style={{ width: `${Math.max(progress, 6)}%` }} />
        </div>
      </div>

      <div key={step} className={`funnel-step ${direction}`}>
        {content && !isContact && (
          <>
            <h2 ref={headingRef} tabIndex={-1} id="funnel-question">
              {content.title}
            </h2>
            <p className="funnel-hint">{content.hint}</p>
            <div className="funnel-options" role="group" aria-labelledby="funnel-question">
              {content.options.map((option) => {
                const selected = answers[step] === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`funnel-option${selected ? " selected" : ""}`}
                    aria-pressed={selected}
                    data-value={option.value}
                    onClick={() => choose(step, option.value)}
                  >
                    <span>{option.label}</span>
                    <span className="funnel-radio" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </>
        )}

        {isContact && (
          <form ref={formRef} onSubmit={onSubmit} noValidate aria-labelledby="funnel-question" data-testid="funnel-form">
            <h2 ref={headingRef} tabIndex={-1} id="funnel-question">
              Wie können wir Sie erreichen?
            </h2>
            <p className="funnel-hint" data-testid="contact-intro">
              {contactIntro(answers)}
            </p>

            {leadMode === "mock" && (
              <p className="mode-notice" data-testid="mock-notice">
                <strong>Vorschau-Modus:</strong> Dieses Formular ist nicht mit Pajisto verbunden. Es werden keine Daten
                versendet.
              </p>
            )}
            {leadMode === "disabled" && (
              <p className="mode-notice" data-testid="disabled-notice">
                <strong>Formular noch nicht angebunden:</strong> Anfragen können derzeit nicht übermittelt werden. Bitte
                rufen Sie uns an: {COMPANY.phoneDisplay}.
              </p>
            )}

            <div className="funnel-fields">
              <div className="contact-field">
                <label htmlFor="funnel-name">Ihr Name *</label>
                <input
                  id="funnel-name"
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
                <label htmlFor="funnel-company">Unternehmen *</label>
                <input
                  id="funnel-company"
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
              <div className="contact-field full">
                <label htmlFor="funnel-email">Geschäftliche E-Mail *</label>
                <input
                  id="funnel-email"
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
              <fieldset className="contact-field full pref">
                <legend>Wie sollen wir uns melden?</legend>
                <div className="pref-options">
                  {CONTACT_PREFERENCES.map((p) => (
                    <label key={p} className={`pref-option${preference === p ? " selected" : ""}`}>
                      <input
                        type="radio"
                        name="contact_preference"
                        value={p}
                        checked={preference === p}
                        onChange={() => {
                          setPreference(p);
                          if (errors.phone) setErrors((e) => ({ ...e, phone: undefined }));
                        }}
                      />
                      {CONTACT_PREFERENCE_LABEL[p]}
                    </label>
                  ))}
                </div>
                {fieldError("contact_preference")}
              </fieldset>
              <div className="contact-field full">
                <label htmlFor="funnel-phone">{preference === "rueckruf" ? "Telefon *" : "Telefon (optional)"}</label>
                <input
                  id="funnel-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  maxLength={40}
                  required={preference === "rueckruf"}
                  aria-required={preference === "rueckruf"}
                  value={values.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  aria-invalid={errors.phone ? true : undefined}
                  aria-describedby={describedBy("phone")}
                />
                {fieldError("phone")}
              </div>
              {/* Honeypot gegen einfache Bots – für Menschen und Hilfstechnologien unsichtbar. */}
              <div className="hp-field" aria-hidden="true">
                <label htmlFor="funnel-hp">Bitte dieses Feld leer lassen</label>
                <input
                  id="funnel-hp"
                  name={HONEYPOT_FIELD}
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-accent funnel-submit" disabled={submitting} data-testid="submit">
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
                  Unverbindliche Anfrage senden <Arrow />
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
              Wir verwenden Ihre Angaben nur, um Ihre Anfrage zu bearbeiten und Sie dazu zu kontaktieren. Details in der{" "}
              <a href={COMPANY.privacyUrl} target="_blank" rel="noopener noreferrer">
                Datenschutzerklärung
              </a>
              . Die Anfrage ist keine Inkasso-Beauftragung.
            </p>
          </form>
        )}
      </div>

      {/* Immer gerendert, damit die Karte zwischen den Schritten nicht springt. */}
      {(
        <div className="funnel-nav">
          {stepIndex > 0 ? (
            <button type="button" className="back-btn" onClick={() => go(stepIndex - 1, "back")} disabled={submitting}>
              ← Zurück
            </button>
          ) : (
            <span />
          )}
          {answered && (
            <button type="button" className="back-btn next-btn" onClick={() => go(stepIndex + 1, "forward")}>
              Weiter →
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/** Hero-Microcopy – nennt die tatsächliche Zahl der Fragen der aktiven Variante. */
export function FunnelMicrocopy() {
  const variant = useSyncExternalStore(subscribeFunnelVariant, getFunnelVariant, getServerFunnelVariant);
  return <>{variant === "ausfuehrlich" ? "Fünf" : "Vier"} kurze Fragen. Unverbindlich. Ohne Registrierung.</>;
}
