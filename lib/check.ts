/**
 * Fachlogik des Pajisto-Forderungschecks.
 *
 * Bewusst frei von DOM/React, damit sie im Browser, auf dem Server und in
 * Unit-Tests identisch läuft. Der Check berechnet ausschließlich die
 * rechnerische Summe der angegebenen Hauptforderungen – keine Erfolgsquote,
 * keine Prognose, keine rechtliche Einordnung.
 */

export const ROUTES = ["einzeln", "gelegentlich", "regelmaessig"] as const;
export type Route = (typeof ROUTES)[number];

export const STAGES = ["ueberfaellig", "gemahnt", "bestritten", "tituliert"] as const;
export type Stage = (typeof STAGES)[number];

export const DEBTOR_TYPES = ["privat", "unternehmen", "gemischt"] as const;
export type DebtorType = (typeof DEBTOR_TYPES)[number];

export type Period = "current" | "year" | "month";

export const DEFAULT_ROUTE: Route = "gelegentlich";
export const DEFAULT_AMOUNT = 500;
export const DEFAULT_COUNT: Record<Route, number> = {
  einzeln: 1,
  gelegentlich: 4,
  regelmaessig: 6,
};

/** Technische Obergrenzen – nur Schutz vor Tippfehlern, keine fachliche Schwelle. */
export const MAX_COUNT = 100_000;
export const MAX_AMOUNT = 10_000_000;

export const PERIOD_BY_ROUTE: Record<Route, Period> = {
  einzeln: "current",
  gelegentlich: "year",
  regelmaessig: "month",
};

export const ROUTE_LABEL: Record<Route, string> = {
  einzeln: "Einzelne offene Forderung",
  gelegentlich: "Gelegentliche Zahlungsausfälle",
  regelmaessig: "Laufendes Forderungsmanagement",
};

export const STAGE_LABEL: Record<Stage, string> = {
  ueberfaellig: "Zahlungsziel überschritten",
  gemahnt: "Bereits erinnert oder gemahnt",
  bestritten: "Forderung wird bestritten",
  tituliert: "Forderung ist tituliert",
};

export const DEBTOR_LABEL: Record<DebtorType, string> = {
  privat: "Überwiegend Privatpersonen",
  unternehmen: "Überwiegend Unternehmen",
  gemischt: "Beides / unterschiedlich",
};

export const COUNT_LABEL: Record<Route, string> = {
  einzeln: "Wie viele konkrete Forderungen?",
  gelegentlich: "Wie viele Forderungen ungefähr pro Jahr?",
  regelmaessig: "Wie viele Forderungen ungefähr pro Monat?",
};

export const COUNT_HINT: Record<Route, string> = {
  einzeln: "Aktuell betroffene Forderungen",
  gelegentlich: "Ein Schätzwert genügt",
  regelmaessig: "Ein Schätzwert genügt",
};

export function isRoute(v: unknown): v is Route {
  return typeof v === "string" && (ROUTES as readonly string[]).includes(v);
}
export function isStage(v: unknown): v is Stage {
  return typeof v === "string" && (STAGES as readonly string[]).includes(v);
}
export function isDebtorType(v: unknown): v is DebtorType {
  return typeof v === "string" && (DEBTOR_TYPES as readonly string[]).includes(v);
}

export type ParseResult = { ok: true; value: number } | { ok: false; error: string };

/**
 * Anzahl der Forderungen: nur ganze Zahlen >= 1. Es wird nichts still
 * gerundet – "2,5" ist ein Fehler und kein "2".
 */
export function parseCount(raw: string): ParseResult {
  const s = raw.trim().replace(/\s/g, "");
  if (s === "") return { ok: false, error: "Bitte geben Sie eine Anzahl ein." };
  // Tausenderpunkte wie "1.000" zulassen.
  const normalized = /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, "") : s;
  if (!/^\d+$/.test(normalized)) {
    return { ok: false, error: "Bitte geben Sie eine ganze Zahl ein, zum Beispiel 4." };
  }
  const value = Number(normalized);
  if (!Number.isSafeInteger(value) || value < 1) {
    return { ok: false, error: "Die Anzahl muss mindestens 1 betragen." };
  }
  if (value > MAX_COUNT) {
    return {
      ok: false,
      error: `Bitte geben Sie höchstens ${formatInteger(MAX_COUNT)} ein. Bei größeren Mengen sprechen wir am besten direkt.`,
    };
  }
  return { ok: true, value };
}

/**
 * Betrag in Euro. Akzeptiert deutsche Schreibweise ("1.250,50"), einfache
 * Dezimalpunkte ("1250.50") und ein optionales Euro-Zeichen. Es gibt keine
 * fachliche Mindestgröße – auch 20 € sind eine gültige Eingabe.
 */
export function parseAmount(raw: string): ParseResult {
  let s = raw.trim().replace(/\s/g, "").replace(/€|EUR$/gi, "");
  if (s === "") return { ok: false, error: "Bitte geben Sie einen Betrag ein." };
  if (s.includes(",")) {
    // Komma ist Dezimaltrenner, Punkte sind Tausendertrenner.
    if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$/.test(s) && !/^\d+(,\d{1,2})?$/.test(s)) {
      return { ok: false, error: "Bitte geben Sie den Betrag als Zahl ein, zum Beispiel 500 oder 1.250,50." };
    }
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) {
    return { ok: false, error: "Bitte geben Sie den Betrag als Zahl ein, zum Beispiel 500 oder 1.250,50." };
  }
  const value = Number(s);
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, error: "Der Betrag muss größer als 0 € sein." };
  }
  if (value > MAX_AMOUNT) {
    return {
      ok: false,
      error: `Bitte geben Sie höchstens ${formatInteger(MAX_AMOUNT)} € ein. Bei höheren Beträgen sprechen wir am besten direkt.`,
    };
  }
  return { ok: true, value };
}

export interface CheckInput {
  route: Route;
  count: number;
  amount: number;
  stage: Stage;
  debtor: DebtorType;
}

export interface CheckResult {
  route: Route;
  stage: Stage;
  period: Period;
  /** true bei bestrittenen oder titulierten Forderungen. */
  special: boolean;
  title: string;
  body: string;
  stageNote: string;
  cta: string;
  volume: number;
  volumeCaption: string;
  volumeText: string;
  volumeExplain: string;
  summary: string;
}

/** Rechnerische Summe der Hauptforderungen in Cent-genauer Arithmetik. */
export function calculateVolume(route: Route, count: number, amount: number): number {
  const factor = route === "regelmaessig" ? 12 : 1;
  return (count * Math.round(amount * 100) * factor) / 100;
}

function formatInteger(n: number): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(n);
}

/** "800 €", "1.250,50 €" – Nachkommastellen nur, wenn welche vorhanden sind. */
export function formatEuro(n: number): string {
  const hasCents = Math.round(n * 100) % 100 !== 0;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(n);
}

/**
 * Darstellung des Volumens. Ab einer Million wird bewusst gerundet
 * ("rund 1,2 Mio. €"), weil eine Hochrechnung aus Schätzwerten keine
 * Euro-genaue Zahl hergibt.
 */
export function formatVolume(n: number): string {
  if (n >= 1_000_000) {
    const mio = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(n / 1_000_000);
    return `rund ${mio} Mio. €`;
  }
  return formatEuro(n);
}

const ROUTE_CONTENT: Record<Route, { title: string; body: string; cta: string }> = {
  einzeln: {
    title: "Auch eine einzelne offene Rechnung verdient Aufmerksamkeit.",
    body: "Sie müssen nicht dauerhaft viele Zahlungsausfälle haben, um Unterstützung anzufragen. Wir prüfen gern das Vorgehen für Ihren konkreten Fall.",
    cta: "Einzelforderung unverbindlich prüfen",
  },
  gelegentlich: {
    title: "Für gelegentliche Forderungsausfälle gibt es passende Lösungen.",
    body: "Je nach Art und Umfang kann eine fallweise Bearbeitung oder eine laufende Betreuung passen. Wir besprechen, was wirtschaftlich sinnvoll ist.",
    cta: "Passendes Betreuungsmodell finden",
  },
  regelmaessig: {
    title: "Eine laufende Betreuung könnte Ihr Unternehmen entlasten.",
    body: "Wiederkehrende Zahlungsausfälle sprechen für einen klaren Prozess. Wir besprechen, wie Sie Ihre Fälle regelmäßig übergeben können.",
    cta: "Laufende Betreuung anfragen",
  },
};

const STAGE_NOTE: Record<Stage, string> = {
  ueberfaellig:
    "Das Zahlungsziel ist überschritten. Im Gespräch klären wir, ob die Voraussetzungen für weitere Schritte bereits vorliegen.",
  gemahnt:
    "Nach Ihren bisherigen Zahlungserinnerungen kann eine professionelle Weiterverfolgung der nächste Schritt sein.",
  bestritten:
    "Ob und wie eine bestrittene Forderung weiterverfolgt werden kann, lässt sich nicht automatisch beantworten. Wir sehen uns Ihre Situation persönlich an.",
  tituliert:
    "Welche Maßnahmen im Einzelfall sinnvoll sind, hängt vom Titel und von der Situation des Schuldners ab.",
};

const SPECIAL_CONTENT: Record<"bestritten" | "tituliert", { title: string; body: string; cta: string }> = {
  bestritten: {
    title: "Bestrittene Forderungen prüfen wir individuell.",
    body: "Wenn Ihr Kunde Einwendungen erhebt, kommt es auf die Anspruchsgrundlage, Ihre Nachweise und den Inhalt der Einwendungen an.",
    cta: "Individuelle Prüfung anfragen",
  },
  tituliert: {
    title: "Bei titulierten Forderungen geht es um die Vollstreckung.",
    body: "Liegt bereits ein vollstreckbarer Titel vor, prüfen wir mit Ihnen, welche Vollstreckungsmaßnahmen in Betracht kommen.",
    cta: "Mögliche Vollstreckung prüfen lassen",
  },
};

export function countPhrase(route: Route, count: number): string {
  const n = formatInteger(count);
  if (route === "regelmaessig") return `${n} ${count === 1 ? "Forderung" : "Forderungen"} pro Monat`;
  if (route === "gelegentlich") return `${n} ${count === 1 ? "Forderung" : "Forderungen"} pro Jahr`;
  return `${n} konkrete ${count === 1 ? "Forderung" : "Forderungen"}`;
}

/**
 * Ergebnis des Checks. Die Einordnung folgt zuerst der vom Besucher gewählten
 * Situation (Route); die Fallzahl dient nur der Summenbildung. Bestrittene
 * und titulierte Forderungen führen immer zu einer individuellen Prüfung –
 * nie zu einer Ablehnung.
 */
export function buildResult(input: CheckInput): CheckResult {
  const { route, count, amount, stage } = input;
  const special = stage === "bestritten" || stage === "tituliert";
  const base = ROUTE_CONTENT[route];
  const content = stage === "bestritten" || stage === "tituliert" ? SPECIAL_CONTENT[stage] : base;
  const volume = calculateVolume(route, count, amount);
  const period = PERIOD_BY_ROUTE[route];

  const volumeCaption =
    route === "regelmaessig"
      ? "Betroffenes Forderungsvolumen, hochgerechnet auf 12 Monate"
      : route === "gelegentlich"
        ? "Betroffenes Forderungsvolumen pro Jahr"
        : "Betroffenes Forderungsvolumen";

  const calc =
    route === "regelmaessig"
      ? `Hochrechnung: ${formatInteger(count)} × ${formatEuro(amount)} × 12 Monate.`
      : `${formatInteger(count)} × ${formatEuro(amount)}.`;

  return {
    route,
    stage,
    period,
    special,
    title: content.title,
    body: content.body,
    stageNote: STAGE_NOTE[stage],
    cta: content.cta,
    volume,
    volumeCaption,
    volumeText: formatVolume(volume),
    volumeExplain: `${calc} Rechnerische Summe der angegebenen Hauptforderungen. Keine Prognose von Zahlungseingängen.`,
    summary: `${ROUTE_LABEL[route]} · ${countPhrase(route, count)} · Ø ${formatEuro(amount)} · ${STAGE_LABEL[stage]}`,
  };
}
