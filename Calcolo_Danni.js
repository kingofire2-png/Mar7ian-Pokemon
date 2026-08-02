/**
 * Calcolo_Danni.js - Parte 1
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
  let sortAscending = true;
  let currentLimit = 48;

  let pokemonA = null;
  let pokemonB = null;
  let targetSelection = 'A';

  let statsBonusA = { 'hp': 0, 'attack': 0, 'defense': 0, 'special-attack': 0, 'special-defense': 0, 'speed': 0 };
  let statsBonusB = { 'hp': 0, 'attack': 0, 'defense': 0, 'special-attack': 0, 'special-defense': 0, 'speed': 0 };

  let selectedMove = { name: 'Azione', type: 'normal', power: 40 };

  document.addEventListener('DOMContentLoaded', () => {
    initDamageCalcUI();
    fetchPokemonData();
  });

  function initDamageCalcUI() {
    const mainContainer = document.querySelector('main') || document.body;

    const calcSection = document.createElement('section');
    calcSection.id = 'damage-calc-section';
    calcSection.style.cssText = 'margin-top: 40px; padding: 24px; background: var(--panel-bg, #121824); border: 1px solid var(--border-color, #26334d); border-radius: 12px;';

    calcSection.innerHTML = `
      <h2 style="font-size: 1.8rem; font-weight: 800; color: var(--text-main, #f0f4fc); margin-bottom: 6px;">Calcolo Danni</h2>
      <p style="color: var(--text-muted, #8e9bb0); font-size: 0.9rem; margin-bottom: 20px;">Seleziona i Pokémon, configura le mosse ed eroga i passini (+32 PS/Stats).</p>

      <div class="calc-search-group" style="margin-bottom: 20px;">
        <label style="font-size: 0.85rem; font-weight: 600; display: block; margin-bottom: 8px;">Cerca per nome o numero</label>
        <div style="position: relative;">
          <input type="text" id="calc-search-input" placeholder="Es. Charizard, Lucario o #0006" style="width: 100%; background: var(--bg-dark, #0b0e14); border: 1px solid var(--border-color, #26334d); border-radius: 8px; padding: 10px 16px; color: #fff;">
          <div id="calc-suggestions" style="position: absolute; top: 100%; left: 0; right: 0; background: var(--card-bg, #182030); border: 1px solid var(--border-color, #26334d); border-radius: 8px; z-index: 999; display: none; max-height: 200px; overflow-y: auto;"></div>
        </div>
      </div>

      <div style="margin-bottom: 24px; padding-top: 16px; border-top: 1px solid var(--border-color, #26334d);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 0.85rem; font-weight: 600;">Filtra per tipo (Max 2)</span>
          <button id="calc-btn-reset-types" style="background: transparent; border: none; color: var(--text-muted, #8e9bb0); font-size: 0.75rem; cursor: pointer;">RESET</button>
        </div>
        <div id="calc-type-grid" style="display: flex; flex-wrap: wrap; gap: 6px;"></div>
      </div>

      <div style="display: flex; justify-content: center; gap: 16px; margin-bottom: 20px;">
        <button id="btn-select-target-a" style="padding: 8px 16px; border-radius: 6px; font-weight: 700; cursor: pointer; border: 2px solid var(--lime, #84cc16); background: var(--lime, #84cc16); color: #000;">
          Target: Pokémon A (Attaccante)
        </button>
        <button id="btn-select-target-b" style="padding: 8px 16px; border-radius: 6px; font-weight: 700; cursor: pointer; border: 2px solid var(--border-color, #26334d); background: var(--card-bg, #182030); color: #fff;">
          Target: Pokémon B (Difensore)
        </button>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 32px;">
        <div id="box-pokemon-a" style="background: var(--card-bg, #182030); border: 2px solid var(--lime, #84cc16); border-radius: 12px; padding: 20px;">
          <div style="text-align: center; font-weight: 800; color: var(--lime, #84cc16); margin-bottom: 12px;">POKÉMON A (ATTACCANTE)</div>
          <div id="content-pokemon-a"><p style="text-align: center; color: var(--text-muted, #8e9bb0);">Seleziona dalla lista</p></div>
        </div>
        <div id="box-pokemon-b" style="background: var(--card-bg, #182030); border: 2px solid var(--border-color, #26334d); border-radius: 12px; padding: 20px;">
          <div style="text-align: center; font-weight: 800; color: var(--accent, #4f46e5); margin-bottom: 12px;">POKÉMON B (DIFENSORE)</div>
          <div id="content-pokemon-b"><p style="text-align: center; color: var(--text-muted, #8e9bb0);">Seleziona dalla lista</p></div>
        </div>
      </div>

      <div style="border-top: 1px solid var(--border-color, #26334d); padding-top: 24px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 16px;">
          <span id="calc-pokemon-count" style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted, #8e9bb0);">0 POKÉMON</span>
          <button id="calc-btn-sort" style="background: transparent; border: none; color: #fff; font-size: 0.8rem; cursor: pointer;">Ordina: <span>Numero ↓</span></button>
        </div>
        <div id="calc-pokemon-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px;"></div>
      </div>
    `;

    mainContainer.appendChild(calcSection);
    renderTypeButtons();
    setupEventListeners();
  }

  function renderTypeButtons() {
    const container = document.getElementById('calc-type-grid');
    if (!container) return;
    container.innerHTML = TYPES_CONFIG.map(t => `
      <button class="calc-type-button" data-type="${t.id}" style="background: var(--bg-dark, #0b0e14); border: 1px solid var(--border-color, #26334d); color: #fff; padding: 6px 12px; border-radius: 6px; font-size: 0.75rem; cursor: pointer;">
        ${t.name}
      </button>
    `).join('');

    container.querySelectorAll('.calc-type-button').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type');
        if (selectedTypes.includes(type)) {
          selectedTypes = selectedTypes.filter(t => t !== type);
          btn.style.backgroundColor = '';
        } else if (selectedTypes.length < 2) {
          selectedTypes.push(type);
          btn.style.backgroundColor = `var(--type-${type}, #84cc16)`;
        }
        applyFilters();
      });
    });
  }

  async function fetchPokemonData() {
    try {
      const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=151');
      const data = await res.json();
      allPokemon = data.results.map((p, idx) => ({
        id: idx + 1,
        rawName: p.name,
        name: p.name.charAt(0).toUpperCase() + p.name.slice(1),
        image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${idx + 1}.png`,
        types: []
      }));
      filteredPokemon = [...allPokemon];
      renderList();
      assignPokemonToSlot(4, 'A');
      assignPokemonToSlot(7, 'B');
    } catch (e) { console.error(e); }
  }
  /* Calcolo_Danni.js - Parte 2 */

  function setupEventListeners() {
    const input = document.getElementById('calc-search-input');
    const sortBtn = document.getElementById('calc-btn-sort');
    const resetBtn = document.getElementById('calc-btn-reset-types');
    const targetA = document.getElementById('btn-select-target-a');
    const targetB = document.getElementById('btn-select-target-b');

    if (input) input.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      filteredPokemon = allPokemon.filter(p => p.name.toLowerCase().includes(q) || String(p.id).includes(q));
      renderList();
    });

    if (sortBtn) sortBtn.addEventListener('click', () => {
      sortAscending = !sortAscending;
      filteredPokemon.sort((a, b) => sortAscending ? a.id - b.id : b.id - a.id);
      renderList();
    });

    if (resetBtn) resetBtn.addEventListener('click', () => {
      selectedTypes = [];
      document.querySelectorAll('.calc-type-button').forEach(b => b.style.backgroundColor = '');
      applyFilters();
    });

    if (targetA && targetB) {
      targetA.addEventListener('click', () => {
        targetSelection = 'A';
        targetA.style.background = 'var(--lime, #84cc16)'; targetA.style.color = '#000';
        targetB.style.background = 'var(--card-bg, #182030)'; targetB.style.color = '#fff';
      });
      targetB.addEventListener('click', () => {
        targetSelection = 'B';
        targetB.style.background = 'var(--accent, #4f46e5)'; targetB.style.color = '#fff';
        targetA.style.background = 'var(--card-bg, #182030)'; targetA.style.color = '#fff';
      });
    }
  }

  function applyFilters() {
    filteredPokemon = allPokemon.filter(p => selectedTypes.length === 0 || selectedTypes.every(t => p.types.includes(t)));
    renderList();
  }

  function renderList() {
    const container = document.getElementById('calc-pokemon-list');
    const countEl = document.getElementById('calc-pokemon-count');
    if (!container) return;
    if (countEl) countEl.textContent = `${filteredPokemon.length} POKÉMON`;

    container.innerHTML = filteredPokemon.slice(0, currentLimit).map(p => `
      <button onclick="window.calcAssignToCurrentTarget(${p.id})" style="background: var(--panel-bg, #121824); border: 1px solid var(--border-color, #26334d); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; align-items: center; cursor: pointer; color: #fff;">
        <span style="font-size: 0.7rem; color: var(--text-muted); align-self: flex-start;">#${String(p.id).padStart(4, '0')}</span>
        <img src="${p.image}" style="width: 60px; height: 60px; object-fit: contain;">
        <span style="font-size: 0.8rem; font-weight: 600;">${p.name}</span>
      </button>
    `).join('');
  }

  window.calcAssignToCurrentTarget = (id) => assignPokemonToSlot(id, targetSelection);

  async function assignPokemonToSlot(id, slot) {
    try {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
      const data = await res.json();
      const pObj = {
        id: data.id,
        name: data.name.charAt(0).toUpperCase() + data.name.slice(1),
        image: data.sprites.other['official-artwork'].front_default || data.sprites.front_default,
        types: data.types.map(t => t.type.name),
        stats: data.stats,
        moves: data.moves
      };

      if (slot === 'A') { pokemonA = pObj; renderPokemonA(); }
      else { pokemonB = pObj; renderPokemonB(); }
    } catch (e) { console.error(e); }
  }

  function renderPokemonA() {
    const container = document.getElementById('content-pokemon-a');
    if (!container || !pokemonA) return;

    const movesOptionsHtml = pokemonA.moves.slice(0, 30).map(m => `<option value="${m.move.url}">${m.move.name}</option>`).join('');
    const statsHtml = pokemonA.stats.map(s => {
      const key = s.stat.name;
      const total = s.base_stat + (statsBonusA[key] || 0);
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; font-size: 0.75rem;">
          <span>${STAT_NAMES_ITA[key] || key}: <strong>${total}</strong></span>
          <div>
            <button onclick="window.updateStatBonus('A', '${key}', -32)" style="background:#0b0e14; border:1px solid #26334d; color:#fff; border-radius:4px;">-32</button>
            <button onclick="window.updateStatBonus('A', '${key}', 32)" style="background:#0b0e14; border:1px solid #26334d; color:#fff; border-radius:4px;">+32</button>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
        <img src="${pokemonA.image}" style="width:70px; height:70px;">
        <h3 style="font-size:1.1rem; color:#fff;">${pokemonA.name}</h3>
      </div>
      <div style="background:#0b0e14; padding:8px; border-radius:6px; margin-bottom:12px;">
        <label style="font-size:0.75rem; color:#8e9bb0;">MOSSA</label>
        <select onchange="window.handleMoveChange(this.value)" style="width:100%; background:#121824; color:#fff; border:1px solid #26334d; padding:4px; border-radius:4px;">
          ${movesOptionsHtml}
        </select>
        <div style="display:flex; justify-content:space-between; margin-top:6px; font-size:0.8rem;">
          <span>Potenza:</span>
          <input type="number" value="${selectedMove.power}" onchange="window.updateMovePower(this.value)" style="width:50px; text-align:center; background:#121824; color:#fff; border:1px solid #26334d;">
        </div>
      </div>
      <div>${statsHtml}</div>
    `;
  }

  function renderPokemonB() {
    const container = document.getElementById('content-pokemon-b');
    if (!container || !pokemonB) return;

    const statsHtml = pokemonB.stats.map(s => {
      const key = s.stat.name;
      const total = s.base_stat + (statsBonusB[key] || 0);
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; font-size: 0.75rem;">
          <span>${STAT_NAMES_ITA[key] || key}: <strong>${total}</strong></span>
          <div>
            <button onclick="window.updateStatBonus('B', '${key}', -32)" style="background:#0b0e14; border:1px solid #26334d; color:#fff; border-radius:4px;">-32</button>
            <button onclick="window.updateStatBonus('B', '${key}', 32)" style="background:#0b0e14; border:1px solid #26334d; color:#fff; border-radius:4px;">+32</button>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
        <img src="${pokemonB.image}" style="width:70px; height:70px;">
        <h3 style="font-size:1.1rem; color:#fff;">${pokemonB.name}</h3>
      </div>
      <div>${statsHtml}</div>
    `;
  }

  window.updateStatBonus = (slot, key, amount) => {
    if (slot === 'A') {
      statsBonusA[key] = Math.max(0, (statsBonusA[key] || 0) + amount);
      renderPokemonA();
    } else {
      statsBonusB[key] = Math.max(0, (statsBonusB[key] || 0) + amount);
      renderPokemonB();
    }
  };

  window.handleMoveChange = async (moveUrl) => {
    try {
      const res = await fetch(moveUrl);
      const data = await res.json();
      selectedMove.power = data.power || 40;
      renderPokemonA();
    } catch(e) {}
  };

  window.updateMovePower = (val) => { selectedMove.power = parseInt(val, 10) || 0; };

})();
