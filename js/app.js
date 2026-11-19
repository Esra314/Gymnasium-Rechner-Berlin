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

        var url = new URL(window.location.href);
        if (code === "de") {
            url.searchParams.delete("lang");
        } else {
            url.searchParams.set("lang", code);
        }
        window.history.replaceState(null, "", url.toString());

        if (letztesErgebnis) {
            zeigeErgebnis(letztesErgebnis);
        }
        zeigeTermine();
        zeigeDatenquelle();
        aktualisiereGymHinweis();
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
        document.getElementById("durchschnitt").textContent = zahl(r.durchschnitt, 2);

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
            " = " + zahl(r.durchschnitt, 2);

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
            liste.appendChild(li);
        });

        if (karte) {
            zeichneKarte(r);
        }
    }

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

    form.addEventListener("reset", function () {
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

    baueTabelle();
    baueSprachauswahl();
    setzeSprache(waehleStartsprache());
})();
