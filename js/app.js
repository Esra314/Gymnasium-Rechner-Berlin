document
.getElementById("rechnerForm")
.addEventListener("submit", function(event){

    event.preventDefault();

    function note(id){
        return Number(document.getElementById(id).value);
    }

    const vorname =
        document.getElementById("vorname").value.trim();

    const nachname =
        document.getElementById("nachname").value.trim();

    const deutsch5 = note("deutsch5");
    const mathe5 = note("mathe5");
    const englisch5 = note("englisch5");
    const nawi5 = note("nawi5");
    const gewi5 = note("gewi5");
    const kunst5 = note("kunst5");
    const musik5 = note("musik5");
    const sport5 = note("sport5");

    const deutsch6 = note("deutsch6");
    const mathe6 = note("mathe6");
    const englisch6 = note("englisch6");
    const nawi6 = note("nawi6");
    const gewi6 = note("gewi6");
    const kunst6 = note("kunst6");
    const musik6 = note("musik6");
    const sport6 = note("sport6");

    const gewichteteSumme =
        deutsch5 * 2 +
        mathe5 * 2 +
        englisch5 * 2 +
        nawi5 * 2 +
        gewi5 * 2 +
        kunst5 +
        musik5 +
        sport5 +
        deutsch6 * 2 +
        mathe6 * 2 +
        englisch6 * 2 +
        nawi6 * 2 +
        gewi6 * 2 +
        kunst6 +
        musik6 +
        sport6;

    const durchschnitt =
        (gewichteteSumme / 26).toFixed(2);

    const hauptfachsumme =
        deutsch5 +
        mathe5 +
        englisch5 +
        deutsch6 +
        mathe6 +
        englisch6;

    let empfehlung;

    if(
        hauptfachsumme <= 14
    ){
        empfehlung =
            "✅ Gymnasialempfehlung erhalten";
    }
    else{
        empfehlung =
            "⚠️ Probeunterricht erforderlich";
    }

    document
        .getElementById("schuelerName")
        .textContent =
        vorname + " " + nachname;

    document
        .getElementById("durchschnitt")
        .textContent =
        durchschnitt;

    document
        .getElementById("hauptfachsumme")
        .textContent =
        hauptfachsumme;

    const empfehlungElement =
        document.getElementById("empfehlung");

    empfehlungElement.textContent =
        empfehlung;

    if(empfehlung.includes("Gymnasialempfehlung")){
        empfehlungElement.className = "erfolg";
    }
    else{
        empfehlungElement.className = "warnung";
    }

    document
        .getElementById("ergebnis")
        .classList.remove("verborgen");

});
