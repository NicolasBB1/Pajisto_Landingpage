# Close CRM – Integration

Stand: 10.11.2026. Der Adapter ist implementiert und gegen einen lokalen
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
| „Wie oft kommen bei Ihnen offene Forderungen vor?“ (Auswahl) | `cf_vxR6lJVUeukH6KLg88pdlyKSphxXExg2sN0qojD3Jk3` | `CLOSE_CF_FREQUENCY_CHOICE`. Zuordnung: einzeln → „Einmalig oder selten“, gelegentlich → „Mehrmals im jahr“, regelmaessig → „Mehrmals im Monat“ (Schreibweise wie im Konto). |

Das Feld „Wie hoch ist die offene Forderung“ (Stufen unter 500 € / 500–10.000 €
/ über 10.000 €) wird bewusst nicht befüllt: Der Check erfasst einen
Durchschnittsbetrag, keine Stufe.

## Zur Freigabe: fehlende Felder

Ohne diese Felder funktioniert alles; der Kontext steht dann nur als Text in
der Lead-Beschreibung und ist nicht filterbar. Für Auswertungen empfohlen
(Lead-Custom-Fields, Typ Text, sofern nicht anders angegeben):

| Vorschlag Feldname | Env-Variable | Beispielwert |
|---|---|---|
| Check Route | `CLOSE_CF_CHECK_ROUTE` | `regelmaessig` |
| Fälle/Zeitraum | `CLOSE_CF_CLAIMS_PERIOD` | `6 Forderungen pro Monat` |
| Ø Forderung | `CLOSE_CF_AVG_AMOUNT` | `250 €` |
| Stadium | `CLOSE_CF_STAGE` | `gemahnt` |
| Kundentyp | `CLOSE_CF_DEBTOR_TYPE` | `privat` |
| Landing Variant | `CLOSE_CF_LANDING_VARIANT` | `B` |
| UTM Quelle | `CLOSE_CF_UTM_SOURCE` | `meta` |
| UTM Kampagne | `CLOSE_CF_UTM_CAMPAIGN` | `herbst` |

Ich habe im Konto nichts angelegt. Nach dem Anlegen die IDs (`cf_…`) als
Environment-Variablen setzen.

## Noch zu konfigurieren

1. API-Key in Close erzeugen (Settings → Developer → API Keys), möglichst für
   einen eigenen Integrationsnutzer, und **nur** als `CLOSE_API_KEY` im Hosting
   hinterlegen.
2. `LEAD_MODE=close` setzen.
3. Entscheiden: `CLOSE_LEAD_STATUS_ID` (naheliegend „Inbound Lead Ads“, wenn
   der Traffic aus Meta Ads kommt) oder Standardstatus.
4. Optional Felder anlegen und IDs setzen.
5. Finale Testeinreichung laut Launch-Checkliste.

## Closed-Loop (nur vorbereitet)

Die Status „Unqualifiziert“ und „Aktiver Kunde“ sowie das Feld „Konditionen“
erlauben später eine Auswertung je `Landing Variant` und UTM-Kampagne –
vorausgesetzt, die Felder oben existieren. Ein eigener Status „Qualifiziert“
fehlt im Konto. Eine automatische Rückmeldung an Meta ist **nicht** gebaut.
