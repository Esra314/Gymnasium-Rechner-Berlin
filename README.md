# Oberschul-Helfer Berlin

**Von der Grundschule zur Oberschule**

Unverbindlicher Rechner für die Förderprognose beim Übergang von der Grundschule in Klasse 7 in Berlin.
Eltern tragen die Noten aus den Zeugnissen 5/2 und 6/1 ein und sehen, welche Schularten möglich sind:
Gymnasium, Integrierte Sekundarschule (ISS) und Gemeinschaftsschule.

## Funktionen

- Noteneingabe wie im Zeugnis (Fächer und Schularten bleiben auf Deutsch)
- Notensumme aus Deutsch, Mathematik und 1. Fremdsprache (bis 14: Gymnasium möglich)
- Durchschnittsnote aller Fächer (Hauptfächer, Naturwissenschaften und Gesellschaftswissenschaften doppelt)
- Erklärung zu Gymnasium, ISS, Gemeinschaftsschule und Probeunterricht
- Erklärtexte auf Deutsch, Englisch, Türkisch, Arabisch (von rechts nach links), Ukrainisch und Russisch
- Rechenweg zum Aufklappen, Ergebnis als PDF speichern oder drucken
- Schulen in der Nähe: Postleitzahl eingeben, Filter nach Gymnasium, ISS, Gemeinschaftsschule und Privatschulen,
  Liste mit Entfernung und Karte (OpenStreetMap, lädt erst nach Klick)
- Wichtige Termine für den Wechsel und häufige Fragen (FAQ)
- Keine Daten werden gesendet oder gespeichert, keine Cookies
- Impressum und Datenschutzerklärung

## Regeln

Quelle: [Senatsverwaltung für Bildung, Wechsel zur 7. Klasse](https://www.berlin.de/sen/bildung/schule/bildungswege/uebergang-weiterfuehrende-schule/wechsel-zur-7-klasse/)
(Stand November 2026, Übergang 2027). Die Rechenlogik steht in `js/rechner.js`.

## Aufbau

```text
index.html          Rechner
impressum.html      Impressum (Platzhalter ausfüllen!)
datenschutz.html    Datenschutzerklärung (Platzhalter ausfüllen!)
favicon.svg
css/style.css
js/rechner.js       Berechnung (ohne Abhängigkeiten, auch in Node testbar)
js/i18n.js          Übersetzungen
js/umkreis.js       Umkreissuche (ohne Abhängigkeiten, testbar)
js/app.js           Oberfläche
data/schulen.js     Schulen und Postleitzahlen (erzeugt)
scripts/            Skript zum Aktualisieren der Schuldaten
vendor/leaflet/     Kartenbibliothek Leaflet 1.9.4 (BSD-2-Clause)
tests/              Tests mit node:test
```

## Lokal starten

`index.html` im Browser öffnen. Eine Sprache direkt öffnen: `index.html?lang=tr` (de, en, tr, ar, uk, ru).

## Tests

```bash
npm test
```

Die Tests laufen auch automatisch bei jedem Push (GitHub Actions).

## Schuldaten aktualisieren

```bash
npm run schuldaten
```

Lädt die offenen Daten aus dem Geoportal Berlin (Schulen: Datenlizenz Deutschland – Zero 2.0,
Postleitzahlen: Amt für Statistik Berlin-Brandenburg, CC BY 3.0 DE) und schreibt `data/schulen.js`.
Am besten einmal pro Schuljahr ausführen.

## Neue Sprache hinzufügen

1. In `js/i18n.js` die Sprache in `SPRACHEN` eintragen.
2. Einen Block in `TEXTE` mit allen Schlüsseln aus `de` anlegen.
3. `npm test` prüft, dass kein Text fehlt.

## Veröffentlichung (GitHub Pages)

Repository → Settings → Pages → Source: „Deploy from branch“, Branch `main`, Ordner `/ (root)`.
Vorher in `impressum.html` und `datenschutz.html` die gelb markierten Platzhalter ausfüllen.
