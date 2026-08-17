/**
 * sw.js — Interruttore di smontaggio per il supporto offline (rimosso su richiesta).
 *
 * Il supporto offline (PWA) è stato tolto dall'app: sull'iPhone dell'utente il banner
 * di aggiornamento non compariva mai e la versione installata sulla schermata Home
 * restava bloccata senza mostrare nulla. index.html non registra più alcun service
 * worker per i nuovi visitatori — ma chi aveva già installato la versione precedente
 * ha ancora il vecchio sw.js attivo in background, ed è irraggiungibile da un semplice
 * revert dei file (un service worker non si disinstalla da solo). Questo file resta
 * quindi qui APPOSTA, con un solo compito: quando un client già registrato lo rileva
 * come aggiornamento, si installa, si disinstalla subito, svuota tutte le cache di
 * questa origin e ricarica ogni tab aperta — dopo di che quel client torna a caricare
 * tutto direttamente dalla rete, come se il service worker non fosse mai esistito.
 * Non cancellare questo file: è l'unico modo per "raggiungere" chi lo aveva già preso.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
      await self.registration.unregister();

      const clientsList = await self.clients.matchAll({ type: 'window' });
      clientsList.forEach((client) => client.navigate(client.url));
    })()
  );
});
