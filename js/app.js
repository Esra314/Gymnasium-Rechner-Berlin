(function () {
    "use strict";

    var Rechner = window.Rechner;
    var I18n = window.I18n;

    var form = document.getElementById("rechnerForm");
    var zeilen = document.getElementById("noten-zeilen");
    var fsName = document.getElementById("fremdsprache-name");
    var fehlerBox = document.getElementById("fehler");
    var ergebnis = document.getElementById("ergebnis");

    var aktuelleSprache = "de";
    var letztesErgebnis = null;

    function t(schluessel, werte) {
        var text = (I18n.TEXTE[aktuelleSprache] || {})[schluessel];
        if (text === undefined) {
            text = I18n.TEXTE.de[schluessel] || "";
        }
        werte = werte || {};
        werte.grenze = Rechner.GRENZE_NOTENSUMME;
        return text.replace(/\{(\w+)\}/g, function (ganz, name) {
            return werte[name] !== undefined ? String(werte[name]) : ganz;
        });
    }

    function gebietsschema() {
        return aktuelleSprache === "ar" ? "ar-u-nu-latn" : aktuelleSprache;
    }

    function zahl(wert, stellen) {
        var locale = gebietsschema();
        return new Intl.NumberFormat(locale, {
            minimumFractionDigits: stellen,
            maximumFractionDigits: stellen
        }).format(wert);
    }

    function bisDreiStellen(wert) {
        return new Intl.NumberFormat(gebietsschema(), { maximumFractionDigits: 3 }).format(wert);
    }

    function fachAnzeige(fach) {
        if (fach.id === "fremdsprache") {
            return fach.name + " (" + fsName.value + ")";
        }
        return fach.name;
    }

    // ---------- Notentabelle aufbauen ----------

    function baueTabelle() {
        Rechner.FAECHER.forEach(function (fach) {
            var tr = document.createElement("tr");
            tr.dataset.fach = fach.id;

            var th = document.createElement("th");
            th.scope = "row";
            th.className = "fachname";
            th.lang = "de";
            th.id = "fach-" + fach.id;
            th.textContent = fachAnzeige(fach);
            if (fach.gewicht === 2) {
                th.classList.add("doppelt");
            }
            tr.appendChild(th);

            Rechner.HALBJAHRE.forEach(function (halbjahr, i) {
                var td = document.createElement("td");
                var select = document.createElement("select");
                select.id = fach.id + "-" + i;
                select.name = select.id;
                select.dataset.fach = fach.id;
                select.dataset.halbjahr = String(i);
                select.setAttribute("aria-labelledby", "fach-" + fach.id + " kopf-" + i);

                var leer = document.createElement("option");
                leer.value = "";
                leer.dataset.i18n = "choose";
                select.appendChild(leer);

                for (var n = 1; n <= 6; n++) {
                    var opt = document.createElement("option");
                    opt.value = String(n);
                    opt.textContent = String(n);
                    select.appendChild(opt);
                }

                if (!fach.pflicht) {
                    var keine = document.createElement("option");
                    keine.value = "keine";
                    keine.dataset.i18n = "no_grade";
                    select.appendChild(keine);
                }

                td.appendChild(select);
                tr.appendChild(td);
            });

            zeilen.appendChild(tr);
        });

        // Spaltenköpfe für die Beschriftung der Auswahlfelder
        var koepfe = document.querySelectorAll(".noten-tabelle thead th");
        koepfe[1].id = "kopf-0";
        koepfe[2].id = "kopf-1";
    }

    // ---------- Sprache ----------

    // Standardsprache ist Deutsch. Eine andere Sprache nur über ?lang=… oder die Auswahl.
    function waehleStartsprache() {
        var codes = I18n.SPRACHEN.map(function (s) { return s.code; });
        var ausUrl = new URLSearchParams(window.location.search).get("lang");
        if (ausUrl && codes.indexOf(ausUrl) !== -1) {
            return ausUrl;
        }
        return "de";
    }

    function setzeSprache(code) {
        aktuelleSprache = code;
        var info = I18n.SPRACHEN.filter(function (s) { return s.code === code; })[0];
        document.documentElement.lang = code;
        document.documentElement.dir = info ? info.dir : "ltr";
        document.querySelectorAll("#sprachChips button").forEach(function (b) {
            b.setAttribute("aria-pressed", b.dataset.lang === code ? "true" : "false");
        });

        document.querySelectorAll("[data-i18n]").forEach(function (el) {
            el.textContent = t(el.dataset.i18n);
        });
        document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
            el.setAttribute("aria-label", t(el.dataset.i18nAria));
        });

        var url = new URL(window.location.href);
        if (code === "de") {
            url.searchParams.delete("lang");
        } else {
            url.searchParams.set("lang", code);
        }
        window.history.replaceState(null, "", url.toString());

        // Datenschutz-Link führt direkt zur Kurzfassung in der gewählten Sprache
        var dsLink = document.querySelector('.seitenfuss a[href^="datenschutz.html"]');
        if (dsLink) dsLink.setAttribute("href", "datenschutz.html" + (code === "de" ? "" : "#" + code));

        if (letztesErgebnis) {
            zeigeErgebnis(letztesErgebnis);
        }
        zeigeTermine();
        zeigeDatenquelle();
        aktualisiereGymHinweis();
        zeigeVergleich();
        if (letzteSuche) {
            zeigeSuche(letzteSuche);
        }
        if (!fehlerBox.classList.contains("verborgen")) {
            pruefeUndBerechne(false);
        }
    }

    function baueSprachauswahl() {
        var chips = document.getElementById("sprachChips");
        I18n.SPRACHEN.forEach(function (s) {
            var li = document.createElement("li");
            var b = document.createElement("button");
            b.type = "button";
            b.lang = s.code;
            b.dataset.lang = s.code;
            b.textContent = s.name;
            b.addEventListener("click", function () { setzeSprache(s.code); });
            li.appendChild(b);
            chips.appendChild(li);
        });
    }

    // ---------- Berechnung ----------

    function leseNoten() {
        var noten = {};
        Rechner.FAECHER.forEach(function (fach) {
            noten[fach.id] = Rechner.HALBJAHRE.map(function (_, i) {
                var wert = document.getElementById(fach.id + "-" + i).value;
                if (wert === "") return undefined;
                if (wert === "keine") return null;
                return Number(wert);
            });
        });
        return noten;
    }

    function zeigeFehler(fehler) {
        document.querySelectorAll(".noten-tabelle select").forEach(function (s) {
            s.removeAttribute("aria-invalid");
        });

        if (fehler.length === 0) {
            fehlerBox.classList.add("verborgen");
            fehlerBox.textContent = "";
            return;
        }

        var liste = document.createElement("ul");
        fehler.forEach(function (f) {
            var fach = Rechner.FAECHER.filter(function (x) { return x.id === f.fach; })[0];
            var idx = Rechner.HALBJAHRE.indexOf(f.halbjahr);
            document.getElementById(f.fach + "-" + idx).setAttribute("aria-invalid", "true");
            var li = document.createElement("li");
            li.textContent = fachAnzeige(fach) + " – " + f.halbjahr;
            liste.appendChild(li);
        });

        fehlerBox.textContent = "";
        var p = document.createElement("p");
        p.textContent = t("err_missing");
        fehlerBox.appendChild(p);
        fehlerBox.appendChild(liste);
        fehlerBox.classList.remove("verborgen");
    }

    function zeigeErgebnis(r) {
        document.getElementById("notensumme").textContent = String(r.notensumme);
        document.getElementById("durchschnitt").textContent = zahl(r.durchschnitt, 1);

        var karte = document.getElementById("karte-gym");
        var status = document.getElementById("status-gym");
        karte.classList.toggle("ok", r.gymnasiumMoeglich);
        karte.classList.toggle("bedingt", !r.gymnasiumMoeglich);
        status.textContent = r.gymnasiumMoeglich ? t("status_yes") : t("status_probe");
        document.getElementById("probe").classList.toggle("verborgen", r.gymnasiumMoeglich);

        var noten = leseNoten();
        var kern = Rechner.FAECHER.filter(function (f) { return f.kern; });
        var teile = [];
        kern.forEach(function (f) {
            noten[f.id].forEach(function (n) { teile.push(n); });
        });
        document.getElementById("rechenweg-summe").textContent =
            t("sum_label") + " (Deutsch, Mathematik, 1. Fremdsprache; 5/2 + 6/1): " +
            teile.join(" + ") + " = " + r.notensumme +
            (r.gymnasiumMoeglich ? " ≤ " : " > ") + Rechner.GRENZE_NOTENSUMME;

        document.getElementById("rechenweg-schnitt").textContent =
            t("avg_label") + ": " + r.gewichteteSumme + " ÷ " + r.gewichtSumme +
            " = " + bisDreiStellen(r.durchschnittGenau) + " → " + zahl(r.durchschnitt, 1);

        ergebnis.classList.remove("verborgen");
    }

    function pruefeUndBerechne(scrollen) {
        var r = Rechner.berechne(leseNoten());
        zeigeFehler(r.fehler);
        if (!r.ok) {
            letztesErgebnis = null;
            ergebnis.classList.add("verborgen");
            if (scrollen) fehlerBox.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
        }
        var neu = !letztesErgebnis || letztesErgebnis.gymnasiumMoeglich !== r.gymnasiumMoeglich;
        letztesErgebnis = r;
        zeigeErgebnis(r);
        if (neu) {
            // Filter der Schulsuche an das Ergebnis anpassen
            document.querySelector('input[name="art"][value="gym"]').checked = r.gymnasiumMoeglich;
            aktualisiereGymHinweis();
            if (letzteSuche) sucheSchulen(false);
        }
        if (scrollen) {
            ergebnis.focus({ preventScroll: true });
            ergebnis.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }

    // ---------- Termine ----------

    // Allgemeine Angaben ("meist ...") und feste Termine für den Wechsel 2027
    var TERMINE = [
        { wann: "tl_when_1", text: "tl_1" },
        { wann: "tl_when_2", text: "tl_2" },
        { von: "2027-02-08", bis: "2027-02-09", text: "date_probe_anmeldung" },
        { von: "2027-02-19", text: "date_probe" },
        { von: "2027-03-03", bis: "2027-03-11", text: "date_anmeldung" },
        { wann: "tl_when_5", text: "tl_5" },
        { wann: "tl_when_6", text: "tl_6" }
    ];

    function datum(iso) {
        return new Intl.DateTimeFormat(gebietsschema(), {
            day: "numeric", month: "long", year: "numeric", timeZone: "UTC"
        }).format(new Date(iso + "T00:00:00Z"));
    }

    function datumBereich(von, bis) {
        var format = new Intl.DateTimeFormat(gebietsschema(), {
            day: "numeric", month: "long", year: "numeric", timeZone: "UTC"
        });
        var a = new Date(von + "T00:00:00Z");
        var b = new Date(bis + "T00:00:00Z");
        return format.formatRange ? format.formatRange(a, b) : format.format(a) + " – " + format.format(b);
    }

    function zeigeTermine() {
        var liste = document.getElementById("terminListe");
        liste.textContent = "";
        TERMINE.forEach(function (termin) {
            var li = document.createElement("li");
            var wann = document.createElement("strong");
            wann.className = "termin-datum";
            if (termin.wann) {
                wann.textContent = t(termin.wann);
                li.className = "allgemein";
            } else {
                wann.textContent = termin.bis ? datumBereich(termin.von, termin.bis) : datum(termin.von);
            }
            var was = document.createElement("span");
            was.textContent = t(termin.text);
            li.appendChild(wann);
            li.appendChild(was);
            liste.appendChild(li);
        });
    }

    // ---------- Schulen in der Nähe ----------

    var SCHULART_NAMEN = {
        gym: "Gymnasium",
        iss: "Integrierte Sekundarschule (ISS)",
        gms: "Gemeinschaftsschule"
    };
    var daten = window.SCHULDATEN || { schulen: [], plz: {}, stand: "" };
    var letzteSuche = null;
    var karte = null;
    var markerSchicht = null;

    function zeigeDatenquelle() {
        document.getElementById("datenquelle").textContent =
            t("data_source", { stand: daten.stand ? datum(daten.stand) : "" });
    }

    function aktualisiereGymHinweis() {
        var gymAn = document.querySelector('input[name="art"][value="gym"]').checked;
        var hinweis = document.getElementById("gym-hinweis");
        var zeigen = gymAn && letztesErgebnis && !letztesErgebnis.gymnasiumMoeglich;
        hinweis.textContent = zeigen ? "Gymnasium: " + t("status_probe") : "";
        hinweis.classList.toggle("verborgen", !zeigen);
    }

    function gewaehlteArten() {
        return Array.prototype.map.call(
            document.querySelectorAll('input[name="art"]:checked'),
            function (el) { return el.value; }
        );
    }

    var SCHULEN_PRO_SEITE = 10;
    var sichtbareSchulen = SCHULEN_PRO_SEITE;

    function sucheSchulen(scrollen) {
        sichtbareSchulen = SCHULEN_PRO_SEITE;
        var r = window.Umkreis.suche(daten, {
            plz: document.getElementById("plz").value,
            arten: gewaehlteArten(),
            privat: document.getElementById("privat").checked,
            radiusKm: Number(document.getElementById("radius").value)
        });
        letzteSuche = r;
        zeigeSuche(r);
        if (scrollen && r.ok) {
            document.getElementById("sucheErgebnis").scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }

    function zeigeSuche(r) {
        var fehler = document.getElementById("sucheFehler");
        var bereich = document.getElementById("sucheErgebnis");
        if (!r.ok) {
            fehler.textContent = t(r.fehler);
            fehler.classList.remove("verborgen");
            bereich.classList.add("verborgen");
            return;
        }
        fehler.classList.add("verborgen");
        bereich.classList.remove("verborgen");

        var km = document.getElementById("radius").value;
        document.getElementById("trefferAnzahl").textContent = r.schulen.length > 0
            ? t("near_count", { anzahl: r.schulen.length, km: km })
            : t("near_none");

        var liste = document.getElementById("schulListe");
        liste.textContent = "";
        var mehrKnopf = document.getElementById("mehrSchulen");
        mehrKnopf.classList.toggle("verborgen", r.schulen.length <= sichtbareSchulen);
        r.schulen.slice(0, sichtbareSchulen).forEach(function (s) {
            var li = document.createElement("li");
            li.className = "schule schule-" + s.a;

            var kopf = document.createElement("div");
            kopf.className = "schule-kopf";
            var name = document.createElement("strong");
            name.lang = "de";
            name.textContent = s.n;
            var abstand = document.createElement("span");
            abstand.className = "abstand";
            abstand.dir = "ltr";
            abstand.textContent = zahl(s.km, 1) + " km";
            kopf.appendChild(name);
            kopf.appendChild(abstand);

            var info = document.createElement("div");
            info.className = "schule-info";
            var art = document.createElement("span");
            art.className = "badge badge-" + s.a;
            art.lang = "de";
            art.textContent = SCHULART_NAMEN[s.a];
            var traeger = document.createElement("span");
            traeger.className = "traeger";
            traeger.textContent = s.p ? t("school_private") : t("school_public");
            info.appendChild(art);
            info.appendChild(traeger);

            var adresse = document.createElement("div");
            adresse.className = "adresse";
            adresse.lang = "de";
            adresse.textContent = s.s + ", " + s.z + " Berlin" + (s.o ? " (" + s.o + ")" : "");

            li.appendChild(kopf);
            li.appendChild(info);
            li.appendChild(adresse);

            var kontakt = document.createElement("div");
            kontakt.className = "kontakt";
            if (s.w) {
                var link = document.createElement("a");
                link.href = /^https?:\/\//.test(s.w) ? s.w : "https://" + s.w;
                link.target = "_blank";
                link.rel = "noopener";
                link.textContent = "🌐 " + t("website");
                kontakt.appendChild(link);
            }
            if (s.t) {
                var tel = document.createElement("a");
                tel.href = "tel:" + s.t.replace(/[^+\d]/g, "");
                tel.dir = "ltr";
                tel.textContent = "☎ " + s.t;
                kontakt.appendChild(tel);
            }
            if (s.e) {
                var mail = document.createElement("a");
                mail.href = "mailto:" + s.e;
                mail.dir = "ltr";
                mail.textContent = "✉ " + s.e;
                kontakt.appendChild(mail);
            }
            li.appendChild(kontakt);
            li.appendChild(baueMerkKnopf(s));
            li.appendChild(baueDetails(s));
            liste.appendChild(li);
        });

        if (karte) {
            zeichneKarte(r);
        }
    }

    // ---------- Details, Merkliste und Vergleich ----------

    var merkliste = window.Merkliste.erstelle((function () {
        try { return window.localStorage; } catch (e) { return null; }
    })());
    var schuleNachId = {};
    daten.schulen.forEach(function (s) { schuleNachId[s.id] = s; });

    var AUSWAHL_FELDER = { ganztag: true, essen: true };
    var AUSWAHL_WERTE = [["", "opt_unknown"], ["ja", "opt_yes"], ["teilweise", "opt_partly"], ["nein", "opt_no"]];
    var FELD_TEXT = {
        sprachen: "f_lang", ganztag: "f_ganztag", profil: "f_profil",
        essen: "f_essen", tdot: "f_tdot", notizen: "f_notes"
    };

    // Angaben aus dem Schulverzeichnis und Termine aus dem Kalender (data/schulinfos.js)
    var schulinfos = (window.SCHULINFOS && window.SCHULINFOS.schulen) || {};
    var infoStand = (window.SCHULINFOS && window.SCHULINFOS.stand) || "";
    var PORTRAET_URL = "https://www.bildung.berlin.de/Schulverzeichnis/Schulportrait.aspx?IDSchulzweig=";
    var KALENDER_URL = "https://www.berlin.de/land/kalender/index.php?c=79&kategorie%5B47%5D=109&stichwort=";

    function heuteIso() {
        var d = new Date();
        var mm = ("0" + (d.getMonth() + 1)).slice(-2);
        var tt = ("0" + d.getDate()).slice(-2);
        return d.getFullYear() + "-" + mm + "-" + tt;
    }

    function kommendeTermine(s) {
        var info = schulinfos[s.id];
        if (!info || !info.td) return [];
        var heute = heuteIso();
        return info.td.filter(function (x) { return x.d >= heute; });
    }

    function terminText(x) {
        var zeit = x.v ? ", " + x.v + (x.b ? "–" + x.b : "") : "";
        return t("td_" + x.a) + ": " + datum(x.d) + zeit;
    }

    // Text, wie er im Schulverzeichnis steht (für Vergleich und Details)
    function amtlich(s, feld) {
        var info = schulinfos[s.id];
        if (!info) return "";
        if (feld === "sprachen") return info.sp || "";
        if (feld === "ganztag") return info.gt ? t("gt_" + info.gt) : "";
        if (feld === "profil") return info.pr || "";
        if (feld === "essen") return info.me || "";
        if (feld === "tdot") return kommendeTermine(s).map(terminText).join("; ");
        return "";
    }

    // Vorschlag für die Checkliste, solange die Familie selbst nichts eingetragen hat
    function vorschlag(s, feld) {
        var info = schulinfos[s.id];
        if (!info) return "";
        if (feld === "ganztag") {
            if (info.gt === "gebunden") return "ja";
            return info.gt ? "teilweise" : "";
        }
        if (feld === "essen") {
            if (!info.me) return "";
            return /keine/i.test(info.me) ? "nein" : "ja";
        }
        if (feld === "tdot") {
            var naechster = kommendeTermine(s)[0];
            return naechster ? terminText(naechster) : "";
        }
        return amtlich(s, feld);
    }

    function neuerLink(href, text) {
        var a = document.createElement("a");
        a.href = href;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = text;
        return a;
    }

    function webseite(s) {
        return /^https?:\/\//.test(s.w) ? s.w : "https://" + s.w;
    }

    function baueSchulverzeichnis(s) {
        var info = schulinfos[s.id];
        var block = document.createElement("div");
        block.className = "detail-block sv-block";
        var h = document.createElement("h4");
        h.textContent = "🏫 " + t("sv_title");
        block.appendChild(h);

        var liste = document.createElement("dl");
        liste.className = "sv-liste";
        var zeilen = info ? [
            ["f_lang", info.sp],
            ["f_ganztag", info.gt ? t("gt_" + info.gt) : ""],
            ["f_profil", info.pr],
            ["sv_notes", info.bm],
            ["sv_ags", info.ag],
            ["f_essen", info.me]
        ] : [];
        zeilen.forEach(function (z) {
            if (!z[1]) return;
            var dt = document.createElement("dt");
            dt.textContent = t(z[0]);
            var dd = document.createElement("dd");
            dd.lang = "de";
            dd.dir = "auto";
            dd.textContent = z[1];
            if (z[0] === "f_ganztag") dd.removeAttribute("lang");
            liste.appendChild(dt);
            liste.appendChild(dd);
        });
        if (info && info.ob) {
            var dtO = document.createElement("dt");
            dtO.textContent = "✓";
            var ddO = document.createElement("dd");
            ddO.textContent = t("sv_oberstufe");
            liste.appendChild(dtO);
            liste.appendChild(ddO);
        }
        if (liste.childNodes.length > 0) {
            block.appendChild(liste);
        } else {
            var leer = document.createElement("p");
            leer.textContent = t("sv_none");
            block.appendChild(leer);
        }

        var h5 = document.createElement("h5");
        h5.textContent = "📅 " + t("sv_dates");
        block.appendChild(h5);
        var termine = kommendeTermine(s);
        if (termine.length > 0) {
            var ul = document.createElement("ul");
            ul.className = "sv-termine";
            termine.forEach(function (x) {
                var li = document.createElement("li");
                li.appendChild(neuerLink(x.l, terminText(x)));
                ul.appendChild(li);
            });
            block.appendChild(ul);
        } else {
            var keine = document.createElement("p");
            keine.textContent = t("sv_dates_none");
            block.appendChild(keine);
        }

        var links = document.createElement("div");
        links.className = "kontakt";
        if (info && info.z) links.appendChild(neuerLink(PORTRAET_URL + encodeURIComponent(info.z), "📄 " + t("sv_portrait")));
        links.appendChild(neuerLink(KALENDER_URL + encodeURIComponent(s.id), "📅 " + t("sv_calendar")));
        if (s.w) links.appendChild(neuerLink(webseite(s), "🌐 " + t("website")));
        block.appendChild(links);

        var hinweis = document.createElement("p");
        hinweis.className = "hinweis-pruefen";
        hinweis.textContent = "⚠️ " + t("sv_hint", { datum: infoStand ? datum(infoStand) : "–" });
        block.appendChild(hinweis);
        return block;
    }

    function minuten(km, kmh) {
        // Umweg-Faktor 1,3 gegenüber der Luftlinie, auf 5 Minuten gerundet
        return Math.max(5, Math.round((km * 1.3 / kmh) * 60 / 5) * 5);
    }

    function anfahrtLink(s) {
        var ziel = s.s + ", " + s.z + " Berlin";
        return "https://www.google.com/maps/dir/?api=1&travelmode=transit&destination=" + encodeURIComponent(ziel);
    }

    function baueMerkKnopf(s) {
        var knopf = document.createElement("button");
        knopf.type = "button";
        knopf.className = "merken";
        function beschriften() {
            var an = merkliste.istGemerkt(s.id);
            knopf.textContent = an ? t("btn_remembered") : t("btn_remember");
            knopf.setAttribute("aria-pressed", an ? "true" : "false");
        }
        beschriften();
        knopf.addEventListener("click", function () {
            merkliste.umschalten(s.id);
            beschriften();
            zeigeVergleich();
        });
        return knopf;
    }

    function wertAnzeige(feld, wert) {
        if (AUSWAHL_FELDER[feld]) {
            var paar = AUSWAHL_WERTE.filter(function (p) { return p[0] === wert; })[0];
            return wert && paar ? t(paar[1]) : "–";
        }
        return wert || "–";
    }

    function baueDetails(s) {
        var details = document.createElement("details");
        details.className = "schul-details";
        var summary = document.createElement("summary");
        summary.textContent = t("details_school");
        details.appendChild(summary);

        var weg = document.createElement("div");
        weg.className = "detail-block";
        var h = document.createElement("h4");
        h.textContent = t("travel_title");
        var zeile = document.createElement("p");
        zeile.textContent = s.km !== undefined
            ? t("dist_line", { km: zahl(s.km, 1), fuss: minuten(s.km, 4.5), rad: minuten(s.km, 15) })
            : "";
        var link = document.createElement("a");
        link.href = anfahrtLink(s);
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = "🚌 " + t("travel_link");
        var notiz = document.createElement("p");
        notiz.className = "klein";
        notiz.textContent = t("travel_note");
        weg.appendChild(h);
        weg.appendChild(zeile);
        weg.appendChild(link);
        weg.appendChild(notiz);
        details.appendChild(weg);
        details.appendChild(baueSchulverzeichnis(s));

        var check = document.createElement("div");
        check.className = "detail-block";
        var h2 = document.createElement("h4");
        h2.textContent = t("check_title");
        var hinweis = document.createElement("p");
        hinweis.className = "klein";
        hinweis.textContent = t("check_hint");
        check.appendChild(h2);
        check.appendChild(hinweis);

        var raster = document.createElement("div");
        raster.className = "check-raster";
        var vorausgefuellt = false;
        window.Merkliste.FELDER.forEach(function (feld) {
            var label = document.createElement("label");
            label.className = "check-feld";
            var span = document.createElement("span");
            span.textContent = t(FELD_TEXT[feld]);
            label.appendChild(span);
            var eingabe;
            if (AUSWAHL_FELDER[feld]) {
                eingabe = document.createElement("select");
                AUSWAHL_WERTE.forEach(function (p) {
                    var o = document.createElement("option");
                    o.value = p[0];
                    o.textContent = t(p[1]);
                    eingabe.appendChild(o);
                });
            } else if (feld === "notizen") {
                eingabe = document.createElement("textarea");
                eingabe.rows = 2;
            } else {
                eingabe = document.createElement("input");
                eingabe.type = "text";
            }
            var eigene = merkliste.notiz(s.id, feld);
            var vorschlagWert = eigene ? "" : vorschlag(s, feld);
            eingabe.value = eigene || vorschlagWert;
            if (vorschlagWert) {
                vorausgefuellt = true;
                label.classList.add("vorausgefuellt");
                eingabe.title = t("sv_mark");
            }
            eingabe.maxLength = 2000;
            eingabe.addEventListener("change", function () {
                merkliste.setzeNotiz(s.id, feld, eingabe.value);
                label.classList.remove("vorausgefuellt");
                zeigeVergleich();
            });
            label.appendChild(eingabe);
            raster.appendChild(label);
        });
        if (vorausgefuellt) {
            var vorHinweis = document.createElement("p");
            vorHinweis.className = "klein vorausgefuellt-hinweis";
            vorHinweis.textContent = "ⓘ " + t("sv_prefilled");
            check.appendChild(vorHinweis);
        }
        check.appendChild(raster);
        details.appendChild(check);
        return details;
    }

    function zeigeVergleich() {
        var ids = merkliste.ids().filter(function (id) { return schuleNachId[id]; });
        var zaehler = document.getElementById("merkZaehler");
        if (zaehler) {
            zaehler.textContent = ids.length ? String(ids.length) : "";
            zaehler.classList.toggle("verborgen", ids.length === 0);
        }
        document.getElementById("vergleichLeer").classList.toggle("verborgen", ids.length > 0);
        document.getElementById("vergleichBereich").classList.toggle("verborgen", ids.length === 0);
        var tabelle = document.getElementById("vergleichTabelle");
        tabelle.textContent = "";
        if (ids.length === 0) return;

        var schulen = ids.map(function (id) { return schuleNachId[id]; });
        var mitte = letzteSuche && letzteSuche.ok ? letzteSuche.mitte : null;

        var kopf = document.createElement("thead");
        var kopfZeile = document.createElement("tr");
        kopfZeile.appendChild(document.createElement("th"));
        schulen.forEach(function (s) {
            var th = document.createElement("th");
            th.scope = "col";
            var name = document.createElement("div");
            name.lang = "de";
            name.textContent = s.n;
            var weg = document.createElement("button");
            weg.type = "button";
            weg.className = "entfernen nur-bildschirm";
            weg.textContent = "✕ " + t("compare_remove");
            weg.addEventListener("click", function () {
                merkliste.umschalten(s.id);
                zeigeVergleich();
                if (letzteSuche) zeigeSuche(letzteSuche);
            });
            th.appendChild(name);
            th.appendChild(weg);
            kopfZeile.appendChild(th);
        });
        kopf.appendChild(kopfZeile);
        tabelle.appendChild(kopf);

        var zeilen = [
            ["compare_type", function (s) { return SCHULART_NAMEN[s.a]; }],
            ["compare_carrier", function (s) { return s.p ? t("school_private") : t("school_public"); }],
            ["compare_area", function (s) { return s.o || "–"; }],
            ["compare_distance", function (s) {
                if (!mitte) return "–";
                var km = window.Umkreis.entfernungKm(mitte[0], mitte[1], s.lat, s.lon);
                return zahl(km, 1) + " km · 🚶 " + minuten(km, 4.5) + " min";
            }]
        ];
        window.Merkliste.FELDER.forEach(function (feld) {
            zeilen.push([FELD_TEXT[feld], function (s) {
                var eigene = merkliste.notiz(s.id, feld);
                if (eigene) return wertAnzeige(feld, eigene);
                var offiziell = amtlich(s, feld);
                if (!offiziell) return "–";
                var span = document.createElement("span");
                span.className = "amtlich";
                span.title = t("sv_mark");
                span.textContent = offiziell + " ⓘ";
                return span;
            }]);
        });
        zeilen.push(["website", function (s) {
            if (!s.w) return "–";
            var a = document.createElement("a");
            a.href = /^https?:\/\//.test(s.w) ? s.w : "https://" + s.w;
            a.target = "_blank";
            a.rel = "noopener";
            a.textContent = "🌐 " + t("website");
            return a;
        }]);

        var rumpf = document.createElement("tbody");
        zeilen.forEach(function (z) {
            var tr = document.createElement("tr");
            var th = document.createElement("th");
            th.scope = "row";
            th.textContent = t(z[0]);
            tr.appendChild(th);
            schulen.forEach(function (s) {
                var td = document.createElement("td");
                td.dir = "auto";
                var inhalt = z[1](s);
                if (typeof inhalt === "string") {
                    td.textContent = inhalt;
                } else {
                    td.appendChild(inhalt);
                }
                tr.appendChild(td);
            });
            rumpf.appendChild(tr);
        });
        tabelle.appendChild(rumpf);
        document.getElementById("vergleichLegende").textContent = "ⓘ = " + t("sv_mark") + ". "
            + t("sv_dates_source", { datum: infoStand ? datum(infoStand) : "–" });
    }

    document.getElementById("vergleichLeeren").addEventListener("click", function () {
        merkliste.leeren();
        zeigeVergleich();
        if (letzteSuche) zeigeSuche(letzteSuche);
    });

    var FARBEN = { gym: "#1565c0", iss: "#1b7f3b", gms: "#8e24aa" };

    function zeichneKarte(r) {
        var L = window.L;
        markerSchicht.clearLayers();
        var punkte = [r.mitte];
        L.circleMarker(r.mitte, { radius: 6, color: "#333", fillOpacity: 0.9 }).addTo(markerSchicht);
        r.schulen.forEach(function (s) {
            var m = L.circleMarker([s.lat, s.lon], {
                radius: 8, color: "#fff", weight: 2, fillColor: FARBEN[s.a], fillOpacity: 0.95
            });
            var inhalt = document.createElement("div");
            var b = document.createElement("strong");
            b.textContent = s.n;
            inhalt.appendChild(b);
            inhalt.appendChild(document.createElement("br"));
            inhalt.appendChild(document.createTextNode(SCHULART_NAMEN[s.a] + " · " + s.s));
            m.bindPopup(inhalt);
            m.addTo(markerSchicht);
            punkte.push([s.lat, s.lon]);
        });
        if (punkte.length > 1) {
            karte.fitBounds(punkte, { padding: [24, 24], maxZoom: 15 });
        } else {
            karte.setView(r.mitte, 14);
        }
    }

    function ladeKarte() {
        var L = window.L;
        if (!L || karte) return;
        var el = document.getElementById("karte");
        el.classList.remove("verborgen");
        document.getElementById("karteHinweis").classList.add("verborgen");
        karte = L.map(el, { scrollWheelZoom: false });
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
        }).addTo(karte);
        markerSchicht = L.layerGroup().addTo(karte);
        if (letzteSuche && letzteSuche.ok) {
            zeichneKarte(letzteSuche);
        }
    }

    // ---------- Ereignisse ----------

    document.getElementById("sucheForm").addEventListener("submit", function (event) {
        event.preventDefault();
        sucheSchulen(true);
    });

    document.getElementById("sucheForm").addEventListener("change", function (event) {
        if (event.target.name === "art") aktualisiereGymHinweis();
        if (letzteSuche && letzteSuche.ok && event.target.id !== "plz") sucheSchulen(false);
    });

    document.getElementById("karteLaden").addEventListener("click", ladeKarte);

    document.getElementById("mehrSchulen").addEventListener("click", function () {
        sichtbareSchulen += SCHULEN_PRO_SEITE;
        if (letzteSuche) zeigeSuche(letzteSuche);
    });

    form.addEventListener("submit", function (event) {
        event.preventDefault();
        pruefeUndBerechne(true);
    });

    form.addEventListener("reset", function (event) {
        var etwasEingetragen = Array.prototype.some.call(
            zeilen.querySelectorAll("select"),
            function (s) { return s.value !== ""; }
        );
        if (etwasEingetragen && !window.confirm(t("confirm_reset"))) {
            event.preventDefault();
            return;
        }
        letztesErgebnis = null;
        ergebnis.classList.add("verborgen");
        zeigeFehler([]);
        setTimeout(function () {
            document.getElementById("fach-fremdsprache").textContent =
                fachAnzeige(Rechner.FAECHER[2]);
        }, 0);
    });

    fsName.addEventListener("change", function () {
        document.getElementById("fach-fremdsprache").textContent =
            fachAnzeige(Rechner.FAECHER[2]);
    });

    // Nach einem Fehler sofort neu prüfen, sobald Noten ergänzt werden.
    zeilen.addEventListener("change", function () {
        if (!fehlerBox.classList.contains("verborgen") || letztesErgebnis) {
            pruefeUndBerechne(false);
        }
    });

    document.getElementById("drucken").addEventListener("click", function () {
        window.print();
    });

    // Als App installierbar und offline nutzbar (nur über https oder localhost)
    if ("serviceWorker" in navigator && window.isSecureContext && location.protocol !== "file:") {
        window.addEventListener("load", function () {
            navigator.serviceWorker.register("sw.js").catch(function () { /* ohne Offline-Modus weiter */ });
        });
    }

    // ---------- Menü: immer nur ein Bereich sichtbar ----------

    var ANSICHTEN = Array.prototype.slice.call(document.querySelectorAll(".ansicht"));
    var menueLinks = Array.prototype.slice.call(document.querySelectorAll("#hauptmenue a"));

    function zeigeAnsicht(id, ziel, scrollen) {
        document.documentElement.classList.add("mit-ansichten");
        ANSICHTEN.forEach(function (el) { el.classList.toggle("aktiv", el.id === id); });
        menueLinks.forEach(function (a) {
            if (a.getAttribute("href") === "#" + id) {
                a.setAttribute("aria-current", "page");
            } else {
                a.removeAttribute("aria-current");
            }
        });
        if (!scrollen) return;
        var element = ziel || document.getElementById(id);
        var menue = document.getElementById("hauptmenue");
        // Nur hochscrollen, wenn der Anfang des Bereichs nicht zu sehen ist
        if (ziel || element.getBoundingClientRect().top < menue.offsetHeight) {
            element.scrollIntoView({ block: "start" });
        }
    }

    function ansichtAusAdresse(scrollen) {
        var id = decodeURIComponent(window.location.hash.slice(1));
        var el = id ? document.getElementById(id) : null;
        var ansicht = el && el.closest ? el.closest(".ansicht") : null;
        if (!ansicht) {
            zeigeAnsicht(ANSICHTEN[0].id, null, false);
            return;
        }
        zeigeAnsicht(ansicht.id, el !== ansicht ? el : null, scrollen);
    }

    window.addEventListener("hashchange", function () { ansichtAusAdresse(true); });

    baueTabelle();
    baueSprachauswahl();
    setzeSprache(waehleStartsprache());
    if (ANSICHTEN.length > 0) {
        ansichtAusAdresse(true);
        // Beim Öffnen mit #abschnitt erneut hinscrollen, wenn alles geladen ist
        if (window.location.hash) {
            window.addEventListener("load", function () { ansichtAusAdresse(true); });
        }
    }
})();
