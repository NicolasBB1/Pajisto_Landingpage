import { expect, test, type Page } from "@playwright/test";
import { answer, answerQuestions, fillContact, funnel, open } from "./helpers";

const VIEWPORTS = [
  { name: "Android", width: 360, height: 740 },
  { name: "iPhone", width: 390, height: 844 },
  { name: "Tablet", width: 768, height: 1024 },
  { name: "Laptop", width: 1024, height: 768 },
  { name: "Desktop", width: 1440, height: 900 },
];

async function expectNoOverflow(page: Page, label: string) {
  const r = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
    shifted: [...document.querySelectorAll("*")].filter((el) => el.scrollLeft !== 0).length,
  }));
  expect(r.scroll, `${label}: horizontaler Überlauf`).toBeLessThanOrEqual(r.client);
  expect(r.shifted, `${label}: seitlich verschobener Bereich`).toBe(0);
}

test.describe("Mobile, Tablet, Desktop", () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.name} ${viewport.width}px: erste Frage früh sichtbar, kein Überlauf, große Antwortflächen`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await open(page, "none");
      await expectNoOverflow(page, "Start mit Consent-Banner");
      await page.getByTestId("consent-deny").click();

      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // Die erste Frage beginnt im ersten Bildschirm.
      const question = funnel(page).getByRole("heading");
      const top = (await question.boundingBox())!.y;
      expect(top, "Position der ersten Frage").toBeLessThan(viewport.height * 0.62);

      for (const option of await funnel(page).locator(".funnel-option").all()) {
        const box = (await option.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(56);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      }

      await answerQuestions(page);
      await expectNoOverflow(page, "Kontaktschritt");
      await fillContact(page, { company: "Sehr lange Beispielfirma für Gebäudemanagement und Dienstleistungen GmbH & Co. KG" });
      const submit = page.getByTestId("submit");
      await submit.scrollIntoViewIfNeeded();
      await expect(submit).toBeInViewport();
      expect((await submit.boundingBox())!.height).toBeGreaterThanOrEqual(48);
      await submit.click();
      await expect(page.getByTestId("funnel-success")).toBeVisible();
      await expect(page.getByTestId("funnel-success")).toBeInViewport();
      await expectNoOverflow(page, "Bestätigung");
    });
  }

  test("kein Layoutsprung: die Karte behält auf dem Desktop über alle Fragen ihre Höhe", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page);
    const height = async () => Math.round((await funnel(page).boundingBox())!.height);
    const first = await height();
    await answer(page, "frequency", "einzelfall");
    expect(await height()).toBe(first);
    await answer(page, "amount", "unter_250");
    expect(await height()).toBe(first);
    await answer(page, "debtor", "privat");
    expect(await height()).toBe(first);
  });
});

test.describe("Tastatur und Screenreader-Kern", () => {
  test("der gesamte Funnel ist ohne Maus bedienbar", async ({ page }) => {
    await open(page, "none");
    await page.getByTestId("consent-deny").focus();
    await page.keyboard.press("Enter");

    const f = funnel(page);
    await f.locator(".funnel-option").first().focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(f.locator('[data-value="monatlich_1_5"]')).toBeFocused();
    await page.keyboard.press("Enter");

    // Nach jedem Schritt liegt der Fokus auf der neuen Frage; Tab führt zur ersten Antwort.
    for (const [step, title] of [
      ["amount", "Wie hoch sind die offenen Forderungen ungefähr?"],
      ["debtor", "Wer schuldet Ihnen das Geld?"],
      ["stage", "Wie ist der aktuelle Stand?"],
    ] as const) {
      await expect(f).toHaveAttribute("data-step", step);
      await expect(f.getByRole("heading", { name: title })).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(f.locator(".funnel-option").first()).toBeFocused();
      await page.keyboard.press("Space");
    }

    await expect(f.getByRole("heading", { name: "Wie können wir Sie erreichen?" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.locator("#funnel-name")).toBeFocused();
    await page.keyboard.type("Erika Beispiel");
    await page.keyboard.press("Tab");
    await page.keyboard.type("Beispiel GmbH");
    await page.keyboard.press("Tab");
    await page.keyboard.type("erika@beispiel.de");
    await page.keyboard.press("Tab");
    // Kontaktpräferenz: echte Radiogruppe, Pfeiltaste wechselt auf Rückruf.
    await expect(page.getByRole("radio", { name: "Per E-Mail" })).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: "Per Rückruf" })).toBeChecked();
    await page.keyboard.press("Tab");
    await expect(page.locator("#funnel-phone")).toBeFocused();
    await page.keyboard.type("0911 123456");
    await page.keyboard.press("Enter");

    const success = page.getByTestId("funnel-success");
    await expect(success).toBeVisible();
    await expect(success.getByRole("heading")).toBeFocused();
  });

  test("Skip-Link ist das erste Tab-Ziel und führt zur Anfrage", async ({ page }) => {
    await open(page, "none");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Direkt zur Anfrage" });
    await expect(skip).toBeFocused();
    await expect(skip).toHaveAttribute("href", "#anfrage");
  });

  test("Antwortkarten melden ihren Zustand, Fortschritt ist ausgezeichnet", async ({ page }) => {
    await open(page);
    const f = funnel(page);
    await expect(f.getByRole("group", { name: "Wie häufig bleiben bei Ihnen Rechnungen offen?" })).toBeVisible();
    await expect(f.locator(".funnel-option").first()).toHaveAttribute("aria-pressed", "false");
    await answer(page, "frequency", "einzelfall");
    await f.getByRole("button", { name: "Zurück" }).click();
    await expect(f.locator('[data-value="einzelfall"]')).toHaveAttribute("aria-pressed", "true");
    await expect(f.getByRole("progressbar", { name: "Fortschritt der Anfrage" })).toBeVisible();
  });

  test("Reduced Motion: keine Animationen im Funnel", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page);
    await answer(page, "frequency", "einzelfall");
    expect(await page.locator(".funnel-step").evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  });

  test("semantische Grundstruktur: eine H1, beschriftete Felder, Honeypot unsichtbar", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Offene Rechnungen\?\s*Wir übernehmen das\./);
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
    await expect(page.getByRole("main")).toHaveCount(1);
    await answerQuestions(page);
    const unlabeled = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLInputElement>("input, select, textarea")]
        .filter((el) => !el.labels?.length && !el.getAttribute("aria-label"))
        .map((el) => el.name || el.id),
    );
    expect(unlabeled).toEqual([]);
    const hp = page.locator('input[name="company_website"]');
    await expect(hp).toHaveAttribute("tabindex", "-1");
    await expect(page.locator(".hp-field")).toHaveAttribute("aria-hidden", "true");
    // Keine Abfrage von Schuldnerdaten oder Dokumenten.
    await expect(page.locator('input[type="file"], textarea')).toHaveCount(0);
  });

  test("Seite: Struktur, Hero-Texte, noindex, Rechtslinks, keine Vorschau-Leiste im Produktions-Build", async ({ page }) => {
    await open(page);
    await expect(page.locator(".hero-sub")).toHaveText(
      "Ob eine einzelne Forderung oder regelmäßig ausbleibende Zahlungen: Pajisto unterstützt Unternehmen bei der professionellen Durchsetzung offener Forderungen – auf Wunsch bis zur Vollstreckung.",
    );
    await expect(page.locator(".hero-micro")).toContainText("Vier kurze Fragen. Unverbindlich. Ohne Registrierung.");
    for (const name of ["Weniger eigenes Nachfassen", "Professionelle Bearbeitung", "Bis zur Vollstreckung, wenn nötig", "So geht es weiter.", "Häufige Fragen."]) {
      await expect(page.getByRole("heading", { name })).toBeVisible();
    }
    await expect(page.locator("details")).toHaveCount(6);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByTestId("preview-bar")).toHaveCount(0);
    const footer = page.getByRole("contentinfo");
    await expect(footer.getByRole("link", { name: "Impressum" })).toHaveAttribute("href", "https://www.pajisto.de/impressum");
    await expect(footer.getByRole("link", { name: "Datenschutz" })).toHaveAttribute("href", "https://www.pajisto.de/datenschutz");
    await answerQuestions(page);
    await expect(funnel(page).getByRole("link", { name: "Datenschutzerklärung" })).toHaveAttribute("href", "https://www.pajisto.de/datenschutz");
  });

  test("Seitentext enthält keine unzulässigen Versprechen, Preise, Bewertungen oder Verknappung", async ({ page }) => {
    await open(page);
    await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(
      /garant|erfolgsquote|kostenlos|ohne risiko|100\s?%|smart flat|schuldner trägt|trägt der schuldner|nur noch|nur heute|sterne|bewertung|kunden vertrauen/i,
    );
  });
});
