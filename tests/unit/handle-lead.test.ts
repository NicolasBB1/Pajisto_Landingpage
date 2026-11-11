import { afterEach, describe, expect, it } from "vitest";
import type { LeadApiResponse } from "@/lib/lead";
import { getCloseConfig, getLeadMode } from "@/lib/server/config";
import { createIdempotencyStore, createRateLimiter } from "@/lib/server/guards";
import { HONEYPOT_FIELD, handleLead, type LeadDeps } from "@/lib/server/handle-lead";
import { defaultHandler, startCloseMock } from "./close-mock-server";

const payload = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    submission_id: "0b9f3c1e-2a4d-4c8e-9f10-bbbbbbbbbbbb",
    landing_variant: "C",
    funnel_variant: "kurz",
    frequency: "einzelfall",
    amount: "1000_5000",
    debtor: "geschaeft",
    stage: "ueberfaellig",
    name: "Erika Beispiel",
    company: "Beispiel Fitness GmbH",
    email: "erika@beispiel-fitness.de",
    contact_preference: "email",
    ...over,
  });

function deps(over: Partial<LeadDeps> = {}): LeadDeps & { logs: string[] } {
  const logs: string[] = [];
  return {
    mode: "mock",
    close: null,
    rateLimiter: createRateLimiter(5, 60_000),
    idempotency: createIdempotencyStore<LeadApiResponse & { ok: true }>(60_000),
    log: (m) => logs.push(m),
    logs,
    ...over,
  };
}

let mock: Awaited<ReturnType<typeof startCloseMock>> | undefined;
afterEach(async () => {
  await mock?.close();
  mock = undefined;
});

describe("POST /api/lead – Verarbeitung", () => {
  it("Mock-Modus bestätigt ausdrücklich als mock und ruft kein CRM auf", async () => {
    const r = await handleLead(payload(), "1.1.1.1", deps());
    expect(r).toEqual({ status: 200, body: { ok: true, mode: "mock", event_id: "0b9f3c1e-2a4d-4c8e-9f10-bbbbbbbbbbbb" } });
  });

  it("gültige Anfrage erreicht Close mit Zeitstempel", async () => {
    mock = await startCloseMock(defaultHandler());
    const r = await handleLead(payload(), "1.1.1.1", deps({ mode: "close", close: { apiKey: "k", baseUrl: mock.baseUrl } }));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, mode: "close" });
    expect(mock.requests.filter((q) => q.path === "/api/v1/lead/")).toHaveLength(1);
  });

  it("gibt Feldfehler zurück und ruft bei ungültigen Daten kein CRM auf", async () => {
    mock = await startCloseMock(defaultHandler());
    const r = await handleLead(payload({ email: "x" }), "1.1.1.1", deps({ mode: "close", close: { apiKey: "k", baseUrl: mock.baseUrl } }));
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ ok: false, error: "validation", fields: { email: expect.any(String) } });
    expect(mock.requests).toHaveLength(0);
  });

  it("lehnt kaputtes JSON, zu große Bodies und gefüllten Honeypot ohne Erfolgsmeldung ab", async () => {
    expect((await handleLead("{", "1.1.1.1", deps())).body).toEqual({ ok: false, error: "bad_request" });
    expect((await handleLead("x".repeat(20_000), "1.1.1.1", deps())).status).toBe(413);
    const hp = await handleLead(payload({ [HONEYPOT_FIELD]: "http://spam.example" }), "1.1.1.1", deps());
    expect(hp).toEqual({ status: 400, body: { ok: false, error: "rejected" } });
  });

  it("doppelte Einsendung (gleiche submission_id) erzeugt nur einen Lead", async () => {
    mock = await startCloseMock(defaultHandler());
    const d = deps({ mode: "close", close: { apiKey: "k", baseUrl: mock.baseUrl } });
    const [a, b] = await Promise.all([handleLead(payload(), "1.1.1.1", d), handleLead(payload(), "1.1.1.1", d)]);
    const c = await handleLead(payload(), "1.1.1.1", d);
    expect([a.status, b.status, c.status]).toEqual([200, 200, 200]);
    expect(mock.requests.filter((q) => q.path === "/api/v1/lead/")).toHaveLength(1);
  });

  it("CRM nicht erreichbar: kein Erfolg, Fehlerklasse im Log ohne Personenbezug, Retry möglich", async () => {
    let fail = true;
    mock = await startCloseMock((req, i) =>
      fail && req.path === "/api/v1/lead/" ? { status: 503, body: { error: "down" } } : defaultHandler()(req, i),
    );
    const d = deps({ mode: "close", close: { apiKey: "api_SECRET", baseUrl: mock.baseUrl } });

    const first = await handleLead(payload(), "1.1.1.1", d);
    expect(first).toEqual({ status: 502, body: { ok: false, error: "crm_unavailable" } });
    expect(d.logs).toEqual(["[lead] CRM-Einsendung fehlgeschlagen: server/503"]);
    expect(d.logs.join()).not.toMatch(/erika|Beispiel|api_SECRET/);

    fail = false;
    const second = await handleLead(payload(), "1.1.1.1", d);
    expect(second.body).toMatchObject({ ok: true, mode: "close" });
  });

  it.each([401, 403, 429])("meldet Close-Status %i nach außen nur als crm_unavailable", async (status) => {
    mock = await startCloseMock(defaultHandler({ searchEmail: { status, headers: { "retry-after": "60" } } }));
    const d = deps({ mode: "close", close: { apiKey: "k", baseUrl: mock.baseUrl, sleep: async () => {} } });
    const r = await handleLead(payload(), "1.1.1.1", d);
    expect(r).toEqual({ status: 502, body: { ok: false, error: "crm_unavailable" } });
  });

  it("ohne Konfiguration: 503 not_configured statt Schein-Erfolg", async () => {
    expect((await handleLead(payload(), "1.1.1.1", deps({ mode: "disabled" }))).body).toEqual({ ok: false, error: "not_configured" });
    expect((await handleLead(payload(), "1.1.1.1", deps({ mode: "close", close: null }))).status).toBe(503);
  });

  it("begrenzt Anfragen je Client, zählt aber keine Tippfehler", async () => {
    const d = deps({ rateLimiter: createRateLimiter(2, 60_000) });
    const id = (n: number) => ({ submission_id: `0b9f3c1e-2a4d-4c8e-9f10-00000000000${n}` });
    await handleLead(payload({ email: "falsch" }), "9.9.9.9", d);
    await handleLead(payload({ email: "falsch" }), "9.9.9.9", d);
    expect((await handleLead(payload(id(1)), "9.9.9.9", d)).status).toBe(200);
    expect((await handleLead(payload(id(2)), "9.9.9.9", d)).status).toBe(200);
    expect((await handleLead(payload(id(3)), "9.9.9.9", d)).body).toEqual({ ok: false, error: "rate_limited" });
    expect((await handleLead(payload(id(4)), "8.8.8.8", d)).status).toBe(200);
  });
});

describe("Konfiguration", () => {
  it("leitet den Modus sicher aus der Umgebung ab", () => {
    expect(getLeadMode({ LEAD_MODE: "mock", NODE_ENV: "production" })).toBe("mock");
    expect(getLeadMode({ LEAD_MODE: "close", CLOSE_API_KEY: "k" })).toBe("close");
    expect(getLeadMode({ LEAD_MODE: "close" })).toBe("disabled");
    expect(getLeadMode({ NODE_ENV: "production" })).toBe("disabled");
    expect(getLeadMode({ NODE_ENV: "development" })).toBe("mock");
    // Ein Key allein schaltet nichts scharf.
    expect(getLeadMode({ CLOSE_API_KEY: "k", NODE_ENV: "production" })).toBe("disabled");
  });

  it("erlaubt eine abweichende Close-URL nie in Produktion", () => {
    const env = { CLOSE_API_KEY: "k", CLOSE_API_BASE_URL: "http://evil.example" };
    expect(getCloseConfig({ ...env, NODE_ENV: "production" })?.baseUrl).toBeUndefined();
    expect(getCloseConfig({ ...env, NODE_ENV: "test" })?.baseUrl).toBe("http://evil.example");
    expect(getCloseConfig({})).toBeNull();
  });
});
