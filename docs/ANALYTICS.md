# Messkonzept

Maßstab ist der qualifizierte Lead und später der unterzeichnete Vertrag, nicht
der Klick auf den Check.

## Events (`lib/analytics.ts`)

| Event | Zeitpunkt | Parameter |
|---|---|---|
| `check_start` | Erste aktive Auswahl in Schritt 1 (oder „Weiter“) | `landing_variant` |
| `check_step_2` | Schritt 2 wird aufgerufen | `route` |
| `check_complete` | Ergebnis wird angezeigt | `route`, `stage`, `period` |
| `result_cta_click` | Klick auf den Ergebnis-CTA | `route` |
| `form_start` | Erste Interaktion mit dem Formular | `route` (falls Check vorhanden) |
| `lead_submit_success` | Server bestätigt die CRM-Speicherung | `landing_variant`, `route` |
| `lead_submit_failure` | Server/Netz meldet Fehler | `error_class` |

Die Parameter sind über TypeScript-Typen auf Kategorien beschränkt. Namen,
E-Mail, Telefon, Firma, Beträge, Fallzahlen und Freitext können nicht übergeben
werden; ein Browser-Test prüft das zusätzlich.

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
  `eventID` = `submission_id` der Anfrage. Demo-Einsendungen lösen es nicht aus.
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

## A/B-Vergleich A (Aufwand-Rechner) gegen B (Forderungscheck)

- Gleiche Attribution: `landing_variant` in jeder Anfrage und in
  `check_start` / `lead_submit_success`. Variante A muss dieselben
  Erfolgsevents und dasselbe Übergabefeld liefern.
- Primär: qualifizierte Anfragen je Besucher bzw. Kosten je qualifizierter
  Anfrage, später Kosten je gewonnenem Kunden (interne Zielgröße, kein
  Kundenversprechen).
- Sekundär: Check-Startquote, Check-Abschluss, Formular-Abschluss,
  Erreichbarkeit, Anteil Einzelfall / laufende Betreuung.
- Qualifizierung kommt aus Close (Status), nicht aus Meta.
- Bei kleinen Fallzahlen und kurzer Laufzeit sind Unterschiede nicht belastbar;
  vorab Mindestlaufzeit und Mindestzahl an Anfragen festlegen und
  Vertriebsfeedback einbeziehen.
