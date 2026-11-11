# Close CRM – Integration

Stand: 11.11.2026 (Multistep-Anfrage, Leadquelle `pajisto_lp_multistep`). Der Adapter ist implementiert und gegen einen lokalen
Mock-Server getestet. **Gegen das echte Close-Konto wurde nichts geschrieben
und kein Testlead angelegt.** Das Konto wurde nur lesend abgefragt (Felder,
Status, Formulare).

## Entscheidung: API-Route statt nativem Close Form

Geprüft anhand der Close-Hilfe zu Forms. Native Forms können Felder auf Custom
Fields mappen und UTM-Parameter erfassen, aber:

- Gestaltung nur über Farben/Radius; das Formular käme als fremdes Embed.
- Keine Übernahme dynamischer Werte aus dem Check (nur URL-Parameter).
- Kein eigener Erfolgs-/Fehlerzustand im Seitencode – damit kein sauberer
  Auslöser für `lead_submit_success` / Meta `Lead` und keine eigene Validierung.

Deshalb: eigener Endpunkt `POST /api/lead`, der serverseitig mit der Close-API
spricht. Im Konto existiert derzeit ohnehin kein Close Form.

## Ablauf je Anfrage

1. `POST /data/search/` – Leads mit einem Kontakt mit exakt dieser E-Mail.
2. **Treffer:** `POST /activity/note/` am ersten Treffer. Es wird nichts
   überschrieben. Weicht der Firmenname ab oder gibt es mehrere Treffer,
   enthält die Notiz „BITTE PRÜFEN: …“.
3. **Kein Treffer:** `POST /data/search/` nach exakt gleichem Lead-Namen (nur
   als Hinweis, blockiert nie), dann `POST /lead/` mit Firma, Kontakt und dem
   Kontext in der Beschreibung. Bei gleichem Firmennamen wird **nicht**
   zusammengeführt, sondern ein Dublettenhinweis ergänzt.

Es werden keine Opportunities, Aufgaben oder E-Mails erzeugt. Jeder Pfad hat
genau einen schreibenden Aufruf.

Die Suchabfragen sind nach der Dokumentation (Advanced Filtering,
`contact_email.email`, Modus `exact_value`) gebaut, aber noch nicht gegen das
echte Konto gelaufen – das gehört zur finalen Testeinreichung.

## Fehlerbehandlung

| Close-Antwort | Verhalten |
|---|---|
| 400 beim Anlegen | Einmalige Wiederholung ohne Custom Fields und ohne Telefonfeld (Telefon steht dann in der Beschreibung). So kostet eine falsche Feld-ID keine Anfrage. |
| 401 / 403 | Abbruch, Besucher sieht eine ehrliche Fehlermeldung mit Telefonnummer. |
| 429 | Wartet `rate_reset` (ersatzweise `retry-after`) und wiederholt, insgesamt höchstens 6 Sekunden. |
| 5xx / Netzwerk | Kein automatischer Retry beim Schreiben (Dublettenrisiko). Besucher kann erneut senden; die E-Mail-Suche verhindert dann einen zweiten Lead, schlimmstenfalls entsteht eine zweite Notiz. |

Im Server-Log steht nur die Fehlerklasse, z. B.
`[lead] CRM-Einsendung fehlgeschlagen: server/503` – nie Key, Kontaktdaten oder
Antwortinhalte.

## Was im Konto vorhanden ist (nur gelesen)

Lead-Status:

| Status | ID |
|---|---|
| Potential | `stat_lBydaDy84tHY9ltAAOycJoVKUyChegBdEu1cn8ioj1X` |
| Inbound Lead Ads | `stat_ahblZNvahstA4wCYQXvcXoOW6PLE1kcWmRsaUP7cmeW` |
| Unqualifiziert | `stat_KISflS6QS9OaPQNHn7Zu7cZZMqS2uVCc9nttNjNayzd` |
| Aktiver Kunde | `stat_4gqYwWxL4eb0bvziPpAZ1PGN83lIIfzzQMCqgbN0UAt` |
| Inaktiver Kunde | `stat_l3kFevDNeJofzzowAaQYPcZH69746h2egjYeVbZYma8` |
| Blacklist | `stat_BPuuWs3x51jawuoYHRCi8uiM4wHkT5OX4V3DX0q9e15` |

Passendes vorhandenes Lead-Custom-Field:

| Feld | ID | Nutzung |
|---|---|---|
| „Wie oft kommen bei Ihnen offene Forderungen vor?“ (Auswahl) | `cf_vxR6lJVUeukH6KLg88pdlyKSphxXExg2sN0qojD3Jk3` | `CLOSE_CF_FREQUENCY_CHOICE`. Zuordnung: konkrete Rechnung → „Einmalig oder selten“, ein paar Mal im Jahr → „Mehrmals im jahr“, monatlich (beide Stufen) → „Mehrmals im Monat“; „kann ich nicht einschätzen“ bleibt leer. |

Das Feld „Wie hoch ist die offene Forderung“ (Stufen unter 500 € / 500–10.000 €
/ über 10.000 €) wird nicht befüllt: Die Stufen des Funnels (250 / 1.000 /
5.000 €) lassen sich nicht eindeutig zuordnen.

## Was im Lead steht

Neue Leads erhalten Firma, Kontakt (Name, E-Mail, ggf. Telefon) und diese
Beschreibung – bei bereits bekannter E-Mail steht derselbe Text in der Notiz:

```
Leadquelle: pajisto_lp_multistep
Eingang: 11.11.2026, 14:05 Uhr (Europe/Berlin)
Segment: regelmäßig – potenzieller Bedarf an laufender Betreuung

Häufigkeit: Mehr als 5 Rechnungen pro Monat
Forderungshöhe: 250–1.000 €
Kundentyp: Privatkunden
Stand: Wir haben bereits erinnert oder gemahnt
Kontaktwunsch: Per Rückruf

Landingpage-Variante: C · Funnel: kurz
UTM: utm_source=meta · utm_campaign=herbst
Herkunft: Seite / · Verweis von l.facebook.com
Anfrage-ID: 0b9f3c1e-…
```

Der Zeitpunkt wird serverseitig gesetzt. Als Herkunft werden nur Seitenpfad
und Hostname der verweisenden Seite gespeichert – keine IP-Adresse, keine
Klick-IDs. Segment und Leadquelle setzt der Server, nicht der Browser. Die
Anfrage-ID ist zugleich die Event-ID des Meta-`Lead`-Events und erlaubt später
den Abgleich zwischen Close und Marketingauswertung.

## Zur Freigabe: Felder für Filter und Auswertung

**Die Liste hat sich mit dem neuen Funnel geändert** (die frühere Liste mit
acht Feldern gilt nicht mehr). Ohne Felder funktioniert alles; der Kontext
steht dann nur als Text in der Beschreibung und ist nicht filterbar.
Empfohlen als Lead-Custom-Fields, Typ Text:

| Vorschlag Feldname | Env-Variable | Beispielwert |
|---|---|---|
| Leadquelle | `CLOSE_CF_SOURCE` | `pajisto_lp_multistep` |
| Segment | `CLOSE_CF_SEGMENT` | `regelmäßig` |
| Häufigkeit | `CLOSE_CF_FREQUENCY` | `1–5 Rechnungen pro Monat` |
| Forderungshöhe | `CLOSE_CF_AMOUNT` | `250–1.000 €` |
| Kundentyp | `CLOSE_CF_DEBTOR_TYPE` | `Privatkunden` |
| Forderungsstatus | `CLOSE_CF_STAGE` | `Die Forderung wird bestritten` |
| Kontaktwunsch | `CLOSE_CF_CONTACT_PREFERENCE` | `Per Rückruf` |
| Landing Variant | `CLOSE_CF_LANDING_VARIANT` | `C` |
| Funnel Variant | `CLOSE_CF_FUNNEL_VARIANT` | `kurz` |
| UTM Quelle | `CLOSE_CF_UTM_SOURCE` | `meta` |
| UTM Kampagne | `CLOSE_CF_UTM_CAMPAIGN` | `herbst` |

Für die Vertriebssteuerung am wichtigsten: Leadquelle, Segment, Landing
Variant, Funnel Variant, UTM Kampagne. Im Konto wurde nichts angelegt; über
den angebundenen Close-Zugang lassen sich Felder nicht anlegen. Nach dem
Anlegen die IDs (`cf_…`) als Environment-Variablen setzen.

## Terminbuchung ohne zweiten Lead

In Close sind Calendly-Terminlinks hinterlegt (u. a. „Erstberatung zu Ihrer
offenen Forderung“). Wird einer als `NEXT_PUBLIC_BOOKING_URL` gesetzt,
erscheint er als freiwilliger Link in der Bestätigung. Die Seite legt dabei
nichts an und übergibt keine Daten an den Link. Laut Close-Dokumentation
ordnet die Calendly-Integration eine Buchung über die E-Mail-Adresse dem
bestehenden Kontakt zu – bucht jemand mit einer anderen E-Mail als in der
Anfrage, entsteht dort ein eigener Lead. Bitte in der Testeinreichung prüfen.

## Noch zu konfigurieren

1. API-Key in Close erzeugen (Settings → Developer → API Keys), möglichst für
   einen eigenen Integrationsnutzer, und **nur** als `CLOSE_API_KEY` im Hosting
   hinterlegen.
2. `LEAD_MODE=close` setzen.
3. Entscheiden: `CLOSE_LEAD_STATUS_ID` (naheliegend „Inbound Lead Ads“, wenn
   der Traffic aus Meta Ads kommt) oder Standardstatus.
4. Optional Felder anlegen und IDs setzen.
5. Finale Testeinreichung laut Launch-Checkliste.

## Rückführung in die Marketingauswertung (nicht gebaut)

Ziel: qualifizierte Leads, geführte Gespräche und Abschlüsse je Kampagne,
Landing- und Funnel-Variante auswerten.

- Voraussetzung sind die Felder oben (mindestens Leadquelle, Varianten, UTM).
- Auswertung in Close: Leads mit Leadquelle `pajisto_lp_multistep` nach Status
  („Unqualifiziert“, „Aktiver Kunde“) und Feld „Konditionen“ je Variante und
  UTM-Kampagne. Ein eigener Status „Qualifiziert“ fehlt im Konto, ebenso ein
  Merkmal „Gespräch geführt“ – beides wäre für die Auswertung nötig.
- Rückmeldung an Meta (z. B. qualifizierter Lead als Offline-/CAPI-Event) ist
  **nicht implementiert**. Technisch ginge das über einen Close-Webhook auf
  Statuswechsel und die Anfrage-ID als Event-ID; rechtlich setzt es die
  Einwilligung des Besuchers und eine angepasste Datenschutzerklärung voraus.
