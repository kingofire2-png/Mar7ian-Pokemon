/**
 * shared-data.js
 * Dati condivisi tra le tre sezioni (Pokédex, Calcolo Danni, Squadra VGC): database mosse
 * (pokemon-moves.json) e dex completo con tipi (PokéAPI). Ogni fetch parte una sola volta,
 * appena questo script viene eseguito (non aspetta DOMContentLoaded), e viene condiviso
 * tramite window.SharedData invece di essere ripetuto da ogni sezione.
 */

(function () {
  'use strict';

  // ===============================
  // Database mosse (pokemon-moves.json)
  // ===============================
  let movesDatabase = {};

  const movesReady = fetch('./pokemon-moves.json')
    .then(res => res.json())
    .then(data => {
      movesDatabase = data;
      return data;
    })
    .catch(err => {
      console.error('Errore caricamento pokemon-moves.json:', err);
      movesDatabase = {};
      return movesDatabase;
    });

  function getPokemonMoves(name) {
    if (!name) return [];
    const normalized = name.trim().toLowerCase();
    const withHyphens = normalized.replace(/ /g, '-');
    let entry = movesDatabase[normalized]
      || movesDatabase[withHyphens]
      || movesDatabase[normalized.replace(/-/g, ' ')];

    // Le Megaevoluzioni non cambiano mai il movepool rispetto alla forma base: se la voce
    // Mega manca o e' vuota nel DB, ricadiamo sulla forma base (regola ufficiale di gioco).
    if ((!entry || entry.moves.length === 0) && /-mega(-x|-y)?$|-gmax$/.test(withHyphens)) {
      const baseKey = withHyphens.replace(/-mega(-x|-y)?$|-gmax$/, '');
      const baseEntry = movesDatabase[baseKey];
      if (baseEntry && baseEntry.moves.length > 0) entry = baseEntry;
    }

    return entry ? entry.moves : [];
  }

  // ===============================
  // Dex completo con tipi (PokéAPI)
  // ===============================
  let dexList = [];
  let dexReadyResolve;
  const dexReady = new Promise(resolve => { dexReadyResolve = resolve; });

  async function fetchAllPokemonResults() {
    const results = [];
    let url = 'https://pokeapi.co/api/v2/pokemon?limit=100';

    while (url) {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Errore PokéAPI');
      const data = await response.json();
      results.push(...data.results);
      url = data.next;
    }

    return results;
  }

  async function loadDex() {
    try {
      const results = await fetchAllPokemonResults();

      dexList = results.map((p) => {
        const urlParts = p.url.split('/').filter(Boolean);
        const id = parseInt(urlParts[urlParts.length - 1], 10);
        const formattedName = p.name
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        return {
          id: id,
          rawName: p.name,
          name: formattedName,
          url: p.url,
          image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`,
          types: []
        };
      });

      // Risolve subito: chi ascolta puo' gia' mostrare la lista senza aspettare i tipi.
      dexReadyResolve(dexList);

      const typeRes = await fetch('https://pokeapi.co/api/v2/type?limit=20');
      const typeData = await typeRes.json();

      await Promise.all(typeData.results.map(async (t) => {
        const res = await fetch(t.url);
        const details = await res.json();
        const typeName = t.name;

        details.pokemon.forEach(item => {
          const urlParts = item.pokemon.url.split('/').filter(Boolean);
          const pId = parseInt(urlParts[urlParts.length - 1], 10);
          const pok = dexList.find(p => p.id === pId);
          if (pok && !pok.types.includes(typeName)) {
            pok.types.push(typeName);
          }
        });
      }));

      window.dispatchEvent(new CustomEvent('pokedex-types-ready'));
    } catch (err) {
      console.error('Errore caricamento dex condiviso:', err);
    }
  }

  loadDex();

  window.SharedData = {
    movesReady,
    getPokemonMoves,
    dexReady,
    getDex: () => dexList
  };
})();
