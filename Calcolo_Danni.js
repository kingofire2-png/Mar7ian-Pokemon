/**
 * Calcolo_Danni.js - Versione Corretta (Filtri Tipi, Traduzione Integrale Mosse, Statistiche +75/+20)
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

  const STAT_NAMES_ITA = {
    'hp': 'PS', 'attack': 'Attacco', 'defense': 'Difesa',
    'special-attack': 'Sp. Atk', 'special-defense': 'Sp. Def', 'speed': 'Velocità'
  };

  // Dizionario esteso di traduzione per le mosse
  const MOVE_DICTIONARY_ITA = {
    'dig': 'Fossa', 'seismic-toss': 'Movimento Sismico', 'screech': 'Stridio',
    'focus-energy': 'Focalenergia', 'metronome': 'Metronomo', 'swift': 'Cometone',
    'fury-swipes': 'Sfogofuria', 'night-shade': 'Ombra Notturna', 'thunder': 'Tuono',
    'fire-punch': 'Pugnofuoco', 'ice-punch': 'Gelopugno', 'thunder-punch': 'Tuonopugno',
    'scratch': 'Graffio', 'body-slam': 'Corpo a Corpo', 'take-down': 'Ridotto',
    'thrash': 'Colpo', 'double-edge': 'Sdoppiatore', 'leer': 'Peculiare',
    'hyper-beam': 'Iper Raggio', 'low-kick': 'Colpo Basso', 'counter': 'Contropiede',
    'rage-fist': 'Pugno di Rabbia', 'close-combat': 'Zuffa', 'shadow-punch': 'Ombra Pugno',
    'outrage': 'Oltraggio', 'earthquake': 'Terremoto', 'flamethrower': 'Lanciafiamme',
    'surf': 'Surf', 'ice-beam': 'Gelo Raggio', 'thunderbolt': 'Fulmine',
    'psychic': 'Psichico', 'shadow-ball': 'Palla Ombra', 'sludge-bomb': 'Fangobomba',
    'stone-edge': 'Pietrataglio', 'iron-head': 'Zuccata', 'play-rough': 'Carineria'
  };

  let allPokemon = [];
  let filteredPokemon = [];
  let selectedTypes = [];
  let currentLimit = 48;

  let pokemonA = null;
  let pokemonB = null;
  let targetSelection = 'A';

  let statsBonusA = { 'hp': 1, 'attack': 1, 'defense': 1, 'special-attack': 1, 'special-defense': 1, 'speed': 1 };
  let statsBonusB = { 'hp': 1, 'attack': 1, 'defense': 1, 'special-attack': 1, 'special-defense': 1, 'speed': 1 };

  window.switchAppSection = function (sectionId) {
    const pokedexView = document.getElementById('main-pokedex-view');
    const calcView = document.getElementById('damage-calc-view');

    if (!pokedexView || !calcView) return;

    if (sectionId === 'damage-calc') {
      pokedexView.style.display = 'none';
      calcView.style.display = 'block';
    } else {
      calcView.style.display = 'none';
      pokedexView.style.display = 'block';
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    initDamageCalcLayout();
    fetch1351Pokemon();
  });

  function initDamageCalcLayout() {
    const calcContainer = document.getElementById('damage-calc-view');
    if (!calcContainer) return;

    calcContainer.style.cssText = 'max-width: 1280px; margin: 20px auto; padding: 20px; font-family: system-ui, sans-serif; color: #f0f4fc;';

    calcContainer.innerHTML = `
      <header style="margin-bottom: 24px; text-align: center;">
        <h1 style="font-size: 2.2rem; font-weight: 800; color: #84cc16;">Calcolo Danni Pokémon</h1>
        <p style="color: #8e9bb0;">Modulo integrato: Statistiche personalizzate (HP+75, Altre+20), Passini 1-32 e mosse in Italiano.</p>
      </header>

      <div style="display: flex; justify-content: center; gap: 16px; margin-bottom: 24px;">
        <button id="btn-target-a" style="padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; border: 2px solid #84cc16; background: #84cc16; color: #000;">
          Target: Pokémon A (Attaccante)
        </button>
        <button id="btn-target-b" style="padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; border: 2px solid #26334d; background: #182030; color: #fff;">
          Target: Pokémon B (Difensore)
        </button>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; margin-bottom: 32px;">
        <div id="box-a" style="background: #182030; border: 2px solid #84cc16; border-radius: 12px; padding: 20px;">
          <h3 style="color: #84cc16; text-align: center; margin-bottom: 12px;">POKÉMON A (ATTACCANTE)</h3>
          <div id="content-a"><p style="text-align: center; color: #8e9bb0;">Seleziona un Pokémon dalla lista sottostante</p></div>
        </div>
        <div id="box-b" style="background: #182030; border: 2px solid #26334d; border-radius: 12px; padding: 20px;">
          <h3 style="color: #4f46e5; text-align: center; margin-bottom: 12px;">POKÉMON B (DIFENSORE)</h3>
          <div id="content-b"><p style="text-align: center; color: #8e9bb0;">Seleziona un Pokémon dalla lista sottostante</p></div>
        </div>
      </div>

      <div style="background: #121824; border: 1px solid #26334d; border-radius: 12px; padding: 20px;">
        <div style="margin-bottom: 16px;">
          <input type="text" id="calc-search" placeholder="Cerca per nome o numero (es. Annihilape, #0979)..." style="width: 100%; padding: 12px; background: #0b0e14; border: 1px solid #26334d; border-radius: 8px; color: #fff;">
        </div>
        <div id="type-filters" style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px;"></div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px; color: #8e9bb0; font-size: 0.85rem;">
          <span id="calc-pokemon-count">0 POKÉMON TROVATI</span>
        </div>
        <div id="pokemon-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px;"></div>
        <button id="btn-load-more" style="width: 100%; padding: 12px; margin-top: 16px; background: #182030; border: 1px solid #26334d; color: #fff; border-radius: 8px; cursor: pointer; display: none;">Carica altri</button>
      </div>
    `;

    renderTypeFilters();
    setupTargetControls();
  }

  function renderTypeFilters() {
    const container = document.getElementById('type-filters');
    if (!container) return;
    container.innerHTML = TYPES_CONFIG.map(t => `
      <button class="type-btn" data-type="${t.id}" style="background: #0b0e14; border: 1px solid #26334d; color: #fff; padding: 6px 12px; border-radius: 6px; font-size: 0.75rem; cursor: pointer; transition: background 0.2s;">
        ${t.name}
      </button>
    `).join('');

    container.querySelectorAll('.type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type');
        if (selectedTypes.includes(type)) {
          selectedTypes = selectedTypes.filter(t => t !== type);
          btn.style.backgroundColor = '#0b0e14';
          btn.style.borderColor = '#26334d';
        } else if (selectedTypes.length < 2) {
          selectedTypes.push(type);
          btn.style.backgroundColor = '#84cc16';
          btn.style.borderColor = '#84cc16';
          btn.style.color = '#000';
        }
        applyFilters();
      });
    });
  }

  function setupTargetControls() {
    const btnA = document.getElementById('btn-target-a');
    const btnB = document.getElementById('btn-target-b');

    if (btnA && btnB) {
      btnA.addEventListener('click', () => {
        targetSelection = 'A';
        btnA.style.background = '#84cc16'; btnA.style.borderColor = '#84cc16'; btnA.style.color = '#000';
        btnB.style.background = '#182030'; btnB.style.borderColor = '#26334d'; btnB.style.color = '#fff';
      });

      btnB.addEventListener('click', () => {
        targetSelection = 'B';
        btnB.style.background = '#4f46e5'; btnB.style.borderColor = '#4f46e5'; btnB.style.color = '#fff';
        btnA.style.background = '#182030'; btnA.style.borderColor = '#26334d'; btnA.style.color = '#fff';
      });
    }

    const searchInput = document.getElementById('calc-search');
    if (searchInput) searchInput.addEventListener('input', applyFilters);

    const loadMore = document.getElementById('btn-load-more');
    if (loadMore) {
      loadMore.addEventListener('click', () => {
        currentLimit += 48;
        renderGrid();
      });
    }
  }

  async function fetch1351Pokemon() {
    try {
      const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1351');
      const data = await res.json();

      allPokemon = data.results.map((p) => {
        const parts = p.url.split('/').filter(Boolean);
        const id = parseInt(parts[parts.length - 1], 10);
        return {
          id: id,
          rawName: p.name,
          name: p.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`,
          types: [] // Verranno valorizzati dinamicamente per permettere il filtro esatto
        };
      });

      filteredPokemon = [...allPokemon];
      renderGrid();

      // Inizializza Pokémon A e B
      await assignPokemonSlot(979, 'A');
      await assignPokemonSlot(7, 'B');
    } catch (err) {
      console.error('Errore nel caricamento dei 1351 Pokémon:', err);
    }
  }

  function applyFilters() {
    const searchVal = document.getElementById('calc-search')?.value.toLowerCase().trim() || '';
    filteredPokemon = allPokemon.filter(p => {
      const matchName = p.name.toLowerCase().includes(searchVal) || String(p.id).includes(searchVal);
      const matchType = selectedTypes.length === 0 || selectedTypes.every(t => p.types.includes(t));
      return matchName && matchType;
    });
    currentLimit = 48;
    renderGrid();
  }

  function renderGrid() {
    const container = document.getElementById('pokemon-grid');
    const countEl = document.getElementById('calc-pokemon-count');
    const loadMoreBtn = document.getElementById('btn-load-more');

    if (!container) return;

    if (countEl) countEl.textContent = `${filteredPokemon.length} POKÉMON TROVATI`;
    const visible = filteredPokemon.slice(0, currentLimit);

    container.innerHTML = visible.map(p => {
      const isSelectedA = pokemonA && pokemonA.id === p.id;
      const isSelectedB = pokemonB && pokemonB.id === p.id;

      let borderStyle = '1px solid #26334d';
      let bgStyle = '#121824';
      let badgeHtml = '';

      if (isSelectedA) {
        borderStyle = '2px solid #84cc16';
        bgStyle = 'rgba(132, 204, 22, 0.15)';
        badgeHtml = `<span style="background: #84cc16; color: #000; font-weight: 800; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; margin-bottom: 4px;">TARGET A</span>`;
      } else if (isSelectedB) {
        borderStyle = '2px solid #4f46e5';
        bgStyle = 'rgba(79, 70, 229, 0.15)';
        badgeHtml = `<span style="background: #4f46e5; color: #fff; font-weight: 800; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; margin-bottom: 4px;">TARGET B</span>`;
      }

      return `
        <button onclick="window.calcAssignPokemon(${p.id})" style="background: ${bgStyle}; border: ${borderStyle}; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; align-items: center; cursor: pointer; color: #fff; transition: all 0.2s ease;">
          ${badgeHtml}
          <span style="font-size: 0.7rem; color: #8e9bb0; align-self: flex-start;">#${String(p.id).padStart(4, '0')}</span>
          <img src="${p.image}" alt="${p.name}" style="width: 60px; height: 60px; object-fit: contain;" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png'">
          <span style="font-size: 0.8rem; font-weight: 600; margin-top: 4px; text-align: center;">${p.name}</span>
        </button>
      `;
    }).join('');

    if (loadMoreBtn) {
      loadMoreBtn.style.display = currentLimit < filteredPokemon.length ? 'block' : 'none';
    }
  }

  window.calcAssignPokemon = (id) => assignPokemonSlot(id, targetSelection);

  async function assignPokemonSlot(id, slot) {
    try {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
      const data = await res.json();

      const extractedTypes = data.types.map(t => t.type.name);

      // Aggiorna i tipi nella lista globale per abilitare i filtri per questo Pokémon
      const globalPoke = allPokemon.find(p => p.id === id);
      if (globalPoke) globalPoke.types = extractedTypes;

      const pokemonObj = {
        id: data.id,
        name: data.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        image: data.sprites.other['official-artwork'].front_default || data.sprites.front_default,
        types: extractedTypes,
        stats: data.stats,
        moves: data.moves
      };

      if (slot === 'A') {
        pokemonA = pokemonObj;
        await renderPokemonA();
      } else {
        pokemonB = pokemonObj;
        renderPokemonB();
      }

      renderGrid();
    } catch (e) {
      console.error('Errore assegnazione Pokémon:', e);
    }
  }

  // Format e traduzione mossa avanzata
  function getMoveItalianName(slug) {
    if (MOVE_DICTIONARY_ITA[slug]) return MOVE_DICTIONARY_ITA[slug];
    return slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  async function renderPokemonA() {
    const container = document.getElementById('content-a');
    if (!container || !pokemonA) return;

    // Genera options in italiano
    const movesListHtml = pokemonA.moves.map(m => {
      const slug = m.move.name;
      const itaName = getMoveItalianName(slug);
      return `<option value="${m.move.url}" data-slug="${slug}">${itaName}</option>`;
    }).join('');

    // CALCOLO STATISTICHE CORRETTO: HP (+75), ALTRE (+20) + PASSINO
    const statsHtml = pokemonA.stats.map(s => {
      const statKey = s.stat.name;
      const baseVal = s.base_stat;
      const bonusPassino = statsBonusA[statKey] || 1;
      
      const offset = (statKey === 'hp') ? 75 : 20;
      const totalVal = baseVal + offset + bonusPassino;

      return `
        <div style="display: grid; grid-template-columns: 80px 50px 1fr 100px; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 0.8rem;">
          <span style="color: #8e9bb0;">${STAT_NAMES_ITA[statKey] || statKey}</span>
          <span style="font-weight: 700;">${totalVal}</span>
          <div style="background: #0b0e14; height: 6px; border-radius: 3px; overflow: hidden;">
            <div style="width: ${Math.min(100, (totalVal / 300) * 100)}%; height: 100%; background: #84cc16;"></div>
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            <label style="font-size: 0.7rem; color: #8e9bb0;">Passino:</label>
            <input type="number" min="1" max="32" value="${bonusPassino}" onchange="window.updatePassino('A', '${statKey}', this.value)" style="width: 45px; background: #0b0e14; border: 1px solid #26334d; color: #fff; text-align: center; border-radius: 4px; padding: 2px;">
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
        <img src="${pokemonA.image}" style="width: 80px; height: 80px; object-fit: contain;">
        <div>
          <h3 style="font-size: 1.2rem; font-weight: 800; color: #fff;">${pokemonA.name}</h3>
          <div>${pokemonA.types.map(t => `<span style="background: #26334d; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-right: 4px;">${(TYPE_NAMES_ITA[t] || t).toUpperCase()}</span>`).join('')}</div>
        </div>
      </div>

      <div style="background: #0b0e14; padding: 12px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #26334d;">
        <label style="font-size: 0.75rem; font-weight: 700; color: #8e9bb0; display: block; margin-bottom: 6px;">MOSSA ATTACCO (ITALIANO)</label>
        <select id="select-move-a" onchange="window.loadItalianMoveDetails(this)" style="width: 100%; background: #121824; border: 1px solid #26334d; color: #84cc16; padding: 8px; border-radius: 6px; font-size: 0.85rem; font-weight: 700; margin-bottom: 8px;">
          ${movesListHtml}
        </select>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem;">
          <span id="move-ita-name" style="font-weight: 700; color: #84cc16;">Mossa: -</span>
          <span id="move-power-val" style="font-weight: 700; color: #fff;">Potenza Reale: -</span>
        </div>
      </div>

      <div style="font-size: 0.75rem; font-weight: 700; color: #84cc16; margin-bottom: 8px;">STATISTICHE (BASE + OFFSET + PASSINO 1-32)</div>
      <div>${statsHtml}</div>
    `;

    const selectEl = document.getElementById('select-move-a');
    if (selectEl) loadItalianMoveDetails(selectEl);
  }

  function renderPokemonB() {
    const container = document.getElementById('content-b');
    if (!container || !pokemonB) return;

    // CALCOLO STATISTICHE CORRETTO: HP (+75), ALTRE (+20) + PASSINO
    const statsHtml = pokemonB.stats.map(s => {
      const statKey = s.stat.name;
      const baseVal = s.base_stat;
      const bonusPassino = statsBonusB[statKey] || 1;

      const offset = (statKey === 'hp') ? 75 : 20;
      const totalVal = baseVal + offset + bonusPassino;

      return `
        <div style="display: grid; grid-template-columns: 80px 50px 1fr 100px; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 0.8rem;">
          <span style="color: #8e9bb0;">${STAT_NAMES_ITA[statKey] || statKey}</span>
          <span style="font-weight: 700;">${totalVal}</span>
          <div style="background: #0b0e14; height: 6px; border-radius: 3px; overflow: hidden;">
            <div style="width: ${Math.min(100, (totalVal / 300) * 100)}%; height: 100%; background: #4f46e5;"></div>
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            <label style="font-size: 0.7rem; color: #8e9bb0;">Passino:</label>
            <input type="number" min="1" max="32" value="${bonusPassino}" onchange="window.updatePassino('B', '${statKey}', this.value)" style="width: 45px; background: #0b0e14; border: 1px solid #26334d; color: #fff; text-align: center; border-radius: 4px; padding: 2px;">
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
        <img src="${pokemonB.image}" style="width: 80px; height: 80px; object-fit: contain;">
        <div>
          <h3 style="font-size: 1.2rem; font-weight: 800; color: #fff;">${pokemonB.name}</h3>
          <div>${pokemonB.types.map(t => `<span style="background: #26334d; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-right: 4px;">${(TYPE_NAMES_ITA[t] || t).toUpperCase()}</span>`).join('')}</div>
        </div>
      </div>

      <div style="font-size: 0.75rem; font-weight: 700; color: #4f46e5; margin-bottom: 8px;">STATISTICHE (BASE + OFFSET + PASSINO 1-32)</div>
      <div>${statsHtml}</div>
    `;
  }

  window.updatePassino = function(slot, statKey, value) {
    let numVal = parseInt(value, 10);
    if (isNaN(numVal) || numVal < 1) numVal = 1;
    if (numVal > 32) numVal = 32;

    if (slot === 'A') {
      statsBonusA[statKey] = numVal;
      renderPokemonA();
    } else {
      statsBonusB[statKey] = numVal;
      renderPokemonB();
    }
  };

  // ESTRAZIONE NOME UFFICIALE IN ITALIANO CON FALLBACK FORZATO
  window.loadItalianMoveDetails = async function(selectElement) {
    if (!selectElement || !selectElement.value) return;
    const moveUrl = selectElement.value;
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    const slug = selectedOption ? selectedOption.getAttribute('data-slug') : '';

    try {
      const res = await fetch(moveUrl);
      const data = await res.json();

      const itaEntry = data.names ? data.names.find(n => n.language.name === 'it') : null;
      const itaName = itaEntry ? itaEntry.name : getMoveItalianName(slug);
      const movePower = data.power !== null ? data.power : 0;

      // Aggiorna anche l'opzione nel menu a tendina se era rimasta in inglese
      if (selectedOption && itaEntry) {
        selectedOption.textContent = itaEntry.name;
      }

      const nameEl = document.getElementById('move-ita-name');
      const powerEl = document.getElementById('move-power-val');

      if (nameEl) nameEl.textContent = `Mossa: ${itaName}`;
      if (powerEl) powerEl.textContent = `Potenza Reale: ${movePower}`;
    } catch (e) {
      console.error('Errore dettagli mossa:', e);
    }
  };

})();
