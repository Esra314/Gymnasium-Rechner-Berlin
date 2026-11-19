const test = require("node:test");
const assert = require("node:assert/strict");
const Rechner = require("../js/rechner.js");

// Hilfsfunktion: alle Fächer mit derselben Note in beiden Halbjahren.
function alle(note, abweichungen = {}) {
    const noten = {};
    for (const fach of Rechner.FAECHER) {
        noten[fach.id] = [note, note];
    }
    return Object.assign(noten, abweichungen);
}

test("Notensumme zählt nur Deutsch, Mathematik und 1. Fremdsprache aus beiden Halbjahren", () => {
    const r = Rechner.berechne(alle(1, { nawi: [6, 6], gewi: [6, 6], kunst: [6, 6] }));
    assert.equal(r.ok, true);
    assert.equal(r.notensumme, 6);
});

test("Notensumme 14 reicht für das Gymnasium", () => {
    const r = Rechner.berechne(alle(2, { deutsch: [3, 3] })); // 3+3+2+2+2+2 = 14
    assert.equal(r.notensumme, 14);
    assert.equal(r.gymnasiumMoeglich, true);
});

test("Notensumme 15 reicht nicht für das Gymnasium", () => {
    const r = Rechner.berechne(alle(2, { deutsch: [3, 3], mathe: [3, 2] })); // 15
    assert.equal(r.notensumme, 15);
    assert.equal(r.gymnasiumMoeglich, false);
});

test("Durchschnitt: Hauptfächer, NaWi und GeWi zählen doppelt (Teiler 26)", () => {
    // Doppelt gewichtete Fächer alle 1, Kunst/Musik/Sport alle 4.
    const r = Rechner.berechne(alle(1, { kunst: [4, 4], musik: [4, 4], sport: [4, 4] }));
    // (10 Noten * 1 * 2 + 6 Noten * 4) / 26 = (20 + 24) / 26
    assert.equal(r.gewichtSumme, 26);
    assert.equal(r.gewichteteSumme, 44);
    assert.ok(Math.abs(r.durchschnitt - 44 / 26) < 1e-12);
});

test("Fächer ohne Note (Kunst, Musik, Sport) zählen beim Durchschnitt nicht mit", () => {
    const r = Rechner.berechne(alle(2, { sport: [null, null] }));
    assert.equal(r.ok, true);
    assert.equal(r.gewichtSumme, 24);
    assert.equal(r.durchschnitt, 2);
});

test("Hauptfächer brauchen immer eine Note", () => {
    const r = Rechner.berechne(alle(2, { deutsch: [null, 2] }));
    assert.equal(r.ok, false);
    assert.deepEqual(r.fehler, [{ fach: "deutsch", halbjahr: "5/2" }]);
});

test("Ungültige Noten werden abgelehnt", () => {
    for (const falsch of [0, 7, 2.5, NaN, "2", undefined]) {
        const r = Rechner.berechne(alle(2, { mathe: [2, falsch] }));
        assert.equal(r.ok, false, `Note ${String(falsch)} müsste abgelehnt werden`);
        assert.deepEqual(r.fehler, [{ fach: "mathe", halbjahr: "6/1" }]);
    }
});

test("Leere Eingabe meldet alle Felder als fehlend", () => {
    const r = Rechner.berechne({});
    assert.equal(r.ok, false);
    assert.equal(r.fehler.length, Rechner.FAECHER.length * 2);
});

test("Alle Sprachen haben dieselben Texte wie Deutsch", () => {
    const I18n = require("../js/i18n.js");
    const deutsch = Object.keys(I18n.TEXTE.de).sort();
    for (const sprache of I18n.SPRACHEN) {
        const texte = I18n.TEXTE[sprache.code];
        assert.ok(texte, `Sprache ${sprache.code} fehlt`);
        assert.deepEqual(Object.keys(texte).sort(), deutsch, `Texte in ${sprache.code} unvollständig`);
        for (const [schluessel, text] of Object.entries(texte)) {
            assert.ok(text.trim().length > 0, `${sprache.code}.${schluessel} ist leer`);
        }
    }
});
