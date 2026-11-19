(function () {
    "use strict";

    var Rechner = window.Rechner;
    var I18n = window.I18n;

    var form = document.getElementById("rechnerForm");
    var zeilen = document.getElementById("noten-zeilen");
    var spracheSelect = document.getElementById("sprache");
    var fsName = document.getElementById("fremdsprache-name");
    var fehlerBox = document.getElementById("fehler");
    var ergebnis = document.getElementById("ergebnis");

    var aktuelleSprache = "de";
    var letztesErgebnis = null;

    function t(schluessel) {
        var text = (I18n.TEXTE[aktuelleSprache] || {})[schluessel];
        if (text === undefined) {
            text = I18n.TEXTE.de[schluessel] || "";
        }
        return text.replace("{grenze}", String(Rechner.GRENZE_NOTENSUMME));
    }

    function zahl(wert, stellen) {
        var locale = aktuelleSprache === "ar" ? "ar-u-nu-latn" : aktuelleSprache;
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

    function waehleStartsprache() {
        var codes = I18n.SPRACHEN.map(function (s) { return s.code; });
        var ausUrl = new URLSearchParams(window.location.search).get("lang");
        if (ausUrl && codes.indexOf(ausUrl) !== -1) {
            return ausUrl;
        }
        var browser = navigator.languages || [navigator.language || "de"];
        for (var i = 0; i < browser.length; i++) {
            var kurz = String(browser[i]).slice(0, 2).toLowerCase();
            if (codes.indexOf(kurz) !== -1) {
                return kurz;
            }
        }
        return "de";
    }

    function setzeSprache(code) {
        aktuelleSprache = code;
        var info = I18n.SPRACHEN.filter(function (s) { return s.code === code; })[0];
        document.documentElement.lang = code;
        document.documentElement.dir = info ? info.dir : "ltr";
        spracheSelect.value = code;

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
        if (!fehlerBox.classList.contains("verborgen")) {
            pruefeUndBerechne(false);
        }
    }

    function baueSprachauswahl() {
        I18n.SPRACHEN.forEach(function (s) {
            var opt = document.createElement("option");
            opt.value = s.code;
            opt.textContent = s.name;
            opt.lang = s.code;
            spracheSelect.appendChild(opt);
        });
        spracheSelect.addEventListener("change", function () {
            setzeSprache(spracheSelect.value);
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
        letztesErgebnis = r;
        zeigeErgebnis(r);
        if (scrollen) {
            ergebnis.focus({ preventScroll: true });
            ergebnis.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }

    // ---------- Ereignisse ----------

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

    baueTabelle();
    baueSprachauswahl();
    setzeSprache(waehleStartsprache());
})();
