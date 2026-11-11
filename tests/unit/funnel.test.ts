import { describe, expect, it } from "vitest";
import {
  AMOUNTS,
  DEBTORS,
  FREQUENCIES,
  STAGES,
  contactIntro,
  hasOngoingPotential,
  questionContent,
  segmentOf,
  stepsFor,
  successText,
} from "@/lib/funnel";
import { pickVariant } from "@/lib/funnel-variant";

describe("Funnel-Inhalte", () => {
  it("stellt die vier Fragen mit genau den vorgegebenen Antworten", () => {
    expect(questionContent("frequency", {}).title).toBe("Wie häufig bleiben bei Ihnen Rechnungen offen?");
    expect(questionContent("frequency", {}).options.map((o) => o.label)).toEqual([
      "Ich habe eine konkrete offene Rechnung",
      "Ein paar Mal im Jahr",
      "1–5 Rechnungen pro Monat",
      "Mehr als 5 Rechnungen pro Monat",
      "Kann ich noch nicht einschätzen",
    ]);
    expect(questionContent("amount", {}).options.map((o) => o.label)).toEqual([
      "Unter 250 €",
      "250–1.000 €",
      "1.000–5.000 €",
      "Über 5.000 €",
      "Unterschiedlich / weiß ich nicht",
    ]);
    expect(questionContent("debtor", {}).options.map((o) => o.label)).toEqual(["Privatkunden", "Geschäftskunden", "Beides"]);
    expect(questionContent("stage", {}).options.map((o) => o.label)).toEqual([
      "Zahlungsziel ist überschritten",
      "Wir haben bereits erinnert oder gemahnt",
      "Die Forderung wird bestritten",
      "Es gibt bereits einen Titel",
      "Bin mir nicht sicher",
    ]);
  });

  it("formuliert beim Einzelfall im Singular, sonst im Plural", () => {
    expect(questionContent("amount", { frequency: "einzelfall" }).title).toBe("Wie hoch ist die offene Forderung ungefähr?");
    expect(questionContent("amount", { frequency: "monatlich_1_5" }).title).toBe("Wie hoch sind die offenen Forderungen ungefähr?");
    expect(questionContent("amount", { frequency: "monatlich_1_5" }).hint).toContain("typische Höhe");
    expect(questionContent("stage", { frequency: "einzelfall" }).hint).toContain("dieser Forderung");
  });

  it("ordnet das interne Segment zu, ohne jemanden auszuschließen", () => {
    expect(FREQUENCIES.map(segmentOf)).toEqual(["einzelfall", "gelegentlich", "regelmaessig", "regelmaessig", "ungeklaert"]);
    expect(FREQUENCIES.filter(hasOngoingPotential)).toEqual(["monatlich_1_5", "monatlich_ueber_5"]);
  });

  it("kurze Variante hat vier Fragen, die ausführliche zusätzlich die Branche", () => {
    expect(stepsFor("kurz")).toEqual(["frequency", "amount", "debtor", "stage", "contact"]);
    expect(stepsFor("ausfuehrlich")).toEqual(["frequency", "amount", "debtor", "stage", "industry", "contact"]);
  });

  it("drängt Einzelfälle nicht in eine laufende Betreuung", () => {
    for (const stage of STAGES) {
      const text = `${contactIntro({ frequency: "einzelfall", stage })} ${successText({ frequency: "einzelfall", stage }, "email")}`;
      expect(text).not.toMatch(/laufend|Abo|regelmäßig/i);
    }
    expect(contactIntro({ frequency: "monatlich_ueber_5", stage: "gemahnt" })).toContain("laufend");
  });

  it("behandelt bestritten und tituliert als individuelle Prüfung bzw. Vollstreckung", () => {
    expect(contactIntro({ frequency: "paar_mal_jahr", stage: "bestritten" })).toMatch(/individuell/);
    expect(contactIntro({ frequency: "paar_mal_jahr", stage: "tituliert" })).toMatch(/Vollstreckungsmaßnahmen/);
    expect(successText({ stage: "tituliert" }, "rueckruf")).toMatch(/rufen Sie zurück.*Vollstreckungsmaßnahmen/);
  });

  it("macht in keinem Text Erfolgs-, Kosten- oder Rechtsversprechen", () => {
    const forbidden = /garant|erfolgsquote|kostenlos|ohne risiko|100\s?%|schuldner trägt|trägt der schuldner|sicher durchsetz|ablehnen|leider/i;
    const texts: string[] = [];
    for (const frequency of FREQUENCIES)
      for (const stage of STAGES) {
        const a = { frequency, stage, amount: AMOUNTS[0], debtor: DEBTORS[0] };
        texts.push(contactIntro(a), successText(a, "email"), successText(a, "rueckruf"));
        for (const key of ["frequency", "amount", "debtor", "stage", "industry"] as const) {
          const q = questionContent(key, a);
          texts.push(q.title, q.hint, ...q.options.map((o) => o.label));
        }
      }
    expect(texts.join(" ")).not.toMatch(forbidden);
  });
});

describe("A/B-Zuordnung der Funnel-Variante", () => {
  it("folgt der Konfiguration", () => {
    expect(pickVariant("", "kurz")).toBe("kurz");
    expect(pickVariant("", "ausfuehrlich")).toBe("ausfuehrlich");
  });
  it("teilt im Split-Modus 50/50", () => {
    expect(pickVariant("", "split", () => 0.1)).toBe("kurz");
    expect(pickVariant("", "split", () => 0.9)).toBe("ausfuehrlich");
  });
  it("lässt sich per URL erzwingen und ignoriert ungültige Werte", () => {
    expect(pickVariant("?fv=ausfuehrlich", "kurz")).toBe("ausfuehrlich");
    expect(pickVariant("?utm_source=meta&fv=kurz", "ausfuehrlich")).toBe("kurz");
    expect(pickVariant("?fv=hack", "kurz")).toBe("kurz");
  });
});
