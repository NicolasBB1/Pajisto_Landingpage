import { afterEach, describe, expect, it } from "vitest";
import { CloseError, submitLeadToClose, type CloseConfig } from "@/lib/close";
import { validateLead, type Lead } from "@/lib/lead";
import { defaultHandler, startCloseMock, type MockHandler } from "./close-mock-server";

const API_KEY = "api_TESTKEY_nur_fuer_mock";

function lead(over: Record<string, unknown> = {}): Lead {
  const r = validateLead({
    submission_id: "0b9f3c1e-2a4d-4c8e-9f10-aaaaaaaaaaaa",
    landing_variant: "C",
    funnel_variant: "kurz",
    frequency: "monatlich_ueber_5",
    amount: "250_1000",
    debtor: "privat",
    stage: "gemahnt",
    name: "Erika Beispiel",
    company: "Beispiel Fitness GmbH",
    email: "erika@beispiel-fitness.de",
    phone: "0911 123456",
    contact_preference: "rueckruf",
    utm: { utm_source: "meta", utm_campaign: "herbst" },
    origin: { page_path: "/", referrer_host: "l.facebook.com" },
    ...over,
  });
  if (!r.ok) throw new Error("Testdaten ungültig");
  return r.lead;
}

const AT = new Date("2026-11-11T13:05:00Z");

let mock: Awaited<ReturnType<typeof startCloseMock>> | undefined;
afterEach(async () => {
  await mock?.close();
  mock = undefined;
});

async function setup(handler: MockHandler, cfg: Partial<CloseConfig> = {}) {
  mock = await startCloseMock(handler);
  const sleeps: number[] = [];
  const config: CloseConfig = {
    apiKey: API_KEY,
    baseUrl: mock.baseUrl,
    sleep: async (ms) => void sleeps.push(ms),
    ...cfg,
  };
  return { mock, config, sleeps };
}

describe("Close-Adapter: neuer Lead", () => {
  it("legt einen Unternehmenslead mit Kontakt an und authentifiziert per Basic Auth", async () => {
    const { mock, config } = await setup(defaultHandler());
    const result = await submitLeadToClose(lead(), config, AT);

    expect(result).toEqual({ outcome: "lead_created", leadId: "lead_new123" });
    expect(mock.requests.map((r) => `${r.method} ${r.path}`)).toEqual([
      "POST /api/v1/data/search/",
      "POST /api/v1/data/search/",
      "POST /api/v1/lead/",
    ]);
    // API-Key als Benutzername, leeres Passwort.
    expect(mock.requests[0]!.auth).toBe(`Basic ${Buffer.from(`${API_KEY}:`).toString("base64")}`);

    const body = mock.requests[2]!.body;
    expect(body.name).toBe("Beispiel Fitness GmbH");
    expect(body.contacts).toEqual([
      {
        name: "Erika Beispiel",
        emails: [{ email: "erika@beispiel-fitness.de", type: "office" }],
        phones: [{ phone: "0911 123456", type: "office" }],
      },
    ]);
    for (const part of [
      "Leadquelle: pajisto_lp_multistep",
      "Eingang: 11.11.2026, 14:05 Uhr (Europe/Berlin)",
      "Segment: regelmäßig – potenzieller Bedarf an laufender Betreuung",
      "Häufigkeit: Mehr als 5 Rechnungen pro Monat",
      "Forderungshöhe: 250–1.000 €",
      "Kundentyp: Privatkunden",
      "Stand: Wir haben bereits erinnert oder gemahnt",
      "Kontaktwunsch: Per Rückruf",
      "Landingpage-Variante: C · Funnel: kurz",
      "utm_source=meta",
      "Herkunft: Seite / · Verweis von l.facebook.com",
      "Anfrage-ID: 0b9f3c1e-2a4d-4c8e-9f10-aaaaaaaaaaaa",
    ]) {
      expect(body.description).toContain(part);
    }
    // Keine Opportunities, Aufgaben oder E-Mails.
    expect(body.opportunities).toBeUndefined();
    expect(body.tasks).toBeUndefined();
    expect(Object.keys(body).some((k) => k.startsWith("custom."))).toBe(false);
  });

  it("schreibt konfigurierte Custom Fields und Lead-Status", async () => {
    const { mock, config } = await setup(defaultHandler(), {
      leadStatusId: "stat_inbound",
      fields: { frequencyChoice: "cf_freq", source: "cf_src", segment: "cf_seg", amount: "cf_amt", utmSource: "cf_utm", landingVariant: "cf_var", funnelVariant: "cf_fv" },
    });
    await submitLeadToClose(lead(), config, AT);
    const body = mock.requests[2]!.body;
    expect(body.status_id).toBe("stat_inbound");
    expect(body["custom.cf_freq"]).toBe("Mehrmals im Monat");
    expect(body["custom.cf_src"]).toBe("pajisto_lp_multistep");
    expect(body["custom.cf_seg"]).toBe("regelmäßig");
    expect(body["custom.cf_amt"]).toBe("250–1.000 €");
    expect(body["custom.cf_utm"]).toBe("meta");
    expect(body["custom.cf_var"]).toBe("C");
    expect(body["custom.cf_fv"]).toBe("kurz");
  });

  it("Einzelfall ohne Telefon: kein Betreuungshinweis, kein Telefonfeld, kein Wert für »unklar«", async () => {
    const { mock, config } = await setup(defaultHandler(), { fields: { frequencyChoice: "cf_freq" } });
    await submitLeadToClose(lead({ frequency: "einzelfall", phone: "", contact_preference: "email" }), config, AT);
    const body = mock.requests[2]!.body;
    expect(body.description).toContain("Segment: Einzelfall\n");
    expect(body.description).not.toContain("laufender Betreuung");
    expect(body["custom.cf_freq"]).toBe("Einmalig oder selten");
    expect(body.contacts[0].phones).toBeUndefined();

    await submitLeadToClose(lead({ frequency: "unklar", email: "andere@beispiel.de" }), config, AT);
    expect(mock.requests.at(-1)!.body["custom.cf_freq"]).toBeUndefined();
  });

  it("wiederholt bei 400 einmal ohne Custom Fields/Telefon, damit keine Anfrage verloren geht", async () => {
    let leadCalls = 0;
    const { mock, config } = await setup(
      (req, i) => {
        if (req.path === "/api/v1/lead/") {
          leadCalls++;
          return leadCalls === 1 ? { status: 400, body: { error: "bad choice" } } : { status: 200, body: { id: "lead_fb" } };
        }
        return defaultHandler()(req, i);
      },
      { fields: { frequencyChoice: "cf_freq" } },
    );
    const result = await submitLeadToClose(lead(), config, AT);
    expect(result.leadId).toBe("lead_fb");
    const retry = mock.requests.at(-1)!.body;
    expect(Object.keys(retry).some((k) => k.startsWith("custom."))).toBe(false);
    expect(retry.contacts[0].phones).toBeUndefined();
    expect(retry.description).toContain("Telefon laut Anfrage: 0911 123456");
  });

  it("führt bei gleichem Firmennamen nicht zusammen, sondern markiert eine mögliche Dublette", async () => {
    const { mock, config } = await setup(
      defaultHandler({ searchCompany: { status: 200, body: { data: [{ id: "lead_old", display_name: "Beispiel Fitness GmbH" }] } } }),
    );
    const result = await submitLeadToClose(lead(), config, AT);
    expect(result.outcome).toBe("lead_created_possible_duplicate");
    expect(mock.requests.at(-1)!.path).toBe("/api/v1/lead/");
    expect(mock.requests.at(-1)!.body.description).toContain("BITTE PRÜFEN: Es existiert bereits ein Lead mit gleichem Firmennamen (lead_old)");
  });

  it("legt den Lead auch an, wenn der Firmenabgleich fehlschlägt", async () => {
    const { config } = await setup(defaultHandler({ searchCompany: { status: 500 } }));
    await expect(submitLeadToClose(lead(), config, AT)).resolves.toMatchObject({ outcome: "lead_created" });
  });
});

describe("Close-Adapter: bestehender Kontakt", () => {
  it("legt bei bekannter E-Mail keinen zweiten Lead an, sondern eine Notiz", async () => {
    const { mock, config } = await setup(
      defaultHandler({ searchEmail: { status: 200, body: { data: [{ id: "lead_exist", display_name: "Beispiel Fitness" }] } } }),
    );
    const result = await submitLeadToClose(lead(), config, AT);
    expect(result).toEqual({ outcome: "note_on_existing_lead", leadId: "lead_exist" });
    expect(mock.requests.map((r) => r.path)).toEqual(["/api/v1/data/search/", "/api/v1/activity/note/"]);
    const note = mock.requests[1]!.body;
    expect(note.lead_id).toBe("lead_exist");
    expect(note.note).toContain("Neue Anfrage über die Landingpage");
    expect(note.note).not.toContain("BITTE PRÜFEN");
  });

  it("überschreibt bei abweichender Firma nichts und setzt einen Prüfhinweis", async () => {
    const { mock, config } = await setup(
      defaultHandler({ searchEmail: { status: 200, body: { data: [{ id: "lead_exist", display_name: "Ganz Andere AG" }] } } }),
    );
    const result = await submitLeadToClose(lead(), config, AT);
    expect(result.outcome).toBe("note_on_existing_lead_review");
    expect(mock.requests.some((r) => r.path === "/api/v1/lead/")).toBe(false);
    expect(mock.requests.some((r) => r.method !== "POST")).toBe(false); // kein PUT/DELETE
    expect(mock.requests[1]!.body.note).toContain('BITTE PRÜFEN: Die E-Mail-Adresse ist bereits diesem Lead zugeordnet');
  });
});

describe("Close-Adapter: Fehlerbehandlung", () => {
  it.each([
    [400, "bad_request"],
    [401, "auth"],
    [403, "forbidden"],
    [500, "server"],
    [503, "server"],
  ] as const)("ordnet HTTP %i der Fehlerklasse %s zu", async (status, kind) => {
    const { config } = await setup(defaultHandler({ searchEmail: { status, body: { error: "geheim: details" } } }));
    const err = await submitLeadToClose(lead(), config, AT).catch((e) => e);
    expect(err).toBeInstanceOf(CloseError);
    expect(err.kind).toBe(kind);
    expect(err.status).toBe(status);
    // Weder Key noch Antwortinhalt noch Kontaktdaten in der Fehlermeldung.
    expect(err.message).not.toContain(API_KEY);
    expect(err.message).not.toContain("geheim");
    expect(err.message).not.toContain("erika");
  });

  it("wiederholt 5xx beim Anlegen nicht automatisch (Dublettenrisiko)", async () => {
    const { mock, config } = await setup(defaultHandler({ lead: { status: 502 } }));
    await expect(submitLeadToClose(lead(), config, AT)).rejects.toMatchObject({ kind: "server" });
    expect(mock.requests.filter((r) => r.path === "/api/v1/lead/")).toHaveLength(1);
  });

  it("wartet bei 429 die von Close genannte rate_reset-Zeit ab und wiederholt", async () => {
    let n = 0;
    const { mock, config, sleeps } = await setup((req, i) => {
      if (req.path === "/api/v1/lead/" && n++ === 0) {
        return { status: 429, headers: { "retry-after": "9" }, body: { error: { rate_reset: 1.2 } } };
      }
      return defaultHandler()(req, i);
    });
    const result = await submitLeadToClose(lead(), config, AT);
    expect(result.outcome).toBe("lead_created");
    expect(sleeps).toEqual([1200]);
    expect(mock.requests.filter((r) => r.path === "/api/v1/lead/")).toHaveLength(2);
  });

  it("nutzt retry-after, wenn rate_reset fehlt, und gibt bei zu langer Wartezeit auf", async () => {
    const { config, sleeps } = await setup(defaultHandler({ lead: { status: 429, headers: { "retry-after": "2" } } }), {
      maxRateLimitWaitMs: 5000,
    });
    await expect(submitLeadToClose(lead(), config, AT)).rejects.toMatchObject({ kind: "rate_limited", status: 429 });
    expect(sleeps).toEqual([2000, 2000]);
  });

  it("meldet Netzwerkfehler als eigene Klasse", async () => {
    const err = await submitLeadToClose(lead(), { apiKey: API_KEY, baseUrl: "http://127.0.0.1:9/api/v1" }).catch((e) => e);
    expect(err).toMatchObject({ kind: "network" });
  });
});
