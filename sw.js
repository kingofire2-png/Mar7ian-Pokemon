/**
 * sw.js — Service worker per supporto offline.
 *
 * Ambito dichiarato (v1): app shell (HTML/CSS/JS) + i due JSON locali
 * (pokemon-moves.json, move-targets.json) sono offline completo e affidabile.
 * Le chiamate PokeAPI (dex, dettaglio specie, abilità, oggetti) sono offline
 * solo per ciò che l'utente ha già visitato online (stale-while-revalidate) —
 * non c'è pre-caricamento massivo dell'intero Pokédex in questa versione.
 * I CDN esterni (Google Fonts, unpkg, jsdelivr) si popolano solo dopo una
 * prima visita online riuscita: un primo accesso assoluto offline non può
 * funzionare comunque, per nessuna risorsa cross-origin mai vista prima.
 *
 * Due versioni di cache separate e indipendenti: CACHE_VERSION copre l'app
 * shell (cambia spesso, ad ogni fix di codice), DATA_CACHE_VERSION copre i
 * due JSON locali (cambia raramente, solo quando un commit corregge dati
 * come pokemon-moves.json — evita di forzare il ri-download di 20MB per una
 * modifica di sola UI). Bump manuale di uno dei due = invalidazione mirata.
 */

const CACHE_VERSION = 'shell-v1';
const DATA_CACHE_VERSION = 'data-v1';
const RUNTIME_CACHE = 'runtime-v1';

const SHELL_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './shared-data.js',
  './type-details.js',
  './app.js',
  './Calcolo_Danni.js',
  './Calcolo_Danni_Engine.js',
  './Calcolo_Danni_2v2.js',
  './team-builder-engine.js',
  './team-builder.js',
  './icons/icon.svg',
  './icons/icon-maskable.svg'
];

const DATA_ASSETS = ['./pokemon-moves.json', './move-targets.json'];

const CURRENT_CACHES = [CACHE_VERSION, DATA_CACHE_VERSION, RUNTIME_CACHE];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => !CURRENT_CACHES.includes(n)).map((n) => caches.delete(n)))
    )
  );
});

// Non chiamiamo skipWaiting() in automatico (vedi commento sopra su install/activate): un
// worker aggiornato resta "in attesa" finché la pagina non glielo chiede esplicitamente,
// cliccando il banner "Nuova versione disponibile" (index.html). Questo e' l'unico modo in cui
// un aggiornamento si attiva prima che l'utente chiuda e riapra l'app da solo.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isDataAsset(url) {
  return DATA_ASSETS.some((path) => url.pathname.endsWith(path.replace('./', '/')));
}

// Cache-first: serve dalla cache se presente, altrimenti va in rete e mette in cache la
// risposta per la prossima volta. Usato per l'app shell e i due JSON locali (stabili, non
// devono essere ricontrollati ad ogni richiesta) e per i CDN esterni (opportunistico).
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

// Stale-while-revalidate: risponde subito dalla cache se c'è, e in parallelo rifà la richiesta
// in rete per aggiornare la cache in background — così chi è online vede sempre dati freschi
// alla visita successiva, e chi è offline vede comunque l'ultima versione già vista. Usato per
// PokeAPI, dove i dati cambiano di rado ma non sono garantiti stabili come i file locali.
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || (await networkPromise) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET') return;

  if (url.origin === self.location.origin) {
    if (isDataAsset(url)) {
      event.respondWith(cacheFirst(event.request, DATA_CACHE_VERSION));
      return;
    }
    event.respondWith(cacheFirst(event.request, CACHE_VERSION));
    return;
  }

  if (url.hostname === 'pokeapi.co') {
    event.respondWith(staleWhileRevalidate(event.request, RUNTIME_CACHE));
    return;
  }

  // CDN esterni (Google Fonts, unpkg, jsdelivr): cache-first opportunistica, mai precaricati
  // in install (un addAll cross-origin è fragile lato CORS se il CDN è momentaneamente giù).
  event.respondWith(cacheFirst(event.request, RUNTIME_CACHE));
});
