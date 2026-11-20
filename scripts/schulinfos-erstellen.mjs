// Erzeugt data/schulinfos.js aus den Rohdaten des Berliner Schulverzeichnisses
// und des Veranstaltungskalenders der Senatsverwaltung.
//
//   python3 scripts/schulverzeichnis_laden.py roh/    -> roh/portraets.json
//   python3 scripts/kalender_laden.py roh/termine.json
//   node scripts/schulinfos-erstellen.mjs roh/portraets.json roh/termine.json [Stand JJJJ-MM-TT]
//
// Nur Schulen, die auch in data/schulen.js stehen, werden übernommen.
import { readFileSync, writeFileSync } from "node:fs";

const [portraetDatei, termineDatei, standArg] = process.argv.slice(2);
if (!portraetDatei || !termineDatei) {
    console.error("Aufruf: node scripts/schulinfos-erstellen.mjs portraets.json termine.json [stand]");
    process.exit(1);
}
const stand = standArg || new Date().toISOString().slice(0, 10);
const portraets = JSON.parse(readFileSync(portraetDatei, "utf8"));
const termine = JSON.parse(readFileSync(termineDatei, "utf8"));

const schulenJs = readFileSync(new URL("../data/schulen.js", import.meta.url), "utf8");
const bekannt = new Set([...schulenJs.matchAll(/"id":"(\w+)"/g)].map((m) => m[1]));

const GANZTAG = [
    [/Gebundener Ganztag/i, "gebunden"],
    [/Teilgebundener Ganztag/i, "teilgebunden"],
    [/Offene Ganztag/i, "offen"]
];
// Angebote, die für die Wahl der Oberschule nichts aussagen
const UNWICHTIG = [
    /Ganztag/i, /Ersatzschule/i, /^Schulanfangsphase/i, /Lerngruppen 1-3/i
];

function kuerzen(text, max) {
    const t = (text || "").replace(/\s+/g, " ").trim();
    return t.length > max ? t.slice(0, max - 1).replace(/\s+\S*$/, "") + " …" : t;
}

function ganztag(angebote) {
    // "Teilgebunden" zuerst prüfen, weil "gebunden" darin enthalten ist
    if (/Teilgebundener Ganztag/i.test(angebote)) return "teilgebunden";
    for (const [muster, wert] of GANZTAG) if (muster.test(angebote)) return wert;
    return "";
}

function essen(mittag) {
    const m = (mittag || "").trim();
    if (!m) return "";
    return kuerzen(m.replace(/^Mittagessenversorgung\s*-\s*/i, "Mittagessen: "), 160);
}

function datumIso(d) {
    const [tag, monat, jahr] = d.split(".");
    return `${jahr}-${monat}-${tag}`;
}

const schulen = {};
for (const [bsn, p] of Object.entries(portraets)) {
    if (!bekannt.has(bsn)) continue;
    const profil = (p.angebote || "").split(/,\s*/)
        .filter((a) => a && !UNWICHTIG.some((m) => m.test(a)));
    const eintrag = {
        sp: kuerzen(p.sprachen, 300),
        gt: ganztag(p.angebote || ""),
        pr: profil.join(", "),
        bm: kuerzen(p.bemerkungen, 280),
        ag: kuerzen(p.ags, 220),
        me: essen(p.mittag),
        ob: Boolean(p.oberstufe),
        z: p.zweig,
        td: []
    };
    for (const k of Object.keys(eintrag)) {
        if (eintrag[k] === "" || eintrag[k] === false) delete eintrag[k];
    }
    schulen[bsn] = eintrag;
}

// Termine: nur Tag der offenen Tür / Infoabend, nur unsere Schulen
const gesehen = new Set();
for (const t of termine) {
    if (!t.datum || !/offenen Tür|Infoabend|Informationsabend|Infotag/i.test(t.text)) continue;
    for (const bsn of new Set(t.bsn || [])) {
        const s = schulen[bsn];
        if (!s) continue;
        let von = t.von && t.von >= "06:00" ? t.von : null;
        const art = /Infoabend|Informationsabend/i.test(t.text) ? "info" : "tdot";
        const schluessel = bsn + datumIso(t.datum) + art;
        const vorher = s.td.find((x) => x.k === schluessel);
        if (vorher) {
            if (!vorher.b && t.bis) vorher.b = t.bis;
            continue;
        }
        const termin = { k: schluessel, d: datumIso(t.datum), a: art, l: t.detail };
        if (von) termin.v = von;
        if (von && t.bis) termin.b = t.bis;
        s.td.push(termin);
        gesehen.add(bsn);
    }
}
for (const s of Object.values(schulen)) {
    s.td.sort((a, b) => (a.d + (a.v || "")).localeCompare(b.d + (b.v || "")));
    s.td.forEach((x) => delete x.k);
    if (s.td.length === 0) delete s.td;
}

const daten = { stand, schulen };
const kopf = `// Automatisch erzeugt mit scripts/schulinfos-erstellen.mjs – nicht von Hand ändern.
// Quellen: Berliner Schulverzeichnis (bildung.berlin.de/Schulverzeichnis) und
// Veranstaltungskalender der Senatsverwaltung für Bildung, Jugend und Familie (berlin.de).
// Angaben ohne Gewähr; die Schulen können sie jederzeit ändern.
`;
writeFileSync(new URL("../data/schulinfos.js", import.meta.url),
    kopf + "window.SCHULINFOS = " + JSON.stringify(daten) + ";\n");
console.log(`Schulen: ${Object.keys(schulen).length}, mit Terminen: ${gesehen.size}, Stand ${stand}`);
