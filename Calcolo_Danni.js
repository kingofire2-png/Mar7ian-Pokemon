/**
 * Calcolo_Danni.js - Versione con Autocomplete, Filtri Tipo, EV (0-32) e Wiki Scraping completo via Proxy
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

  const MOVE_TRANSLATIONS = {
    'scratch': 'Graffio', 'body-slam': 'Corpo a Corpo', 'take-down': 'Ridotto',
    'thrash': 'Colpo', 'double-edge': 'Sdoppiatore', 'leer': 'Peculiare',
    'hyper-beam': 'Iper Raggio', 'low-kick': 'Colpo Basso', 'counter': 'Contropiede',
    'seismic-toss': 'Movimento Sismico', 'dig': 'Fossa', 'night-shade': 'Ombra Notturna',
    'screech': 'Stridio', 'focus-energy': 'Focalenergia', 'metronome': 'Metronomo',
    'swift': 'Cometone', 'fury-swipes': 'Sfogofuria', 'fire-punch': 'Pugnofuoco',
    'ice-punch': 'Gelopugno', 'thunder-punch': 'Tuonopugno', 'rage-fist': 'Pugno di Rabbia',
    'close-combat': 'Zuffa', 'shadow-punch': 'Ombra Pugno', 'outrage': 'Oltraggio',
    'earthquake': 'Terremoto', 'flamethrower': 'Lanciafiamme', 'surf': 'Surf',
    'ice-beam': 'Gelo Raggio', 'thunderbolt': 'Fulmine', 'thunder': 'Tuono',
    'psychic': 'Psichico', 'shadow-ball': 'Palla Ombra', 'sludge-bomb': 'Fangobomba',
    'stone-edge': 'Pietrataglio', 'iron-head': 'Zuccata', 'play-rough': 'Carineria'
  };

  let localPokemonList = [];
  let filteredPokemon = [];
  let selectedTypes = [];
  let currentLimit = 48;

  let pokemonA = null;
  let pokemonB = null;
  let targetSelection = 'A';

  // ===============================
// DATABASE MOSSE (Pokemon Central)
// ===============================
let movesDatabase = {};

async function loadMovesDatabase() {

    try {

        const response = await fetch("./pokemon-moves.json");

        movesDatabase = await response.json();

        console.log(
            "Database mosse caricato:",
            Object.keys(movesDatabase).length,
            "Pokémon"
        );

    } catch (err) {

        console.error(
            "Errore caricamento pokemon-moves.json",
            err
        );

    }

}

function getPokemonMoves(name) {

    if (!name) return [];

    const normalized = name.trim();

    const entry =
        movesDatabase[normalized] ||
        movesDatabase[normalized.replace(/ /g, "-")] ||
        movesDatabase[normalized.replace(/-/g, " ")];

    if (!entry) {

        console.warn("Mosse non trovate:", normalized);

        return [];

    }

    return entry.moves;

}

  let statsBonusA = { 'hp': 0, 'attack': 0, 'defense': 0, 'special-attack': 0, 'special-defense': 0, 'speed': 0 };
  let statsBonusB = { 'hp': 0, 'attack': 0, 'defense': 0, 'special-attack': 0, 'special-defense': 0, 'speed': 0 };

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

  document.addEventListener('DOMContentLoaded', async () => {

    initDamageCalcLayout();

    await loadMovesDatabase();

    await loadPokemonDataset();

});

  function initDamageCalcLayout() {
    const calcContainer = document.getElementById('damage-calc-view');
    if (!calcContainer) return;

    calcContainer.style.cssText = 'max-width: 1280px; margin: 20px auto; padding: 20px; font-family: system-ui, sans-serif; color: #f0f4fc;';

    calcContainer.innerHTML = `
      <header style="margin-bottom: 24px; text-align: center;">
        <h1 style="font-size: 2.2rem; font-weight: 800; color: #84cc16;">Calcolo Danni Pokémon</h1>
        <p style="color: #8e9bb0;">Statistiche (HP+75, Altre+20), EV (0-32) e ricerca avanzata.</p>
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
        <!-- BARRA DI RICERCA CON DROPDOWN AUTOCOMPLETE -->
        <div style="position: relative; margin-bottom: 16px;">
          <input type="text" id="calc-search" placeholder="Cerca per nome o numero (es. Annihilape, #0979)..." autocomplete="off" style="width: 100%; padding: 12px; background: #0b0e14; border: 1px solid #26334d; border-radius: 8px; color: #fff;">
          <div id="calc-suggestions" style="position: absolute; top: 100%; left: 0; right: 0; background: #182030; border: 1px solid #26334d; border-top: none; border-radius: 0 0 8px 8px; max-height: 220px; overflow-y: auto; z-index: 1000; display: none;"></div>
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
      <button class="type-btn" data-type="${t.id}" style="background: #0b0e14; border: 1px solid #26334d; color: #fff; padding: 6px 12px; border-radius: 6px; font-size: 0.75rem; cursor: pointer;">
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
          btn.style.color = '#fff';
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
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        applyFilters();
        showAutocompleteSuggestions(e.target.value);
      });

      document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target)) {
          hideSuggestions();
        }
      });
    }

    const loadMore = document.getElementById('btn-load-more');
    if (loadMore) {
      loadMore.addEventListener('click', () => {
        currentLimit += 48;
        renderGrid();
      });
    }
  }

  function showAutocompleteSuggestions(val) {
    const suggestionsBox = document.getElementById('calc-suggestions');
    if (!suggestionsBox) return;

    const query = val.toLowerCase().trim();
    if (!query) {
      suggestionsBox.style.display = 'none';
      return;
    }

    const matches = localPokemonList.filter(p => 
      p.name.toLowerCase().includes(query) || String(p.id).includes(query)
    ).slice(0, 8);

    if (matches.length === 0) {
      suggestionsBox.style.display = 'none';
      return;
    }

    suggestionsBox.innerHTML = matches.map(p => `
      <div class="suggestion-item" onclick="window.calcSelectFromSuggestion(${p.id}, '${p.name.replace(/'/g, "\\'")}')" style="padding: 10px 14px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #26334d; cursor: pointer; color: #fff;">
        <img src="${p.image}" style="width: 32px; height: 32px; object-fit: contain;" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png'">
        <span style="font-weight: 600; font-size: 0.9rem;">${p.name}</span>
        <span style="font-size: 0.75rem; color: #8e9bb0; margin-left: auto;">#${String(p.id).padStart(4, '0')}</span>
      </div>
    `).join('');

    suggestionsBox.style.display = 'block';
  }

  function hideSuggestions() {
    const suggestionsBox = document.getElementById('calc-suggestions');
    if (suggestionsBox) suggestionsBox.style.display = 'none';
  }

  window.calcSelectFromSuggestion = function(id, name) {
    const searchInput = document.getElementById('calc-search');
    if (searchInput) searchInput.value = name;
    hideSuggestions();
    window.calcAssignPokemon(id);
  };

  async function loadPokemonDataset() {
    if (window.allPokemonData && window.allPokemonData.length > 0) {
      localPokemonList = window.allPokemonData;
    } else if (window.allPokemon && window.allPokemon.length > 0) {
      localPokemonList = window.allPokemon;
    } else {
      try {
        const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1351');
        const data = await res.json();
        localPokemonList = data.results.map((p) => {
          const parts = p.url.split('/').filter(Boolean);
          const id = parseInt(parts[parts.length - 1], 10);
          return {
            id: id,
            name: p.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`,
            types: []
          };
        });
      } catch (err) {
        console.error('Errore caricamento dataset:', err);
      }
    }

    filteredPokemon = [...localPokemonList];
    renderGrid();

    fetchTypesForDataset();

    assignPokemonSlot(979, 'A');
    assignPokemonSlot(7, 'B');
  }

  async function fetchTypesForDataset() {
    try {
      const res = await fetch('https://pokeapi.co/api/v2/type');
      const data = await res.json();

      for (const t of data.results) {
        const tRes = await fetch(t.url);
        const tData = await tRes.json();
        const typeName = tData.name;

        tData.pokemon.forEach(pObj => {
          const parts = pObj.pokemon.url.split('/').filter(Boolean);
          const pId = parseInt(parts[parts.length - 1], 10);
          const found = localPokemonList.find(p => p.id === pId);
          if (found) {
            if (!found.types) found.types = [];
            if (!found.types.includes(typeName)) found.types.push(typeName);
          }
        });
      }
      applyFilters();
    } catch (e) {
      console.error('Errore durante la sincronizzazione dei tipi:', e);
    }
  }

  function applyFilters() {
    const searchVal = document.getElementById('calc-search')?.value.toLowerCase().trim() || '';

    filteredPokemon = localPokemonList.filter(p => {
      const matchName = p.name.toLowerCase().includes(searchVal) || String(p.id).includes(searchVal);
      if (selectedTypes.length === 0) return matchName;

      const pTypes = p.types || [];
      const matchType = selectedTypes.every(t => pTypes.includes(t));
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

      const item = localPokemonList.find(p => p.id === id);
      if (item) item.types = extractedTypes;

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

  function getFormattedMoveName(slug) {
    if (MOVE_TRANSLATIONS[slug]) return MOVE_TRANSLATIONS[slug];
    return slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  

  

  async function renderPokemonA() {
    const container = document.getElementById('content-a');
    if (!container || !pokemonA) return;

    // Estrazione completa delle mosse (Livello, MT, Uovo) tramite Proxy Wiki
    const movesDetailed = getPokemonMoves(pokemonA.name);

console.log("Nome Pokémon:", pokemonA.name);
console.log("Database contiene:", movesDatabase[pokemonA.name.toLowerCase()]);
console.log("Mosse:", movesDetailed);

    // Raggruppamento mosse per tipo
    const groupedMoves = {};
    movesDetailed.forEach(m => {
      if (!groupedMoves[m.type]) groupedMoves[m.type] = [];
      groupedMoves[m.type].push(m);
    });

    let selectOptionsHtml = '';
    for (const [typeKey, movesGroup] of Object.entries(groupedMoves)) {
      const typeLabelITA = typeKey.toUpperCase();
      selectOptionsHtml += `<optgroup label="TIPO ${typeLabelITA}">`;
      movesGroup.forEach(m => {

    selectOptionsHtml += `
<option
value="${m.name}"
data-name="${m.name}"
data-type="${m.type}"
data-category="${m.category}"
data-power="${m.power}"
data-accuracy="${m.accuracy}"
data-pp="${m.pp}">
[${typeLabelITA}] ${m.name}
</option>`;

});
      selectOptionsHtml += `</optgroup>`;
    }

    if (movesDetailed.length === 0) {
      selectOptionsHtml = `<option value="">Nessuna mossa trovata su Pokémon Central Wiki</option>`;
    }

    const statsHtml = pokemonA.stats.map(s => {
      const statKey = s.stat.name;
      const baseVal = s.base_stat;
      const bonusEV = statsBonusA[statKey] || 0;
      const offset = (statKey === 'hp') ? 75 : 20;
      const totalVal = baseVal + offset + bonusEV;

      return `
        <div style="display: grid; grid-template-columns: 80px 50px 1fr 100px; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 0.8rem;">
          <span style="color: #8e9bb0;">${STAT_NAMES_ITA[statKey] || statKey}</span>
          <span style="font-weight: 700;">${totalVal}</span>
          <div style="background: #0b0e14; height: 6px; border-radius: 3px; overflow: hidden;">
            <div style="width: ${Math.min(100, (totalVal / 300) * 100)}%; height: 100%; background: #84cc16;"></div>
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            <label style="font-size: 0.7rem; color: #8e9bb0;">EV:</label>
            <input type="number" min="0" max="32" value="${bonusEV}" onchange="window.updateEV('A', '${statKey}', this.value)" style="width: 45px; background: #0b0e14; border: 1px solid #26334d; color: #fff; text-align: center; border-radius: 4px; padding: 2px;">
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

    <label style="font-size: 0.75rem; font-weight: 700; color: #8e9bb0; display: block; margin-bottom: 6px;">
        MOSSE DA POKÉMON CENTRAL WIKI (ITALIANO)
    </label>

    <input
        type="text"
        id="move-search"
        placeholder="🔍 Cerca una mossa..."
        style="
            width:100%;
            background:#101827;
            color:white;
            border:1px solid #26334d;
            padding:8px;
            border-radius:6px;
            font-size:0.85rem;
            margin-bottom:8px;
        ">
         <div id="move-search-results"
     style="
        display:none;
        max-height:220px;
        overflow-y:auto;
        margin-bottom:8px;
        background:#101827;
        border:1px solid #334155;
        border-radius:6px;
    ">
</div>
    <select
        id="select-move-a"
        onchange="window.updateMoveSelectionInfo(this)"
        style="width:100%; background:#121824; border:1px solid #26334d; color:#84cc16; padding:8px; border-radius:6px; font-size:0.85rem; font-weight:700; margin-bottom:8px;">

        ${selectOptionsHtml}

    </select>
        <div id="move-info-card"
     style="
        margin-top:10px;
        padding:10px;
        background:#101827;
        border:1px solid #2b3a55;
        border-radius:8px;
        color:#fff;
        font-size:0.85rem;
        line-height:1.7;
">

    <div><strong>Mossa:</strong> <span id="move-ita-name">-</span></div>

    <div><strong>Tipo:</strong> <span id="move-type">-</span></div>

    <div><strong>Categoria:</strong> <span id="move-category">-</span></div>

    <div><strong>Potenza:</strong> <span id="move-power-val">-</span></div>

    <div><strong>Precisione:</strong> <span id="move-accuracy">-</span></div>

    <div><strong>PP:</strong> <span id="move-pp">-</span></div>

</div>
      </div>

      <div style="font-size: 0.75rem; font-weight: 700; color: #84cc16; margin-bottom: 8px;">STATISTICHE (BASE + OFFSET + EV 0-32)</div>
      <div>${statsHtml}</div>
    `;

    const selectEl = document.getElementById('select-move-a');
    if (selectEl) {
    window.updateMoveSelectionInfo(selectEl);
    window.initMoveSearch(movesDetailed);
}
  }

  function renderPokemonB() {
    const container = document.getElementById('content-b');
    if (!container || !pokemonB) return;

    const statsHtml = pokemonB.stats.map(s => {
      const statKey = s.stat.name;
      const baseVal = s.base_stat;
      const bonusEV = statsBonusB[statKey] || 0;
      const offset = (statKey === 'hp') ? 75 : 20;
      const totalVal = baseVal + offset + bonusEV;

      return `
        <div style="display: grid; grid-template-columns: 80px 50px 1fr 100px; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 0.8rem;">
          <span style="color: #8e9bb0;">${STAT_NAMES_ITA[statKey] || statKey}</span>
          <span style="font-weight: 700;">${totalVal}</span>
          <div style="background: #0b0e14; height: 6px; border-radius: 3px; overflow: hidden;">
            <div style="width: ${Math.min(100, (totalVal / 300) * 100)}%; height: 100%; background: #4f46e5;"></div>
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            <label style="font-size: 0.7rem; color: #8e9bb0;">EV:</label>
            <input type="number" min="0" max="32" value="${bonusEV}" onchange="window.updateEV('B', '${statKey}', this.value)" style="width: 45px; background: #0b0e14; border: 1px solid #26334d; color: #fff; text-align: center; border-radius: 4px; padding: 2px;">
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

      <div style="font-size: 0.75rem; font-weight: 700; color: #4f46e5; margin-bottom: 8px;">STATISTICHE (BASE + OFFSET + EV 0-32)</div>
      <div>${statsHtml}</div>
    `;
  }

  window.updateEV = function(slot, statKey, value) {
    let numVal = parseInt(value, 10);
    if (isNaN(numVal) || numVal < 0) numVal = 0;
    if (numVal > 32) numVal = 32;

    if (slot === 'A') {
      statsBonusA[statKey] = numVal;
      renderPokemonA();
    } else {
      statsBonusB[statKey] = numVal;
      renderPokemonB();
    }
  };

 window.updateMoveSelectionInfo = function (selectElement) {

    if (!selectElement || !selectElement.options.length)
        return;

    const opt = selectElement.options[selectElement.selectedIndex];
    console.log(opt.dataset);
   console.log("DATASET MOSSA:", opt.dataset);
console.log("POWER:", opt.dataset.power);
console.log("CATEGORY:", opt.dataset.category);
console.log("TYPE:", opt.dataset.type);
console.log("ACCURACY:", opt.dataset.accuracy);
console.log("PP:", opt.dataset.pp);
    if (!opt)
        return;

    const moveNameEl = document.getElementById("move-ita-name");
    const moveTypeEl = document.getElementById("move-type");
    const moveCategoryEl = document.getElementById("move-category");
    const movePowerEl = document.getElementById("move-power-val");
    const moveAccuracyEl = document.getElementById("move-accuracy");
    const movePPEl = document.getElementById("move-pp");

    if (moveNameEl)
        moveNameEl.textContent = opt.dataset.name || "-";

    if (moveTypeEl)
        moveTypeEl.textContent = opt.dataset.type || "-";

    if (moveCategoryEl)
        moveCategoryEl.textContent = opt.dataset.category || "-";

    if (movePowerEl) {

    const rawPower = opt.dataset.power || "";

    const match = rawPower.match(/\d+/);

    movePowerEl.textContent = match ? match[0] : rawPower || "-";

}

    if (moveAccuracyEl)
        moveAccuracyEl.textContent = opt.dataset.accuracy || "-";

    if (movePPEl)
        movePPEl.textContent = opt.dataset.pp || "-";
};

  window.initMoveSearch = function (movesDetailed) {

    const input = document.getElementById("move-search");
    const results = document.getElementById("move-search-results");
    const select = document.getElementById("select-move-a");

    if (!input || !results || !select)
        return;

    input.oninput = function () {

        const text = this.value.trim().toLowerCase();

        results.innerHTML = "";

        if (!text) {
            results.style.display = "none";
            return;
        }

        const found = movesDetailed.filter(m =>
            m.name.toLowerCase().includes(text)
        );

        if (!found.length) {
            results.style.display = "none";
            return;
        }

        results.style.display = "block";

        found.forEach(move => {

            const item = document.createElement("div");

            item.textContent = `[${move.type}] ${move.name}`;

            item.style.padding = "8px";
            item.style.cursor = "pointer";
            item.style.borderBottom = "1px solid #26334d";
            item.style.color = "#84cc16";

            item.onmouseenter = () =>
                item.style.background = "#1e293b";

            item.onmouseleave = () =>
                item.style.background = "";

            item.onclick = () => {

                for (let i = 0; i < select.options.length; i++) {

                    if (select.options[i].dataset.name === move.name) {

                        select.selectedIndex = i;

                        window.updateMoveSelectionInfo(select);

                        break;
                    }
                }

                input.value = "";

                results.style.display = "none";
            };

            results.appendChild(item);

        });

    };

};

})();
