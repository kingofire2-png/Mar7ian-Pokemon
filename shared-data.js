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

  // ===============================
  // Oggetti equipaggiabili (nomi italiani risolti a runtime via PokeAPI, caricati una sola
  // volta qui e riusati da Squadra VGC e Calcolo Danni, stesso principio di mosse/dex sopra)
  // ===============================
  const ITEM_SLUGS = [
    'focus-sash', 'leftovers', 'life-orb', 'assault-vest', 'choice-band', 'choice-specs', 'choice-scarf',
    'rocky-helmet', 'sitrus-berry', 'mental-herb', 'electric-seed', 'grassy-seed', 'psychic-seed', 'misty-seed',
    'booster-energy', 'clear-amulet', 'covert-cloak', 'loaded-dice', 'weakness-policy', 'safety-goggles',
    'eject-button', 'red-card', 'room-service', 'protective-pads', 'wide-lens', 'expert-belt', 'air-balloon',
    'black-sludge', 'flame-orb', 'toxic-orb', 'lum-berry', 'heavy-duty-boots', 'terrain-extender', 'light-clay',
    'damp-rock', 'heat-rock', 'icy-rock', 'smooth-rock', 'metronome', 'throat-spray', 'eject-pack',
    'mirror-herb', 'ability-shield', 'punching-glove',
    // Oggetti che potenziano un tipo (uno per tipo) + oggetti con effetto diretto sul danno,
    // aggiunti per il calcolo danni: verificati contro PokeAPI, esistono tutti con nome italiano.
    'charcoal', 'mystic-water', 'miracle-seed', 'magnet', 'never-melt-ice', 'black-belt', 'poison-barb',
    'soft-sand', 'sharp-beak', 'twisted-spoon', 'silver-powder', 'hard-stone', 'spell-tag', 'dragon-fang',
    'black-glasses', 'metal-coat', 'silk-scarf', 'pixie-plate', 'eviolite', 'muscle-band', 'wise-glasses'
  ];

  // PokeAPI non ha ancora la localizzazione italiana per questi oggetti recenti (verificato: il campo
  // "names" della loro risposta manca della voce "it"). Nomi ufficiali italiani presi da Bulbapedia,
  // usati solo come fallback quando PokeAPI non restituisce una traduzione.
  const ITEM_NAME_FALLBACK_IT = {
    'booster-energy': 'Capsula energetica',
    'clear-amulet': 'Ciondolochiaro',
    'covert-cloak': 'Anonimanto',
    'loaded-dice': 'Dado truccato',
    'mirror-herb': 'Foglia carbone',
    'ability-shield': 'Scudo abilità',
    'punching-glove': 'Guantone'
  };

  // Effetti sul danno per gli oggetti con un impatto diretto e ben definito (meccaniche di gioco
  // stabili). Gli oggetti non elencati qui restano selezionabili ma non influenzano il calcolo.
  // statMult usa le chiavi di statistica gia' usate dal motore di calcolo (attack/defense/
  // special-attack/special-defense); typeBoost si applica se il tipo della mossa corrisponde.
  const ITEM_EFFECTS = {
    'life-orb': { damageMult: 1.3 },
    'expert-belt': { damageMultIfSuperEffective: 1.2 },
    'muscle-band': { damageMultByCategory: { physical: 1.1 } },
    'wise-glasses': { damageMultByCategory: { special: 1.1 } },
    'choice-band': { statMult: { attack: 1.5 } },
    'choice-specs': { statMult: { 'special-attack': 1.5 } },
    'assault-vest': { statMult: { 'special-defense': 1.5 } },
    'eviolite': { statMult: { defense: 1.5, 'special-defense': 1.5 } },
    'charcoal': { typeBoost: 'fire', mult: 1.2 },
    'mystic-water': { typeBoost: 'water', mult: 1.2 },
    'miracle-seed': { typeBoost: 'grass', mult: 1.2 },
    'magnet': { typeBoost: 'electric', mult: 1.2 },
    'never-melt-ice': { typeBoost: 'ice', mult: 1.2 },
    'black-belt': { typeBoost: 'fighting', mult: 1.2 },
    'poison-barb': { typeBoost: 'poison', mult: 1.2 },
    'soft-sand': { typeBoost: 'ground', mult: 1.2 },
    'sharp-beak': { typeBoost: 'flying', mult: 1.2 },
    'twisted-spoon': { typeBoost: 'psychic', mult: 1.2 },
    'silver-powder': { typeBoost: 'bug', mult: 1.2 },
    'hard-stone': { typeBoost: 'rock', mult: 1.2 },
    'spell-tag': { typeBoost: 'ghost', mult: 1.2 },
    'dragon-fang': { typeBoost: 'dragon', mult: 1.2 },
    'black-glasses': { typeBoost: 'dark', mult: 1.2 },
    'metal-coat': { typeBoost: 'steel', mult: 1.2 },
    'silk-scarf': { typeBoost: 'normal', mult: 1.2 },
    'pixie-plate': { typeBoost: 'fairy', mult: 1.2 }
  };

  let itemNameCache = {};
  const itemNamesReady = Promise.all(ITEM_SLUGS.map(async slug => {
    try {
      const res = await fetch(`https://pokeapi.co/api/v2/item/${slug}`);
      const data = await res.json();
      const it = data.names.find(n => n.language.name === 'it');
      itemNameCache[slug] = it ? it.name : (ITEM_NAME_FALLBACK_IT[slug] || slug);
    } catch (e) {
      itemNameCache[slug] = ITEM_NAME_FALLBACK_IT[slug] || slug;
    }
  })).then(() => itemNameCache);

  function getItemName(slug) {
    return slug ? (itemNameCache[slug] || slug) : '';
  }

  // ===============================
  // Bersaglio delle mosse (move-targets.json, generato offline: vedi
  // PokemonCentralScraper/build-move-targets.js). Serve al Calcolo Danni 2vs2 per sapere
  // quali mosse colpiscono piu' bersagli (riduzione di danno x0.75 prevista dal doppio).
  // ===============================
  let moveTargets = {};
  const moveTargetsReady = fetch('./move-targets.json')
    .then(res => res.json())
    .then(data => { moveTargets = data; return data; })
    .catch(err => {
      console.error('Errore caricamento move-targets.json:', err);
      moveTargets = {};
      return moveTargets;
    });

  function getMoveTarget(italianName) {
    if (!italianName) return null;
    return moveTargets[italianName] || null;
  }

  function isSpreadMove(italianName) {
    const t = getMoveTarget(italianName);
    return t === 'all-opponents' || t === 'all-other-pokemon';
  }

  // ===============================
  // Nature (25, nome italiano ufficiale) e formula statistica con Natura applicata. Stessa
  // tabella/formula gia' usata da Squadra VGC (team-builder-engine.js), copiata qui per non
  // dipendere dall'ordine di caricamento degli script (Calcolo Danni 2vs2 carica prima di
  // team-builder-engine.js). null = nature neutra (nessun effetto). Mai su HP. Nessun IV.
  // ===============================
  const NATURES = {
    'Ardita': null, 'Docile': null, 'Seria': null, 'Ritrosa': null, 'Furba': null,
    'Schiva':   { up: 'attack', down: 'defense' },
    'Audace':   { up: 'attack', down: 'speed' },
    'Decisa':   { up: 'attack', down: 'special-attack' },
    'Birbona':  { up: 'attack', down: 'special-defense' },
    'Sicura':   { up: 'defense', down: 'attack' },
    'Placida':  { up: 'defense', down: 'speed' },
    'Scaltra':  { up: 'defense', down: 'special-attack' },
    'Fiacca':   { up: 'defense', down: 'special-defense' },
    'Timida':   { up: 'speed', down: 'attack' },
    'Lesta':    { up: 'speed', down: 'defense' },
    'Allegra':  { up: 'speed', down: 'special-attack' },
    'Ingenua':  { up: 'speed', down: 'special-defense' },
    'Modesta':  { up: 'special-attack', down: 'attack' },
    'Mite':     { up: 'special-attack', down: 'defense' },
    'Quieta':   { up: 'special-attack', down: 'speed' },
    'Ardente':  { up: 'special-attack', down: 'special-defense' },
    'Calma':    { up: 'special-defense', down: 'attack' },
    'Gentile':  { up: 'special-defense', down: 'defense' },
    'Vivace':   { up: 'special-defense', down: 'speed' },
    'Cauta':    { up: 'special-defense', down: 'special-attack' }
  };

  function getNatureMod(natureKey, statKey) {
    if (statKey === 'hp') return 1;
    const n = NATURES[natureKey];
    if (!n) return 1;
    if (n.up === statKey) return 1.1;
    if (n.down === statKey) return 0.9;
    return 1;
  }

  // base + offset (75 PS / 20 altre) + EV (0-32), poi Natura. Nessun IV (coerente col resto
  // dell'app: Pokemon Champions non li usa).
  function computeStatTotal(base, ev, statKey, natureKey) {
    const offset = statKey === 'hp' ? 75 : 20;
    const raw = (base || 0) + offset + (ev || 0);
    return Math.floor(raw * getNatureMod(natureKey, statKey));
  }

  // ===============================
  // Mosse che modificano le statistiche (fasi), usate dal Calcolo Danni 2vs2 per applicare
  // automaticamente l'effetto quando un alleato sceglie una di queste mosse. Nessun dato del
  // genere esiste in pokemon-moves.json (verificato): tabella curata a mano sulle mosse piu'
  // comuni in competitivo, nomi italiani verificati contro move-targets.json/pokemon-moves.json.
  // Altre mosse status restano gestibili a mano tramite il regolatore di fasi nel box.
  // ===============================
  const STAT_BOOST_MOVES = {
    'Danzaspada':  { target: 'self', changes: [{ stat: 'attack', stages: 2 }] },
    'Congiura':    { target: 'self', changes: [{ stat: 'special-attack', stages: 1 }, { stat: 'special-defense', stages: 1 }] },
    'Agilità':     { target: 'self', changes: [{ stat: 'speed', stages: 2 }] },
    'Dragodanza':  { target: 'self', changes: [{ stat: 'attack', stages: 1 }, { stat: 'speed', stages: 1 }] },
    'Granfisico':  { target: 'self', changes: [{ stat: 'attack', stages: 1 }, { stat: 'defense', stages: 1 }] },
    'Ferroscudo':  { target: 'self', changes: [{ stat: 'defense', stages: 2 }] },
    'Arrotola':    { target: 'self', changes: [{ stat: 'attack', stages: 1 }, { stat: 'defense', stages: 1 }] },
    'Gettaguscio': { target: 'self', changes: [{ stat: 'attack', stages: 2 }, { stat: 'special-attack', stages: 2 }, { stat: 'speed', stages: 2 }, { stat: 'defense', stages: -1 }, { stat: 'special-defense', stages: -1 }] },
    'Coaching':    { target: 'ally', changes: [{ stat: 'attack', stages: 1 }, { stat: 'defense', stages: 1 }] }
  };

  // ===============================
  // Categorie oggetti per il picker del Calcolo Danni 2vs2 (raggruppamento per tema di gioco,
  // copre tutti i 65 ITEM_SLUGS). "other" e' per gli oggetti di stato auto-inflitto che non
  // rientrano nelle altre 3 categorie richieste (danno / difesa / statistiche-utilita').
  // ===============================
  const ITEM_CATEGORY_LABELS = { damage: 'Danno', defense: 'Difesa', utility: 'Statistiche/Utilità', other: 'Altro' };
  const ITEM_CATEGORIES = {
    'life-orb': 'damage', 'choice-band': 'damage', 'choice-specs': 'damage', 'expert-belt': 'damage',
    'muscle-band': 'damage', 'wise-glasses': 'damage', 'metronome': 'damage', 'punching-glove': 'damage',
    'charcoal': 'damage', 'mystic-water': 'damage', 'miracle-seed': 'damage', 'magnet': 'damage',
    'never-melt-ice': 'damage', 'black-belt': 'damage', 'poison-barb': 'damage', 'soft-sand': 'damage',
    'sharp-beak': 'damage', 'twisted-spoon': 'damage', 'silver-powder': 'damage', 'hard-stone': 'damage',
    'spell-tag': 'damage', 'dragon-fang': 'damage', 'black-glasses': 'damage', 'metal-coat': 'damage',
    'silk-scarf': 'damage', 'pixie-plate': 'damage',

    'assault-vest': 'defense', 'eviolite': 'defense', 'rocky-helmet': 'defense', 'leftovers': 'defense',
    'sitrus-berry': 'defense', 'focus-sash': 'defense', 'heavy-duty-boots': 'defense', 'safety-goggles': 'defense',
    'covert-cloak': 'defense', 'protective-pads': 'defense', 'clear-amulet': 'defense', 'ability-shield': 'defense',
    'mental-herb': 'defense', 'lum-berry': 'defense', 'black-sludge': 'defense',

    'choice-scarf': 'utility', 'electric-seed': 'utility', 'grassy-seed': 'utility', 'psychic-seed': 'utility',
    'misty-seed': 'utility', 'booster-energy': 'utility', 'loaded-dice': 'utility', 'weakness-policy': 'utility',
    'eject-button': 'utility', 'red-card': 'utility', 'room-service': 'utility', 'wide-lens': 'utility',
    'air-balloon': 'utility', 'terrain-extender': 'utility', 'light-clay': 'utility', 'damp-rock': 'utility',
    'heat-rock': 'utility', 'icy-rock': 'utility', 'smooth-rock': 'utility', 'throat-spray': 'utility',
    'eject-pack': 'utility', 'mirror-herb': 'utility',

    'flame-orb': 'other', 'toxic-orb': 'other'
  };
  function getItemCategory(slug) {
    return ITEM_CATEGORIES[slug] || 'other';
  }

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
    getAttackEffectivenessAgainstType,
    ITEM_SLUGS,
    ITEM_EFFECTS,
    itemNamesReady,
    getItemName,
    moveTargetsReady,
    getMoveTarget,
    isSpreadMove,
    NATURES,
    getNatureMod,
    computeStatTotal,
    STAT_BOOST_MOVES,
    ITEM_CATEGORY_LABELS,
    getItemCategory
  };
})();
