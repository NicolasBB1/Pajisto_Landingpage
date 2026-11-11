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

export interface FunnelAnswers {
  frequency?: string;
  amount?: string;
  debtor?: string;
  stage?: string;
  industry?: string;
}

export const DEFAULT_ANSWERS: Required<Omit<FunnelAnswers, "industry">> = {
  frequency: "monatlich_1_5",
  amount: "250_1000",
  debtor: "privat",
  stage: "gemahnt",
};

export const funnel = (page: Page) => page.getByTestId("funnel");

/** Beantwortet eine Frage per Klick; der Funnel springt automatisch weiter. */
export async function answer(page: Page, step: string, value: string) {
  const f = funnel(page);
  await expect(f).toHaveAttribute("data-step", step);
  await f.locator(`[data-value="${value}"]`).click();
  await expect(f).not.toHaveAttribute("data-step", step);
}

export async function answerQuestions(page: Page, over: FunnelAnswers = {}) {
  const a = { ...DEFAULT_ANSWERS, ...over };
  await answer(page, "frequency", a.frequency);
  await answer(page, "amount", a.amount);
  await answer(page, "debtor", a.debtor);
  await answer(page, "stage", a.stage);
  if (a.industry) await answer(page, "industry", a.industry);
  await expect(funnel(page)).toHaveAttribute("data-step", "contact");
}

export async function fillContact(page: Page, over: Partial<Record<"name" | "company" | "email" | "phone", string>> = {}) {
  await page.locator("#funnel-name").fill(over.name ?? "Erika Beispiel");
  await page.locator("#funnel-company").fill(over.company ?? "Beispiel Fitness GmbH");
  await page.locator("#funnel-email").fill(over.email ?? "erika@beispiel-fitness.de");
  if (over.phone !== undefined) await page.locator("#funnel-phone").fill(over.phone);
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

export const closeOk = { status: 200, body: { ok: true, mode: "close", event_id: "evt-42" } };
export const events = (page: Page) => page.evaluate(() => (window as any).__pajistoEvents ?? []);
