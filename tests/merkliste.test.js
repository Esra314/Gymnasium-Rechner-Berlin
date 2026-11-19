const test = require("node:test");
const assert = require("node:assert/strict");
const Merkliste = require("../js/merkliste.js");

function speicher() {
    const daten = {};
    return {
        getItem: (k) => (k in daten ? daten[k] : null),
        setItem: (k, v) => { daten[k] = String(v); },
        removeItem: (k) => { delete daten[k]; }
    };
}

test("Schulen merken, entfernen und nach Neuladen wiederfinden", () => {
    const s = speicher();
    const a = Merkliste.erstelle(s);
    assert.equal(a.umschalten("01Y01"), true);
    assert.equal(a.umschalten("02K03"), true);
    a.setzeNotiz("01Y01", "ganztag", "ja");
    assert.deepEqual(Merkliste.erstelle(s).ids(), ["01Y01", "02K03"]);
    assert.equal(Merkliste.erstelle(s).notiz("01Y01", "ganztag"), "ja");
    assert.equal(a.umschalten("01Y01"), false);
    assert.deepEqual(Merkliste.erstelle(s).ids(), ["02K03"]);
});

test("Unbekannte Felder werden ignoriert, Leeren löscht alles", () => {
    const s = speicher();
    const a = Merkliste.erstelle(s);
    a.umschalten("x");
    a.setzeNotiz("x", "boese", "nein");
    assert.equal(a.notiz("x", "boese"), "");
    a.leeren();
    assert.deepEqual(Merkliste.erstelle(s).ids(), []);
});

test("Ohne Speicher oder mit kaputten Daten läuft es trotzdem", () => {
    const ohne = Merkliste.erstelle(null);
    ohne.umschalten("a");
    assert.deepEqual(ohne.ids(), ["a"]);

    const kaputt = speicher();
    kaputt.setItem(Merkliste.SCHLUESSEL, "{nicht json");
    assert.deepEqual(Merkliste.erstelle(kaputt).ids(), []);

    const gesperrt = { getItem() { throw new Error("gesperrt"); }, setItem() { throw new Error("gesperrt"); } };
    const g = Merkliste.erstelle(gesperrt);
    g.umschalten("b");
    assert.deepEqual(g.ids(), ["b"]);
});
