# Launch-Checkliste

Stand 11.11.2026 (Multistep-Anfrage). Nichts davon ist erledigt, solange es hier nicht abgehakt ist.

## 1. Zugänge und IDs

- [ ] Close-API-Key erzeugen und als `CLOSE_API_KEY` im Hosting hinterlegen (nicht per Chat/E-Mail/Git)
- [ ] `LEAD_MODE=close` setzen
- [x] Lead-Status für neue Anfragen: „Inbound Lead Ads“ (in Vercel als `CLOSE_LEAD_STATUS_ID` gesetzt)
- [x] Test-Deployment im Demo-Modus: https://pajisto-landingpage.vercel.app
- [ ] Kontextfelder in Close anlegen (Settings → Custom Fields → Lead, Typ Text) und IDs in Vercel setzen. **Neue Liste** mit elf Feldern in `docs/CLOSE_INTEGRATION.md`; über den angebundenen Close-Zugang lassen sich Felder nicht anlegen.
- [ ] Terminlink festlegen (`NEXT_PUBLIC_BOOKING_URL`), z. B. den Calendly-Link „Erstberatung zu Ihrer offenen Forderung“ – oder bewusst weglassen
- [ ] Funnel-Test festlegen: `kurz`, `ausfuehrlich` oder `split`
- [ ] Meta-Pixel-ID (`NEXT_PUBLIC_META_PIXEL_ID`), ggf. GA4-ID
- [ ] Entscheidung: Conversions API ja/nein (derzeit nicht implementiert)

## 2. Rechtliche Kontrolle

- [ ] **Datenschutzerklärung anpassen.** Auf pajisto.de steht derzeit, dass keine Tracking-Cookies und kein Meta Pixel / Google Analytics eingesetzt werden. Das passt nicht mehr, sobald hier ein Pixel aktiv ist. Ebenso ergänzen: Verarbeitung von Anfragen in Close CRM, Hosting (Vercel).
- [ ] Consent-Banner (Text, Gleichwertigkeit, Widerruf, Speicherdauer) prüfen lassen oder durch ein CMP ersetzen
- [ ] Datenschutzhinweis am Formular prüfen
- [ ] Auftragsverarbeitung / Drittlandtransfer für Close, Vercel, Meta, Google klären
- [ ] Werbeaussagen freigeben: „Registrierter Inkassodienstleister (§ 10 RDG)“ (laut Impressum belegt), „Persönliche Ansprechpartner“, „wir übernehmen die Kommunikation mit dem Schuldner“, „auf Wunsch bis zur Vollstreckung“, Aussagen zu Partnerkanzleien, FAQ-Antwort zu den Kosten
- [ ] Texte zu bestrittenen und titulierten Forderungen fachlich gegenlesen
- [ ] Impressum-/Datenschutz-Links: verweisen auf pajisto.de; klären, ob die Landingpage auf eigener Domain eigene Seiten braucht

## 3. Finale Testeinreichung (nur mit ausdrücklicher Freigabe)

- [ ] Einen klar gekennzeichneten Testlead senden (z. B. Firma „TEST Landingpage – bitte löschen“)
- [ ] In Close prüfen: Lead, Kontakt, Beschreibung, Status, Custom Fields
- [ ] Zweite Einsendung mit derselben E-Mail: es entsteht eine Notiz, kein zweiter Lead (bestätigt die Suchabfrage gegen das echte Konto)
- [ ] Einsendung mit derselben E-Mail, anderer Firma: Notiz mit „BITTE PRÜFEN“
- [ ] Anfrage mit Kontaktwunsch „Rückruf“: Telefonnummer am Kontakt
- [ ] Falls Terminlink gesetzt: Buchung mit derselben E-Mail erzeugt keinen zweiten Lead
- [ ] Testdaten in Close wieder löschen

## 4. Tracking-Probe

- [ ] Ohne Zustimmung: im Netzwerk-Tab keine Anfragen an Meta/Google
- [ ] Nach Zustimmung: `PageView` und Funnel-Events im Meta Events Manager (Test Events)
- [ ] `Lead` erscheint genau einmal, erst nach erfolgreicher Einsendung
- [ ] Keine personenbezogenen Daten in den Event-Parametern
- [ ] UTM-Parameter einer Testanzeige kommen in Close an

## 5. Domain und Livegang

- [ ] Ziel-Domain festlegen, `NEXT_PUBLIC_SITE_URL` setzen
- [ ] `NEXT_PUBLIC_ALLOW_INDEXING=true` nur, wenn die Seite indexiert werden soll (reine Ads-Landingpages oft bewusst nicht)
- [ ] `NEXT_PUBLIC_SHOW_PREVIEW_BAR` in Produktion nicht auf `true`
- [ ] Wappen als Vektordatei (SVG) bereitstellen – derzeit eine aus dem Brand-Board-PDF entnommene PNG-Datei (für die verwendeten Größen scharf, aber nicht beliebig skalierbar)
- [ ] Open-Graph-Bild ergänzen (derzeit keines); laut Brand Board wäre dafür die Akzentvariante des Wappens zulässig
- [ ] Vercel-Firewall/Rate-Limit für `/api/lead` als zusätzlichen Schutz erwägen
- [ ] Test auf echten Geräten (iPhone Safari, Android Chrome) und mit einem Screenreader
- [ ] In Close einen Status „Qualifiziert“ und ein Merkmal für geführte Gespräche einführen, wenn die Rückführung in die Marketingauswertung gewünscht ist
- [ ] Kampagnen erst nach Freigabe auf die neue URL umstellen

## Bekannte Restpunkte

- Close-Anbindung nur gegen Mock-Server getestet, nicht gegen das echte Konto.
- Rate-Limit und Idempotenz gelten je Serverinstanz (siehe README).
- Keine gemessenen Lighthouse-/Core-Web-Vitals-Werte; die Seite ist statisch, ohne Webfonts und ohne Bilder, gemessen wurde aber nicht.
- Barrierefreiheit: automatisierte Tastatur- und Strukturtests, kein manueller Screenreader-Test, keine vollständige Kontrastprüfung. Das Mittelgrau #797979 der Marke liegt auf Weiß knapp unter dem AA-Kontrast für kleinen Text und wird deshalb nur für Beschriftungen verwendet, nicht für Fließtext.
- Getestet wurde in Chromium; Safari und Firefox nicht.
