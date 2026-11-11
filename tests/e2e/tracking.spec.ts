import { expect, test, type Page } from "@playwright/test";
import { answer, answerQuestions, closeOk, events, fillContact, open, stubLeadApi } from "./helpers";

async function fullJourney(page: Page) {
  await answerQuestions(page);
  await fillContact(page);
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("funnel-success")).toBeVisible();
}

async function recordFbq(page: Page) {
  await page.evaluate(() => {
    (window as any).__fbqCalls = [];
    const original = window.fbq!;
    window.fbq = ((...args: unknown[]) => {
      (window as any).__fbqCalls.push(args);
      original(...args);
    }) as typeof window.fbq;
  });
}
const fbqCalls = (page: Page): Promise<unknown[][]> => page.evaluate(() => (window as any).__fbqCalls);

test.describe("Consent und Tracking", () => {
  test("ohne Entscheidung: kein Tracking-Request, kein Event, kein fbq/gtag", async ({ page }) => {
    await stubLeadApi(page, () => closeOk);
    const { trackerHits } = await open(page, "none");
    await expect(page.getByTestId("consent-banner")).toBeVisible();
    await fullJourney(page);
    expect(trackerHits).toEqual([]);
    expect(await events(page)).toEqual([]);
    expect(await page.evaluate(() => typeof window.fbq + typeof window.gtag)).toBe("undefinedundefined");
  });

  test("nach Ablehnung: kein Tracking, Entscheidung bleibt nach Reload bestehen", async ({ page }) => {
    await stubLeadApi(page, () => closeOk);
    const { trackerHits } = await open(page, "deny");
    await fullJourney(page);
    await page.reload();
    await expect(page.getByTestId("consent-banner")).toHaveCount(0);
    expect(trackerHits).toEqual([]);
    expect(await events(page)).toEqual([]);
  });

  test("nach Einwilligung: Funnel-Events ohne Antworten oder Personenbezug, Lead genau einmal nach bestätigtem Eingang", async ({ page }) => {
    await stubLeadApi(page, (i) => (i === 0 ? { status: 502, body: { ok: false, error: "crm_unavailable" } } : closeOk));
    await page.route("https://termin.example/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "ok" }));
    const { trackerHits } = await open(page, "accept");
    await expect.poll(() => trackerHits.some((u) => u.includes("connect.facebook.net"))).toBe(true);
    expect(trackerHits.some((u) => u.includes("googletagmanager.com/gtag/js?id=G-TEST000000"))).toBe(true);
    await recordFbq(page);

    await answerQuestions(page, { frequency: "monatlich_ueber_5" });
    // Zurück und erneut antworten zählt den Schritt nicht doppelt.
    await page.getByTestId("funnel").getByRole("button", { name: "Zurück" }).click();
    await answer(page, "stage", "bestritten");
    await fillContact(page);
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("form-error")).toBeVisible();
    expect((await fbqCalls(page)).some((c) => c[1] === "Lead")).toBe(false);

    await page.getByTestId("submit").click();
    await expect(page.getByTestId("funnel-success")).toBeVisible();

    const fv = { funnel_variant: "kurz" };
    expect(await events(page)).toEqual([
      { name: "funnel_start", params: { landing_variant: "C", ...fv } },
      { name: "funnel_step_complete", params: { step: "frequency", step_number: 1, ...fv } },
      { name: "funnel_step_complete", params: { step: "amount", step_number: 2, ...fv } },
      { name: "funnel_step_complete", params: { step: "debtor", step_number: 3, ...fv } },
      { name: "funnel_step_complete", params: { step: "stage", step_number: 4, ...fv } },
      { name: "lead_submit_failure", params: { error_class: "crm_unavailable" } },
      { name: "funnel_step_complete", params: { step: "contact", step_number: 5, ...fv } },
      { name: "lead_submit_success", params: { landing_variant: "C", segment: "regelmaessig", ...fv } },
    ]);

    const leadCalls = (await fbqCalls(page)).filter((c) => c[0] === "track" && c[1] === "Lead");
    expect(leadCalls).toEqual([["track", "Lead", {}, { eventID: "evt-42" }]]);

    // Optionaler Terminlink: eigener Event, kein zweites Lead-Event.
    const booking = page.getByTestId("booking-link");
    await expect(booking).toHaveAttribute("href", "https://termin.example/pajisto");
    await expect(booking).toHaveAttribute("rel", /noopener/);
    const [popup] = await Promise.all([page.waitForEvent("popup"), booking.click()]);
    await popup.close();
    expect((await events(page)).at(-1)).toEqual({ name: "booking_link_click", params: fv });
    expect((await fbqCalls(page)).filter((c) => c[1] === "Lead")).toHaveLength(1);

    // Nichts Personenbezogenes und keine einzelnen Antworten in Events oder Requests.
    const everything = JSON.stringify([await fbqCalls(page), await events(page), trackerHits]);
    for (const secret of ["Erika", "Beispiel", "erika@", "bestritten", "250_1000", "privat", "monatlich"]) {
      expect(everything, secret).not.toContain(secret);
    }
  });

  test("Abbruch wird einmal gemeldet – aber nicht nach erfolgreicher Anfrage und nicht ohne Start", async ({ page }) => {
    await stubLeadApi(page, () => closeOk);
    await open(page, "accept");
    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    expect(await events(page)).toEqual([]);

    await answer(page, "frequency", "einzelfall");
    await answer(page, "amount", "unter_250");
    await page.evaluate(() => {
      window.dispatchEvent(new Event("pagehide"));
      window.dispatchEvent(new Event("pagehide"));
    });
    const abandons = (await events(page)).filter((e: { name: string }) => e.name === "funnel_abandon");
    expect(abandons).toEqual([{ name: "funnel_abandon", params: { last_step: "debtor", step_number: 3, funnel_variant: "kurz" } }]);

    await page.reload();
    await fullJourney(page);
    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    expect((await events(page)).some((e: { name: string }) => e.name === "funnel_abandon")).toBe(false);
  });

  test("Vorschau-Einsendungen lösen kein Lead-Event aus", async ({ page }) => {
    await open(page, "accept");
    await recordFbq(page);
    await answerQuestions(page);
    await fillContact(page);
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("funnel-success")).toHaveAttribute("data-mode", "mock");
    expect((await events(page)).some((e: { name: string }) => e.name === "lead_submit_success")).toBe(false);
    expect((await fbqCalls(page)).some((c) => c[1] === "Lead")).toBe(false);
  });

  test("Einwilligung lässt sich über den Footer widerrufen", async ({ page }) => {
    await open(page, "accept");
    await page.getByRole("button", { name: "Cookie-Einstellungen" }).click();
    await page.getByTestId("consent-deny").click();
    await answer(page, "frequency", "einzelfall");
    expect(await events(page)).toEqual([]);
    expect(await page.evaluate(() => (window as any)["ga-disable-G-TEST000000"])).toBe(true);
  });
});
