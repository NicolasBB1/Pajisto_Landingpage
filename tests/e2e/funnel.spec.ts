import { expect, test } from "@playwright/test";
import { answer, answerQuestions, closeOk, fillContact, funnel, open, stubLeadApi } from "./helpers";

test.describe("Multistep-Anfrage", () => {
  test("die erste Frage ist sofort sichtbar, eine Frage pro Schritt, mit Fortschritt", async ({ page }) => {
    await open(page);
    const f = funnel(page);
    await expect(f).toBeInViewport();
    await expect(f.getByRole("heading", { name: "Wie häufig bleiben bei Ihnen Rechnungen offen?" })).toBeVisible();
    await expect(page.getByTestId("funnel-count")).toHaveText("Frage 1 von 4");
    await expect(f.locator(".funnel-option")).toHaveCount(5);
    await expect(f.getByRole("button", { name: "Zurück" })).toHaveCount(0);

    await answer(page, "frequency", "paar_mal_jahr");
    await expect(page.getByTestId("funnel-count")).toHaveText("Frage 2 von 4");
    await expect(f.getByRole("heading", { name: "Wie hoch sind die offenen Forderungen ungefähr?" })).toBeFocused();
    await answer(page, "amount", "unter_250");
    await expect(f.getByRole("heading", { name: "Wer schuldet Ihnen das Geld?" })).toBeVisible();
    await answer(page, "debtor", "beides");
    await expect(f.getByRole("heading", { name: "Wie ist der aktuelle Stand?" })).toBeVisible();
    await answer(page, "stage", "unsicher");
    await expect(page.getByTestId("funnel-count")).toHaveText("Letzter Schritt");
    await expect(f.getByRole("heading", { name: "Wie können wir Sie erreichen?" })).toBeFocused();
    await expect(f.getByRole("progressbar")).toHaveAttribute("aria-valuenow", /\d+/);
  });

  test("Einzelfall: Singular in der Frage und kein Drängen in laufende Betreuung", async ({ page }) => {
    await open(page);
    await answer(page, "frequency", "einzelfall");
    await expect(funnel(page).getByRole("heading")).toHaveText("Wie hoch ist die offene Forderung ungefähr?");
    await answer(page, "amount", "ueber_5000");
    await answer(page, "debtor", "geschaeft");
    await answer(page, "stage", "ueberfaellig");
    const intro = page.getByTestId("contact-intro");
    await expect(intro).toContainText("Ihren konkreten Fall");
    await expect(intro).not.toContainText(/laufend|Abo/i);
  });

  test("bestritten und tituliert erhalten passende Kurztexte und dürfen abschließen", async ({ page }) => {
    await open(page);
    await answerQuestions(page, { stage: "bestritten" });
    await expect(page.getByTestId("contact-intro")).toContainText("individuell");
    await funnel(page).getByRole("button", { name: "Zurück" }).click();
    await answer(page, "stage", "tituliert");
    await expect(page.getByTestId("contact-intro")).toContainText("Vollstreckungsmaßnahmen");
    await expect(page.getByTestId("submit")).toBeEnabled();
  });

  test("Zurück und Antwortwechsel: Auswahl bleibt markiert, neue Antwort ersetzt die alte", async ({ page }) => {
    const bodies = await stubLeadApi(page, () => closeOk);
    await open(page);
    const f = funnel(page);
    await answerQuestions(page);
    await fillContact(page);

    // Drei Schritte zurück bis zur Forderungshöhe.
    for (const step of ["stage", "debtor", "amount"]) {
      await f.getByRole("button", { name: "Zurück" }).click();
      await expect(f).toHaveAttribute("data-step", step);
    }
    await expect(f.locator('[data-value="250_1000"]')).toHaveAttribute("aria-pressed", "true");
    // Antwort ändern → weiter; spätere Antworten sind noch da und per „Weiter“ erreichbar.
    await answer(page, "amount", "1000_5000");
    await expect(f.locator('[data-value="privat"]')).toHaveAttribute("aria-pressed", "true");
    await f.getByRole("button", { name: "Weiter" }).click();
    await f.getByRole("button", { name: "Weiter" }).click();
    await expect(f).toHaveAttribute("data-step", "contact");
    // Kontaktdaten sind erhalten geblieben.
    await expect(page.locator("#funnel-name")).toHaveValue("Erika Beispiel");

    await page.getByTestId("submit").click();
    await expect(page.getByTestId("funnel-success")).toBeVisible();
    expect(bodies[0]).toMatchObject({ frequency: "monatlich_1_5", amount: "1000_5000", debtor: "privat", stage: "gemahnt" });
  });

  test("Übergabemodell: Antworten, Quelle-relevante Felder, UTM, Variante und Herkunft in EINER Anfrage", async ({ page }) => {
    const bodies = await stubLeadApi(page, () => closeOk);
    await open(page, "deny", "/?utm_source=meta&utm_medium=paid&utm_campaign=herbst&utm_content=video1&utm_term=inkasso&fbclid=abc");
    await answerQuestions(page, { frequency: "monatlich_ueber_5", amount: "250_1000", debtor: "privat", stage: "gemahnt" });
    await fillContact(page);
    await page.getByTestId("submit").click();

    const success = page.getByTestId("funnel-success");
    await expect(success).toContainText("Vielen Dank – Ihre Anfrage ist bei uns eingegangen.");
    await expect(success).toContainText("melden uns per E-Mail");
    await expect(success.getByRole("heading")).toBeFocused();
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({
      landing_variant: "C",
      funnel_variant: "kurz",
      frequency: "monatlich_ueber_5",
      amount: "250_1000",
      debtor: "privat",
      stage: "gemahnt",
      name: "Erika Beispiel",
      company: "Beispiel Fitness GmbH",
      email: "erika@beispiel-fitness.de",
      contact_preference: "email",
      utm: { utm_source: "meta", utm_medium: "paid", utm_campaign: "herbst", utm_content: "video1", utm_term: "inkasso" },
      origin: { page_path: "/" },
    });
    expect(bodies[0].utm.fbclid).toBeUndefined();
    expect(bodies[0].submission_id).toMatch(/^[A-Za-z0-9-]{16,64}$/);
    // Der Funnel ist danach abgeschlossen – keine zweite Formularstrecke.
    await expect(page.getByTestId("submit")).toHaveCount(0);
    await expect(page.locator("form")).toHaveCount(0);
  });

  test("Validierung: Pflichtfelder, E-Mail und Telefonpflicht bei Rückruf", async ({ page }) => {
    const bodies = await stubLeadApi(page, () => closeOk);
    await open(page);
    await answerQuestions(page);
    await page.getByTestId("submit").click();

    await expect(page.locator("#funnel-name-error")).toHaveText("Bitte geben Sie Ihren Namen an.");
    await expect(page.locator("#funnel-company-error")).toBeVisible();
    await expect(page.locator("#funnel-email-error")).toBeVisible();
    await expect(page.locator("#funnel-phone-error")).toHaveCount(0);
    await expect(page.locator("#funnel-name")).toBeFocused();
    await expect(page.locator("#funnel-name")).toHaveAttribute("aria-describedby", "funnel-name-error");

    await fillContact(page, { email: "erika@beispiel" });
    await page.getByTestId("submit").click();
    await expect(page.locator("#funnel-email-error")).toContainText("Bitte prüfen Sie die E-Mail-Adresse");
    await page.locator("#funnel-email").fill("erika@beispiel.de");

    // Rückruf gewählt → Telefonnummer wird Pflicht.
    await expect(page.getByLabel("Telefon (optional)")).toBeVisible();
    await page.getByText("Per Rückruf").click();
    await expect(page.getByLabel("Telefon *")).toHaveAttribute("aria-required", "true");
    await page.getByTestId("submit").click();
    await expect(page.locator("#funnel-phone-error")).toHaveText("Für einen Rückruf benötigen wir Ihre Telefonnummer.");
    await expect(page.locator("#funnel-phone")).toBeFocused();
    expect(bodies).toHaveLength(0);

    await page.locator("#funnel-phone").fill("0911 123456");
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("funnel-success")).toContainText("rufen Sie zurück");
    expect(bodies[0]).toMatchObject({ contact_preference: "rueckruf", phone: "0911 123456" });
  });

  test("serverseitige Feldfehler werden am Feld angezeigt", async ({ page }) => {
    await stubLeadApi(page, () => ({
      status: 400,
      body: { ok: false, error: "validation", fields: { email: "Bitte prüfen Sie die E-Mail-Adresse, zum Beispiel name@unternehmen.de." } },
    }));
    await open(page);
    await answerQuestions(page);
    await fillContact(page);
    await page.getByTestId("submit").click();
    await expect(page.locator("#funnel-email-error")).toBeVisible();
    await expect(page.getByTestId("funnel-success")).toHaveCount(0);
  });

  test("Doppelklick sendet genau eine Anfrage, Button zeigt Ladezustand", async ({ page }) => {
    const bodies = await stubLeadApi(page, () => ({ ...closeOk, delayMs: 700 }));
    await open(page);
    await answerQuestions(page);
    await fillContact(page);
    const submit = page.getByTestId("submit");
    await submit.dblclick();
    await expect(submit).toBeDisabled();
    await expect(submit).toContainText("Wird gesendet");
    await page.getByTestId("funnel-form").evaluate((f: HTMLFormElement) => f.requestSubmit()).catch(() => {});
    await expect(page.getByTestId("funnel-success")).toBeVisible();
    expect(bodies).toHaveLength(1);
  });

  test("CRM nicht erreichbar: ehrliche Fehlermeldung, Retry mit gleicher ID, dann Erfolg", async ({ page }) => {
    const bodies = await stubLeadApi(page, (i) =>
      i === 0 ? { status: 502, body: { ok: false, error: "crm_unavailable" } } : closeOk,
    );
    await open(page);
    await answerQuestions(page);
    await fillContact(page);
    await page.getByTestId("submit").click();

    const error = page.getByTestId("form-error");
    await expect(error).toContainText("konnte gerade nicht übermittelt werden");
    await expect(error).toContainText("0911 88187939");
    await expect(page.getByTestId("funnel-success")).toHaveCount(0);
    await expect(page.getByText("Vielen Dank")).toHaveCount(0);
    await expect(page.locator("#funnel-name")).toHaveValue("Erika Beispiel");

    const submit = page.getByTestId("submit");
    await expect(submit).toContainText("Erneut senden");
    await submit.click();
    await expect(page.getByTestId("funnel-success")).toContainText("Vielen Dank");
    expect(bodies).toHaveLength(2);
    expect(bodies[1].submission_id).toBe(bodies[0].submission_id);
  });

  test("Netzwerkabbruch und nicht angebundenes Formular führen nie zu einer Erfolgsmeldung", async ({ page }) => {
    await open(page);
    await page.route("**/api/lead", (route) => route.abort("connectionrefused"));
    await answerQuestions(page);
    await fillContact(page);
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("form-error")).toContainText("konnte gerade nicht übermittelt werden");

    await page.unroute("**/api/lead");
    await stubLeadApi(page, () => ({ status: 503, body: { ok: false, error: "not_configured" } }));
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("form-error")).toContainText("nicht an unser System angebunden");
    await expect(page.getByTestId("funnel-success")).toHaveCount(0);
  });

  test("Vorschau-Modus gegen den echten Endpunkt: deutlicher Hinweis statt Eingangsbestätigung", async ({ page }) => {
    await open(page);
    await answerQuestions(page);
    await expect(page.getByTestId("mock-notice")).toContainText("Es werden keine Daten versendet");
    await fillContact(page);
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith("/api/lead")),
      page.getByTestId("submit").click(),
    ]);
    expect(await response.json()).toMatchObject({ ok: true, mode: "mock" });
    const success = page.getByTestId("funnel-success");
    await expect(success).toHaveAttribute("data-mode", "mock");
    await expect(success).toContainText("Vorschau-Modus: Es wurde nichts versendet.");
    await expect(success).not.toContainText("Vielen Dank");
    await expect(page.getByTestId("booking-link")).toHaveCount(0);
  });

  test("alle »Anfrage starten«-CTAs führen zum selben Funnel", async ({ page }) => {
    await open(page);
    const ctas = page.getByRole("link", { name: "Anfrage starten" });
    await expect(ctas).toHaveCount(2);
    for (const cta of await ctas.all()) await expect(cta).toHaveAttribute("href", "#anfrage");
    await expect(page.locator("#anfrage")).toHaveCount(1);

    await ctas.last().scrollIntoViewIfNeeded();
    await ctas.last().click();
    await expect(funnel(page)).toBeInViewport();
    await expect(funnel(page).getByRole("heading")).toBeFocused();
    // Kein zweiter Haupt-CTA und kein altes Check-/Kontaktformular mehr.
    await expect(page.getByText(/Forderungscheck|Direkt anfragen|Ergebnis anzeigen/)).toHaveCount(0);
  });

  test("ausführliche Variante per URL: zusätzliche Branchenfrage, Microcopy passt sich an", async ({ page }) => {
    const bodies = await stubLeadApi(page, () => closeOk);
    await open(page, "deny", "/?fv=ausfuehrlich");
    await expect(funnel(page)).toHaveAttribute("data-variant", "ausfuehrlich");
    await expect(page.getByTestId("funnel-count")).toHaveText("Frage 1 von 5");
    await expect(page.locator(".hero-micro")).toContainText("Fünf kurze Fragen");
    await answerQuestions(page, { industry: "verein" });
    await fillContact(page);
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("funnel-success")).toBeVisible();
    expect(bodies[0]).toMatchObject({ funnel_variant: "ausfuehrlich", industry: "verein" });
  });
});

test.describe("Echter Endpunkt", () => {
  const valid = {
    submission_id: "0b9f3c1e-2a4d-4c8e-9f10-cccccccccccc",
    landing_variant: "C",
    funnel_variant: "kurz",
    frequency: "einzelfall",
    amount: "unter_250",
    debtor: "privat",
    stage: "unsicher",
    name: "Erika Beispiel",
    company: "Beispiel GmbH",
    email: "erika@beispiel.de",
  };

  test("lehnt ungültige Daten, fehlende Antworten, Honeypot und fremde Origins ab", async ({ request, baseURL }) => {
    const bad = await request.post("/api/lead", { data: { ...valid, email: "x" } });
    expect(bad.status()).toBe(400);
    expect(await bad.json()).toMatchObject({ ok: false, error: "validation" });

    const missing = await request.post("/api/lead", { data: { ...valid, frequency: undefined } });
    expect(await missing.json()).toEqual({ ok: false, error: "bad_request" });

    const callback = await request.post("/api/lead", { data: { ...valid, contact_preference: "rueckruf" } });
    expect(await callback.json()).toMatchObject({ ok: false, error: "validation", fields: { phone: expect.any(String) } });

    const bot = await request.post("/api/lead", { data: { ...valid, company_website: "http://spam.example" } });
    expect(await bot.json()).toEqual({ ok: false, error: "rejected" });

    const foreign = await request.post("/api/lead", { data: valid, headers: { origin: "https://fremde-seite.example" } });
    expect(foreign.status()).toBe(403);

    const form = await request.post("/api/lead", { form: { name: "x" } });
    expect(form.status()).toBe(415);

    const ok = await request.post("/api/lead", { data: valid, headers: { origin: baseURL! } });
    expect(await ok.json()).toMatchObject({ ok: true, mode: "mock" });
  });

  test("Rate-Limit greift nach 5 Anfragen je Client und meldet es ehrlich", async ({ request }) => {
    const headers = { "x-forwarded-for": "10.255.255.1" };
    const post = (n: number) =>
      request.post("/api/lead", { headers, data: { ...valid, submission_id: `0b9f3c1e-2a4d-4c8e-9f10-dddddddddd0${n}` } });
    for (let n = 1; n <= 5; n++) expect((await post(n)).status()).toBe(200);
    const blocked = await post(6);
    expect(blocked.status()).toBe(429);
    expect(await blocked.json()).toEqual({ ok: false, error: "rate_limited" });
  });
});
