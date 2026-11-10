import { expect, test } from "@playwright/test";
import { events, fillContact, open, runCheck, stubLeadApi } from "./helpers";

const closeOk = { status: 200, body: { ok: true, mode: "close", event_id: "evt-42" } };

async function fullJourney(page: import("@playwright/test").Page) {
  await runCheck(page, { route: "regelmaessig", count: "6", amount: "250" });
  await page.getByTestId("result-cta").click();
  await fillContact(page);
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("form-success")).toBeVisible();
}

test.describe("Testfall 11 – Consent und Tracking", () => {
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

  test("nach Einwilligung: Skripte laden, Events ohne personenbezogene Daten, Lead erst nach bestätigtem Eingang", async ({ page }) => {
    await stubLeadApi(page, (i) => (i === 0 ? { status: 502, body: { ok: false, error: "crm_unavailable" } } : closeOk));
    const { trackerHits } = await open(page, "accept");
    await expect.poll(() => trackerHits.some((u) => u.includes("connect.facebook.net"))).toBe(true);
    expect(trackerHits.some((u) => u.includes("googletagmanager.com/gtag/js?id=G-TEST000000"))).toBe(true);

    // Aufrufe an fbq mitschneiden (das echte Skript wird in Tests nicht geladen).
    await page.evaluate(() => {
      (window as any).__fbqCalls = [];
      const original = window.fbq!;
      window.fbq = ((...args: unknown[]) => {
        (window as any).__fbqCalls.push(args);
        original(...args);
      }) as typeof window.fbq;
    });

    await runCheck(page, { route: "regelmaessig", count: "6", amount: "250" });
    await page.getByTestId("result-cta").click();
    await fillContact(page);
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("form-error")).toBeVisible();

    const fbqNames = () => page.evaluate(() => (window as any).__fbqCalls.map((c: unknown[]) => `${c[0]}:${c[1]}`));
    // Fehlgeschlagene Einsendung: kein Lead-Event.
    expect(await fbqNames()).not.toContain("track:Lead");

    await page.getByTestId("submit").click();
    await expect(page.getByTestId("form-success")).toBeVisible();

    expect(await events(page)).toEqual([
      { name: "check_start", params: { landing_variant: "B" } },
      { name: "check_step_2", params: { route: "regelmaessig" } },
      { name: "check_complete", params: { route: "regelmaessig", stage: "gemahnt", period: "month" } },
      { name: "result_cta_click", params: { route: "regelmaessig" } },
      { name: "form_start", params: { route: "regelmaessig" } },
      { name: "lead_submit_failure", params: { error_class: "crm_unavailable" } },
      { name: "lead_submit_success", params: { landing_variant: "B", route: "regelmaessig" } },
    ]);

    const calls: unknown[][] = await page.evaluate(() => (window as any).__fbqCalls);
    const leadCalls = calls.filter((c) => c[0] === "track" && c[1] === "Lead");
    expect(leadCalls).toEqual([["track", "Lead", {}, { eventID: "evt-42" }]]);

    // Nichts Personenbezogenes und keine Beträge/Fallzahlen in irgendeinem Aufruf oder Request.
    const everything = JSON.stringify([calls, await events(page), trackerHits]);
    for (const secret of ["Erika", "Beispiel", "erika@", "250", "18000", "18.000"]) {
      expect(everything).not.toContain(secret);
    }
  });

  test("Demo-Einsendungen lösen kein Lead-Event aus", async ({ page }) => {
    await open(page, "accept");
    await fillContact(page);
    await page.getByTestId("submit").click();
    await expect(page.getByTestId("form-success")).toHaveAttribute("data-mode", "mock");
    const names = (await events(page)).map((e: { name: string }) => e.name);
    expect(names).toEqual(["form_start"]);
  });

  test("Einwilligung lässt sich über den Footer widerrufen", async ({ page }) => {
    await open(page, "accept");
    await page.getByRole("button", { name: "Cookie-Einstellungen" }).click();
    await page.getByTestId("consent-deny").click();
    await runCheck(page, { route: "einzeln" });
    expect(await events(page)).toEqual([]);
    expect(await page.evaluate(() => (window as any)["ga-disable-G-TEST000000"])).toBe(true);
  });
});
