import { describe, expect, it } from "vitest";
import {
  MAX_AMOUNT,
  MAX_COUNT,
  buildResult,
  calculateVolume,
  formatEuro,
  formatVolume,
  parseAmount,
  parseCount,
  type CheckInput,
} from "@/lib/check";

const input = (over: Partial<CheckInput>): CheckInput => ({
  route: "gelegentlich",
  count: 4,
  amount: 500,
  stage: "gemahnt",
  debtor: "gemischt",
  ...over,
});
// Intl nutzt ein geschütztes Leerzeichen vor dem Euro-Zeichen.
const plain = (s: string) => s.replace(/ /g, " ");

describe("Berechnung des Forderungsvolumens", () => {
  it("Testfall 1 – Einzelfall: 1 × 800 € = 800 €", () => {
    const r = buildResult(input({ route: "einzeln", count: 1, amount: 800 }));
    expect(r.volume).toBe(800);
    expect(plain(r.volumeText)).toBe("800 €");
    expect(r.cta).toBe("Einzelforderung unverbindlich prüfen");
    expect(r.title).toBe("Auch eine einzelne offene Rechnung verdient Aufmerksamkeit.");
    expect(r.period).toBe("current");
  });

  it("Testfall 2 – Gelegentlich: 5 × 500 €/Jahr = 2.500 €", () => {
    const r = buildResult(input({ route: "gelegentlich", count: 5, amount: 500 }));
    expect(r.volume).toBe(2500);
    expect(plain(r.volumeText)).toBe("2.500 €");
    expect(r.cta).toBe("Passendes Betreuungsmodell finden");
    expect(r.period).toBe("year");
  });

  it("Testfall 3 – Regelmäßig: 6 × 250 €/Monat = 18.000 € auf 12 Monate", () => {
    const r = buildResult(input({ route: "regelmaessig", count: 6, amount: 250 }));
    expect(r.volume).toBe(18000);
    expect(plain(r.volumeText)).toBe("18.000 €");
    expect(r.cta).toBe("Laufende Betreuung anfragen");
    expect(r.volumeCaption).toContain("12 Monate");
    expect(r.volumeExplain).toContain("Hochrechnung");
    expect(r.period).toBe("month");
  });

  it("weist jede Summe als rechnerisch und nicht als Prognose aus", () => {
    for (const route of ["einzeln", "gelegentlich", "regelmaessig"] as const) {
      const r = buildResult(input({ route }));
      expect(r.volumeExplain).toContain("Rechnerische Summe der angegebenen Hauptforderungen.");
      expect(r.volumeExplain).toContain("Keine Prognose von Zahlungseingängen.");
    }
  });

  it("rechnet centgenau ohne Gleitkommafehler", () => {
    expect(calculateVolume("einzeln", 3, 0.1)).toBe(0.3);
    expect(calculateVolume("regelmaessig", 7, 19.99)).toBe(1679.16);
  });

  it("vermeidet Scheingenauigkeit bei sehr großen Summen", () => {
    expect(plain(formatVolume(1_234_567))).toBe("rund 1,2 Mio. €");
    expect(plain(formatVolume(999_999))).toBe("999.999 €");
    expect(plain(formatEuro(1250.5))).toBe("1.250,50 €");
  });
});

describe("Sonderfälle bestritten / tituliert", () => {
  it("Testfall 4 – bestritten führt bei jeder Route zur individuellen Prüfung, nie zur Ablehnung", () => {
    for (const route of ["einzeln", "gelegentlich", "regelmaessig"] as const) {
      const r = buildResult(input({ route, stage: "bestritten" }));
      expect(r.special).toBe(true);
      expect(r.title).toBe("Bestrittene Forderungen prüfen wir individuell.");
      expect(r.cta).toBe("Individuelle Prüfung anfragen");
      expect(`${r.body} ${r.stageNote}`).toMatch(/Einwendungen/);
      expect(`${r.title} ${r.body} ${r.stageNote}`).not.toMatch(/nicht möglich|ablehnen|leider|können wir nicht/i);
      expect(r.volume).toBeGreaterThan(0);
    }
  });

  it("Testfall 5 – tituliert stellt die Vollstreckung in den Mittelpunkt, ohne Verfahrensübernahme zu behaupten", () => {
    const r = buildResult(input({ stage: "tituliert" }));
    const text = `${r.title} ${r.body} ${r.stageNote} ${r.cta}`;
    expect(text).toMatch(/Vollstreckung/);
    expect(text).not.toMatch(/Gerichtsverfahren|Verfahren übernehmen|übernehmen wir/i);
  });

  it("macht in keinem Ergebnis Erfolgs- oder Kostenversprechen", () => {
    const forbidden = /garant|erfolgsquote|kostenlos|ohne risiko|100\s?%|schuldner trägt|trägt der schuldner/i;
    for (const route of ["einzeln", "gelegentlich", "regelmaessig"] as const) {
      for (const stage of ["ueberfaellig", "gemahnt", "bestritten", "tituliert"] as const) {
        const r = buildResult(input({ route, stage }));
        expect(Object.values(r).join(" ")).not.toMatch(forbidden);
      }
    }
  });
});

describe("Testfall 8 – Eingabevalidierung", () => {
  it("lehnt 0, negative, leere und nicht numerische Anzahlen ab", () => {
    for (const raw of ["0", "-3", "", "   ", "abc", "2,5", "2.5", "1e3", "٣"]) {
      expect(parseCount(raw).ok, `Anzahl "${raw}"`).toBe(false);
    }
  });

  it("akzeptiert ganze Zahlen ab 1 ohne stilles Runden", () => {
    expect(parseCount("1")).toEqual({ ok: true, value: 1 });
    expect(parseCount(" 12 ")).toEqual({ ok: true, value: 12 });
    expect(parseCount("1.000")).toEqual({ ok: true, value: 1000 });
  });

  it("begrenzt sehr große Anzahlen mit verständlicher Meldung", () => {
    expect(parseCount(String(MAX_COUNT)).ok).toBe(true);
    const r = parseCount(String(MAX_COUNT + 1));
    expect(r.ok).toBe(false);
    expect(parseCount("99999999999999999999999").ok).toBe(false);
  });

  it("lehnt 0, negative, leere und nicht numerische Beträge ab", () => {
    for (const raw of ["0", "0,00", "-50", "", "abc", "12,345", "1,2,3", "Infinity", "NaN", "5e5"]) {
      expect(parseAmount(raw).ok, `Betrag "${raw}"`).toBe(false);
    }
  });

  it("kennt keine künstliche Mindestgröße und versteht deutsche Schreibweise", () => {
    expect(parseAmount("20")).toEqual({ ok: true, value: 20 });
    expect(parseAmount("0,50")).toEqual({ ok: true, value: 0.5 });
    expect(parseAmount("1.250,50")).toEqual({ ok: true, value: 1250.5 });
    expect(parseAmount("1.250")).toEqual({ ok: true, value: 1250 });
    expect(parseAmount("1250.50")).toEqual({ ok: true, value: 1250.5 });
    expect(parseAmount("500 €")).toEqual({ ok: true, value: 500 });
  });

  it("begrenzt sehr große Beträge", () => {
    expect(parseAmount(String(MAX_AMOUNT)).ok).toBe(true);
    expect(parseAmount(String(MAX_AMOUNT + 1)).ok).toBe(false);
  });
});
