# Pajisto Landingpage V2 – Forderungscheck (Variante B)

Conversion-Landingpage der Pajisto Forderungsmanagement GmbH mit interaktivem
Forderungscheck, Anfrageformular, serverseitiger Close-CRM-Anbindung und
consent-gesteuertem Tracking.

**Status:** lauffähig und getestet im Demo-Modus. Close, Meta Pixel und GA4
sind vorbereitet, aber **nicht verbunden** – es wurden keine Zugangsdaten
hinterlegt und kein echter Lead angelegt. Offene Schritte stehen in
[`LAUNCH_CHECKLIST.md`](LAUNCH_CHECKLIST.md).

## Schnellstart

```bash
npm install
cp .env.example .env.local   # LEAD_MODE=mock ist voreingestellt
npm run dev                  # http://localhost:3000
```

Im Demo-Modus zeigt das Formular einen gelben Hinweis und die Bestätigung
lautet „Demo-Modus: Es wurde nichts versendet.“ Bitte trotzdem keine echten
Kundendaten eingeben.

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver (mit Vorschau-Kennzeichnung) |
| `npm run build` / `npm run start` | Produktions-Build und -Server |
| `npm run typecheck` | TypeScript-Prüfung |
| `npm test` | Unit-Tests (Logik, Validierung, Close-Adapter gegen lokalen Mock-Server, Endpunkt) |
| `npm run test:e2e` | Browser-Tests (Playwright/Chromium), baut und startet die Seite selbst auf Port 3100 |
| `npm run check` | Typecheck + Unit-Tests + Build |

Hinweis zu `test:e2e`: Der Lauf baut mit Platzhalter-Tracking-IDs. Danach für
eine normale Vorschau erneut `npm run build` ausführen. Falls kein passender
Browser vorhanden ist: `npx playwright install chromium`.

## Aufbau

```
app/page.tsx              Seite (statisch gerendert), Abschnitte wie in der Vorschau
app/api/lead/route.ts     POST-Endpunkt für Anfragen (Node-Runtime)
components/               ForderungsCheck, ContactForm, ConsentBanner, Icons
lib/check.ts              Fachlogik des Checks (Texte, Validierung, Berechnung)
lib/lead.ts               Übergabemodell + Validierung (Browser und Server)
lib/close.ts              Close-Adapter (Suche, Lead, Notiz, Fehlerklassen, 429-Backoff)
lib/server/               Modus/Konfiguration, Rate-Limit, Idempotenz, Verarbeitung
lib/analytics.ts          Typsichere Events, Meta Pixel / GA4 nur nach Einwilligung
lib/consent.ts            Einwilligungsstatus
tests/unit, tests/e2e     Automatisierte Tests
reference/                Unveränderte HTML-Vorschau als Vergleich
docs/                     Close-Integration, Messkonzept
```

Warum Next.js statt der einzelnen HTML-Datei: Der Close-API-Key darf nur
serverseitig existieren, dafür braucht es einen Endpunkt. Die Seite selbst
bleibt statisch und kommt ohne UI-Bibliothek, Webfonts oder externe Assets aus.

## Environment-Variablen

Vorlage: [`.env.example`](.env.example). Geheimnisse gehören ausschließlich in
die Hosting-Einstellungen bzw. lokal in `.env.local` (von Git ignoriert).

| Variable | Sichtbarkeit | Bedeutung |
|---|---|---|
| `LEAD_MODE` | Server | `mock` (nichts wird versendet), `close` (Close CRM). Leer: lokal `mock`, in Produktion ist das Formular deaktiviert und sagt das auch. |
| `CLOSE_API_KEY` | **Server, geheim** | Close-API-Key. Nie mit `NEXT_PUBLIC_`. |
| `CLOSE_LEAD_STATUS_ID` | Server | Optionaler Status neuer Leads. |
| `CLOSE_CF_*` | Server | Optionale Custom-Field-IDs, siehe [`docs/CLOSE_INTEGRATION.md`](docs/CLOSE_INTEGRATION.md). |
| `NEXT_PUBLIC_LANDING_VARIANT` | Browser | `B` (Standard) oder `A`. |
| `NEXT_PUBLIC_META_PIXEL_ID` | Browser | Leer = kein Pixel, kein Banner. |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | Browser | Leer = kein GA4. |
| `NEXT_PUBLIC_SITE_URL` | Browser | Ziel-Domain für Canonical/Open Graph. |
| `NEXT_PUBLIC_ALLOW_INDEXING` | Browser | Nur `true` + gesetzte Domain hebt `noindex` auf. |
| `NEXT_PUBLIC_SHOW_PREVIEW_BAR` | Browser | Vorschau-Leiste auch im Produktions-Build. |

`NEXT_PUBLIC_*`-Werte werden beim Build eingebettet – nach Änderungen neu
deployen.

## Deployment (Vercel, Testdomain)

**Aktuelles Test-Deployment (Demo-Modus, `noindex`, mit Vorschau-Leiste):**
https://pajisto-landingpage.vercel.app – Vercel-Projekt `pajisto-landingpage`.
Das Projekt ist nicht mit GitHub verknüpft (dem Vercel-Konto fehlt die
GitHub-Verbindung); neue Stände werden per `npx vercel deploy --prod`
veröffentlicht. Dort bereits gesetzt: `LEAD_MODE=mock`,
`CLOSE_LEAD_STATUS_ID` (Inbound Lead Ads), `CLOSE_CF_FREQUENCY_CHOICE`.

1. Repository in Vercel importieren (Framework wird als Next.js erkannt).
2. Für das Test-Deployment setzen: `LEAD_MODE=mock`,
   `NEXT_PUBLIC_SHOW_PREVIEW_BAR=true`. Indexierung bleibt aus.
3. Deployen und die Seite auf der Vercel-Testdomain prüfen.
4. Erst nach den Freigaben aus der Launch-Checkliste: `LEAD_MODE=close`,
   `CLOSE_API_KEY` (als „Sensitive“), optional Feld-IDs und Tracking-IDs setzen
   und neu deployen.

Die produktive Domain und laufende Kampagnen werden durch dieses Projekt nicht
angefasst.

## Verhalten des Formulars

- Pflicht: Name, Unternehmen, geschäftliche E-Mail. Optional: Telefon, Nachricht.
- Der Check kann übersprungen werden; alle Check-Felder sind optional.
- Erfolg wird nur nach bestätigter Server-Antwort angezeigt. Bei Fehlern
  bleiben die Eingaben erhalten, es gibt „Erneut senden“ und die Telefonnummer.
- Schutz: Honeypot, Origin-Prüfung, Größenlimit, Rate-Limit (5 gültige
  Anfragen / 10 Minuten / IP), Idempotenz über `submission_id`.
- Grenzen: Rate-Limit und Idempotenz liegen im Arbeitsspeicher der jeweiligen
  Serverinstanz. Zweite Linie gegen doppelte Leads ist die E-Mail-Suche in
  Close. Für harten, instanzübergreifenden Schutz zusätzlich die
  Vercel-Firewall oder einen gemeinsamen Speicher einsetzen.

## Tracking

Siehe [`docs/ANALYTICS.md`](docs/ANALYTICS.md). Kurz: Ohne Einwilligung wird
nichts geladen und nichts gesendet; Events enthalten nur Kategorien; das
Meta-Event `Lead` feuert ausschließlich nach bestätigter CRM-Speicherung.

## Variante A

Der Aufwand-Rechner (Variante A) liegt **nicht** in diesem Repository – es war
bei Projektstart leer. Hier wurde also nichts überschrieben. Für den A/B-Test
muss A dieselbe Attribution liefern (`landing_variant: "A"`), siehe
`docs/ANALYTICS.md`.
