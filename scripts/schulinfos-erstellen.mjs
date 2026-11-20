// Erzeugt data/schulinfos.js aus den Rohdaten des Berliner Schulverzeichnisses
// und des Veranstaltungskalenders der Senatsverwaltung.
//
//   python3 scripts/schulverzeichnis_laden.py roh/    -> roh/portraets.json
//   python3 scripts/kalender_laden.py roh/termine.json
//   python3 scripts/schulwebsites_laden.py data/schulen.js roh/web/     (optional)
//   python3 scripts/schulwebsites_auswerten.py roh/web/ roh/portraets.json roh/web.json
//   node scripts/schulinfos-erstellen.mjs roh/portraets.json roh/termine.json [Stand JJJJ-MM-TT] [roh/web.json]
//
// Angaben von den Websites der Schulen werden mit q:"w" (Termine) bzw. im Feld w
// (Quell-URL je Feld) markiert und nur dort ergänzt, wo das Schulverzeichnis nichts sagt.
//
// Nur Schulen, die auch in data/schulen.js stehen, werden übernommen.
import { readFileSync, writeFileSync } from "node:fs";

const [portraetDatei, termineDatei, standArg, webDatei] = process.argv.slice(2);
if (!portraetDatei || !termineDatei) {
    console.error("Aufruf: node scripts/schulinfos-erstellen.mjs portraets.json termine.json [stand]");
    process.exit(1);
}
const stand = standArg || new Date().toISOString().slice(0, 10);
const portraets = JSON.parse(readFileSync(portraetDatei, "utf8"));
const termine = JSON.parse(readFileSync(termineDatei, "utf8"));
const web = webDatei ? JSON.parse(readFileSync(webDatei, "utf8")) : {};

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
// Angaben von den Websites der Schulen
let webStand = "";
let webTermine = 0;
for (const [bsn, w] of Object.entries(web)) {
    const s = schulen[bsn];
    if (!s) continue;
    if (w.abruf && w.abruf > webStand) webStand = w.abruf;
    for (const x of w.td || []) {
        if (!/^https:\/\//.test(x.l)) continue;
        // gleicher Tag schon aus dem amtlichen Kalender: der hat Vorrang
        if (s.td.some((y) => y.d === x.d)) continue;
        const termin = { d: x.d, a: x.a, l: x.l, q: "w" };
        if (x.v) termin.v = x.v;
        if (x.v && x.b) termin.b = x.b;
        s.td.push(termin);
        webTermine++;
    }
    const quellen = {};
    if (w.gt && !s.gt && /^https:\/\//.test(w.gt.l)) { s.gt = w.gt.wert; quellen.gt = w.gt.l; }
    if (w.me && !s.me && /^https:\/\//.test(w.me.l)) { s.me = "Mittagessen (laut Website der Schule)"; quellen.me = w.me.l; }
    if (w.sp && !s.sp && /^https:\/\//.test(w.sp.l)) { s.sp = w.sp.wert.join(", "); quellen.sp = w.sp.l; }
    if (Object.keys(quellen).length) s.w = quellen;
}

for (const s of Object.values(schulen)) {
    s.td.sort((a, b) => (a.d + (a.v || "")).localeCompare(b.d + (b.v || "")));
    s.td.forEach((x) => delete x.k);
    if (s.td.length === 0) delete s.td;
}

const daten = { stand, schulen };
if (webStand) daten.webStand = webStand;
const kopf = `// Automatisch erzeugt mit scripts/schulinfos-erstellen.mjs – nicht von Hand ändern.
// Quellen: Berliner Schulverzeichnis (bildung.berlin.de/Schulverzeichnis) und
// Veranstaltungskalender der Senatsverwaltung für Bildung, Jugend und Familie (berlin.de)
// sowie die Websites der Schulen (Termine und fehlende Angaben, mit Quell-URL).
// Angaben ohne Gewähr; die Schulen können sie jederzeit ändern.
`;
writeFileSync(new URL("../data/schulinfos.js", import.meta.url),
    kopf + "window.SCHULINFOS = " + JSON.stringify(daten) + ";\n");
console.log(`Schulen: ${Object.keys(schulen).length}, mit Kalender-Terminen: ${gesehen.size}, ` +
    `Website-Termine: ${webTermine}, Stand ${stand}${webStand ? ", Websites " + webStand : ""}`);
