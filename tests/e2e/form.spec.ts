import { expect, test } from "@playwright/test";
import { fillContact, open, runCheck, stubLeadApi } from "./helpers";

const closeOk = { status: 200, body: { ok: true, mode: "close", event_id: "evt-1" } };

test.describe("Kontaktformular", () => {
  test("Testfall 6 – Direktanfrage ohne Check gegen den echten Endpunkt (Mock-Modus)", async ({ page }) => {
    await open(page);
    await expect(page.getByTestId("mock-notice")).toContainText("Es werden keine Daten versendet");
    await fillContact(page);

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith("/api/lead")),
      page.getByTestId("submit").click(),
    ]);
    expect(response.status()).toBe(200);
    const sent = response.request().postDataJSON();
    expect(sent.check).toBeUndefined();
    expect(sent.need).toBe("unklar");
    expect(sent.landing_variant).toBe("B");
    expect(await response.json()).toMatchObject({ ok: true, mode: "mock" });

    // Im Mock-Modus darf keine echte Eingangsbestätigung erscheinen.
    const success = page.getByTestId("form-success");
    await expect(success).toHaveAttribute("data-mode", "mock");
    await expect(success).toContainText("Demo-Modus: Es wurde nichts versendet.");
    await expect(success).not.toContainText("Vielen Dank");
  });

  test("übergibt Check-Kontext, UTM-Parameter und Variante im Übergabemodell", async ({ page }) => {
    const bodies = await stubLeadApi(page, () => closeOk);
    await open(page, "deny", "/?utm_source=meta&utm_medium=paid&utm_campaign=herbst&utm_content=video1&utm_term=inkasso&fbclid=abc");
    await runCheck(page, { route: "regelmaessig", count: "6", amount: "250", stage: "gemahnt" });
    await page.getByTestId("result-cta").click();
    await fillContact(page);
    await page.getByTestId("submit").click();

    await expect(page.getByTestId("form-success")).toContainText("Vielen Dank – Ihre Anfrage ist bei uns eingegangen.");
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({
      landing_variant: "B",
      need: "regelmaessig",
      check: {
        check_route: "regelmaessig",
        claim_count: 6,
        claim_period: "month",
        average_claim_amount_eur: 250,
        claim_stage: "gemahnt",
        debtor_customer_type: "gemischt",
        calculated_volume_eur: 18000,
      },
      utm: { utm_source: "meta", utm_medium: "paid", utm_campaign: "herbst", utm_content: "video1", utm_term: "inkasso" },
    });
    expect(bodies[0].utm.fbclid).toBeUndefined();
    expect(bodies[0].submission_id).toMatch(/^[A-Za-z0-9-]{16,64}$/);
  });

  test("Check-Angaben lassen sich vor dem Senden entfernen", async ({ page }) => {
    const bodies = await stubLeadApi(page, () => closeOk);
    await open(page);
    await runCheck(page, { route: "einzeln" });
    await page.getByTestId("result-cta").click();
    await page.getByRole("button", { name: "Nicht mitsenden" }).click();
    await fillContact(page);
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("form-success")).toBeVisible();
    expect(bodies[0].check).toBeUndefined();
  });

  test("clientseitige Validierung mit Fehlermeldungen an den Feldern, ohne Serveranfrage", async ({ page }) => {
    const bodies = await stubLeadApi(page, () => closeOk);
    await open(page);
    await page.getByTestId("submit").click();

    await expect(page.locator("#contact-name-error")).toHaveText("Bitte geben Sie Ihren Namen an.");
    await expect(page.locator("#contact-company-error")).toBeVisible();
    await expect(page.locator("#contact-email-error")).toBeVisible();
    await expect(page.locator("#contact-name")).toBeFocused();
    await expect(page.locator("#contact-name")).toHaveAttribute("aria-describedby", "contact-name-error");

    await fillContact(page, { email: "erika@beispiel" });
    await page.getByTestId("submit").click();
    await expect(page.locator("#contact-email-error")).toContainText("Bitte prüfen Sie die E-Mail-Adresse");
    await expect(page.locator("#contact-email")).toBeFocused();
    expect(bodies).toHaveLength(0);
    await expect(page.getByTestId("form-success")).toHaveCount(0);
  });

  test("serverseitige Feldfehler werden angezeigt", async ({ page }) => {
    await stubLeadApi(page, () => ({
      status: 400,
      body: { ok: false, error: "validation", fields: { email: "Bitte prüfen Sie die E-Mail-Adresse, zum Beispiel name@unternehmen.de." } },
    }));
    await open(page);
    await fillContact(page);
    await page.getByTestId("submit").click();
    await expect(page.locator("#contact-email-error")).toBeVisible();
    await expect(page.getByTestId("form-success")).toHaveCount(0);
  });

  test("Testfall 9 – Doppelklick sendet genau eine Anfrage, Button zeigt Ladezustand", async ({ page }) => {
    const bodies = await stubLeadApi(page, () => ({ ...closeOk, delayMs: 700 }));
    await open(page);
    await fillContact(page);
    const submit = page.getByTestId("submit");
    await submit.dblclick();
    await expect(submit).toBeDisabled();
    await expect(submit).toContainText("Wird gesendet");
    await submit.click({ force: true }).catch(() => {});
    await page.locator("#contact-form").evaluate((f: HTMLFormElement) => f.requestSubmit()).catch(() => {});
    await expect(page.getByTestId("form-success")).toBeVisible();
    expect(bodies).toHaveLength(1);
  });

  test("Testfall 10 – CRM nicht erreichbar: ehrliche Fehlermeldung, Retry mit gleicher ID, dann Erfolg", async ({ page }) => {
    const bodies = await stubLeadApi(page, (i) =>
      i === 0 ? { status: 502, body: { ok: false, error: "crm_unavailable" } } : closeOk,
    );
    await open(page);
    await fillContact(page);
    await page.locator("#contact-message").fill("Bitte Rückruf.");
    await page.getByTestId("submit").click();

    const error = page.getByTestId("form-error");
    await expect(error).toContainText("konnte gerade nicht übermittelt werden");
    await expect(error).toContainText("0911 88187939");
    await expect(page.getByTestId("form-success")).toHaveCount(0);
    await expect(page.getByText("Vielen Dank")).toHaveCount(0);
    // Eingaben bleiben erhalten.
    await expect(page.locator("#contact-name")).toHaveValue("Erika Beispiel");
    await expect(page.locator("#contact-message")).toHaveValue("Bitte Rückruf.");

    const submit = page.getByTestId("submit");
    await expect(submit).toContainText("Erneut senden");
    await submit.click();
    await expect(page.getByTestId("form-success")).toContainText("Vielen Dank");
    expect(bodies).toHaveLength(2);
    expect(bodies[1].submission_id).toBe(bodies[0].submission_id);
  });

  test("Netzwerkabbruch und nicht angebundenes Formular führen nie zu einer Erfolgsmeldung", async ({ page }) => {
    await open(page);
    await page.route("**/api/lead", (route) => route.abort("connectionrefused"));
    await fillContact(page);
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("form-error")).toContainText("konnte gerade nicht übermittelt werden");

    await page.unroute("**/api/lead");
    await stubLeadApi(page, () => ({ status: 503, body: { ok: false, error: "not_configured" } }));
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("form-error")).toContainText("nicht an unser System angebunden");
    await expect(page.getByTestId("form-success")).toHaveCount(0);
  });

  test("der echte Endpunkt lehnt ungültige Daten, Honeypot und fremde Origins ab", async ({ request, baseURL }) => {
    const valid = {
      submission_id: "0b9f3c1e-2a4d-4c8e-9f10-cccccccccccc",
      name: "Erika Beispiel",
      company: "Beispiel GmbH",
      email: "erika@beispiel.de",
      need: "unklar",
    };
    const bad = await request.post("/api/lead", { data: { ...valid, email: "x" } });
    expect(bad.status()).toBe(400);
    expect(await bad.json()).toMatchObject({ ok: false, error: "validation" });

    const bot = await request.post("/api/lead", { data: { ...valid, company_website: "http://spam.example" } });
    expect(await bot.json()).toEqual({ ok: false, error: "rejected" });

    const foreign = await request.post("/api/lead", { data: valid, headers: { origin: "https://fremde-seite.example" } });
    expect(foreign.status()).toBe(403);

    const form = await request.post("/api/lead", { form: { name: "x" } });
    expect(form.status()).toBe(415);

    const ok = await request.post("/api/lead", { data: valid, headers: { origin: baseURL! } });
    expect(await ok.json()).toMatchObject({ ok: true, mode: "mock" });
  });
});

test("Rate-Limit des echten Endpunkts greift nach 5 Anfragen je Client und meldet es ehrlich", async ({ request }) => {
  const headers = { "x-forwarded-for": "10.255.255.1" };
  const post = (n: number) =>
    request.post("/api/lead", {
      headers,
      data: {
        submission_id: `0b9f3c1e-2a4d-4c8e-9f10-dddddddddd0${n}`,
        name: "Erika Beispiel",
        company: "Beispiel GmbH",
        email: "erika@beispiel.de",
      },
    });
  for (let n = 1; n <= 5; n++) expect((await post(n)).status()).toBe(200);
  const blocked = await post(6);
  expect(blocked.status()).toBe(429);
  expect(await blocked.json()).toEqual({ ok: false, error: "rate_limited" });
});
