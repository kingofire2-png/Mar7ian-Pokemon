/**
 * Calcolo_Danni.js - Pagina Standalone Calcolo Danni
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

  let allPokemon = [];
  let filteredPokemon = [];
  let selectedTypes = [];
  let currentLimit = 48;

  let pokemonA = null;
  let pokemonB = null;
  let targetSelection = 'A';

  // Valori passini da 1 a 32 per ogni statistica (default: 1)
  let statsBonusA = { 'hp': 1, 'attack': 1, 'defense': 1, 'special-attack': 1, 'special-defense': 1, 'speed': 1 };
  let statsBonusB = { 'hp': 1, 'attack': 1, 'defense': 1, 'special-attack': 1, 'special-defense': 1, 'speed': 1 };

  let selectedMove = { name: 'Scegli Mossa', type: 'normal', power: 0 };

  document.addEventListener('DOMContentLoaded', () => {
    initPageLayout();
    fetch1351Pokemon();
  });

  // Render della Nuova Pagina
  function initPageLayout() {
    document.body.innerHTML = `
      <div style="max-width: 1200px; margin: 0 auto; padding: 20px; font-family: system-ui, -apple-system, sans-serif; color: var(--text-main, #f0f4fc);">
        <header style="margin-bottom: 24px; text-align: center;">
          <h1 style="font-size: 2.2rem; font-weight: 800; color: #84cc16;">Calcolo Danni Pokémon</h1>
          <p style="color: #8e9bb0;">Seleziona i Pokémon, regola i passini da 1 a 32 e analizza le mosse ufficiali in italiano.</p>
        </header>

        <!-- Selezione Target Attaccante / Difensore -->
        <div style="display: flex; justify-content: center; gap: 16px; margin-bottom: 24px;">
          <button id="btn-target-a" style="padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; border: 2px solid #84cc16; background: #84cc16; color: #000;">
            Destinazione: Pokémon A (Attaccante)
          </button>
          <button id="btn-target-b" style="padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; border: 2px solid #26334d; background: #182030; color: #fff;">
            Destinazione: Pokémon B (Difensore)
          </button>
        </div>

        <!-- Box Pokémon A e B -->
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

        <!-- Filtri e Lista Pokémon -->
        <div style="background: #121824; border: 1px solid #26334d; border-radius: 12px; padding: 20px;">
          <div style="margin-bottom: 16px;">
            <input type="text" id="calc-search" placeholder="Cerca tra tutti i 1351 Pokémon per nome o ID..." style="width: 100%; padding: 12px; background: #0b0e14; border: 1px solid #26334d; border-radius: 8px; color: #fff;">
          </div>
          <div id="type-filters" style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px;"></div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px; color: #8e9bb0; font-size: 0.85rem;">
            <span id="pokemon-count">0 POKÉMON TROVATI</span>
          </div>
          <div id="pokemon-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px;"></div>
          <button id="btn-load-more" style="width: 100%; padding: 12px; margin-top: 16px; background: #182030; border: 1px solid #26334d; color: #fff; border-radius: 8px; cursor: pointer; display: none;">Carica altri</button>
        </div>
      </div>
    `;

    renderTypeFilters();
    setupTargetControls();
  }

  function renderTypeFilters() {
    const container = document.getElementById('type-filters');
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
        } else if (selectedTypes.length < 2) {
          selectedTypes.push(type);
          btn.style.backgroundColor = '#84cc16';
        }
        applyFilters();
      });
    });
  }

  function setupTargetControls() {
    const btnA = document.getElementById('btn-target-a');
    const btnB = document.getElementById('btn-target-b');

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

    document.getElementById('calc-search').addEventListener('input', applyFilters);
    document.getElementById('btn-load-more').addEventListener('click', () => {
      currentLimit += 48;
      renderGrid();
    });
  }

  // Caricamento completo dei 1351 Pokémon da PokéAPI
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
          types: []
        };
      });

      filteredPokemon = [...allPokemon];
      renderGrid();

      // Assegna Charmander (4) e Squirtle (7) di default
      assignPokemonSlot(4, 'A');
      assignPokemonSlot(7, 'B');
    } catch (err) {
      console.error('Errore nel caricamento dei 1351 Pokémon:', err);
    }
  }

  function applyFilters() {
    const query = document.getElementById('calc-search').value.toLowerCase().trim();
    filteredPokemon = allPokemon.filter(p => {
      const matchName = p.name.toLowerCase().includes(query) || String(p.id).includes(query);
      const matchType = selectedTypes.length === 0 || selectedTypes.every(t => p.types.includes(t));
      return matchName && matchType;
    });
    currentLimit = 48;
    renderGrid();
  }

  function renderGrid() {
    const container = document.getElementById('pokemon-grid');
    const countEl = document.getElementById('pokemon-count');
    const loadMoreBtn = document.getElementById('btn-load-more');

    countEl.textContent = `${filteredPokemon.length} POKÉMON TROVATI`;
    const visible = filteredPokemon.slice(0, currentLimit);

    container.innerHTML = visible.map(p => `
      <button onclick="window.calcAssignPokemon(${p.id})" style="background: #121824; border: 1px solid #26334d; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; align-items: center; cursor: pointer; color: #fff;">
        <span style="font-size: 0.7rem; color: #8e9bb0; align-self: flex-start;">#${String(p.id).padStart(4, '0')}</span>
        <img src="${p.image}" alt="${p.name}" style="width: 60px; height: 60px; object-fit: contain;" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png'">
        <span style="font-size: 0.8rem; font-weight: 600; margin-top: 4px; text-align: center;">${p.name}</span>
      </button>
    `).join('');

    loadMoreBtn.style.display = currentLimit < filteredPokemon.length ? 'block' : 'none';
  }

  window.calcAssignPokemon = (id) => assignPokemonSlot(id, targetSelection);

   /* Calcolo_Danni.js - Parte 2 */

  async function assignPokemonSlot(id, slot) {
    try {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
      const data = await res.json();

      const pokemonObj = {
        id: data.id,
        name: data.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        image: data.sprites.other['official-artwork'].front_default || data.sprites.front_default,
        types: data.types.map(t => t.type.name),
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
    } catch (e) {
      console.error('Errore nell\'assegnare il Pokémon:', e);
    }
  }

  // Render Pokémon A (Attaccante con Mosse in Italiano e Potenza Ufficiale)
  async function renderPokemonA() {
    const container = document.getElementById('content-a');
    if (!container || !pokemonA) return;

    // Recupera la prima mossa e scarica la traduzione in italiano e la potenza reale
    const movesListHtml = pokemonA.moves.map(m => {
      return `<option value="${m.move.url}">${m.move.name}</option>`;
    }).join('');

    const statsHtml = pokemonA.stats.map(s => {
      const statKey = s.stat.name;
      const baseVal = s.base_stat;
      const bonus = statsBonusA[statKey] || 1;
      const totalVal = baseVal + bonus;

      return `
        <div style="display: grid; grid-template-columns: 80px 50px 1fr 100px; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 0.8rem;">
          <span style="color: #8e9bb0;">${STAT_NAMES_ITA[statKey] || statKey}</span>
          <span style="font-weight: 700;">${totalVal}</span>
          <div style="background: #0b0e14; height: 6px; border-radius: 3px; overflow: hidden;">
            <div style="width: ${Math.min(100, (totalVal / 250) * 100)}%; height: 100%; background: #84cc16;"></div>
          </div>
          <!-- Input Passino da 1 a 32 -->
          <div style="display: flex; align-items: center; gap: 4px;">
            <label style="font-size: 0.7rem; color: #8e9bb0;">Passino:</label>
            <input type="number" min="1" max="32" value="${bonus}" onchange="window.updatePassino('A', '${statKey}', this.value)" style="width: 45px; background: #0b0e14; border: 1px solid #26334d; color: #fff; text-align: center; border-radius: 4px; padding: 2px;">
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

      <!-- Sezione Mossa con Traduzione Italiana e Potenza Ufficiale -->
      <div style="background: #0b0e14; padding: 12px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #26334d;">
        <label style="font-size: 0.75rem; font-weight: 700; color: #8e9bb0; display: block; margin-bottom: 6px;">MOSSA ATTACCO (ITALIANO)</label>
        <select id="select-move-a" onchange="window.loadItalianMoveDetails(this.value)" style="width: 100%; background: #121824; border: 1px solid #26334d; color: #fff; padding: 8px; border-radius: 6px; font-size: 0.85rem; margin-bottom: 8px;">
          ${movesListHtml}
        </select>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem;">
          <span id="move-ita-name" style="font-weight: 700; color: #84cc16;">Nome Ita: -</span>
          <span id="move-power-val" style="font-weight: 700; color: #fff;">Potenza Reale: -</span>
        </div>
      </div>

      <div style="font-size: 0.75rem; font-weight: 700; color: #84cc16; margin-bottom: 8px;">STATISTICHE (BASE + PASSINO 1-32)</div>
      <div>${statsHtml}</div>
    `;

    if (pokemonA.moves.length > 0) {
      loadItalianMoveDetails(pokemonA.moves[0].move.url);
    }
  }

  // Render Pokémon B (Difensore)
  function renderPokemonB() {
    const container = document.getElementById('content-b');
    if (!container || !pokemonB) return;

    const statsHtml = pokemonB.stats.map(s => {
      const statKey = s.stat.name;
      const baseVal = s.base_stat;
      const bonus = statsBonusB[statKey] || 1;
      const totalVal = baseVal + bonus;

      return `
        <div style="display: grid; grid-template-columns: 80px 50px 1fr 100px; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 0.8rem;">
          <span style="color: #8e9bb0;">${STAT_NAMES_ITA[statKey] || statKey}</span>
          <span style="font-weight: 700;">${totalVal}</span>
          <div style="background: #0b0e14; height: 6px; border-radius: 3px; overflow: hidden;">
            <div style="width: ${Math.min(100, (totalVal / 250) * 100)}%; height: 100%; background: #4f46e5;"></div>
          </div>
          <!-- Input Passino da 1 a 32 -->
          <div style="display: flex; align-items: center; gap: 4px;">
            <label style="font-size: 0.7rem; color: #8e9bb0;">Passino:</label>
            <input type="number" min="1" max="32" value="${bonus}" onchange="window.updatePassino('B', '${statKey}', this.value)" style="width: 45px; background: #0b0e14; border: 1px solid #26334d; color: #fff; text-align: center; border-radius: 4px; padding: 2px;">
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

      <div style="font-size: 0.75rem; font-weight: 700; color: #4f46e5; margin-bottom: 8px;">STATISTICHE (BASE + PASSINO 1-32)</div>
      <div>${statsHtml}</div>
    `;
  }

  // Aggiornamento Passino (valore forzato tra 1 e 32)
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

  // Carica i dettagli della mossa traducendo il nome in Italiano ed estraendo la potenza ufficiale
  window.loadItalianMoveDetails = async function(moveUrl) {
    try {
      const res = await fetch(moveUrl);
      const data = await res.json();

      // Trova il nome in italiano nella lista "names"
      const itaEntry = data.names.find(n => n.language.name === 'it');
      const itaName = itaEntry ? itaEntry.name : data.name;
      const movePower = data.power !== null ? data.power : 0;

      const nameEl = document.getElementById('move-ita-name');
      const powerEl = document.getElementById('move-power-val');

      if (nameEl) nameEl.textContent = `Mossa: ${itaName}`;
      if (powerEl) powerEl.textContent = `Potenza Reale: ${movePower}`;
    } catch (e) {
      console.error('Errore nel recupero dettagli mossa:', e);
    }
  };

})();
