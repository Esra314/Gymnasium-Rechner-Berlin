/*
 * Service Worker: macht die Seite offline nutzbar und als App installierbar.
 * Bei jeder Änderung an den Dateien VERSION erhöhen, damit Geräte die neue Fassung laden.
 */
const VERSION = "v1";
const CACHE = "oberschul-helfer-" + VERSION;

const DATEIEN = [
    "./",
    "index.html",
    "impressum.html",
    "datenschutz.html",
    "manifest.webmanifest",
    "favicon.svg",
    "icons/icon-192.png",
    "icons/icon-512.png",
    "icons/apple-touch-icon.png",
    "css/style.css",
    "js/rechner.js",
    "js/umkreis.js",
    "js/i18n.js",
    "js/app.js",
    "data/schulen.js",
    "vendor/leaflet/leaflet.js",
    "vendor/leaflet/leaflet.css"
];

self.addEventListener("install", (event) => {
    event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(DATEIEN)));
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((namen) =>
            Promise.all(namen.filter((n) => n !== CACHE).map((n) => caches.delete(n)))
        )
    );
    self.clients.claim();
});

// Eigene Dateien: sofort aus dem Speicher, im Hintergrund aktualisieren.
// Fremde Server (Kartenbilder von OpenStreetMap) werden nicht gespeichert.
self.addEventListener("fetch", (event) => {
    const anfrage = event.request;
    if (anfrage.method !== "GET" || new URL(anfrage.url).origin !== self.location.origin) {
        return;
    }
    event.respondWith(
        caches.open(CACHE).then(async (cache) => {
            const gespeichert = await cache.match(anfrage, { ignoreSearch: true });
            const ausDemNetz = fetch(anfrage)
                .then((antwort) => {
                    if (antwort.ok) {
                        cache.put(anfrage, antwort.clone());
                    }
                    return antwort;
                })
                .catch(() => gespeichert);
            return gespeichert || ausDemNetz;
        })
    );
});
