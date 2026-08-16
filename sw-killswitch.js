/**
 * sw-killswitch.js — Interruttore di emergenza per il service worker.
 *
 * NON è deployato di default (index.html registra ./sw.js, non questo file).
 * Da usare SOLO se una versione di sw.js finisce per servire agli utenti
 * asset rotti/vecchi e serve un fix immediato: rinominare/copiare questo
 * file su sw.js e pubblicarlo. Al prossimo caricamento il browser lo installa,
 * questo si disinstalla da solo, svuota tutte le cache di questa origin e
 * forza il reload di ogni tab aperta — dopo di che tutti i client ripartono
 * da zero (rete diretta, nessuna cache) finché non si ripubblica un sw.js
 * funzionante.
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
