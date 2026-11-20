# Wertet die gecrawlten Schul-Websites aus: Termine (Tag der offenen Tür, Infoabend)
# sowie fehlende Angaben (Ganztag, Mittagessen, Fremdsprachen).
# Aufruf: python3 -I scripts/schulwebsites_auswerten.py roh/web/ roh/portraets.json roh/web.json [JJJJ-MM-TT] [ausschluss.json]
# Übernommen werden nur Termine ab dem Folgetag des Abrufs bis Ende März des Anmeldejahres.
# Ein Datum ohne Jahr zählt nur, wenn der Wochentag dazu passt.
import sys, os, re, json, datetime

ORDNER, PORTRAETS, AUS = sys.argv[1], sys.argv[2], sys.argv[3]
portraets = json.load(open(PORTRAETS))
HEUTE = (datetime.date.fromisoformat(sys.argv[4]) if len(sys.argv) > 4 else datetime.date.today()) + datetime.timedelta(days=1)
SCHULJAHR = HEUTE.year if HEUTE.month >= 8 else HEUTE.year - 1
ENDE = datetime.date(SCHULJAHR + 1, 3, 31)

MONATE = {"januar": 1, "jänner": 1, "februar": 2, "märz": 3, "maerz": 3, "april": 4, "mai": 5, "juni": 6, "juli": 7,
          "august": 8, "september": 9, "oktober": 10, "november": 11, "dezember": 12,
          "jan": 1, "feb": 2, "mär": 3, "apr": 4, "jun": 6, "jul": 7, "aug": 8, "sep": 9, "sept": 9, "okt": 10, "nov": 11, "dez": 12}
TAGE = {"montag": 0, "dienstag": 1, "mittwoch": 2, "donnerstag": 3, "freitag": 4, "samstag": 5, "sonnabend": 5, "sonntag": 6,
        "mo": 0, "di": 1, "mi": 2, "do": 3, "fr": 4, "sa": 5, "so": 6}

EREIGNIS = re.compile(r"tag(e)?\s+der\s+offenen\s+t(ü|ue)r(en)?|offene[nr]?\s+t(ü|ue)r|info(rmations)?[- ]?abend|info(rmations)?[- ]?tag|"
                      r"info(rmations)?veranstaltung|schnupper(tag|unterricht|stunde)|kennenlern(tag|nachmittag)|"
                      r"hospitationstag|tag\s+der\s+offenen\s+schule|open\s+day", re.I)
WT = r"(?:(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonnabend|sonntag|mo|di|mi|do|fr|sa|so)\.?,?\s*(?:den\s+)?)?"
DATUM_NUM = re.compile(WT + r"(\d{1,2})\.\s?(\d{1,2})\.(?:\s?(\d{4}|\d{2})\b)?", re.I)
DATUM_TXT = re.compile(WT + r"(\d{1,2})\.\s*(januar|jänner|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember|jan|feb|mär|apr|jun|jul|aug|sept|sep|okt|nov|dez)\.?(?:\s+(\d{4}|(?:2[4-9]|3[0-5])(?![\d:.])))?", re.I)
ZEIT = re.compile(r"(\d{1,2})[:.](\d{2})\s*(?:-|–|bis)\s*(\d{1,2})[:.](\d{2})|(?:von\s+|ab\s+|um\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(?:uhr)?\s*(?:-|–|bis)\s*(\d{1,2})(?:[:.](\d{2}))?\s*uhr|"
                  r"(?:ab|um)\s+(\d{1,2})(?:[:.](\d{2}))?\s*uhr|(\d{1,2})[:.](\d{2})\s*uhr", re.I)


def datum_aus(m, txt):
    wt = m.group(1)
    tag = int(m.group(2))
    monat = MONATE[m.group(3).lower()] if txt else int(m.group(3))
    jahr = m.group(4)
    if jahr:
        jahr = int(jahr)
        if jahr < 100:
            jahr += 2000
    else:
        if not wt:
            return None, "ohne_jahr"
        jahr = SCHULJAHR if monat >= 8 else SCHULJAHR + 1
    try:
        d = datetime.date(jahr, monat, tag)
    except ValueError:
        return None, "ungueltig"
    if wt and d.weekday() != TAGE[wt.lower().rstrip(".")]:
        return None, "wochentag"
    return d, "ok"


def zeit_aus(text):
    m = ZEIT.search(text)
    if not m:
        return None, None
    g = m.groups()
    for i in (0, 4):
        if g[i]:
            return "%02d:%s" % (int(g[i]), g[i + 1] or "00"), "%02d:%s" % (int(g[i + 2]), g[i + 3] or "00")
    if g[8]:
        return "%02d:%s" % (int(g[8]), g[9] or "00"), None
    return "%02d:%s" % (int(g[10]), g[11]), None


ZEITEN = re.compile(r"(von\s+)?\d{1,2}[:.]\d{2}\s*(uhr)?(\s*(-|–|bis)\s*\d{1,2}[:.]\d{2}\s*(uhr)?)?", re.I)
WOCHENTAG_WORT = r"\b(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b"
SEP = re.compile(r"^[\s|I:–\-,·/•]*$")
SPERRE = re.compile(r"anmeld|ferien|weihnacht|praktikum|zeugnis|konzert|fasching|prüfung|abitur|elternabend|elternsprech|kurs ?fahrt|kurswahrt|basar|sportfest|advent|messe|markt der", re.I)
K5 = re.compile(r"(klassen|jahrgangs)stufe\s*5\b|kl\.\s*5\b|5\.\s*klassen|5\.\s*klasse|klasse\s*5|5\.\s*jahrgang|jahrgang\s*5|grundschul|kita|vorschul", re.I)
EREIGNIS = re.compile(r"tag(e)?\s+der\s+offenen\s+t(ü|ue)r(en)?|offene[nr]?\s+t(ü|ue)r|info(rmations)?[- ]?abend|info(rmations)?[- ]?tag|"
                      r"info(rmations)?[- ]?veranstaltung|kennenlern(tag|nachmittag)|tag\s+der\s+offenen\s+schule|open\s+(day|house)", re.I)


def termine(seiten):
    gefunden = {}
    for seite in seiten:
        t = seite["text"]
        daten = []
        for rx, txt in ((DATUM_NUM, False), (DATUM_TXT, True)):
            for m in rx.finditer(t):
                daten.append((m.start(), m.end(), m, txt))
        daten.sort(key=lambda x: x[0])
        for e in EREIGNIS.finditer(t):
            art = "info" if re.search(r"abend|veranstaltung", e.group(0), re.I) else "tdot"
            vor = [x for x in daten if x[1] <= e.start()]
            nach = [x for x in daten if x[0] >= e.end()]
            wahl = None
            davor = t[max(0, e.start() - 30):e.start()]
            kalender = re.search(r"\d{1,2}[:.]\d{2}\s*(uhr)?\s*$", davor, re.I)
            if vor:
                luecke = ZEITEN.sub(" ", t[vor[-1][1]:e.start()])
                if SEP.match(luecke) and e.start() - vor[-1][1] <= 40:
                    wahl = vor[-1]
                    if nach and re.match(r"^\W{0,3}$", t[e.end():nach[0][0]]):
                        continue  # mehrdeutig (Datum davor und danach)
                elif kalender and not (nach and re.match(r"^\W{0,3}$", t[e.end():nach[0][0]])) and e.start() - vor[-1][1] <= 90 and not SPERRE.search(t[vor[-1][1]:e.start()]):
                    wahl = vor[-1]
            if not wahl and nach and kalender and re.match(r"^\W{0,3}$", t[e.end():nach[0][0]]):
                wahl = nach[0]
            if not wahl and not kalender and nach and nach[0][0] - e.end() <= 150:
                luecke = t[e.end():nach[0][0]]
                if not SPERRE.search(luecke) and not re.search(r"\d{1,2}[:.]\d{2}|\b\d{1,2}\.\d{1,2}\b", luecke, re.I):
                    wahl = nach[0]
                elif re.match(r"^\W{0,3}$", luecke):
                    wahl = nach[0]
            if not wahl:
                continue
            m, txt = wahl[2], wahl[3]
            d, grund = datum_aus(m, txt)
            if not d or not (HEUTE <= d <= ENDE):
                continue
            umfeld = t[max(0, min(e.start(), m.start()) - 60):max(e.end(), m.end()) + 40]
            if re.search(r"(?<!gymnasialer )(?<!gymnasiale )(?<!mittel- und )oberstufe|leistungskurs|sek\.?\s?ii\b|klasse\s*11|11\.\s*klasse", t[max(0, e.start() - 40):e.end() + 40], re.I):
                continue
            seg = t[max(0, min(e.start(), m.start()) - 60):max(e.end() + 50, m.end())]
            if K5.search(seg) and not re.search(r"7\.\s*klasse|klasse\s*7|jahrgang\s*7|7\.\s*jahrgang|7\. kl|ü7|übergang|sekundarschul", seg, re.I):
                continue
            v, b = zeit_aus(t[m.end():m.end() + 60])
            if v and not ("06:00" <= v <= "21:00"):
                v, b = None, None
            if b and b <= (v or ""):
                b = None
            schluessel = (d.isoformat(), art)
            alt = gefunden.get(schluessel)
            kontext = re.sub(r"\s+", " ", t[max(0, min(e.start(), m.start()) - 60):max(e.end(), m.end()) + 60])
            abst = abs(m.start() - e.start())
            if not alt or (v and not alt.get("v")):
                eintrag = {"d": d.isoformat(), "a": art, "l": seite["url"], "q": "web", "ctx": kontext, "abst": abst}
                if v:
                    eintrag["v"] = v
                if b:
                    eintrag["b"] = b
                gefunden[schluessel] = eintrag
    # gleicher Tag als tdot und info: nur einen behalten (tdot)
    for (d, a) in list(gefunden):
        if a == "info" and (d, "tdot") in gefunden:
            if gefunden[(d, "info")]["abst"] < gefunden[(d, "tdot")]["abst"]:
                del gefunden[(d, "tdot")]
            else:
                del gefunden[(d, a)]
    return sorted(gefunden.values(), key=lambda x: (x["d"], x.get("v", "")))


def ganztag(seiten):
    for seite in seiten:
        t = seite["text"]
        for muster, wert in ((r"teilgebunden\w*\s+ganztag", "teilgebunden"), (r"\bgebunden\w*\s+ganztag", "gebunden"),
                             (r"offen\w*\s+ganztag", "offen")):
            m = re.search(muster, t, re.I)
            if m:
                return wert, seite["url"]
    return None, None


def essen(seiten):
    for seite in seiten:
        t = seite["text"]
        m = re.search(r"\b(mensa|cafeteria|mittagessen|schulessen|schulverpflegung)\b", t, re.I)
        if m and not re.search(r"kein(e)?\s+(mensa|mittagessen)", t, re.I):
            return seite["url"]
    return None


SPRACHEN = ["Englisch", "Französisch", "Spanisch", "Latein", "Russisch", "Italienisch", "Polnisch", "Türkisch",
            "Altgriechisch", "Chinesisch", "Japanisch", "Arabisch", "Portugiesisch", "Neugriechisch", "Hebräisch"]


def sprachen(seiten):
    for seite in seiten:
        t = seite["text"]
        for m in re.finditer(r"fremdsprache|sprachenfolge|sprachangebot|zweite sprache|2\. sprache", t, re.I):
            fenster = t[max(0, m.start() - 150):m.end() + 250]
            gefunden = [s for s in SPRACHEN if re.search(r"\b" + s + r"\b", fenster)]
            if len(gefunden) >= 2:
                return gefunden, seite["url"]
    return None, None


# Von Hand geprüfte Fehltreffer: {"BSN": ["JJJJ-MM-TT", ...]}, Zeit "-" = Uhrzeit verwerfen
AUSSCHLUSS = {}
if len(sys.argv) > 5:
    AUSSCHLUSS = json.load(open(sys.argv[5]))
    AUSSCHLUSS.pop("_hinweis", None)

ergebnis = {}
statistik = {"schulen": 0, "mit_terminen": 0, "termine": 0, "gt_neu": 0, "me_neu": 0, "sp_neu": 0, "ohne_seiten": 0}
for datei in sorted(os.listdir(ORDNER)):
    roh = json.load(open(os.path.join(ORDNER, datei)))
    bsn = roh["id"]
    seiten = roh["seiten"]
    statistik["schulen"] += 1
    if not seiten:
        statistik["ohne_seiten"] += 1
    p = portraets.get(bsn, {})
    eintrag = {"abruf": roh["abruf"], "start": roh["start"]}
    td = [x for x in termine(seiten) if x["d"] not in AUSSCHLUSS.get(bsn, [])]
    for x in td:
        if x["d"] + " ohne Zeit" in AUSSCHLUSS.get(bsn, []):
            x.pop("v", None); x.pop("b", None)
    if td:
        eintrag["td"] = td
        statistik["mit_terminen"] += 1
        statistik["termine"] += len(td)
    if not re.search(r"Ganztag", p.get("angebote", "")):
        gt, url = ganztag(seiten)
        if gt:
            eintrag["gt"] = {"wert": gt, "l": url}
            statistik["gt_neu"] += 1
    if not p.get("mittag"):
        url = essen(seiten)
        if url:
            eintrag["me"] = {"l": url}
            statistik["me_neu"] += 1
    if not p.get("sprachen"):
        sp, url = sprachen(seiten)
        if sp:
            eintrag["sp"] = {"wert": sp, "l": url}
            statistik["sp_neu"] += 1
    ergebnis[bsn] = eintrag
json.dump(ergebnis, open(AUS, "w"), ensure_ascii=False, indent=1)
print(statistik)
