import { describe, expect, it } from "vitest";
import { validateLead } from "@/lib/lead";

const base = {
  submission_id: "0b9f3c1e-2a4d-4c8e-9f10-aaaaaaaaaaaa",
  landing_variant: "B",
  name: "Erika Beispiel",
  company: "Beispiel Fitness GmbH",
  email: "Erika@Beispiel-Fitness.de",
  need: "unklar",
};

describe("validateLead", () => {
  it("Testfall 6 – Direktanfrage ohne Check ist gültig", () => {
    const r = validateLead(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lead.check).toBeUndefined();
    expect(r.lead.email).toBe("erika@beispiel-fitness.de");
    expect(r.lead.source).toBe("Pajisto Landingpage Forderungscheck V2");
    expect(r.lead.landing_variant).toBe("B");
    expect(r.lead.utm).toEqual({});
  });

  it("verlangt Name, Unternehmen und E-Mail mit verständlichen Meldungen", () => {
    const r = validateLead({ ...base, name: " ", company: "", email: "kein-at-zeichen" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("fields");
    expect(Object.keys(r.fields).sort()).toEqual(["company", "email", "name"]);
  });

  it.each(["a@b", "a b@c.de", "a@b..de", "@b.de", "a@.de", "a@b.de,c@d.de"])("lehnt E-Mail %s ab", (email) => {
    expect(validateLead({ ...base, email }).ok).toBe(false);
  });

  it("prüft optionale Felder nur, wenn sie ausgefüllt sind", () => {
    expect(validateLead({ ...base, phone: "", message: "" }).ok).toBe(true);
    expect(validateLead({ ...base, phone: "+49 911 / 123-456" }).ok).toBe(true);
    expect(validateLead({ ...base, phone: "ruf mich an" }).ok).toBe(false);
    expect(validateLead({ ...base, message: "x".repeat(2001) }).ok).toBe(false);
  });

  it("übernimmt Check-Daten und berechnet das Volumen serverseitig neu", () => {
    const r = validateLead({
      ...base,
      need: "regelmaessig",
      check: {
        check_route: "regelmaessig",
        claim_count: 6,
        claim_period: "year", // falscher Wert aus dem Browser
        average_claim_amount_eur: 250,
        claim_stage: "gemahnt",
        debtor_customer_type: "privat",
        calculated_volume_eur: 1, // manipuliert
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lead.check).toMatchObject({ claim_period: "month", calculated_volume_eur: 18000 });
  });

  it("lehnt manipulierte Check-Daten ab statt sie still zu übernehmen", () => {
    const check = {
      check_route: "einzeln",
      claim_count: 1,
      average_claim_amount_eur: 800,
      claim_stage: "gemahnt",
      debtor_customer_type: "privat",
    };
    for (const bad of [
      { ...check, claim_count: 0 },
      { ...check, claim_count: 1.5 },
      { ...check, average_claim_amount_eur: -1 },
      { ...check, average_claim_amount_eur: "800" },
      { ...check, check_route: "vip" },
      { ...check, claim_stage: "verjaehrt" },
    ]) {
      const r = validateLead({ ...base, check: bad });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("malformed");
    }
  });

  it("übernimmt nur die fünf UTM-Parameter und kürzt sie", () => {
    const r = validateLead({
      ...base,
      utm: { utm_source: "meta", utm_campaign: "x".repeat(500), fbclid: "abc", email: "a@b.de" },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.keys(r.lead.utm).sort()).toEqual(["utm_campaign", "utm_source"]);
    expect(r.lead.utm.utm_campaign).toHaveLength(200);
  });

  it("verlangt eine gültige submission_id und ein Objekt", () => {
    expect(validateLead({ ...base, submission_id: "kurz" }).ok).toBe(false);
    expect(validateLead(null).ok).toBe(false);
    expect(validateLead("text").ok).toBe(false);
    expect(validateLead([]).ok).toBe(false);
  });

  it("entfernt Steuerzeichen und Zeilenumbrüche aus einzeiligen Feldern", () => {
    const r = validateLead({ ...base, company: "Beispiel\r\nGmbH\u0000" });
    expect(r.ok && r.lead.company).toBe("Beispiel GmbH");
  });
});
