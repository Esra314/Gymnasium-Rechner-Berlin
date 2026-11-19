/*
 * Lädt die offenen Schuldaten und Postleitzahlen des Landes Berlin und schreibt
 * sie kompakt nach data/schulen.js. Aufruf: npm run schuldaten
 * Ohne Internet im Node-Prozess: vorher heruntergeladene GeoJSON-Dateien übergeben:
 *   node scripts/schuldaten-laden.mjs schulen.json postleitzahlen.json
 *
 * Quellen:
 * - Schulen: Geoportal Berlin, WFS "Schulen" (Datenlizenz Deutschland – Zero – 2.0)
 * - Postleitzahlen: Amt für Statistik Berlin-Brandenburg / Postleitzahlen (CC BY 3.0 DE)
 */
import { readFile, writeFile } from "node:fs/promises";

const WFS = "https://gdi.berlin.de/services/wfs";

function featureUrl(dienst, typ) {
    const params = new URLSearchParams({
        service: "WFS",
        version: "2.0.0",
        request: "GetFeature",
        typeNames: typ,
        outputFormat: "application/json",
        srsName: "EPSG:4326"
    });
    return `${WFS}/${dienst}?${params}`;
}

async function lade(url) {
    const antwort = await fetch(url);
    if (!antwort.ok) {
        throw new Error(`${url} -> HTTP ${antwort.status}`);
    }
    return antwort.json();
}

// Nur Schularten, auf die man nach Klasse 6 wechseln kann.
const SCHULARTEN = {
    "Gymnasium": "gym",
    "Integrierte Sekundarschule": "iss",
    "Gemeinschaftsschule": "gms"
};

function runde(x) {
    return Math.round(x * 100000) / 100000;
}

// Schwerpunkt eines Polygons (Ring in Grad, für kleine Flächen ausreichend genau).
function schwerpunktRing(ring) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [x0, y0] = ring[j];
        const [x1, y1] = ring[i];
        const f = x0 * y1 - x1 * y0;
        a += f;
        cx += (x0 + x1) * f;
        cy += (y0 + y1) * f;
    }
    a /= 2;
    return { flaeche: Math.abs(a), lon: cx / (6 * a), lat: cy / (6 * a) };
}

function schwerpunkt(geometrie) {
    const polygone = geometrie.type === "Polygon" ? [geometrie.coordinates] : geometrie.coordinates;
    let summe = 0, lon = 0, lat = 0;
    for (const polygon of polygone) {
        const s = schwerpunktRing(polygon[0]);
        summe += s.flaeche;
        lon += s.lon * s.flaeche;
        lat += s.lat * s.flaeche;
    }
    return [runde(lat / summe), runde(lon / summe)];
}

const [schulDatei, plzDatei] = process.argv.slice(2);
const schulDaten = schulDatei
    ? JSON.parse(await readFile(schulDatei, "utf8"))
    : await lade(featureUrl("schulen", "schulen:schulen"));
const plzDaten = plzDatei
    ? JSON.parse(await readFile(plzDatei, "utf8"))
    : await lade(featureUrl("postleitzahlen", "postleitzahlen:postleitzahlen"));

const schulen = schulDaten.features
    .filter((f) => SCHULARTEN[f.properties.schulart] && f.geometry)
    .map((f) => {
        const p = f.properties;
        const [lon, lat] = f.geometry.coordinates;
        return {
            n: p.schulname,
            a: SCHULARTEN[p.schulart],
            p: p.traeger === "privat" ? 1 : 0,
            s: [p.strasse, p.hausnr].filter(Boolean).join(" "),
            z: p.plz,
            o: p.ortsteil || p.bezirk || "",
            w: p.internet || "",
            t: p.telefon || "",
            e: p.email || "",
            lat: runde(lat),
            lon: runde(lon)
        };
    })
    .sort((x, y) => x.n.localeCompare(y.n, "de"));

const plz = {};
for (const f of plzDaten.features) {
    plz[f.properties.plz] = schwerpunkt(f.geometry);
}

const stand = new Date().toISOString().slice(0, 10);
const inhalt =
    "/* Automatisch erzeugt mit scripts/schuldaten-laden.mjs – nicht von Hand bearbeiten.\n" +
    " * Schulen: Geoportal Berlin, WFS Schulen, Datenlizenz Deutschland – Zero – Version 2.0\n" +
    " * Postleitzahlen: Amt für Statistik Berlin-Brandenburg / Postleitzahlen, CC BY 3.0 DE\n" +
    " */\n" +
    "window.SCHULDATEN = " +
    JSON.stringify({ stand, schulen, plz }) +
    ";\n";

await writeFile(new URL("../data/schulen.js", import.meta.url), inhalt);

const anzahl = {};
for (const s of schulen) anzahl[s.a] = (anzahl[s.a] || 0) + 1;
console.log(`Stand ${stand}: ${schulen.length} Schulen`, anzahl, `${Object.keys(plz).length} Postleitzahlen`);
