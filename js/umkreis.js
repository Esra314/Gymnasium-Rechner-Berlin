/*
 * Umkreissuche für Schulen. Läuft komplett im Browser: Die Postleitzahl wird
 * nur mit der mitgelieferten Liste (data/schulen.js) verglichen und nirgends hingeschickt.
 */
(function (root) {
    "use strict";

    // Entfernung zweier Punkte in km (Haversine-Formel).
    function entfernungKm(lat1, lon1, lat2, lon2) {
        var r = 6371;
        var rad = Math.PI / 180;
        var dLat = (lat2 - lat1) * rad;
        var dLon = (lon2 - lon1) * rad;
        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * r * Math.asin(Math.sqrt(a));
    }

    /*
     * daten: { schulen: [...], plz: { "10115": [lat, lon], ... } }
     * optionen: { plz, arten: ["gym","iss","gms"], privat: true|false, radiusKm }
     * Rückgabe: { ok: true, mitte: [lat, lon], schulen: [...mit km] }
     *       oder { ok: false, fehler: "plz_invalid" | "plz_unknown" }
     */
    function suche(daten, optionen) {
        var plz = String(optionen.plz || "").trim();
        if (!/^\d{5}$/.test(plz)) {
            return { ok: false, fehler: "plz_invalid" };
        }
        var mitte = daten.plz[plz];
        if (!mitte) {
            return { ok: false, fehler: "plz_unknown" };
        }
        var arten = optionen.arten || [];
        var treffer = daten.schulen
            .filter(function (s) {
                return arten.indexOf(s.a) !== -1 && (optionen.privat || !s.p);
            })
            .map(function (s) {
                var kopie = {};
                for (var k in s) kopie[k] = s[k];
                kopie.km = entfernungKm(mitte[0], mitte[1], s.lat, s.lon);
                return kopie;
            })
            .filter(function (s) { return s.km <= optionen.radiusKm; })
            .sort(function (x, y) { return x.km - y.km; });

        return { ok: true, mitte: mitte, schulen: treffer };
    }

    var api = { entfernungKm: entfernungKm, suche: suche };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    } else {
        root.Umkreis = api;
    }
})(this);
