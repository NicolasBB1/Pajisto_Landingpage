# Änderungen

## Corporate Identity nach Brand Board (11.11.2026)

Die Seite folgt jetzt dem Brand Board „Ausgabe 2026 · V1.0“ statt der früheren grün/cremefarbenen Optik.

- **Farben:** Dunkelgrau #363636, Anthrazit #4A4A4A, Mittelgrau #797979, Weiß, Akzentgelb #F6B636. Gelb nur auf Handlungselementen (CTA-Buttons, Absenden) und als kleine Markierung, nie als Fläche.
- **Schrift:** Montserrat ExtraBold für Überschriften, Inter für Fließtext. Beide werden beim Build geladen und von der eigenen Domain ausgeliefert; Besucher-Browser sprechen nicht mit Google.
- **Logo:** Wappen als Primärvariante im Header und Negativvariante im Footer, außerdem als Favicon. Die Dateien sind aus dem Brand-Board-PDF entnommen und nicht nachgezeichnet.
- **Hero:** dunkle Fläche mit dezentem warmem Verlauf wie im Landingpage-Beispiel des Brand Boards; die weiße Funnel-Karte hebt sich davon ab.
- **Formen und Icons:** kantigere Buttons und Karten, Icons mit 2 px Strich, eckigen Enden und spitzen Ecken.
- **Bewusst nicht übernommen:** die Beispieltexte des Brand Boards („Kostenlos starten“, „keine Vorkosten“, „Preise“, „Antwort in 24 h“). Sie widersprechen den Vorgaben für diese Seite (keine Preis- und Kostenversprechen).

## Variante C – Multistep-Anfrage (11.11.2026)

Ersetzt Variante B (Forderungscheck → Rechenergebnis → separates Formular).

**Funnel**
- Ein einziger Ablauf im Hero: vier Fragen, dann Kontakt. Kein Rechenergebnis, keine zweite Formularstrecke, keine Zahleneingaben mehr.
- Antwortkarten mit automatischer Weiterleitung, Zurück/Weiter, Fortschritt, Kurztexte je nach Antwort (Singular beim Einzelfall, eigene Texte für bestritten/tituliert).
- Kontaktwunsch E-Mail oder Rückruf; Telefon nur bei Rückruf Pflicht. Das Nachrichtenfeld entfällt (weniger Reibung, keine Schuldnerdaten im Freitext).
- Jede Antwortkombination kann abschließen. Segment und Betreuungspotenzial sind nur intern in Close sichtbar.
- A/B-Schalter kurz/ausführlich (zusätzliche Branchenfrage), auch per URL.

**Seite**
- Hero mit neuer Headline, Subheadline und Microcopy; die Beispiel-Illustration ist dem Funnel gewichen. Mobil folgt die erste Frage direkt auf die Headline, die Subheadline steht darunter.
- Ein CTA-Wortlaut („Anfrage starten“) in Header und Schlussabschnitt, beide führen zum selben Funnel. Die Telefonnummer steht nur noch als Textlink im Schlussabschnitt.
- Neu: drei Nutzenargumente, „So geht es weiter“, FAQ mit Kostenfrage (ohne Preise). Entfallen: Schmerzpunkt-Karten, Leistungsübersicht, Bewertungen (es liegen keine belegbaren vor).

**Daten und Close**
- Leadquelle `pajisto_lp_multistep`, serverseitiger Zeitstempel, Segment, Herkunft (nur Seitenpfad und Referrer-Hostname), Anfrage-ID. Neue Feldliste in `docs/CLOSE_INTEGRATION.md`.
- „Demo-Modus“ heißt jetzt „Vorschau-Modus“ und erscheint nur bei ausdrücklich gesetztem `LEAD_MODE=mock`.

**Tracking**
- Events für Start, Schritte, Abbruch, Lead, Terminlink. Keine Antworten in Events. `Lead` je Anfrage höchstens einmal.

**Qualität**
- Behoben während der Tests: Karte sprang nach der ersten Frage in der Höhe; Hover-Markierung blieb auf Touch-Geräten stehen.

## Variante B – Forderungscheck (10.11.2026)

Umsetzung der HTML-Vorschau als Next.js-Projekt; Details in der Git-Historie.
Die Vorschau liegt unter `reference/variante-b-vorschau.html`.
