# Messkonzept

Maßstab ist der qualifizierte Lead und später der unterzeichnete Vertrag, nicht
der Klick auf den Check.

## Events (`lib/analytics.ts`)

| Event | Zeitpunkt | Parameter |
|---|---|---|
| `funnel_start` | Erste Antwort im Funnel | `landing_variant`, `funnel_variant` |
| `funnel_step_complete` | Ein Schritt wurde beantwortet (je Schritt einmal) | `step`, `step_number`, `funnel_variant` |
| `funnel_abandon` | Seite wird verlassen, nachdem begonnen, aber nicht gesendet wurde (einmal) | `last_step`, `step_number`, `funnel_variant` |
| `lead_submit_success` | Server bestätigt die CRM-Speicherung | `landing_variant`, `funnel_variant`, `segment` |
| `lead_submit_failure` | Server/Netz meldet Fehler | `error_class` |
| `booking_link_click` | Klick auf den optionalen Terminlink | `funnel_variant` |

`step` ist der Name des Schritts (`frequency`, `amount`, `debtor`, `stage`,
`industry`, `contact`) – nie die gewählte Antwort. Namen, E-Mail, Telefon,
Firma und einzelne Antworten können über die Typen nicht übergeben werden;
ein Browser-Test prüft das zusätzlich. Einzige inhaltliche Kategorie ist das
grobe Segment beim erfolgreichen Lead.

Abbrüche je Schritt ergeben sich aus `funnel_step_complete` (Trichter) und
`funnel_abandon` (letzter gesehener Schritt beim Verlassen). Ohne Einwilligung
werden auch Abbrüche nicht gemessen.

## Einwilligung

- Ohne konfigurierte ID: kein Banner, kein Skript.
- Mit ID: Banner mit gleichwertigen Schaltflächen „Ablehnen“ / „Akzeptieren“.
  Vor einer Zustimmung wird kein Skript geladen, kein Event gesendet und nichts
  nachgereicht.
- Widerruf über „Cookie-Einstellungen“ im Footer.
- Gespeichert wird nur die Entscheidung (localStorage).

Das Banner ist ein technischer Stand, keine Rechtsberatung. Vor dem Livegang
rechtlich prüfen lassen oder durch ein CMP ersetzen.

## Meta

- Nach Zustimmung: `PageView`, die Events oben als `trackCustom`.
- Standardevent `Lead` nur bei `lead_submit_success` im Modus `close`, mit
  `eventID` = Anfrage-ID, je Anfrage höchstens einmal. Vorschau-Einsendungen
  und der Klick auf den Terminlink lösen es nicht aus.
- **Conversions API: nicht implementiert.** Vorbereitet ist nur die gemeinsame
  Event-ID. Für CAPI müsste der Server nach erfolgreichem Close-Aufruf dasselbe
  Event mit derselben ID senden – nur bei vorliegender Einwilligung und mit
  geklärter Rechtsgrundlage für die übermittelten Merkmale.

## GA4

Analog: Laden erst nach Zustimmung, dieselben Events über `gtag`.

## UTM

`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` werden
aus der Aufruf-URL gelesen, nur im Arbeitsspeicher gehalten und mit der Anfrage
an den Server/Close übergeben. Andere Parameter (z. B. `fbclid`) werden nicht
übernommen. Bitte keine personenbezogenen Daten in Kampagnen-URLs.

## A/B-Tests

- **Funnel-Länge:** `kurz` gegen `ausfuehrlich`, siehe README. `funnel_variant`
  steht in jedem Funnel-Event und in jeder Anfrage in Close.
- **Landingpage:** `landing_variant` (`C` für diese Seite) in jeder Anfrage
  und in `funnel_start` / `lead_submit_success`.
- Primär zählen qualifizierte Anfragen je Besucher bzw. Kosten je
  qualifizierter Anfrage, später Kosten je gewonnenem Kunden. Die
  Qualifizierung kommt aus Close, nicht aus Meta.
- Sekundär: Startquote, Abschluss je Schritt, Erreichbarkeit im Vertrieb,
  Anteil der Segmente.
- Bei kleinen Fallzahlen und kurzer Laufzeit sind Unterschiede nicht
  belastbar; vorab Mindestlaufzeit und Mindestzahl an Anfragen festlegen.
