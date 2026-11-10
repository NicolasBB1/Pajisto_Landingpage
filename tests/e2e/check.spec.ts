import { expect, test } from "@playwright/test";
import { open, runCheck, text } from "./helpers";

test.describe("Forderungscheck", () => {
  test("Testfall 1 – Einzelfall: 1 × 800 € → 800 €, Einzelfall-CTA", async ({ page }) => {
    await open(page);
    await runCheck(page, { route: "einzeln", count: "1", amount: "800" });
    await expect(page.getByTestId("result-title")).toHaveText("Auch eine einzelne offene Rechnung verdient Aufmerksamkeit.");
    expect(text(await page.getByTestId("volume-result").textContent())).toBe("800 €");
    await expect(page.getByTestId("volume-explain")).toContainText("Keine Prognose von Zahlungseingängen.");
    await expect(page.getByTestId("result-cta")).toContainText("Einzelforderung unverbindlich prüfen");
  });

  test("Testfall 2 – Gelegentlich: 5 × 500 €/Jahr → 2.500 €, CTA führt vorbefüllt zum Formular", async ({ page }) => {
    await open(page);
    await runCheck(page, { route: "gelegentlich", count: "5", amount: "500" });
    expect(text(await page.getByTestId("volume-result").textContent())).toBe("2.500 €");
    await expect(page.getByTestId("volume-caption")).toHaveText("Betroffenes Forderungsvolumen pro Jahr");
    const cta = page.getByTestId("result-cta");
    await expect(cta).toContainText("Passendes Betreuungsmodell finden");

    // Das Ergebnis steht vor der Kontaktabfrage; erst der Klick führt zum Formular.
    await cta.click();
    await expect(page.locator("#contact-need")).toHaveValue("gelegentlich");
    await expect(page.getByTestId("form-summary")).toContainText("5 Forderungen pro Jahr");
    await expect(page.locator("#contact-name")).toBeFocused();
  });

  test("Testfall 3 – Regelmäßig: 6 × 250 €/Monat → 18.000 € auf 12 Monate", async ({ page }) => {
    await open(page);
    await runCheck(page, { route: "regelmaessig", count: "6", amount: "250" });
    expect(text(await page.getByTestId("volume-result").textContent())).toBe("18.000 €");
    await expect(page.getByTestId("volume-caption")).toContainText("hochgerechnet auf 12 Monate");
    await expect(page.getByTestId("volume-explain")).toContainText("Hochrechnung");
    await expect(page.getByTestId("result-cta")).toContainText("Laufende Betreuung anfragen");
  });

  for (const route of ["einzeln", "gelegentlich", "regelmaessig"] as const) {
    test(`Testfall 4 – bestritten (${route}): individuelle Prüfung, keine Ablehnung`, async ({ page }) => {
      await open(page);
      await runCheck(page, { route, stage: "bestritten" });
      await expect(page.getByTestId("result-title")).toHaveText("Bestrittene Forderungen prüfen wir individuell.");
      await expect(page.getByTestId("result-cta")).toContainText("Individuelle Prüfung anfragen");
      await expect(page.getByTestId("result-cta")).toHaveAttribute("href", "#kontakt");
      await expect(page.getByTestId("check-result")).not.toContainText(/leider|nicht möglich|ablehnen/i);
    });
  }

  test("Testfall 5 – tituliert: Fokus auf Vollstreckung, keine Verfahrensübernahme", async ({ page }) => {
    await open(page);
    await runCheck(page, { route: "einzeln", stage: "tituliert" });
    await expect(page.getByTestId("result-title")).toContainText("Vollstreckung");
    await expect(page.getByTestId("result-body")).toContainText("Vollstreckungsmaßnahmen");
    await expect(page.getByTestId("check-result")).not.toContainText(/Gerichtsverfahren|übernehmen/i);
  });

  test("Testfall 7 – Zurück/Vorwärts erhält Eingaben, Ergebnis wird neu berechnet", async ({ page }) => {
    await open(page);
    const card = page.getByTestId("check-card");
    await runCheck(page, { route: "gelegentlich", count: "7", amount: "300", stage: "ueberfaellig" });
    expect(text(await page.getByTestId("volume-result").textContent())).toBe("2.100 €");

    await card.getByRole("button", { name: "Angaben ändern" }).click();
    await expect(card.locator('input[name="count"]')).toHaveValue("7");
    await expect(card.locator('input[name="amount"]')).toHaveValue("300");
    await expect(card.locator('select[name="stage"]')).toHaveValue("ueberfaellig");

    await card.getByRole("button", { name: "Zurück" }).click();
    await expect(card.getByRole("radio", { name: /Gelegentlich/ })).toBeChecked();
    await card.getByRole("button", { name: "Weiter" }).click();
    await expect(card.locator('input[name="count"]')).toHaveValue("7");

    await card.locator('input[name="amount"]').fill("1.250,50");
    await card.getByRole("button", { name: "Ergebnis anzeigen" }).click();
    expect(text(await page.getByTestId("volume-result").textContent())).toBe("8.753,50 €");

    await card.getByRole("button", { name: "Neu starten" }).click();
    await expect(card.getByRole("radio", { name: /Gelegentlich/ })).toBeChecked();
    await card.getByRole("button", { name: "Weiter" }).click();
    await expect(card.locator('input[name="count"]')).toHaveValue("4");
    await expect(card.locator('input[name="amount"]')).toHaveValue("500");
  });

  test("Standardauswahl ist »gelegentlich« mit den vorgesehenen Startwerten", async ({ page }) => {
    await open(page);
    const card = page.getByTestId("check-card");
    await expect(card.getByRole("radio", { name: /Gelegentlich/ })).toBeChecked();
    for (const [route, label, count] of [
      [/konkrete offene Rechnung/, "Wie viele konkrete Forderungen?", "1"],
      [/Jeden Monat/, "Wie viele Forderungen ungefähr pro Monat?", "6"],
      [/Gelegentlich/, "Wie viele Forderungen ungefähr pro Jahr?", "4"],
    ] as const) {
      await card.getByRole("radio", { name: route }).check({ force: true });
      await card.getByRole("button", { name: "Weiter" }).click();
      await expect(card.getByLabel(label)).toHaveValue(count);
      await card.getByRole("button", { name: "Zurück" }).click();
    }
  });

  test("Testfall 8 – ungültige Eingaben werden sichtbar abgelehnt", async ({ page }) => {
    await open(page);
    const card = page.getByTestId("check-card");
    await card.getByRole("button", { name: "Weiter" }).click();
    const count = card.locator('input[name="count"]');
    const amount = card.locator('input[name="amount"]');
    const submit = card.getByRole("button", { name: "Ergebnis anzeigen" });

    for (const bad of ["0", "-2", "", "abc", "2,5", "99999999999"]) {
      await count.fill(bad);
      await submit.click();
      await expect(card, `Anzahl "${bad}"`).toHaveAttribute("data-step", "2");
      await expect(count).toHaveAttribute("aria-invalid", "true");
      await expect(card.getByRole("alert").first()).toBeVisible();
      await expect(count).toBeFocused();
    }
    await count.fill("3");

    for (const bad of ["0", "-10", "", "viel", "99999999999"]) {
      await amount.fill(bad);
      await submit.click();
      await expect(card, `Betrag "${bad}"`).toHaveAttribute("data-step", "2");
      await expect(amount).toHaveAttribute("aria-invalid", "true");
      await expect(amount).toBeFocused();
    }

    // Kleine Beträge sind ausdrücklich erlaubt (keine künstliche Mindestgröße).
    await amount.fill("20");
    await submit.click();
    expect(text(await page.getByTestId("volume-result").textContent())).toBe("60 €");
  });

  test("sehr große Summen werden gerundet statt scheingenau angezeigt", async ({ page }) => {
    await open(page);
    await runCheck(page, { route: "regelmaessig", count: "400", amount: "1.234,56" });
    expect(text(await page.getByTestId("volume-result").textContent())).toBe("rund 5,9 Mio. €");
  });
});
