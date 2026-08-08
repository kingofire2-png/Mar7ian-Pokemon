/**
 * team-builder-engine.js
 * Motore di analisi per la Squadra VGC (Lotte in Doppio, Pokémon Champions).
 * Dipende da shared-data.js: costanti tipi (window.SharedData.TYPES_CONFIG/TYPE_NAMES_ITA/
 * TYPE_CHART/OFFENSIVE_CHART) e movepool reale (window.SharedData.getPokemonMoves) per i
 * suggerimenti. Deve caricare dopo shared-data.js. Espone tutto su window.TeamBuilderEngine.
 */

(function () {
  'use strict';

  const TYPES_CONFIG = window.SharedData.TYPES_CONFIG;
  const TYPE_NAMES_ITA = window.SharedData.TYPE_NAMES_ITA;

  const TYPE_ITA_TO_ID = {};
  Object.keys(TYPE_NAMES_ITA).forEach(id => {
    TYPE_ITA_TO_ID[TYPE_NAMES_ITA[id].toLowerCase()] = id;
  });

  const STAT_LABELS_IT = {
    hp: 'PS', attack: 'Attacco', defense: 'Difesa',
    'special-attack': 'Att. Sp.', 'special-defense': 'Dif. Sp.', speed: 'Velocità'
  };

  // Matrice difensiva: TYPE_CHART[tipoDifensore][tipoAttaccante] = moltiplicatore subito
  const TYPE_CHART = window.SharedData.TYPE_CHART;

  // OFFENSIVE_CHART[tipoAttaccante] = lista di tipi difensori colpiti in modo super efficace
  const OFFENSIVE_CHART = window.SharedData.OFFENSIVE_CHART;

  // 25 nature (nome italiano ufficiale, verificato) — null = neutra (nessun effetto)
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

  const WEATHER_ABILITY_SLUGS = new Set(['drizzle', 'drought', 'sand-stream', 'snow-warning']);
  const TERRAIN_ABILITY_SLUGS = new Set(['electric-surge', 'psychic-surge', 'grassy-surge', 'misty-surge']);

  // Mosse di supporto da doppio, verificate nel pokemon-moves.json locale del progetto
  // (nome italiano -> tipo/categoria confermati: tutte "Stato")
  const SUPPORT_MOVES = {
    'Sonoqui':      { icon: '🎯', label: 'Richiamo avversari (Sonoqui)' },
    'Polverabbia':  { icon: '🎯', label: 'Richiamo avversari (Polverabbia)' },
    'Bodyguard':    { icon: '🛡️', label: 'Protezione dal Focus Fire (Bodyguard)' },
    'Anticipo':     { icon: '🛡️', label: 'Protezione dal Focus Fire (Anticipo)' },
    'Protezione':   { icon: '🛡️', label: 'Scouting/Protezione' },
    'Distortozona': { icon: '🌀', label: 'Distortozona — controllo velocità' },
    'Ventoincoda': { icon: '💨', label: 'Ventoincoda — raddoppia la Velocità della squadra per 4 turni' }
  };

  // Cache per combinazione di tipi (es. "fire,flying"): il dex ha ~1300 candidati ma solo
  // ~150 combinazioni di tipi distinte, e non cambiano mai a runtime. Il risultato cacheato
  // e' condiviso per riferimento tra tutti i chiamanti: nessuno lo muta, solo lettura.
  const typeMultiplierCache = new Map();

  function calculateTypeMultipliers(types) {
    const key = (types || []).slice().sort().join(',');
    if (typeMultiplierCache.has(key)) return typeMultiplierCache.get(key);

    const multipliers = {};
    TYPES_CONFIG.forEach(t => { multipliers[t.id] = 1; });
    (types || []).forEach(pType => {
      const chart = TYPE_CHART[pType] || {};
      Object.keys(chart).forEach(atkType => { multipliers[atkType] *= chart[atkType]; });
    });

    typeMultiplierCache.set(key, multipliers);
    return multipliers;
  }

  function getNatureMod(natureKey, statKey) {
    if (statKey === 'hp') return 1;
    const n = NATURES[natureKey];
    if (!n) return 1;
    if (n.up === statKey) return 1.1;
    if (n.down === statKey) return 0.9;
    return 1;
  }

  // Stessa formula del Calcolo Danni (base + offset + EV 0-32), con la Natura applicata sopra
  // (mai su HP). Nessun IV: Pokémon Champions non li usa.
  function computeStatTotal(base, ev, statKey, natureKey) {
    const offset = statKey === 'hp' ? 75 : 20;
    const raw = (base || 0) + offset + (ev || 0);
    return Math.floor(raw * getNatureMod(natureKey, statKey));
  }

  function analyzeTeam(slots) {
    const filled = (slots || []).filter(Boolean);

    const weaknessCounts = {};
    const resistCounts = {};
    TYPES_CONFIG.forEach(t => { weaknessCounts[t.id] = 0; resistCounts[t.id] = 0; });

    filled.forEach(slot => {
      const mult = calculateTypeMultipliers(slot.types);
      TYPES_CONFIG.forEach(t => {
        if (mult[t.id] > 1) weaknessCounts[t.id]++;
        else if (mult[t.id] < 1) resistCounts[t.id]++;
      });
    });

    const offensiveTypesUsed = new Set();
    filled.forEach(slot => {
      const moveTypes = (slot.moves || [])
        .filter(Boolean)
        .map(m => TYPE_ITA_TO_ID[(m.type || '').toLowerCase()])
        .filter(Boolean);
      const typesToUse = moveTypes.length ? moveTypes : (slot.types || []);
      typesToUse.forEach(t => offensiveTypesUsed.add(t));
    });
    const offensiveCoverage = new Set();
    offensiveTypesUsed.forEach(t => (OFFENSIVE_CHART[t] || []).forEach(x => offensiveCoverage.add(x)));
    const offensiveGaps = TYPES_CONFIG.map(t => t.id).filter(id => !offensiveCoverage.has(id));

    const tailwindActive = filled.some(slot => (slot.moves || []).some(m => m && m.name === 'Ventoincoda'));

    const speedTiers = filled.map(slot => {
      const speed = computeStatTotal((slot.statsBase || {}).speed, (slot.evs || {}).speed || 0, 'speed', slot.nature);
      return { name: slot.speciesName, speed, speedTailwind: speed * 2 };
    }).sort((a, b) => b.speed - a.speed);

    const avgSpeed = speedTiers.length ? speedTiers.reduce((s, x) => s + x.speed, 0) / speedTiers.length : 0;
    const suggestTrickRoom = filled.length >= 2 && avgSpeed < 100;

    const synergyBadges = [];
    const weatherFound = [];
    const terrainFound = [];

    filled.forEach(slot => {
      if (!slot.abilitySlug) return;
      if (WEATHER_ABILITY_SLUGS.has(slot.abilitySlug)) weatherFound.push(slot);
      if (TERRAIN_ABILITY_SLUGS.has(slot.abilitySlug)) terrainFound.push(slot);
      if (slot.abilitySlug === 'intimidate') {
        synergyBadges.push({ icon: '😤', text: `${slot.abilityDisplayName} su ${slot.speciesName}: abbassa l'Attacco degli avversari a inizio lotta.` });
      }
      if (slot.abilitySlug === 'prankster') {
        synergyBadges.push({ icon: '⚡', text: `${slot.abilityDisplayName} su ${slot.speciesName}: priorità sulle mosse di stato.` });
      }
      if (slot.abilitySlug === 'levitate') {
        synergyBadges.push({ icon: '🕊️', text: `${slot.abilityDisplayName} su ${slot.speciesName}: immunità a Terra.` });
      }
    });

    weatherFound.forEach(slot => {
      synergyBadges.push({ icon: '☔', text: `Setter Meteo: ${slot.abilityDisplayName} (${slot.speciesName})` });
    });
    if (new Set(weatherFound.map(s => s.abilitySlug)).size > 1) {
      synergyBadges.push({ icon: '⚠️', text: 'Più setter meteo diversi in squadra: rischiano di annullarsi a vicenda in campo.' });
    }

    terrainFound.forEach(slot => {
      synergyBadges.push({ icon: '🌍', text: `Setter Terreno: ${slot.abilityDisplayName} (${slot.speciesName})` });
    });
    if (new Set(terrainFound.map(s => s.abilitySlug)).size > 1) {
      synergyBadges.push({ icon: '⚠️', text: 'Più setter terreno diversi in squadra: resta attivo solo l\'ultimo che entra in campo.' });
    }

    filled.forEach(slot => {
      (slot.moves || []).filter(Boolean).forEach(m => {
        const support = SUPPORT_MOVES[m.name];
        if (support) synergyBadges.push({ icon: support.icon, text: `${support.label} (${slot.speciesName})` });
      });
    });

    if (suggestTrickRoom) {
      synergyBadges.push({ icon: '🌀', text: 'Squadra mediamente lenta: valuta Distortozona (Trick Room) per invertire l\'ordine di turno.' });
    }

    return {
      weaknessCounts,
      resistCounts,
      offensiveGaps,
      offensiveCoverage: Array.from(offensiveCoverage),
      speedTiers,
      avgSpeed,
      tailwindActive,
      synergyBadges,
      filledCount: filled.length
    };
  }

  // Versione del dex: incrementata una sola volta quando i tipi PokeAPI arrivano in modo
  // asincrono (evento pokedex-types-ready), per invalidare la cache dei suggerimenti sotto.
  let dexVersion = 0;
  function bumpDexVersion() { dexVersion++; }

  let lastSuggestSignature = null;
  let lastSuggestResult = null;

  function suggestCandidates(analysis, candidates, excludeIds, limit) {
    const criticalWeak = Object.keys(analysis.weaknessCounts).filter(t => analysis.weaknessCounts[t] >= 2);
    const gaps = analysis.offensiveGaps || [];

    // Firma economica dei soli input che contano per il punteggio: se identica all'ultima
    // chiamata (es. una modifica EV/abilita/natura che non tocca tipi/mosse), evitiamo di
    // riscandire l'intero dex (~1300 candidati) e restituiamo il risultato gia' calcolato.
    const signature = JSON.stringify({
      w: criticalWeak.slice().sort(),
      g: gaps.slice().sort(),
      e: Array.from(excludeIds || []).sort(),
      v: dexVersion,
      l: limit || 8
    });
    if (signature === lastSuggestSignature) return lastSuggestResult;

    const scored = (candidates || [])
      .filter(c => c && c.types && c.types.length && !(excludeIds && excludeIds.has(c.id)))
      .map(c => {
        const mult = calculateTypeMultipliers(c.types);
        let score = 0;
        const reasons = [];

        criticalWeak.forEach(t => {
          if (mult[t] === 0) { score += 2; reasons.push(`immune a ${TYPE_NAMES_ITA[t]}`); }
          else if (mult[t] < 1) { score += 1; reasons.push(`resiste a ${TYPE_NAMES_ITA[t]}`); }
        });

        if (gaps.length) {
          // Copertura offensiva reale: usa le mosse effettive del candidato (gia' caricate,
          // nessun fetch) invece di assumere che il suo tipo difensivo predica cosa colpisce.
          const movepool = window.SharedData.getPokemonMoves(c.name) || [];
          const coverage = new Set();
          if (movepool.length) {
            movepool.forEach(m => (OFFENSIVE_CHART[(m.type || '').toLowerCase()] || []).forEach(x => coverage.add(x)));
          } else {
            // Fallback per il raro caso in cui il movepool non sia ancora disponibile
            // (renderAnalysis puo' eseguire prima che SharedData.movesReady si risolva se
            // c'e' gia' una squadra salvata): euristica basata sul tipo difensivo.
            c.types.forEach(ct => (OFFENSIVE_CHART[ct] || []).forEach(x => coverage.add(x)));
          }
          gaps.forEach(gapType => {
            if (coverage.has(gapType)) {
              score += 1;
              reasons.push(`ha una mossa che colpisce ${TYPE_NAMES_ITA[gapType]} in modo super efficace`);
            }
          });
        }

        return { pokemon: c, score, reasons };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score);

    lastSuggestSignature = signature;
    lastSuggestResult = scored.slice(0, limit || 8);
    return lastSuggestResult;
  }

  // Per ogni tipo scoperto (offensiveGaps), trova i tipi attaccanti che lo colpiscono in modo
  // super efficace, poi seleziona un piccolo set di tipi consigliati con un greedy set-cover
  // (copre il massimo di buchi col minor numero di tipi suggeriti).
  function recommendCoverageTypes(offensiveGaps) {
    if (!offensiveGaps || !offensiveGaps.length) return [];

    const coverageCount = {};
    TYPES_CONFIG.forEach(t => { coverageCount[t.id] = 0; });
    offensiveGaps.forEach(gapType => {
      TYPES_CONFIG.forEach(atk => {
        if (TYPE_CHART[gapType] && TYPE_CHART[gapType][atk.id] === 2) coverageCount[atk.id]++;
      });
    });

    const ranked = TYPES_CONFIG
      .map(t => ({ type: t.id, covers: coverageCount[t.id] }))
      .filter(r => r.covers > 0)
      .sort((a, b) => b.covers - a.covers);

    const covered = new Set();
    const recommended = [];
    for (const r of ranked) {
      if (covered.size >= offensiveGaps.length) break;
      const newlyCovers = offensiveGaps.some(g => !covered.has(g) && TYPE_CHART[g][r.type] === 2);
      if (newlyCovers) {
        recommended.push(r.type);
        offensiveGaps.forEach(g => { if (TYPE_CHART[g] && TYPE_CHART[g][r.type] === 2) covered.add(g); });
      }
    }
    return recommended;
  }

  window.TeamBuilderEngine = {
    TYPES_CONFIG,
    TYPE_NAMES_ITA,
    TYPE_CHART,
    OFFENSIVE_CHART,
    NATURES,
    STAT_LABELS_IT,
    SUPPORT_MOVES,
    calculateTypeMultipliers,
    computeStatTotal,
    analyzeTeam,
    suggestCandidates,
    recommendCoverageTypes,
    bumpDexVersion
  };
})();
