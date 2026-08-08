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
  // Costanti tipi condivise (fonte unica di verita')
  // ===============================
  const TYPES_CONFIG = [
    { id: 'normal', name: 'Normale' },
    { id: 'fire', name: 'Fuoco' },
    { id: 'water', name: 'Acqua' },
    { id: 'grass', name: 'Erba' },
    { id: 'electric', name: 'Elettro' },
    { id: 'ice', name: 'Ghiaccio' },
    { id: 'fighting', name: 'Lotta' },
    { id: 'poison', name: 'Veleno' },
    { id: 'ground', name: 'Terra' },
    { id: 'flying', name: 'Volante' },
    { id: 'psychic', name: 'Psico' },
    { id: 'bug', name: 'Coleottero' },
    { id: 'rock', name: 'Roccia' },
    { id: 'ghost', name: 'Spettro' },
    { id: 'dragon', name: 'Drago' },
    { id: 'dark', name: 'Buio' },
    { id: 'steel', name: 'Acciaio' },
    { id: 'fairy', name: 'Folletto' }
  ];

  const TYPE_NAMES_ITA = {
    normal: 'Normale', fire: 'Fuoco', water: 'Acqua', grass: 'Erba',
    electric: 'Elettro', ice: 'Ghiaccio', fighting: 'Lotta', poison: 'Veleno',
    ground: 'Terra', flying: 'Volante', psychic: 'Psico', bug: 'Coleottero',
    rock: 'Roccia', ghost: 'Spettro', dragon: 'Drago', dark: 'Buio',
    steel: 'Acciaio', fairy: 'Folletto'
  };

  const TYPE_IDS = TYPES_CONFIG.map(t => t.id);

  // Matrice difensiva canonica: TYPE_CHART[tipoDifensore][tipoAttaccante] = moltiplicatore subito
  const TYPE_CHART = {
    normal:   { fighting: 2, ghost: 0 },
    fire:     { water: 2, ground: 2, rock: 2, fire: 0.5, grass: 0.5, ice: 0.5, bug: 0.5, steel: 0.5, fairy: 0.5 },
    water:    { electric: 2, grass: 2, fire: 0.5, water: 0.5, ice: 0.5, steel: 0.5 },
    grass:    { fire: 2, ice: 2, poison: 2, flying: 2, bug: 2, water: 0.5, grass: 0.5, electric: 0.5, ground: 0.5 },
    electric: { ground: 2, electric: 0.5, flying: 0.5, steel: 0.5 },
    ice:      { fire: 2, fighting: 2, rock: 2, steel: 2, ice: 0.5 },
    fighting: { flying: 2, psychic: 2, fairy: 2, bug: 0.5, rock: 0.5, dark: 0.5 },
    poison:   { ground: 2, psychic: 2, grass: 0.5, fighting: 0.5, poison: 0.5, bug: 0.5, fairy: 0.5 },
    ground:   { water: 2, grass: 2, ice: 2, poison: 0.5, rock: 0.5, electric: 0 },
    flying:   { electric: 2, ice: 2, rock: 2, grass: 0.5, fighting: 0.5, bug: 0.5, ground: 0 },
    psychic:  { bug: 2, ghost: 2, dark: 2, fighting: 0.5, psychic: 0.5 },
    bug:      { fire: 2, flying: 2, rock: 2, grass: 0.5, fighting: 0.5, ground: 0.5 },
    rock:     { water: 2, grass: 2, fighting: 2, ground: 2, steel: 2, normal: 0.5, fire: 0.5, poison: 0.5, flying: 0.5 },
    ghost:    { ghost: 2, dark: 2, poison: 0.5, bug: 0.5, normal: 0, fighting: 0 },
    dragon:   { ice: 2, dragon: 2, fairy: 2, fire: 0.5, water: 0.5, grass: 0.5, electric: 0.5 },
    dark:     { fighting: 2, bug: 2, fairy: 2, ghost: 0.5, dark: 0.5, psychic: 0 },
    steel:    { fire: 2, fighting: 2, ground: 2, normal: 0.5, grass: 0.5, ice: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 0.5, dragon: 0.5, steel: 0.5, fairy: 0.5, poison: 0 },
    fairy:    { poison: 2, steel: 2, fighting: 0.5, bug: 0.5, dark: 0.5, dragon: 0 }
  };

  // Vista attaccante-indicizzata, derivata automaticamente da TYPE_CHART (serve al Calcolo
  // Danni: "dato il tipo della mossa, che moltiplicatore ha contro il difensore"). Non va mai
  // mantenuta a mano: se TYPE_CHART cambia, questa si aggiorna da sola.
  function buildAttackerIndexedChart(defenderChart) {
    const attackerChart = {};
    Object.keys(defenderChart).forEach(defType => {
      Object.keys(defenderChart[defType]).forEach(atkType => {
        if (!attackerChart[atkType]) attackerChart[atkType] = {};
        attackerChart[atkType][defType] = defenderChart[defType][atkType];
      });
    });
    return attackerChart;
  }
  const TYPE_CHART_BY_ATTACKER = buildAttackerIndexedChart(TYPE_CHART);

  // OFFENSIVE_CHART[tipoAttaccante] = tipi difensori colpiti in modo super efficace (x2),
  // derivata da TYPE_CHART invece che mantenuta a mano separatamente.
  function buildOffensiveChart(defenderChart, typeIds) {
    const offensive = {};
    typeIds.forEach(atk => { offensive[atk] = []; });
    typeIds.forEach(defType => {
      typeIds.forEach(atkType => {
        if (defenderChart[defType] && defenderChart[defType][atkType] === 2) {
          offensive[atkType].push(defType);
        }
      });
    });
    return offensive;
  }
  const OFFENSIVE_CHART = buildOffensiveChart(TYPE_CHART, TYPE_IDS);

  function getAttackEffectivenessAgainstType(defenderType) {
    const result = { superEffective: [], normal: [], notVeryEffective: [], immune: [] };
    TYPE_IDS.forEach(attackerId => {
      const mult = (TYPE_CHART[defenderType] && TYPE_CHART[defenderType][attackerId] !== undefined)
        ? TYPE_CHART[defenderType][attackerId] : 1;
      if (mult === 2) result.superEffective.push(attackerId);
      else if (mult === 1) result.normal.push(attackerId);
      else if (mult === 0.5) result.notVeryEffective.push(attackerId);
      else if (mult === 0) result.immune.push(attackerId);
    });
    return result;
  }

  // ===============================
  // Cache condivisa dettagli-specie (solo in memoria, mai persistita su disco)
  // Evita che Pokedex / Calcolo Danni / Squadra VGC rifetchino lo stesso Pokemon da PokeAPI
  // quando l'utente lo seleziona in piu' sezioni. Ogni sezione legge l'oggetto in sola
  // lettura e lo modella a modo suo: non va mai mutato in-place, e' condiviso per riferimento.
  // ===============================
  const speciesCache = new Map(); // id -> Promise<raw PokeAPI pokemon JSON>

  function getSpeciesDetail(id) {
    if (speciesCache.has(id)) return speciesCache.get(id);
    const promise = fetch(`https://pokeapi.co/api/v2/pokemon/${id}`)
      .then(res => res.json())
      .catch(err => { speciesCache.delete(id); throw err; });
    speciesCache.set(id, promise);
    return promise;
  }

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
    getDex: () => dexList,
    getSpeciesDetail,
    TYPES_CONFIG,
    TYPE_NAMES_ITA,
    TYPE_CHART,
    TYPE_CHART_BY_ATTACKER,
    OFFENSIVE_CHART,
    getAttackEffectivenessAgainstType
  };
})();
