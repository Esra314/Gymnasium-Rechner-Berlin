const test = require("node:test");
const assert = require("node:assert/strict");
const Umkreis = require("../js/umkreis.js");

const daten = {
    plz: { "10115": [52.5323, 13.3846] },
    schulen: [
        { n: "Nah-Gymnasium", a: "gym", p: 0, lat: 52.5330, lon: 13.3850 },
        { n: "Nah-ISS privat", a: "iss", p: 1, lat: 52.5340, lon: 13.3860 },
        { n: "Ferne Gemeinschaftsschule", a: "gms", p: 0, lat: 52.4000, lon: 13.1000 }
    ]
};

test("Entfernung Berlin Mitte bis Potsdam ist etwa 26 km", () => {
    const km = Umkreis.entfernungKm(52.5200, 13.4050, 52.3906, 13.0645);
    assert.ok(km > 25 && km < 28, `berechnet: ${km}`);
});

test("Ungültige und unbekannte Postleitzahlen werden gemeldet", () => {
    assert.equal(Umkreis.suche(daten, { plz: "1011" }).fehler, "plz_invalid");
    assert.equal(Umkreis.suche(daten, { plz: "abcde" }).fehler, "plz_invalid");
    assert.equal(Umkreis.suche(daten, { plz: "80331" }).fehler, "plz_unknown");
});

test("Filter nach Schulart, Träger und Umkreis, sortiert nach Entfernung", () => {
    const alle = Umkreis.suche(daten, { plz: "10115", arten: ["gym", "iss", "gms"], privat: true, radiusKm: 5 });
    assert.deepEqual(alle.schulen.map((s) => s.n), ["Nah-Gymnasium", "Nah-ISS privat"]);

    const ohnePrivat = Umkreis.suche(daten, { plz: "10115", arten: ["gym", "iss", "gms"], privat: false, radiusKm: 5 });
    assert.deepEqual(ohnePrivat.schulen.map((s) => s.n), ["Nah-Gymnasium"]);

    const nurGms = Umkreis.suche(daten, { plz: "10115", arten: ["gms"], privat: true, radiusKm: 50 });
    assert.deepEqual(nurGms.schulen.map((s) => s.n), ["Ferne Gemeinschaftsschule"]);
});

test("Mitgelieferte Schuldaten sind vollständig", () => {
    global.window = {};
    require("../data/schulen.js");
    const d = global.window.SCHULDATEN;
    assert.ok(d.schulen.length > 200, "zu wenige Schulen");
    assert.ok(Object.keys(d.plz).length > 150, "zu wenige Postleitzahlen");
    for (const s of d.schulen) {
        assert.ok(["gym", "iss", "gms"].includes(s.a), `${s.n}: unbekannte Schulart`);
        assert.ok(s.lat > 52.3 && s.lat < 52.7 && s.lon > 13.0 && s.lon < 13.8, `${s.n}: Koordinaten außerhalb Berlins`);
    }
    delete global.window;
});
