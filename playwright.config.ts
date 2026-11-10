import { defineConfig } from "@playwright/test";

const PORT = 3100;

/**
 * Die E2E-Tests laufen gegen einen echten Produktions-Build im Mock-Modus.
 * Die Tracking-IDs sind Platzhalter; Anfragen an Meta/Google werden in den
 * Tests abgefangen und nie ins Internet gesendet.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: `http://127.0.0.1:${PORT}`, locale: "de-DE" },
  webServer: {
    command: `npm run build && npx next start -p ${PORT} -H 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      LEAD_MODE: "mock",
      NEXT_PUBLIC_META_PIXEL_ID: "000000000000000",
      NEXT_PUBLIC_GA4_MEASUREMENT_ID: "G-TEST000000",
      NEXT_PUBLIC_LANDING_VARIANT: "B",
    },
  },
});
