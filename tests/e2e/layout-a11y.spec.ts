import { expect, test } from "@playwright/test";
import { fillContact, open, runCheck, text } from "./helpers";

const VIEWPORTS = [
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page, label: string) {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll, `${label}: horizontaler Überlauf`).toBeLessThanOrEqual(client);
}

test.describe("Testfall 12 – Mobile, Tablet, Desktop", () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.width}px: kein Überlauf, Check und Formular bedienbar`, async ({ page }) => {
      await page.setViewportSize(viewport);
      // Banner bewusst offen lassen: Auch damit darf nichts überlaufen.
      await open(page, "none");
      await expectNoHorizontalOverflow(page, "Start mit Consent-Banner");
      await page.getByTestId("consent-deny").click();

      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator(".nav .btn")).toBeInViewport();

      await runCheck(page, { route: "regelmaessig", count: "100000", amount: "10.000.000" });
      await expect(page.getByTestId("volume-result")).toBeVisible();
      await expectNoHorizontalOverflow(page, "Ergebnis mit Maximalwerten");
      // Kein Bereich darf seitlich verschoben sein (dekorative Formen ragen über den Rand).
      expect(await page.evaluate(() => [...document.querySelectorAll("*")].filter((el) => el.scrollLeft !== 0).length)).toBe(0);
      const cta = page.getByTestId("result-cta");
      const box = (await cta.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.height).toBeGreaterThanOrEqual(44);

      await cta.click();
      await fillContact(page, { company: "Sehr lange Beispielfirma für Gebäudemanagement und Dienstleistungen GmbH & Co. KG" });
      const submit = page.getByTestId("submit");
      await submit.scrollIntoViewIfNeeded();
      await expect(submit).toBeInViewport();
      await expectNoHorizontalOverflow(page, "Formular");

      await submit.click();
      await expect(page.getByTestId("form-success")).toBeVisible();
      await expectNoHorizontalOverflow(page, "Erfolgsansicht");
    });
  }
});

test.describe("Testfall 13 – Tastatur und Screenreader-Kern", () => {
  test("alle drei Schritte und das Formular sind ohne Maus bedienbar", async ({ page }) => {
    await open(page, "none");
    // Consent per Tastatur ablehnen.
    await page.getByTestId("consent-deny").focus();
    await page.keyboard.press("Enter");

    // Schritt 1: Radiogruppe mit Pfeiltasten.
    const card = page.getByTestId("check-card");
    await card.getByRole("radio", { name: /Gelegentlich/ }).focus();
    await page.keyboard.press("ArrowDown");
    await expect(card.getByRole("radio", { name: /Jeden Monat/ })).toBeChecked();
    await page.keyboard.press("Tab");
    await expect(card.getByRole("button", { name: "Weiter" })).toBeFocused();
    await page.keyboard.press("Enter");

    // Schritt 2: Fokus liegt auf der neuen Überschrift, Felder per Tab erreichbar.
    await expect(card.getByRole("heading", { name: "Erzählen Sie uns kurz mehr." })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(card.getByLabel("Wie viele Forderungen ungefähr pro Monat?")).toBeFocused();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("6");
    await page.keyboard.press("Tab");
    await expect(card.getByLabel("Durchschnittliche Hauptforderung in Euro")).toBeFocused();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("250");
    // Enter im Feld sendet Schritt 2 ab.
    await page.keyboard.press("Enter");

    // Schritt 3: Ergebnis-Überschrift erhält den Fokus.
    await expect(page.getByTestId("result-title")).toBeFocused();
    expect(text(await page.getByTestId("volume-result").textContent())).toBe("18.000 €");
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("result-cta")).toBeFocused();
    await page.keyboard.press("Enter");

    // Formular: Fokus im ersten Feld, Ausfüllen und Absenden per Tastatur.
    await expect(page.locator("#contact-name")).toBeFocused();
    await page.keyboard.type("Erika Beispiel");
    await page.keyboard.press("Tab");
    await page.keyboard.type("Beispiel GmbH");
    await page.keyboard.press("Tab");
    await page.keyboard.type("erika@beispiel.de");
    await page.keyboard.press("Enter");
    const success = page.getByTestId("form-success");
    await expect(success).toBeVisible();
    await expect(success).toBeFocused();
  });

  test("Fehler in Schritt 2 werden angesagt und mit dem Feld verknüpft", async ({ page }) => {
    await open(page);
    const card = page.getByTestId("check-card");
    await card.getByRole("button", { name: "Weiter" }).click();
    const count = card.locator('input[name="count"]');
    await count.fill("0");
    await count.press("Enter");
    const describedBy = (await count.getAttribute("aria-describedby"))!.split(" ");
    const errorId = describedBy.find((id) => id.endsWith("count-error"))!;
    const error = page.locator(`[id="${errorId}"]`);
    await expect(error).toHaveAttribute("role", "alert");
    await expect(error).toHaveText("Die Anzahl muss mindestens 1 betragen.");
  });

  test("semantische Grundstruktur: eine H1, beschriftete Felder, Honeypot unsichtbar", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "Hauptnavigation" })).toBeVisible();

    const unlabeled = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLInputElement>("input, select, textarea")]
        .filter((el) => !el.labels?.length && !el.getAttribute("aria-label"))
        .map((el) => el.name || el.id),
    );
    expect(unlabeled).toEqual([]);

    const hp = page.locator('input[name="company_website"]');
    await expect(hp).toHaveAttribute("tabindex", "-1");
    await expect(page.locator(".hp-field")).toHaveAttribute("aria-hidden", "true");
    await expect(hp).not.toBeInViewport();
  });

  test("Seite ist als noindex markiert, verlinkt Impressum/Datenschutz und zeigt in Produktion keine Vorschau-Leiste", async ({ page }) => {
    await open(page);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByTestId("preview-bar")).toHaveCount(0);
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Impressum" })).toHaveAttribute("href", "https://www.pajisto.de/impressum");
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Datenschutz" })).toHaveAttribute("href", "https://www.pajisto.de/datenschutz");
  });

  test("Seitentext enthält keine unzulässigen Versprechen oder Preisangaben", async ({ page }) => {
    await open(page);
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/garant|erfolgsquote|kostenlos|ohne risiko|100\s?%|smart flat|schuldner trägt|trägt der schuldner/i);
  });
});
