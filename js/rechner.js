/*
 * Berechnung der Förderprognose für den Übergang in Klasse 7 (Berlin).
 *
 * Quelle: Senatsverwaltung für Bildung, "Wechsel auf die weiterführende Schule zur 7. Klasse"
 * https://www.berlin.de/sen/bildung/schule/bildungswege/uebergang-weiterfuehrende-schule/wechsel-zur-7-klasse/
 *
 * Teil 1 (Eignung für das Gymnasium):
 *   Notensumme aus Deutsch, Mathematik und 1. Fremdsprache der Zeugnisse 5/2 und 6/1
 *   (6 Noten, ungewichtet). Bis einschließlich 14: Gymnasium möglich.
 * Teil 2 (nur Rangfolge bei übernachgefragten Schulen):
 *   Durchschnitt aller Fächer aus 5/2 und 6/1, Deutsch, Mathematik, Fremdsprache,
 *   Naturwissenschaften und Gesellschaftswissenschaften zählen doppelt.
 *   Amtlich wird die Durchschnittsnote mit EINER Stelle nach dem Komma angegeben,
 *   NICHT gerundet (§ 24 GsVO; Beispiel der Senatsverwaltung: 67 : 26 = 2,5).
 *   Tendenzen (3+, 3-) zählen als ganze Note.
 *
 * Diese Datei hat keine Abhängigkeiten und läuft im Browser und in Node (Tests).
 */
(function (root) {
    "use strict";

    var GRENZE_NOTENSUMME = 14;

    // Fachnamen bleiben so, wie sie im Zeugnis stehen (Deutsch).
    var FAECHER = [
        { id: "deutsch",      name: "Deutsch",                     gewicht: 2, kern: true,  pflicht: true },
        { id: "mathe",        name: "Mathematik",                  gewicht: 2, kern: true,  pflicht: true },
        { id: "fremdsprache", name: "1. Fremdsprache",             gewicht: 2, kern: true,  pflicht: true },
        { id: "nawi",         name: "Naturwissenschaften",         gewicht: 2, kern: false, pflicht: true },
        { id: "gewi",         name: "Gesellschaftswissenschaften", gewicht: 2, kern: false, pflicht: true },
        { id: "kunst",        name: "Kunst",                       gewicht: 1, kern: false, pflicht: false },
        { id: "musik",        name: "Musik",                       gewicht: 1, kern: false, pflicht: false },
        { id: "sport",        name: "Sport",                       gewicht: 1, kern: false, pflicht: false }
    ];

    var HALBJAHRE = ["5/2", "6/1"];

    /*
     * Durchschnitt mit einer Stelle nach dem Komma, ohne Rundung (abgeschnitten).
     * Mit ganzen Zahlen gerechnet, damit keine Rundungsfehler entstehen.
     */
    function abschneiden(gewichteteSumme, gewichtSumme) {
        return Math.floor((gewichteteSumme * 10) / gewichtSumme) / 10;
    }

    // Gültige Note: ganze Zahl von 1 bis 6.
    function istNote(wert) {
        return typeof wert === "number" && Number.isInteger(wert) && wert >= 1 && wert <= 6;
    }

    /*
     * noten: { deutsch: [note5_2, note6_1], mathe: [...], ... }
     *   Eine Note ist eine Zahl 1–6. Bei Kunst, Musik und Sport darf null stehen
     *   ("keine Note"), dann zählt das Fach nicht mit.
     *
     * Rückgabe: { ok, fehler: [{fach, halbjahr}], notensumme, gewichteteSumme,
     *             gewichtSumme, durchschnittGenau, durchschnitt (amtlich: 1 Stelle,
     *             nicht gerundet), gymnasiumMoeglich }
     */
    function berechne(noten) {
        var fehler = [];
        var notensumme = 0;
        var gewichteteSumme = 0;
        var gewichtSumme = 0;

        FAECHER.forEach(function (fach) {
            var werte = (noten && noten[fach.id]) || [];
            HALBJAHRE.forEach(function (halbjahr, i) {
                var wert = werte[i];
                if (wert === null && !fach.pflicht) {
                    return; // keine Note in diesem Fach
                }
                if (!istNote(wert)) {
                    fehler.push({ fach: fach.id, halbjahr: halbjahr });
                    return;
                }
                if (fach.kern) {
                    notensumme += wert;
                }
                gewichteteSumme += wert * fach.gewicht;
                gewichtSumme += fach.gewicht;
            });
        });

        if (fehler.length > 0) {
            return { ok: false, fehler: fehler };
        }

        return {
            ok: true,
            fehler: [],
            notensumme: notensumme,
            gewichteteSumme: gewichteteSumme,
            gewichtSumme: gewichtSumme,
            durchschnittGenau: gewichteteSumme / gewichtSumme,
            durchschnitt: abschneiden(gewichteteSumme, gewichtSumme),
            gymnasiumMoeglich: notensumme <= GRENZE_NOTENSUMME
        };
    }

    var api = {
        FAECHER: FAECHER,
        HALBJAHRE: HALBJAHRE,
        GRENZE_NOTENSUMME: GRENZE_NOTENSUMME,
        istNote: istNote,
        abschneiden: abschneiden,
        berechne: berechne
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    } else {
        root.Rechner = api;
    }
})(this);
