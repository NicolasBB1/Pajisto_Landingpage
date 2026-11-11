# Änderungen

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
