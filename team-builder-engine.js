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
    const trickRoomActive = filled.some(slot => (slot.moves || []).some(m => m && m.name === 'Distortozona'));

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
      trickRoomActive,
      synergyBadges,
      filledCount: filled.length
    };
  }

  // Riordina speedTiers secondo lo stato scelto (non necessariamente quello reale della
  // squadra, l'utente puo' simulare "cosa succede se..."). Ventoincoda raddoppia la Velocita'
  // di TUTTI allo stesso modo: non cambia mai l'ordine relativo da solo (moltiplicatore
  // uniforme), cambia solo i numeri mostrati — comportamento corretto qui perche' questo tool
  // analizza una sola squadra, senza un avversario di cui modellare la velocita'. Distortozona
  // inverte l'ordine (chi e' piu' lento agisce prima), con o senza Ventoincoda attivo.
  function computeTurnOrder(speedTiers, opts) {
    const trickRoom = !!(opts && opts.trickRoom);
    const tailwind = !!(opts && opts.tailwind);
    const withEffective = (speedTiers || []).map(s => ({
      ...s,
      effectiveSpeed: tailwind ? s.speed * 2 : s.speed
    }));
    withEffective.sort((a, b) => trickRoom ? a.effectiveSpeed - b.effectiveSpeed : b.effectiveSpeed - a.effectiveSpeed);
    return withEffective;
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

  // ===============================
  // Accoppiamenti da Doppio (2vs2) e mosse consigliate
  // ===============================

  // Sole/pioggia potenziano le mosse del proprio tipo (x1.5); sabbia/neve in Nona generazione
  // non potenziano piu' mosse di un tipo (solo Dif./Dif.Sp.), quindi non hanno una voce qui.
  const WEATHER_MOVE_BOOST = { drought: 'fire', drizzle: 'water' };
  const WEATHER_LABEL_IT = { drought: 'Sole (Siccità)', drizzle: 'Pioggia (Drizzle)' };

  // Boost di mossa dei terreni (x1.3, solo per Pokémon a terra); effetti extra qualitativi.
  const TERRAIN_MOVE_BOOST = { 'electric-surge': 'electric', 'grassy-surge': 'grass', 'psychic-surge': 'psychic' };
  const TERRAIN_LABEL_IT = {
    'electric-surge': 'Campo Elettrico', 'grassy-surge': 'Campo Erboso',
    'psychic-surge': 'Campo Psichico', 'misty-surge': 'Campo Nebbioso'
  };
  const TERRAIN_QUALITATIVE_IT = {
    'grassy-surge': 'cura leggermente ogni alleato a terra a fine turno e dimezza Terremoto/Selvatempesta/Scavare',
    'misty-surge': 'dimezza i danni delle mosse Drago e impedisce le condizioni di stato sugli alleati a terra',
    'psychic-surge': 'blocca le mosse ad alta priorità dirette contro gli alleati a terra'
  };

  const TEAM_PROTECT_MOVES = new Set(['Bodyguard', 'Anticipo']); // protezione da mosse ad area/priorità

  // Abilità che raddoppiano la Velocità sotto un meteo specifico: sinergia diretta con un
  // compagno che pianta quel meteo (Clorofilla+Siccità, Nuotafoglia+Piogga, ecc.).
  const WEATHER_SPEED_BOOST_ABILITY = { drought: 'chlorophyll', drizzle: 'swift-swim', 'sand-stream': 'sand-rush', 'snow-warning': 'slush-rush' };

  // Mosse schermo (nomi italiani verificati contro pokemon-moves.json: "Velo Aurora" non
  // esiste, il nome corretto e' "Velaurora"), dimezzano i danni subiti da tutta la squadra.
  const SCREEN_SETTER_MOVES = new Set(['Riflesso', 'Schermoluce', 'Velaurora']);

  // Soglie fisse (statistica calcolata a Lv.50, stessa formula di computeStatTotal) invece di
  // medie di squadra: con 2-3 Pokemon la media e' troppo sensibile a un singolo outlier per
  // essere un riferimento stabile di "lento"/"forte". 100 e' la stessa soglia gia' usata da
  // analyzeTeam() per suggerire Trick Room.
  const SPEED_BENCHMARK = 100;
  const OFFENSE_BENCHMARK = 100;

  // Punti assegnati a ciascun segnale di sinergia, calibrati sull'impatto reale in una lotta
  // in Doppio: un richiamo avversari che protegge un compagno fragile o un cambio di ordine
  // di turno (Trick Room/Ventoincoda) di solito decidono la lotta piu' di una singola
  // resistenza di tipo, quindi pesano di piu'.
  const SCORE = {
    weatherMoveBoost: 3,
    weatherSpeedBoost: 3,
    terrainMoveBoost: 3,
    terrainQualitative: 1,
    redirectFragilePartner: 4,
    redirectGeneric: 2,
    teamProtect: 1,
    screenSetter: 1,
    trickRoom: 4,
    sashReliability: 1,
    tailwind: 3,
    fakeOutGeneric: 1,
    fakeOutEnablesSetup: 2,
    intimidateSupport: 2,
    typeSynergyResist: 1,
    typeSynergyImmune: 2
  };

  function movepoolFor(speciesName) {
    return (window.SharedData && window.SharedData.getPokemonMoves(speciesName)) || [];
  }

  function statFor(slot, statKey) {
    return computeStatTotal((slot.statsBase || {})[statKey], (slot.evs || {})[statKey] || 0, statKey, slot.nature);
  }

  function profileSlot(slot) {
    const movepool = movepoolFor(slot.speciesName);

    // Le mosse REALMENTE scelte dal giocatore nell'editor squadra (slot.moves, fino a 4, null
    // per gli slot ancora vuoti) sono la fonte di verita' per tag di sinergia e mosse
    // consigliate: un Pokemon che PUO' imparare Distortozona ma a cui non e' stata assegnata
    // non deve essere trattato come un setter di Trick Room per questo accoppiamento. Il
    // movepool completo resta disponibile solo per suggerire mosse negli slot ancora vuoti
    // (vedi suggestMoveset) e per capire cosa questo Pokemon potrebbe ancora imparare.
    const chosenMoves = (slot.moves || [])
      .filter(Boolean)
      .map(m => ({ ...m, typeId: TYPE_ITA_TO_ID[(m.type || '').toLowerCase()] || null }));
    const hasMove = name => chosenMoves.some(m => m.name === name);
    const attackingMoves = chosenMoves
      .filter(m => m.category === 'Fisico' || m.category === 'Speciale')
      .filter(m => typeof m.power === 'number' && m.power > 0)
      .sort((a, b) => b.power - a.power);
    const movepoolAttackingMoves = movepool
      .filter(m => m.category === 'Fisico' || m.category === 'Speciale')
      .map(m => ({ ...m, typeId: TYPE_ITA_TO_ID[(m.type || '').toLowerCase()] || null }))
      .filter(m => typeof m.power === 'number' && m.power > 0)
      .sort((a, b) => b.power - a.power);

    const tags = [];
    if (WEATHER_ABILITY_SLUGS.has(slot.abilitySlug)) tags.push('weather-setter');
    if (TERRAIN_ABILITY_SLUGS.has(slot.abilitySlug)) tags.push('terrain-setter');
    if (hasMove('Sonoqui') || hasMove('Polverabbia')) tags.push('redirector');
    if (hasMove('Distortozona')) tags.push('trickroom');
    if (hasMove('Ventoincoda')) tags.push('tailwind');
    if (hasMove('Bodyguard') || hasMove('Anticipo')) tags.push('team-protect');
    if (hasMove('Fintoattacco')) tags.push('fake-out');
    if ([...SCREEN_SETTER_MOVES].some(hasMove)) tags.push('screen-setter');
    if (slot.abilitySlug === 'intimidate') tags.push('intimidate');
    if (Object.values(WEATHER_SPEED_BOOST_ABILITY).includes(slot.abilitySlug)) tags.push('weather-speed-boost');

    const physicalAttack = statFor(slot, 'attack');
    const specialAttack = statFor(slot, 'special-attack');

    return {
      slot,
      movepool,
      chosenMoves,
      attackingMoves,
      movepoolAttackingMoves,
      hasMove,
      hasProtect: hasMove('Protezione'),
      speed: statFor(slot, 'speed'),
      physicalAttack,
      specialAttack,
      offense: Math.max(physicalAttack, specialAttack),
      bulk: statFor(slot, 'hp') + statFor(slot, 'defense') + statFor(slot, 'special-defense'),
      tags
    };
  }

  // Un attaccante e' "fisico" se il suo Attacco calcolato supera lo Sp. Atk ed e' abbastanza
  // alto da contare come minaccia reale (stessa soglia OFFENSE_BENCHMARK usata altrove).
  function isPhysicalAttacker(profile) {
    return profile.physicalAttack > profile.specialAttack && profile.offense >= OFFENSE_BENCHMARK;
  }

  // Punteggio di sinergia difensiva "classico": quante debolezze di uno vengono coperte
  // (resistite o annullate) dai tipi dell'altro, nelle due direzioni.
  function typeSynergyScore(a, b) {
    const multA = calculateTypeMultipliers(a.slot.types);
    const multB = calculateTypeMultipliers(b.slot.types);
    let score = 0;
    const covered = [];
    Object.keys(multA).forEach(t => {
      if (multA[t] > 1 && multB[t] < 1) {
        score += multB[t] === 0 ? SCORE.typeSynergyImmune : SCORE.typeSynergyResist;
        covered.push(TYPE_NAMES_ITA[t] || t);
      }
    });
    return { score, covered };
  }

  // Un compagno "ha bisogno" di un turno sicuro se deve piazzare un effetto di squadra
  // (meteo/terreno/Trick Room/Ventoincoda) prima di essere davvero utile: Fintoattacco
  // (priorita', fa saltare il turno al bersaglio) glielo puo' garantire.
  function needsSafeSetupTurn(profile) {
    return profile.tags.some(t => ['weather-setter', 'terrain-setter', 'trickroom', 'tailwind'].includes(t));
  }

  function scorePair(a, b, teamAvg) {
    let score = 0;
    const reasons = [];

    if (a.tags.includes('weather-setter')) {
      const abilitySlug = a.slot.abilitySlug;
      const boostType = WEATHER_MOVE_BOOST[abilitySlug];
      if (boostType && b.attackingMoves.some(m => m.typeId === boostType)) {
        score += SCORE.weatherMoveBoost;
        reasons.push(`${a.slot.abilityDisplayName} (${WEATHER_LABEL_IT[abilitySlug]}) potenzia le mosse di tipo ${TYPE_NAMES_ITA[boostType]} di ${b.slot.speciesName}.`);
      }
      const speedAbility = WEATHER_SPEED_BOOST_ABILITY[abilitySlug];
      if (speedAbility && b.slot.abilitySlug === speedAbility) {
        score += SCORE.weatherSpeedBoost;
        reasons.push(`${a.slot.abilityDisplayName} (${WEATHER_LABEL_IT[abilitySlug]}) raddoppia la Velocità di ${b.slot.speciesName} grazie a ${b.slot.abilityDisplayName}.`);
      }
    }
    if (a.tags.includes('terrain-setter')) {
      const abilitySlug = a.slot.abilitySlug;
      const boostType = TERRAIN_MOVE_BOOST[abilitySlug];
      if (boostType && b.attackingMoves.some(m => m.typeId === boostType)) {
        score += SCORE.terrainMoveBoost;
        reasons.push(`${TERRAIN_LABEL_IT[abilitySlug]} (${a.slot.speciesName}) potenzia le mosse di tipo ${TYPE_NAMES_ITA[boostType]} di ${b.slot.speciesName}.`);
      }
      if (TERRAIN_QUALITATIVE_IT[abilitySlug]) {
        score += SCORE.terrainQualitative;
        reasons.push(`${TERRAIN_LABEL_IT[abilitySlug]} (${a.slot.speciesName}) ${TERRAIN_QUALITATIVE_IT[abilitySlug]} — utile anche per ${b.slot.speciesName}.`);
      }
    }
    if (a.tags.includes('redirector')) {
      const moveName = a.hasMove('Sonoqui') ? 'Sonoqui' : 'Polverabbia';
      const fragile = b.bulk < teamAvg.bulk;
      score += fragile ? SCORE.redirectFragilePartner : SCORE.redirectGeneric;
      reasons.push(`${a.slot.speciesName} può attirare gli attacchi su di sé con ${moveName}${fragile ? ', proteggendo ' + b.slot.speciesName + ' (più fragile)' : ' mentre ' + b.slot.speciesName + ' attacca liberamente'}.`);
    }
    if (a.tags.includes('team-protect') && b.offense >= OFFENSE_BENCHMARK) {
      score += SCORE.teamProtect;
      reasons.push(`${a.slot.speciesName} riduce i danni da mosse ad area/priorità su tutta la squadra, incluso ${b.slot.speciesName}.`);
    }
    if (a.tags.includes('screen-setter') && b.offense >= OFFENSE_BENCHMARK) {
      score += SCORE.screenSetter;
      reasons.push(`${a.slot.speciesName} può piazzare Riflesso/Schermoluce/Velaurora, dimezzando i danni subiti da tutta la squadra incluso ${b.slot.speciesName}.`);
    }
    // Trick Room e Ventoincoda risolvono lo stesso problema (chi si muove per primo) in modo
    // opposto: mai sommarli sullo stesso compagno, stessa priorita' di classifyRole (Trick Room
    // vince se un Pokemon impara entrambe le mosse).
    if (a.tags.includes('trickroom') && b.speed < SPEED_BENCHMARK && b.offense >= OFFENSE_BENCHMARK) {
      score += SCORE.trickRoom;
      reasons.push(`Distortozona (${a.slot.speciesName}) inverte l'ordine di turno: ${b.slot.speciesName} è lento ma potente, colpirebbe per primo.`);
      if (a.slot.item === 'focus-sash') {
        score += SCORE.sashReliability;
        reasons.push(`${a.slot.speciesName} porta la Focus Sash: sopravvive quasi sempre al primo colpo per piazzare Distortozona in sicurezza.`);
      }
    } else if (a.tags.includes('tailwind') && b.offense >= OFFENSE_BENCHMARK) {
      score += SCORE.tailwind;
      reasons.push(`Ventoincoda (${a.slot.speciesName}) raddoppia la Velocità della squadra per 4 turni: ${b.slot.speciesName} guadagna l'iniziativa.`);
    }
    if (a.tags.includes('intimidate') && isPhysicalAttacker(b)) {
      score += SCORE.intimidateSupport;
      reasons.push(`${a.slot.abilityDisplayName} (${a.slot.speciesName}) abbassa l'Attacco degli avversari a inizio lotta, proteggendo ${b.slot.speciesName} (attaccante fisico) dai contrattacchi.`);
    }
    if (a.tags.includes('fake-out')) {
      const enables = needsSafeSetupTurn(b);
      score += enables ? SCORE.fakeOutEnablesSetup : SCORE.fakeOutGeneric;
      reasons.push(enables
        ? `Fintoattacco (${a.slot.speciesName}) fa saltare il turno a un avversario: ${b.slot.speciesName} può piazzare il proprio effetto di squadra senza rischi.`
        : `Fintoattacco (${a.slot.speciesName}) toglie un turno all'avversario, dando a ${b.slot.speciesName} un'apertura più sicura.`);
    }

    const { score: tScore, covered } = typeSynergyScore(a, b);
    if (tScore > 0) {
      score += tScore;
      reasons.push(`${b.slot.speciesName} copre le debolezze di tipo ${covered.join(', ')} di ${a.slot.speciesName}.`);
    }

    return { score, reasons };
  }

  function classifyRole(profile) {
    if (profile.tags.includes('redirector')) return 'Supporto (Richiamo avversari)';
    if (profile.tags.includes('weather-setter')) return 'Setter Meteo';
    if (profile.tags.includes('terrain-setter')) return 'Setter Terreno';
    if (profile.tags.includes('trickroom')) return 'Controllo Velocità (Trick Room)';
    if (profile.tags.includes('tailwind')) return 'Controllo Velocità (Ventoincoda)';
    if (profile.tags.includes('team-protect')) return 'Supporto (Protezione di squadra)';
    if (profile.tags.includes('screen-setter')) return 'Supporto (Schermi)';
    if (profile.tags.includes('intimidate')) return 'Supporto (Intimidazione)';
    if (profile.offense >= OFFENSE_BENCHMARK) return 'Attaccante';
    return 'Difensivo/Bilanciato';
  }

  // Mostra prima di tutto le mosse che il giocatore ha GIA' scelto per questo Pokemon
  // nell'editor squadra (non le rimpiazza mai): questa sezione consiglia con chi accoppiarlo,
  // non un moveset alternativo. Solo gli slot che il giocatore non ha ancora assegnato vengono
  // riempiti con un suggerimento coerente col ruolo, scelto dal movepool reale — mai mosse
  // inventate.
  function suggestMoveset(profile, role) {
    const picked = [];
    const pickedNames = new Set();

    profile.chosenMoves.forEach(m => {
      if (picked.length >= 4 || pickedNames.has(m.name)) return;
      picked.push(m);
      pickedNames.add(m.name);
    });

    if (picked.length >= 4) return picked;

    const own = new Set((profile.slot.types || []));

    function add(nameOrMove) {
      const raw = typeof nameOrMove === 'string'
        ? profile.movepool.find(m => m.name === nameOrMove)
        : nameOrMove;
      if (!raw || pickedNames.has(raw.name) || picked.length >= 4) return false;
      const typeId = raw.typeId || TYPE_ITA_TO_ID[(raw.type || '').toLowerCase()] || null;
      picked.push({ ...raw, typeId });
      pickedNames.add(raw.name);
      return true;
    }

    if (role.startsWith('Supporto (Richiamo')) {
      add('Sonoqui'); add('Polverabbia');
    } else if (role.startsWith('Controllo Velocità (Trick Room')) {
      add('Distortozona');
    } else if (role.startsWith('Controllo Velocità (Ventoincoda')) {
      add('Ventoincoda');
    } else if (role.startsWith('Supporto (Protezione')) {
      add('Bodyguard'); add('Anticipo');
    } else if (role.startsWith('Supporto (Schermi')) {
      add('Riflesso'); add('Schermoluce'); add('Velaurora');
    }
    // Fintoattacco (priorita', fa saltare il turno) e Protezione sono cardine di quasi ogni
    // set da Doppio reale: li si propone sempre quando disponibili, non solo per i ruoli di
    // supporto puro, cosi' un attaccante non finisce con 4 mosse offensive ridondanti.
    if (profile.tags.includes('fake-out')) add('Fintoattacco');
    add('Protezione');

    // Riempie gli slot restanti con le mosse offensive migliori. Prima la mossa piu' potente
    // per OGNI tipo posseduto (STAB): un Pokemon di doppio tipo prende sia la sua migliore
    // mossa del tipo primario sia quella del tipo secondario, invece di 4 mosse dello stesso
    // tipo solo perche' quel tipo ha le mosse piu' potenti in assoluto. Poi riempie col resto
    // (altre STAB o copertura) in ordine di potenza.
    own.forEach(typeId => {
      const best = profile.movepoolAttackingMoves.find(m => m.typeId === typeId && !pickedNames.has(m.name));
      if (best) add(best);
    });
    for (const m of profile.movepoolAttackingMoves) { if (picked.length >= 4) break; add(m); }

    // Se il movepool e' minuscolo (es. Ditto, Metapod), restituisce solo cio' che esiste davvero.
    for (const m of profile.movepool) { if (picked.length >= 4) break; add(m); }

    return picked;
  }

  function suggestPairings(slots) {
    const filled = (slots || [])
      .map((slot, index) => ({ slot, index }))
      .filter(x => x.slot);

    if (filled.length < 2) return [];

    const profiles = filled.map(x => ({ ...profileSlot(x.slot), index: x.index }));
    // Media di squadra usata solo per il confronto "fragile rispetto ai compagni" del
    // richiamo avversari: per velocità/attacco si usano soglie fisse (SPEED_BENCHMARK/
    // OFFENSE_BENCHMARK) perche' la media di 2-3 Pokemon e' troppo rumorosa per essere
    // un riferimento affidabile (es. un solo Pokemon molto lento abbassa la media di squadra
    // al punto che i compagni "normali" risultano falsamente piu' lenti della media).
    const teamAvg = {
      bulk: profiles.reduce((s, p) => s + p.bulk, 0) / profiles.length
    };

    return profiles.map(a => {
      // Valuta OGNI possibile compagno (non solo il migliore): con 3+ Pokemon in squadra,
      // vedere anche la seconda scelta e perche' vale meno aiuta a decidere la formazione
      // da 4 da portare in lotta, non solo "chi va con chi" in astratto.
      const ranked = profiles
        .filter(b => b.index !== a.index)
        .map(b => {
          const { score, reasons } = scorePair(a, b, teamAvg);
          return { partner: b, score, reasons };
        })
        .sort((x, y) => y.score - x.score)
        .slice(0, 2);

      const role = classifyRole(a);
      return {
        slotIndex: a.index,
        speciesName: a.slot.speciesName,
        image: a.slot.image,
        role,
        partners: ranked
          .filter(r => r.score > 0)
          .map(r => ({
            slotIndex: r.partner.index,
            speciesName: r.partner.slot.speciesName,
            image: r.partner.slot.image,
            score: r.score,
            reasons: r.reasons
          })),
        suggestedMoves: suggestMoveset(a, role)
      };
    });
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
    computeTurnOrder,
    SPEED_BENCHMARK,
    suggestCandidates,
    recommendCoverageTypes,
    suggestPairings,
    bumpDexVersion
  };
})();
