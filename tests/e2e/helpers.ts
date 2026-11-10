import { expect, type Page, type Route as PwRoute } from "@playwright/test";

export const TRACKER_PATTERN = /facebook\.(net|com)|googletagmanager\.com|google-analytics\.com|doubleclick\.net/;

/** Fängt alle Tracking-Anfragen ab (nichts verlässt den Rechner) und protokolliert sie. */
export async function interceptTrackers(page: Page): Promise<string[]> {
  const hits: string[] = [];
  await page.route(TRACKER_PATTERN, (route: PwRoute) => {
    hits.push(route.request().url());
    return route.fulfill({ status: 200, contentType: "application/javascript", body: "" });
  });
  return hits;
}

export type ConsentChoice = "accept" | "deny" | "none";

export async function open(page: Page, consent: ConsentChoice = "deny", path = "/") {
  const trackerHits = await interceptTrackers(page);
  // Eigene Client-Adresse je Test, damit das Rate-Limit des echten Endpunkts
  // (5 Anfragen / 10 Minuten je IP) parallele Tests nicht gegenseitig sperrt.
  const octet = () => 1 + Math.floor(Math.random() * 250);
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
  await page.goto(path);
  if (consent !== "none") {
    await page.getByTestId(consent === "accept" ? "consent-accept" : "consent-deny").click();
    await expect(page.getByTestId("consent-banner")).toHaveCount(0);
  }
  return { trackerHits };
}

export interface CheckValues {
  route: "einzeln" | "gelegentlich" | "regelmaessig";
  count?: string;
  amount?: string;
  stage?: "ueberfaellig" | "gemahnt" | "bestritten" | "tituliert";
}

const ROUTE_NAME = {
  einzeln: "Ich habe eine konkrete offene Rechnung",
  gelegentlich: "Gelegentlich bleiben Rechnungen offen",
  regelmaessig: "Jeden Monat sind mehrere Rechnungen offen",
};

export async function runCheck(page: Page, v: CheckValues) {
  const card = page.getByTestId("check-card");
  await card.getByRole("radio", { name: new RegExp(ROUTE_NAME[v.route]) }).check({ force: true });
  await card.getByRole("button", { name: "Weiter" }).click();
  if (v.count !== undefined) await card.locator('input[name="count"]').fill(v.count);
  if (v.amount !== undefined) await card.locator('input[name="amount"]').fill(v.amount);
  if (v.stage) await card.locator('select[name="stage"]').selectOption(v.stage);
  await card.getByRole("button", { name: "Ergebnis anzeigen" }).click();
}

export async function fillContact(page: Page, over: Partial<Record<"name" | "company" | "email", string>> = {}) {
  await page.locator("#contact-name").fill(over.name ?? "Erika Beispiel");
  await page.locator("#contact-company").fill(over.company ?? "Beispiel Fitness GmbH");
  await page.locator("#contact-email").fill(over.email ?? "erika@beispiel-fitness.de");
}

/** Ersetzt den Server-Endpunkt und zeichnet die gesendeten Bodies auf. */
export async function stubLeadApi(
  page: Page,
  reply: (callIndex: number) => { status: number; body: unknown; delayMs?: number },
) {
  const bodies: any[] = [];
  await page.route("**/api/lead", async (route) => {
    const index = bodies.length;
    bodies.push(route.request().postDataJSON());
    const r = reply(index);
    if (r.delayMs) await new Promise((res) => setTimeout(res, r.delayMs));
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  return bodies;
}

export const events = (page: Page) => page.evaluate(() => (window as any).__pajistoEvents ?? []);
export const text = (s: string | null) => (s ?? "").replace(/ /g, " ");
