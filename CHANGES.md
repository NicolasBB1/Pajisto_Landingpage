# Änderungen gegenüber der HTML-Vorschau (Variante B)

Die Vorschau liegt unverändert unter `reference/variante-b-vorschau.html`.
Look & Feel, Abschnittsfolge und Kerntexte sind übernommen.

## Technik

- Eine HTML-Datei → Next.js (App Router, TypeScript) mit statischer Seite und einem Server-Endpunkt. Grund: Der Close-Key muss serverseitig bleiben.
- Demoformular → echtes Formular mit Client- und Server-Validierung, Ladezustand, Fehler-/Erfolgsansicht, Honeypot, Rate-Limit, Idempotenz.
- Neu: Close-Adapter, consent-gesteuertes Eventsystem, UTM-Übernahme, `noindex` für Testdeployments, Sicherheits-Header.
- Vorschau-Leiste nur noch in der Entwicklung bzw. per Schalter; „Konzeptvorschau“ im Footer durch Firmenangaben ersetzt.

## Forderungscheck

- Schritt 1 sind jetzt echte Radiobuttons (Pfeiltasten, Screenreader) statt Buttons.
- Zahlenfelder: Textfelder mit eigener Prüfung statt `type=number`. Deutsche Schreibweise („1.250,50“) wird verstanden, „2,5 Forderungen“ wird abgelehnt statt still abgerundet, Mindestbetrag 1 € entfällt.
- Routenwechsel setzt nur noch die Anzahl auf den passenden Startwert; Betrag, Stadium und Kundentyp bleiben erhalten. Erneutes Wählen derselben Route ändert nichts mehr.
- Ergebnistexte der drei Routen wörtlich nach Masterprompt. Bestritten/tituliert haben eigene Überschrift, eigenen Text und eigenen CTA.
- Volumen: Beschriftung „pro Jahr“ bzw. „hochgerechnet auf 12 Monate“, fester Hinweis „Rechnerische Summe der angegebenen Hauptforderungen. Keine Prognose von Zahlungseingängen.“, ab 1 Mio. € gerundete Angabe.
- Fokus springt bei jedem Schritt auf die neue Überschrift; die Karte wird unter dem fixierten Header ausgerichtet.
- Stadium-Optionen gekürzt, damit sie auf dem Handy nicht abgeschnitten werden.

## Texte und Conversion

- Hero: primärer CTA „Forderungscheck starten“ (wie im Header, ein Begriff für eine Aktion), sekundär „Direkt anfragen“. „In 60 Sekunden“ → „Drei kurze Schritte“, weil die Zeitangabe nicht belegt ist.
- Vertrauensleiste: „Registrierter Inkassodienstleister (§ 10 RDG)“ – gegen das Impressum geprüft.
- Gerichtliche Durchsetzung vorsichtiger formuliert („können je nach Sachlage und nach Abstimmung … folgen“).
- Check-Vorteil „Keine unrealistischen Erfolgsversprechen“ → „Keine Erfolgsversprechen, keine Prognosen“.
- FAQ: Tippfehler korrigiert, Abo-Frage ohne das Wort „Abo“.
- Formular: Platzhalter-Namen entfernt, Hinweis „keine Kundennamen/Unterlagen“, Datenschutzhinweis mit Link, Check-Zusammenfassung mit „Nicht mitsenden“, Button „Unverbindlich anfragen“.
- Kontakt: Telefonnummer anklickbar, vollständige Adresse aus dem Impressum.

## Gestaltung

- Unicode-Symbole (▤ ◷ ↗ ⚖ ⌂) → eigene SVG-Icons, weil die Zeichen je Gerät unterschiedlich aussehen.
- Hero-Headline etwas kleiner, damit „Offene Rechnungen?“ in einer Zeile bleibt.
- Kleine Texte dunkler (Kontrast), Formularfelder 16 px (kein Zoom auf iOS), größere Tippflächen.
- Behoben: Bereiche mit überstehenden Deko-Formen konnten seitlich verrutschen; die Leistungs-Karten liefen bei 390 px über den Rand.
