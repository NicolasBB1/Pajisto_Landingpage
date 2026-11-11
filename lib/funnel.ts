/**
 * Inhalte und Fachlogik des Anfrage-Funnels.
 *
 * Frei von DOM/React, damit Browser, Server und Tests dieselben Definitionen
 * nutzen. Es gibt bewusst keine Bewertung, Mindestmenge oder Aussortierung:
 * Jede Antwortkombination führt zur Kontaktabfrage.
 */

export const FREQUENCIES = ["einzelfall", "paar_mal_jahr", "monatlich_1_5", "monatlich_ueber_5", "unklar"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const AMOUNTS = ["unter_250", "250_1000", "1000_5000", "ueber_5000", "unterschiedlich"] as const;
export type Amount = (typeof AMOUNTS)[number];

export const DEBTORS = ["privat", "geschaeft", "beides"] as const;
export type Debtor = (typeof DEBTORS)[number];

export const STAGES = ["ueberfaellig", "gemahnt", "bestritten", "tituliert", "unsicher"] as const;
export type Stage = (typeof STAGES)[number];

/** Nur in der ausführlichen Funnel-Variante (A/B-Test). */
export const INDUSTRIES = ["fitness_sport", "bildung_kurse", "verein", "dienstleistung_handwerk", "vermietung_lager", "andere"] as const;
export type Industry = (typeof INDUSTRIES)[number];

export const CONTACT_PREFERENCES = ["email", "rueckruf"] as const;
export type ContactPreference = (typeof CONTACT_PREFERENCES)[number];

export const FUNNEL_VARIANTS = ["kurz", "ausfuehrlich"] as const;
export type FunnelVariant = (typeof FUNNEL_VARIANTS)[number];

export const SEGMENTS = ["einzelfall", "gelegentlich", "regelmaessig", "ungeklaert"] as const;
export type Segment = (typeof SEGMENTS)[number];

export const LEAD_SOURCE = "pajisto_lp_multistep";

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  einzelfall: "Ich habe eine konkrete offene Rechnung",
  paar_mal_jahr: "Ein paar Mal im Jahr",
  monatlich_1_5: "1–5 Rechnungen pro Monat",
  monatlich_ueber_5: "Mehr als 5 Rechnungen pro Monat",
  unklar: "Kann ich noch nicht einschätzen",
};

export const AMOUNT_LABEL: Record<Amount, string> = {
  unter_250: "Unter 250 €",
  "250_1000": "250–1.000 €",
  "1000_5000": "1.000–5.000 €",
  ueber_5000: "Über 5.000 €",
  unterschiedlich: "Unterschiedlich / weiß ich nicht",
};

export const DEBTOR_LABEL: Record<Debtor, string> = {
  privat: "Privatkunden",
  geschaeft: "Geschäftskunden",
  beides: "Beides",
};

export const STAGE_LABEL: Record<Stage, string> = {
  ueberfaellig: "Zahlungsziel ist überschritten",
  gemahnt: "Wir haben bereits erinnert oder gemahnt",
  bestritten: "Die Forderung wird bestritten",
  tituliert: "Es gibt bereits einen Titel",
  unsicher: "Bin mir nicht sicher",
};

export const INDUSTRY_LABEL: Record<Industry, string> = {
  fitness_sport: "Fitness, Sport, Studio",
  bildung_kurse: "Schule, Kurse, Nachhilfe, Fahrschule",
  verein: "Verein oder Verband",
  dienstleistung_handwerk: "Dienstleistung, Handwerk, Agentur",
  vermietung_lager: "Vermietung, Stellplätze, Lager",
  andere: "Andere Branche",
};

export const CONTACT_PREFERENCE_LABEL: Record<ContactPreference, string> = {
  email: "Per E-Mail",
  rueckruf: "Per Rückruf",
};

export const SEGMENT_LABEL: Record<Segment, string> = {
  einzelfall: "Einzelfall",
  gelegentlich: "gelegentlich",
  regelmaessig: "regelmäßig",
  ungeklaert: "noch ungeklärt",
};

const includes = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === "string" && (list as readonly string[]).includes(v);

export const isFrequency = (v: unknown): v is Frequency => includes(FREQUENCIES, v);
export const isAmount = (v: unknown): v is Amount => includes(AMOUNTS, v);
export const isDebtor = (v: unknown): v is Debtor => includes(DEBTORS, v);
export const isStage = (v: unknown): v is Stage => includes(STAGES, v);
export const isIndustry = (v: unknown): v is Industry => includes(INDUSTRIES, v);
export const isContactPreference = (v: unknown): v is ContactPreference => includes(CONTACT_PREFERENCES, v);
export const isFunnelVariant = (v: unknown): v is FunnelVariant => includes(FUNNEL_VARIANTS, v);

/**
 * Internes Segment für den Vertrieb. Es beschreibt nur den Bedarf und
 * sortiert niemanden aus.
 */
export function segmentOf(frequency: Frequency): Segment {
  switch (frequency) {
    case "einzelfall":
      return "einzelfall";
    case "paar_mal_jahr":
      return "gelegentlich";
    case "monatlich_1_5":
    case "monatlich_ueber_5":
      return "regelmaessig";
    default:
      return "ungeklaert";
  }
}

/** Interner Hinweis: häufige Fälle sind potenziell ein Fall für laufende Betreuung. */
export const hasOngoingPotential = (frequency: Frequency) => segmentOf(frequency) === "regelmaessig";

export type QuestionKey = "frequency" | "amount" | "debtor" | "stage" | "industry";
export type StepKey = QuestionKey | "contact";

export interface Answers {
  frequency?: Frequency;
  amount?: Amount;
  debtor?: Debtor;
  stage?: Stage;
  industry?: Industry;
}

export function stepsFor(variant: FunnelVariant): StepKey[] {
  return variant === "ausfuehrlich"
    ? ["frequency", "amount", "debtor", "stage", "industry", "contact"]
    : ["frequency", "amount", "debtor", "stage", "contact"];
}

export interface QuestionContent {
  title: string;
  /** Kurzer, zur bisherigen Antwort passender Text unter der Frage. */
  hint: string;
  options: { value: string; label: string }[];
}

const toOptions = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
  values.map((value) => ({ value, label: labels[value] }));

export function questionContent(key: QuestionKey, answers: Answers): QuestionContent {
  const single = answers.frequency === "einzelfall";
  switch (key) {
    case "frequency":
      return {
        title: "Wie häufig bleiben bei Ihnen Rechnungen offen?",
        hint: "Wählen Sie, was am ehesten passt. Eine grobe Einschätzung genügt.",
        options: toOptions(FREQUENCIES, FREQUENCY_LABEL),
      };
    case "amount":
      return {
        title: single ? "Wie hoch ist die offene Forderung ungefähr?" : "Wie hoch sind die offenen Forderungen ungefähr?",
        hint: single
          ? "Auch eine einzelne Rechnung können Sie bei uns anfragen."
          : answers.frequency === "paar_mal_jahr"
            ? "Gemeint ist die typische Höhe einer einzelnen Forderung."
            : answers.frequency === "unklar"
              ? "Kein Problem. Gemeint ist die typische Höhe einer einzelnen Forderung."
              : "Gemeint ist die typische Höhe einer einzelnen Forderung, nicht die Summe.",
        options: toOptions(AMOUNTS, AMOUNT_LABEL),
      };
    case "debtor":
      return {
        title: "Wer schuldet Ihnen das Geld?",
        hint: single ? "Ist Ihr Kunde eine Privatperson oder ein Unternehmen?" : "Sind Ihre Kunden überwiegend Privatpersonen oder Unternehmen?",
        options: toOptions(DEBTORS, DEBTOR_LABEL),
      };
    case "stage":
      return {
        title: "Wie ist der aktuelle Stand?",
        hint: single ? "Was ist bei dieser Forderung bisher passiert?" : "Was trifft auf die meisten Ihrer offenen Forderungen zu?",
        options: toOptions(STAGES, STAGE_LABEL),
      };
    case "industry":
      return {
        title: "In welcher Branche sind Sie tätig?",
        hint: "So können wir uns besser auf das Gespräch vorbereiten.",
        options: toOptions(INDUSTRIES, INDUSTRY_LABEL),
      };
  }
}

/** Kurztext über den Kontaktfeldern – abhängig vom Stand und der Häufigkeit. */
export function contactIntro(answers: Answers): string {
  if (answers.stage === "bestritten") {
    return "Bestrittene Forderungen sehen wir uns individuell an. Es kommt auf Ihre Unterlagen und die Einwendungen an – das besprechen wir persönlich.";
  }
  if (answers.stage === "tituliert") {
    return "Bei einem vorhandenen Titel prüfen wir mit Ihnen, welche Vollstreckungsmaßnahmen in Betracht kommen.";
  }
  switch (answers.frequency ? segmentOf(answers.frequency) : "ungeklaert") {
    case "einzelfall":
      return "Wir melden uns persönlich und besprechen das Vorgehen für Ihren konkreten Fall.";
    case "gelegentlich":
      return "Wir melden uns persönlich und besprechen, welches Vorgehen für Ihre Fälle sinnvoll ist.";
    case "regelmaessig":
      return "Wir melden uns persönlich und zeigen Ihnen, wie Sie offene Forderungen laufend an uns übergeben können.";
    default:
      return "Wir melden uns persönlich und klären gemeinsam, welche Unterstützung zu Ihnen passt.";
  }
}

/** Text der Bestätigungsansicht nach tatsächlich gespeicherter Anfrage. */
export function successText(answers: Answers, preference: ContactPreference): string {
  const how = preference === "rueckruf" ? "rufen Sie zurück" : "melden uns per E-Mail bei Ihnen";
  const topic =
    answers.stage === "bestritten"
      ? "um Ihre Unterlagen und die Einwendungen zu besprechen"
      : answers.stage === "tituliert"
        ? "um mögliche Vollstreckungsmaßnahmen zu besprechen"
        : answers.frequency && segmentOf(answers.frequency) === "einzelfall"
          ? "um das Vorgehen für Ihren Fall zu besprechen"
          : "um das passende Vorgehen zu besprechen";
  return `Wir ${how}, ${topic}. Die Anfrage ist unverbindlich und keine Inkasso-Beauftragung.`;
}
