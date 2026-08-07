/**
 * team-builder-engine.js
 * Motore di analisi per la Squadra VGC (Lotte in Doppio, Pokémon Champions).
 * Nessuna dipendenza da altri moduli: espone tutto su window.TeamBuilderEngine.
 */

(function () {
  'use strict';

  const TYPES_CONFIG = [
    { id: 'normal', name: 'Normale' }, { id: 'fire', name: 'Fuoco' },
    { id: 'water', name: 'Acqua' }, { id: 'grass', name: 'Erba' },
    { id: 'electric', name: 'Elettro' }, { id: 'ice', name: 'Ghiaccio' },
    { id: 'fighting', name: 'Lotta' }, { id: 'poison', name: 'Veleno' },
    { id: 'ground', name: 'Terra' }, { id: 'flying', name: 'Volante' },
    { id: 'psychic', name: 'Psico' }, { id: 'bug', name: 'Coleottero' },
    { id: 'rock', name: 'Roccia' }, { id: 'ghost', name: 'Spettro' },
    { id: 'dragon', name: 'Drago' }, { id: 'dark', name: 'Buio' },
    { id: 'steel', name: 'Acciaio' }, { id: 'fairy', name: 'Folletto' }
  ];

  const TYPE_NAMES_ITA = {
    normal: 'Normale', fire: 'Fuoco', water: 'Acqua', grass: 'Erba',
    electric: 'Elettro', ice: 'Ghiaccio', fighting: 'Lotta', poison: 'Veleno',
    ground: 'Terra', flying: 'Volante', psychic: 'Psico', bug: 'Coleottero',
    rock: 'Roccia', ghost: 'Spettro', dragon: 'Drago', dark: 'Buio',
    steel: 'Acciaio', fairy: 'Folletto'
  };

  const TYPE_ITA_TO_ID = {};
  Object.keys(TYPE_NAMES_ITA).forEach(id => {
    TYPE_ITA_TO_ID[TYPE_NAMES_ITA[id].toLowerCase()] = id;
  });

  const STAT_LABELS_IT = {
    hp: 'PS', attack: 'Attacco', defense: 'Difesa',
    'special-attack': 'Att. Sp.', 'special-defense': 'Dif. Sp.', speed: 'Velocità'
  };

  // Matrice difensiva: TYPE_CHART[tipoDifensore][tipoAttaccante] = moltiplicatore subito
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

  // OFFENSIVE_CHART[tipoAttaccante] = lista di tipi difensori colpiti in modo super efficace
  const OFFENSIVE_CHART = {
    normal:   [],
    fire:     ['grass', 'ice', 'bug', 'steel'],
    water:    ['fire', 'ground', 'rock'],
    grass:    ['water', 'ground', 'rock'],
    electric: ['water', 'flying'],
    ice:      ['grass', 'ground', 'flying', 'dragon'],
    fighting: ['normal', 'ice', 'rock', 'dark', 'steel'],
    poison:   ['grass', 'fairy'],
    ground:   ['fire', 'electric', 'poison', 'rock', 'steel'],
    flying:   ['grass', 'fighting', 'bug'],
    psychic:  ['fighting', 'poison'],
    bug:      ['grass', 'psychic', 'dark'],
    rock:     ['fire', 'ice', 'flying', 'bug'],
    ghost:    ['psychic', 'ghost'],
    dragon:   ['dragon'],
    dark:     ['psychic', 'ghost'],
    steel:    ['ice', 'rock', 'fairy'],
    fairy:    ['fighting', 'dragon', 'dark']
  };

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

  function calculateTypeMultipliers(types) {
    const multipliers = {};
    TYPES_CONFIG.forEach(t => { multipliers[t.id] = 1; });
    (types || []).forEach(pType => {
      const chart = TYPE_CHART[pType] || {};
      Object.keys(chart).forEach(atkType => { multipliers[atkType] *= chart[atkType]; });
    });
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

  function suggestCandidates(analysis, candidates, excludeIds, limit) {
    const criticalWeak = Object.keys(analysis.weaknessCounts).filter(t => analysis.weaknessCounts[t] >= 2);
    const gaps = analysis.offensiveGaps || [];

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

        gaps.forEach(gapType => {
          if (c.types.some(ct => (OFFENSIVE_CHART[ct] || []).includes(gapType))) {
            score += 1;
            reasons.push(`colpisce ${TYPE_NAMES_ITA[gapType]} in modo super efficace`);
          }
        });

        return { pokemon: c, score, reasons };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, limit || 8);
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
    suggestCandidates
  };
})();
