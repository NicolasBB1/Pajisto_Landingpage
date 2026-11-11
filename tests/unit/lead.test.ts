import { describe, expect, it } from "vitest";
import { validateLead } from "@/lib/lead";

const base = {
  submission_id: "0b9f3c1e-2a4d-4c8e-9f10-aaaaaaaaaaaa",
  landing_variant: "C",
  funnel_variant: "kurz",
  frequency: "monatlich_1_5",
  amount: "250_1000",
  debtor: "privat",
  stage: "gemahnt",
  name: "Erika Beispiel",
  company: "Beispiel Fitness GmbH",
  email: "Erika@Beispiel-Fitness.de",
  contact_preference: "email",
};

describe("validateLead", () => {
  it("akzeptiert eine vollständige Anfrage und setzt Quelle und Segment serverseitig", () => {
    const r = validateLead({ ...base, source: "manipuliert", segment: "einzelfall" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lead.source).toBe("pajisto_lp_multistep");
    expect(r.lead.segment).toBe("regelmaessig");
    expect(r.lead.email).toBe("erika@beispiel-fitness.de");
    expect(r.lead.phone).toBeUndefined();
    expect(r.lead.utm).toEqual({});
  });

  it("lässt jede Antwortkombination zu – niemand wird aussortiert", () => {
    for (const frequency of ["einzelfall", "paar_mal_jahr", "monatlich_1_5", "monatlich_ueber_5", "unklar"])
      for (const amount of ["unter_250", "unterschiedlich"])
        for (const stage of ["bestritten", "tituliert", "unsicher"])
          expect(validateLead({ ...base, frequency, amount, stage }).ok).toBe(true);
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

  it("Telefon ist optional – außer bei gewünschtem Rückruf", () => {
    expect(validateLead({ ...base, phone: "" }).ok).toBe(true);
    expect(validateLead({ ...base, phone: "+49 911 / 123-456" }).ok).toBe(true);
    expect(validateLead({ ...base, phone: "ruf mich an" }).ok).toBe(false);

    const callback = validateLead({ ...base, contact_preference: "rueckruf" });
    expect(callback.ok).toBe(false);
    if (!callback.ok) expect(callback.fields.phone).toBe("Für einen Rückruf benötigen wir Ihre Telefonnummer.");
    expect(validateLead({ ...base, contact_preference: "rueckruf", phone: "0911 123456" }).ok).toBe(true);
    expect(validateLead({ ...base, contact_preference: "fax" }).ok).toBe(false);
  });

  it("lehnt fehlende oder manipulierte Funnel-Antworten ab", () => {
    for (const bad of [
      { frequency: undefined },
      { frequency: "vip" },
      { amount: "1000000" },
      { debtor: "" },
      { stage: "verjaehrt" },
      { funnel_variant: "x" },
      { industry: "geheim" },
      { landing_variant: "<script>" },
      { submission_id: "kurz" },
    ]) {
      const r = validateLead({ ...base, ...bad });
      expect(r.ok, JSON.stringify(bad)).toBe(false);
      if (!r.ok) expect(r.reason).toBe("malformed");
    }
    expect(validateLead(null).ok).toBe(false);
    expect(validateLead([]).ok).toBe(false);
  });

  it("übernimmt die Branche nur in gültiger Form", () => {
    const r = validateLead({ ...base, funnel_variant: "ausfuehrlich", industry: "verein" });
    expect(r.ok && r.lead.industry).toBe("verein");
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

  it("speichert als Herkunft nur Seitenpfad und Referrer-Hostname", () => {
    const r = validateLead({
      ...base,
      origin: { page_path: "/angebot?fbclid=abc&email=x@y.de#top", referrer_host: "L.Facebook.com", ip: "1.2.3.4" },
    });
    expect(r.ok && r.lead.origin).toEqual({ page_path: "/angebot", referrer_host: "l.facebook.com" });
    const bad = validateLead({ ...base, origin: { page_path: "javascript:alert(1)", referrer_host: "a b/c?d" } });
    expect(bad.ok && bad.lead.origin).toEqual({});
  });

  it("entfernt Steuerzeichen und Zeilenumbrüche aus einzeiligen Feldern", () => {
    const r = validateLead({ ...base, company: "Beispiel\r\nGmbH\u0000" });
    expect(r.ok && r.lead.company).toBe("Beispiel GmbH");
  });
});
