# Pajisto Landingpage – Multistep-Anfrage (Variante C)

Conversion-Landingpage der Pajisto Forderungsmanagement GmbH. Ein einziger,
nativer Multistep-Funnel im Hero führt von der ersten Frage bis zur
gespeicherten Anfrage im Close CRM.

**Status:** lauffähig und getestet im Vorschau-Modus. Close, Meta Pixel, GA4
und Terminlink sind vorbereitet, aber **nicht verbunden** – es wurden keine
Zugangsdaten hinterlegt und kein echter Lead angelegt. Offene Schritte:
[`LAUNCH_CHECKLIST.md`](LAUNCH_CHECKLIST.md).

## Schnellstart

```bash
npm install
cp .env.example .env.local   # LEAD_MODE=mock ist voreingestellt
npm run dev                  # http://localhost:3000
```

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver (mit Vorschau-Kennzeichnung) |
| `npm run build` / `npm run start` | Produktions-Build und -Server |
| `npm run typecheck` | TypeScript-Prüfung |
| `npm test` | Unit-Tests (Funnel-Logik, Validierung, Close-Adapter gegen lokalen Mock-Server, Endpunkt) |
| `npm run test:e2e` | Browser-Tests (Playwright/Chromium), baut und startet die Seite selbst auf Port 3100 |
| `npm run check` | Typecheck + Unit-Tests + Build |

`test:e2e` baut mit Platzhalter-Tracking-IDs; danach für eine normale Vorschau
erneut `npm run build` ausführen.

## Der Funnel

Vier Fragen (Häufigkeit, Forderungshöhe, Kundentyp, Stand) und ein
Kontaktschritt. Eine Frage pro Schritt, automatische Weiterleitung nach der
Auswahl, Zurück-Funktion, Fortschrittsanzeige, passende Kurztexte je nach
Antwort. Jede Antwortkombination darf abschließen; es gibt keine Bewertung
und kein Zwischenergebnis.

- Kontakt: Name, Unternehmen, geschäftliche E-Mail; Telefon optional und nur
  bei Kontaktwunsch „Rückruf“ Pflicht.
- Internes Segment (nur für den Vertrieb): Einzelfall / gelegentlich /
  regelmäßig / noch ungeklärt. Monatliche Fälle erhalten den Hinweis
  „potenzieller Bedarf an laufender Betreuung“.
- Die Bestätigung erscheint ausschließlich nach bestätigter Speicherung.
  Im Vorschau-Modus steht dort „Es wurde nichts versendet“.

### A/B-Test kurz gegen ausführlich

`NEXT_PUBLIC_FUNNEL_VARIANT` = `kurz` (Standard), `ausfuehrlich` (zusätzliche
Branchenfrage) oder `split` (50/50 je Seitenaufruf). Per URL erzwingbar:
`?fv=kurz` bzw. `?fv=ausfuehrlich` – so lässt sich die Variante je
Anzeigengruppe steuern. Die Variante steht in jeder Anfrage und in jedem
Funnel-Event. Die Zuordnung wird nicht gespeichert (kein Cookie); im
`split`-Modus kann ein Neuladen die Variante wechseln.

## Aufbau

```
app/page.tsx              Seite (statisch gerendert)
app/api/lead/route.ts     POST-Endpunkt für Anfragen (Node-Runtime)
components/Funnel.tsx     Multistep-Anfrage
components/ConsentBanner  Einwilligung für Tracking
lib/funnel.ts             Fragen, Antworten, Kurztexte, Segment
lib/funnel-variant.ts     A/B-Zuordnung
lib/lead.ts               Übergabemodell + Validierung (Browser und Server)
lib/close.ts              Close-Adapter (Suche, Lead, Notiz, Fehlerklassen, 429-Backoff)
lib/server/               Modus/Konfiguration, Rate-Limit, Idempotenz, Verarbeitung
lib/analytics.ts          Typsichere Events, Meta Pixel / GA4 nur nach Einwilligung
tests/unit, tests/e2e     Automatisierte Tests
reference/                Frühere HTML-Vorschau (Variante B) als Vergleich
docs/                     Close-Integration, Messkonzept
```

## Environment-Variablen

Vorlage: [`.env.example`](.env.example). Geheimnisse gehören ausschließlich in
die Hosting-Einstellungen bzw. lokal in `.env.local` (von Git ignoriert).

| Variable | Sichtbarkeit | Bedeutung |
|---|---|---|
| `LEAD_MODE` | Server | `mock` (Vorschau, nichts wird versendet), `close` (Close CRM). Leer: lokal `mock`, in Produktion ist das Formular deaktiviert und sagt das auch. |
| `CLOSE_API_KEY` | **Server, geheim** | Close-API-Key. Nie mit `NEXT_PUBLIC_`. |
| `CLOSE_LEAD_STATUS_ID` | Server | Optionaler Status neuer Leads. |
| `CLOSE_CF_*` | Server | Optionale Custom-Field-IDs, siehe [`docs/CLOSE_INTEGRATION.md`](docs/CLOSE_INTEGRATION.md). |
| `NEXT_PUBLIC_LANDING_VARIANT` | Browser | Kennung der Seite, Standard `C`. |
| `NEXT_PUBLIC_FUNNEL_VARIANT` | Browser | `kurz`, `ausfuehrlich` oder `split`. |
| `NEXT_PUBLIC_BOOKING_URL` | Browser | Optionaler Terminlink (https) in der Bestätigung. |
| `NEXT_PUBLIC_META_PIXEL_ID` | Browser | Leer = kein Pixel, kein Banner. |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | Browser | Leer = kein GA4. |
| `NEXT_PUBLIC_SITE_URL` | Browser | Ziel-Domain für Canonical/Open Graph. |
| `NEXT_PUBLIC_ALLOW_INDEXING` | Browser | Nur `true` + gesetzte Domain hebt `noindex` auf. |
| `NEXT_PUBLIC_SHOW_PREVIEW_BAR` | Browser | Vorschau-Leiste auch im Produktions-Build. |

`NEXT_PUBLIC_*`-Werte werden beim Build eingebettet – nach Änderungen neu
deployen.

## Deployment (Vercel)

Vercel-Projekt `pajisto-landingpage`, nicht mit GitHub verknüpft (dem
Vercel-Konto fehlt die GitHub-Verbindung).

- Vorschau: `npx vercel deploy` – erzeugt eine eigene Preview-URL
  (Vercel-Login nötig), ohne die Test-Domain zu verändern.
- Test-Domain https://pajisto-landingpage.vercel.app: `npx vercel deploy --prod`.

Für den Live-Betrieb `LEAD_MODE=close`, `CLOSE_API_KEY` (als „Sensitive“),
ggf. Feld- und Tracking-IDs setzen, `NEXT_PUBLIC_SHOW_PREVIEW_BAR` entfernen
und neu deployen. Die produktive Pajisto-Domain und laufende Kampagnen werden
durch dieses Projekt nicht angefasst.

## Schutz des Endpunkts

Serverseitige Validierung, Honeypot, Origin-Prüfung, Größenlimit, Rate-Limit
(5 gültige Anfragen / 10 Minuten / IP), Idempotenz über `submission_id`.
Rate-Limit und Idempotenz liegen im Arbeitsspeicher der jeweiligen
Serverinstanz; zweite Linie gegen doppelte Leads ist die E-Mail-Suche in
Close. Für harten, instanzübergreifenden Schutz zusätzlich die
Vercel-Firewall einsetzen.

## Tracking

Siehe [`docs/ANALYTICS.md`](docs/ANALYTICS.md). Ohne Einwilligung wird nichts
geladen und nichts gesendet; Events enthalten weder Antworten noch
Kontaktdaten; das Meta-Event `Lead` feuert je Anfrage höchstens einmal und
nur nach bestätigter CRM-Speicherung.

## Frühere Varianten

A (Aufwand-Rechner) lag nie in diesem Repository. B (Forderungscheck mit
Rechenergebnis und separatem Formular) wurde durch C ersetzt und ist in der
Git-Historie sowie als HTML-Vorschau unter `reference/` erhalten.
