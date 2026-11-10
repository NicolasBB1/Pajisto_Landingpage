"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { track } from "@/lib/analytics";
import {
  COUNT_HINT,
  COUNT_LABEL,
  DEBTOR_LABEL,
  DEBTOR_TYPES,
  DEFAULT_AMOUNT,
  DEFAULT_COUNT,
  DEFAULT_ROUTE,
  ROUTES,
  STAGES,
  STAGE_LABEL,
  buildResult,
  parseAmount,
  parseCount,
  type CheckResult,
  type DebtorType,
  type Route,
  type Stage,
} from "@/lib/check";
import { setCheckHandoff } from "@/lib/check-store";
import { LANDING_VARIANT } from "@/lib/public-config";
import { Arrow, Icon, type IconName } from "./Icon";

const ROUTE_OPTIONS: Record<Route, { title: string; text: string; icon: IconName }> = {
  einzeln: {
    title: "Ich habe eine konkrete offene Rechnung",
    text: "Ich benötige Unterstützung bei einem einzelnen Fall.",
    icon: "invoice",
  },
  gelegentlich: {
    title: "Gelegentlich bleiben Rechnungen offen",
    text: "Ein paar Mal im Jahr kommt es zu Zahlungsausfällen.",
    icon: "clock",
  },
  regelmaessig: {
    title: "Jeden Monat sind mehrere Rechnungen offen",
    text: "Wir suchen einen verlässlichen, laufenden Prozess.",
    icon: "repeat",
  },
};

type Step = 1 | 2 | 3;

export function ForderungsCheck() {
  const uid = useId();
  const [step, setStep] = useState<Step>(1);
  const [route, setRoute] = useState<Route>(DEFAULT_ROUTE);
  const [countRaw, setCountRaw] = useState(String(DEFAULT_COUNT[DEFAULT_ROUTE]));
  const [amountRaw, setAmountRaw] = useState(String(DEFAULT_AMOUNT));
  const [stage, setStage] = useState<Stage>("gemahnt");
  const [debtor, setDebtor] = useState<DebtorType>("gemischt");
  const [errors, setErrors] = useState<{ count?: string; amount?: string }>({});
  const [result, setResult] = useState<CheckResult | null>(null);

  const started = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const isFirstRender = useRef(true);

  // Bei jedem Schrittwechsel den Fokus auf die neue Überschrift setzen, damit
  // Tastatur- und Screenreader-Nutzer am Anfang des neuen Schritts landen.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    headingRef.current?.focus({ preventScroll: true });
    // Karte so ausrichten, dass ihr Kopf unter dem fixierten Header sichtbar ist.
    const card = cardRef.current;
    if (card) {
      const top = card.getBoundingClientRect().top;
      const offset = window.innerWidth <= 720 ? 80 : 96;
      if (top < offset || top > window.innerHeight * 0.5) window.scrollBy({ top: top - offset });
    }
  }, [step]);

  function markStarted() {
    if (started.current) return;
    started.current = true;
    track("check_start", { landing_variant: LANDING_VARIANT });
  }

  function chooseRoute(next: Route) {
    markStarted();
    if (next === route) return;
    setRoute(next);
    // Die Einheit der Anzahl ändert sich mit der Situation (konkret / pro Jahr /
    // pro Monat), deshalb wird hier der passende Startwert gesetzt. Betrag,
    // Stadium und Kundentyp bleiben erhalten.
    setCountRaw(String(DEFAULT_COUNT[next]));
    setErrors({});
  }

  function goToStep2() {
    markStarted();
    setStep(2);
    track("check_step_2", { route });
  }

  function showResult(event: FormEvent) {
    event.preventDefault();
    const count = parseCount(countRaw);
    const amount = parseAmount(amountRaw);
    if (!count.ok || !amount.ok) {
      setErrors({
        ...(count.ok ? {} : { count: count.error }),
        ...(amount.ok ? {} : { amount: amount.error }),
      });
      (count.ok ? amountRef : countRef).current?.focus();
      return;
    }
    setErrors({});
    const next = buildResult({ route, count: count.value, amount: amount.value, stage, debtor });
    setResult(next);
    setCheckHandoff({
      summary: next.summary,
      check: {
        check_route: route,
        claim_count: count.value,
        claim_period: next.period,
        average_claim_amount_eur: amount.value,
        claim_stage: stage,
        debtor_customer_type: debtor,
        calculated_volume_eur: next.volume,
      },
    });
    setStep(3);
    track("check_complete", { route, stage, period: next.period });
  }

  function restart() {
    setRoute(DEFAULT_ROUTE);
    setCountRaw(String(DEFAULT_COUNT[DEFAULT_ROUTE]));
    setAmountRaw(String(DEFAULT_AMOUNT));
    setStage("gemahnt");
    setDebtor("gemischt");
    setErrors({});
    setResult(null);
    setCheckHandoff(null);
    setStep(1);
  }

  function onResultCta() {
    track("result_cta_click", { route });
    // Nach dem Sprung zum Formular direkt das erste Feld fokussieren.
    window.setTimeout(() => document.getElementById("contact-name")?.focus({ preventScroll: true }), 50);
  }

  const id = (name: string) => `${uid}-${name}`;

  return (
    <div className="check-card" ref={cardRef} data-testid="check-card" data-step={step}>
      <div className="progress" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span key={n} className={n <= step ? "active" : undefined} />
        ))}
      </div>

      {step === 1 && (
        <section aria-labelledby={id("h1")}>
          <div className="check-meta">
            <strong>01 / Ihre Situation</strong>
            <small>Schritt 1 von 3</small>
          </div>
          <h3 id={id("h1")} ref={headingRef} tabIndex={-1}>
            Wie häufig bleiben bei Ihnen Rechnungen offen?
          </h3>
          <p className="check-sub">Wählen Sie aus, was Ihre Situation am besten beschreibt.</p>
          <div className="route-options" role="radiogroup" aria-labelledby={id("h1")}>
            {ROUTES.map((r) => (
              <label key={r} className={`route-option${route === r ? " selected" : ""}`}>
                <input
                  type="radio"
                  name={id("route")}
                  value={r}
                  checked={route === r}
                  onChange={() => chooseRoute(r)}
                  onClick={markStarted}
                />
                <span className="route-symbol">
                  <Icon name={ROUTE_OPTIONS[r].icon} />
                </span>
                <span>
                  <strong>{ROUTE_OPTIONS[r].title}</strong>
                  <small>{ROUTE_OPTIONS[r].text}</small>
                </span>
              </label>
            ))}
          </div>
          <div className="step-actions">
            <button className="btn btn-dark" type="button" onClick={goToStep2}>
              Weiter <Arrow />
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section aria-labelledby={id("h2")}>
          <div className="check-meta">
            <strong>02 / Ein paar Eckdaten</strong>
            <small>Schritt 2 von 3</small>
          </div>
          <h3 id={id("h2")} ref={headingRef} tabIndex={-1}>
            Erzählen Sie uns kurz mehr.
          </h3>
          <p className="check-sub">Schätzwerte genügen. Die Angaben bleiben in Ihrem Browser, bis Sie eine Anfrage senden.</p>
          <form onSubmit={showResult} noValidate>
            <div className="form-grid-check">
              <div className="check-field">
                <label htmlFor={id("count")}>{COUNT_LABEL[route]}</label>
                <input
                  id={id("count")}
                  ref={countRef}
                  name="count"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={countRaw}
                  onChange={(e) => setCountRaw(e.target.value)}
                  aria-invalid={errors.count ? true : undefined}
                  aria-describedby={`${id("count-hint")}${errors.count ? ` ${id("count-error")}` : ""}`}
                />
                <div className="hint" id={id("count-hint")}>
                  {COUNT_HINT[route]}
                </div>
                {errors.count && (
                  <p className="field-error" id={id("count-error")} role="alert">
                    {errors.count}
                  </p>
                )}
              </div>
              <div className="check-field">
                <label htmlFor={id("amount")}>Durchschnittliche Hauptforderung in Euro</label>
                <input
                  id={id("amount")}
                  ref={amountRef}
                  name="amount"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={amountRaw}
                  onChange={(e) => setAmountRaw(e.target.value)}
                  aria-invalid={errors.amount ? true : undefined}
                  aria-describedby={`${id("amount-hint")}${errors.amount ? ` ${id("amount-error")}` : ""}`}
                />
                <div className="hint" id={id("amount-hint")}>
                  Rechnungsbetrag ohne Mahn- oder Inkassokosten
                </div>
                {errors.amount && (
                  <p className="field-error" id={id("amount-error")} role="alert">
                    {errors.amount}
                  </p>
                )}
              </div>
              <div className="check-field full">
                <label htmlFor={id("stage")}>Wo stehen die Forderungen derzeit?</label>
                <select id={id("stage")} name="stage" value={stage} onChange={(e) => setStage(e.target.value as Stage)}>
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {STAGE_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="check-field full">
                <label htmlFor={id("debtor")}>Wer sind Ihre Kunden?</label>
                <select
                  id={id("debtor")}
                  name="debtor"
                  value={debtor}
                  onChange={(e) => setDebtor(e.target.value as DebtorType)}
                >
                  {DEBTOR_TYPES.map((d) => (
                    <option key={d} value={d}>
                      {DEBTOR_LABEL[d]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="step-actions">
              <button className="back-btn" type="button" onClick={() => setStep(1)}>
                ← Zurück
              </button>
              <button type="submit" className="btn btn-dark">
                Ergebnis anzeigen <Arrow />
              </button>
            </div>
          </form>
        </section>
      )}

      {step === 3 && result && (
        <section aria-labelledby={id("h3")} data-testid="check-result" data-route={result.route} data-stage={result.stage}>
          <div className="check-meta">
            <strong>03 / Ihre Einordnung</strong>
            <small>Schritt 3 von 3</small>
          </div>
          <h3 className="result-title" id={id("h3")} ref={headingRef} tabIndex={-1} data-testid="result-title">
            {result.title}
          </h3>
          <p className="result-body" data-testid="result-body">
            {result.body} {result.stageNote}
          </p>
          <div className="volume-box">
            <small data-testid="volume-caption">{result.volumeCaption}</small>
            <strong data-testid="volume-result">{result.volumeText}</strong>
            <div className="explain" data-testid="volume-explain">
              {result.volumeExplain}
            </div>
          </div>
          <ul className="result-list">
            <li>
              <Icon name="check" size={16} /> Persönliche Prüfung Ihrer Situation
            </li>
            <li>
              <Icon name="check" size={16} /> Unverbindliche Besprechung des Vorgehens
            </li>
            <li>
              <Icon name="check" size={16} /> Weitere Schritte nur nach Abstimmung mit Ihnen
            </li>
          </ul>
          <a href="#kontakt" className="btn btn-lime result-cta" data-testid="result-cta" onClick={onResultCta}>
            {result.cta} <Arrow />
          </a>
          <div className="step-actions">
            <button className="back-btn" type="button" onClick={() => setStep(2)}>
              ← Angaben ändern
            </button>
            <button className="back-btn" type="button" onClick={restart}>
              Neu starten
            </button>
          </div>
          <p className="preview-alert">
            Orientierung auf Basis Ihrer Angaben – kein Angebot, keine Rechtsprüfung und keine Prognose zu
            Zahlungseingängen. Die Anfrage ist unverbindlich und keine Inkasso-Beauftragung.
          </p>
        </section>
      )}
    </div>
  );
}
