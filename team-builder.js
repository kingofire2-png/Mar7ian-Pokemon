/**
 * team-builder.js
 * UI della sezione "Squadra VGC" (Lotte in Doppio, Pokémon Champions).
 * Usa window.TeamBuilderEngine per l'analisi. Riusa pokemon-moves.json per le mosse,
 * PokeAPI per specie/abilità/oggetti (nomi italiani ufficiali via PokeAPI).
 */

(function () {
  'use strict';

  const ENGINE = () => window.TeamBuilderEngine;

  const ITEM_SLUGS = [
    'focus-sash', 'leftovers', 'life-orb', 'assault-vest', 'choice-band', 'choice-specs', 'choice-scarf',
    'rocky-helmet', 'sitrus-berry', 'mental-herb', 'electric-seed', 'grassy-seed', 'psychic-seed', 'misty-seed',
    'booster-energy', 'clear-amulet', 'covert-cloak', 'loaded-dice', 'weakness-policy', 'safety-goggles',
    'eject-button', 'red-card', 'room-service', 'protective-pads', 'wide-lens', 'expert-belt', 'air-balloon',
    'black-sludge', 'flame-orb', 'toxic-orb', 'lum-berry', 'heavy-duty-boots', 'terrain-extender', 'light-clay',
    'damp-rock', 'heat-rock', 'icy-rock', 'smooth-rock', 'metronome', 'throat-spray', 'eject-pack',
    'mirror-herb', 'ability-shield', 'punching-glove'
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

  const STORAGE_KEY = 'pokemonVGCTeams';

  let teams = [];
  let activeTeamId = null;
  let editingSlotIndex = null;
  let pickerTargetSlotIndex = null;
  let dexList = [];
  let itemNameCache = {};
  let selectedPickerTypes = [];
  let saveDebounceTimer = null;

  // ===============================
  // Persistenza
  // ===============================
  function loadTeamsFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function persistTeams() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ teams, activeTeamId }));
    } catch (e) {
      console.error('Errore salvataggio squadre VGC:', e);
    }
  }

  function scheduleSave() {
    clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(persistTeams, 400);
  }

  function createEmptyTeam(name) {
    return {
      id: 'team-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      name: name || 'Squadra 1',
      updatedAt: Date.now(),
      slots: [null, null, null, null, null, null]
    };
  }

  function getActiveTeam() {
    return teams.find(t => t.id === activeTeamId);
  }

  // ===============================
  // Caricamento dati (mosse + dex con tipi, condivisi tra le sezioni: vedi shared-data.js)
  // ===============================
  function getPokemonMoves(name) {
    return window.SharedData.getPokemonMoves(name);
  }

  async function loadDexWithTypes() {
    try {
      dexList = await window.SharedData.dexReady;
      renderPickerGrid();
      renderAnalysis();

      window.addEventListener('pokedex-types-ready', () => {
        renderPickerGrid();
        renderAnalysis();
      });
    } catch (e) {
      console.error('Errore caricamento dex Squadra VGC:', e);
    }
  }

  async function loadItemNames() {
    await Promise.all(ITEM_SLUGS.map(async slug => {
      try {
        const res = await fetch(`https://pokeapi.co/api/v2/item/${slug}`);
        const data = await res.json();
        const it = data.names.find(n => n.language.name === 'it');
        itemNameCache[slug] = it ? it.name : (ITEM_NAME_FALLBACK_IT[slug] || slug);
      } catch (e) {
        itemNameCache[slug] = ITEM_NAME_FALLBACK_IT[slug] || slug;
      }
    }));
    if (editingSlotIndex !== null) renderSlotDetail();
  }

  // ===============================
  // Layout iniziale
  // ===============================
  function initTeamBuilderLayout() {
    const container = document.getElementById('team-builder-view');
    if (!container) return;

    container.innerHTML = `
      <div class="vgc-shell">
        <header class="vgc-header">
          <div>
            <p class="vgc-tagline">SQUADRA · LOTTE IN DOPPIO · POKÉMON CHAMPIONS</p>
            <h1 class="vgc-title">Costruttore Squadra VGC</h1>
            <p class="vgc-desc">Costruisci una squadra di 6 Pokémon per il doppio. L'analisi qui sotto si aggiorna in tempo reale: debolezze condivise, buchi di copertura offensiva, speed tier e sinergie tipiche del doppio.</p>
          </div>
          <div class="vgc-team-manager">
            <select id="vgc-team-select" onchange="window.vgcSwitchTeam(this.value)"></select>
            <input id="vgc-team-name-input" class="vgc-team-name-input" style="display:none;" placeholder="Nome squadra">
            <button class="vgc-btn" onclick="window.vgcNewTeam()">+ Nuova</button>
            <button class="vgc-btn" onclick="window.vgcRenameTeam()">Rinomina</button>
            <button class="vgc-btn vgc-btn-danger" onclick="window.vgcDeleteTeam()">Elimina</button>
          </div>
        </header>

        <div class="vgc-formation" id="vgc-formation"></div>

        <div class="vgc-analysis-panel" id="vgc-analysis-panel"></div>
      </div>

      <div class="vgc-overlay" id="vgc-picker-overlay" style="display:none;">
        <div class="vgc-picker-box">
          <button class="vgc-modal-close" onclick="window.vgcClosePicker()">✕</button>
          <div class="vgc-picker-header">
            <input id="vgc-picker-search" placeholder="🔍 Cerca Pokémon per nome o numero...">
          </div>
          <div id="vgc-picker-types" class="vgc-picker-types"></div>
          <div id="vgc-picker-grid" class="vgc-picker-grid"></div>
        </div>
      </div>

      <div class="vgc-overlay" id="vgc-slot-detail-overlay" style="display:none;">
        <div class="vgc-slot-detail-box" id="vgc-slot-detail-box"></div>
      </div>
    `;

    document.getElementById('vgc-picker-search').addEventListener('input', renderPickerGrid);
    document.getElementById('vgc-picker-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'vgc-picker-overlay') window.vgcClosePicker();
    });
    document.getElementById('vgc-slot-detail-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'vgc-slot-detail-overlay') window.vgcCloseSlotDetail();
    });

    const nameInput = document.getElementById('vgc-team-name-input');
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') window.vgcConfirmRename(nameInput.value);
      if (e.key === 'Escape') nameInput.style.display = 'none';
    });
    nameInput.addEventListener('blur', () => window.vgcConfirmRename(nameInput.value));
  }

  function injectTeamBuilderStyles() {
    if (document.getElementById('vgc-styles')) return;
    const style = document.createElement('style');
    style.id = 'vgc-styles';
    style.textContent = `
      #team-builder-view { color: var(--text-main, #f0f4fc); }
      .vgc-shell { max-width: 1280px; margin: 20px auto; padding: 24px; }
      .vgc-header { display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px; margin-bottom:28px; padding-bottom:20px; border-bottom:1px solid #26334d; }
      .vgc-tagline { font-size:0.75rem; letter-spacing:1.5px; color:#a78bfa; font-weight:700; margin-bottom:6px; }
      .vgc-title { font-family: var(--font-display, 'Rajdhani', sans-serif); font-size:2.2rem; font-weight:700; background:linear-gradient(90deg,#84cc16,#a78bfa); -webkit-background-clip:text; background-clip:text; color:transparent; margin-bottom:8px; }
      .vgc-desc { color:#8e9bb0; max-width:560px; font-size:0.9rem; line-height:1.5; }
      .vgc-team-manager { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
      .vgc-team-manager select { background:#182030; border:1px solid #26334d; color:#fff; padding:8px 12px; border-radius:8px; font-weight:700; }
      .vgc-btn { background:#182030; border:1px solid #26334d; color:#fff; padding:8px 14px; border-radius:8px; cursor:pointer; font-size:0.8rem; font-weight:700; transition: all .15s; }
      .vgc-btn:hover { border-color:#6366f1; transform:translateY(-1px); }
      .vgc-btn-danger:hover { border-color:#ef4444; color:#ef4444; }
      .vgc-team-name-input { background:#0b0e14; border:1px solid #6366f1; color:#fff; padding:8px 12px; border-radius:8px; }

      .vgc-formation { display:grid; grid-template-columns: repeat(3, 1fr); gap:16px; margin-bottom:32px; padding:24px; border-radius:20px; background:linear-gradient(135deg, rgba(35,32,58,0.9), rgba(24,32,48,0.9)); border:1px solid rgba(255,255,255,0.08); box-shadow: 0 8px 32px rgba(0,0,0,0.35); }
      .vgc-slot { min-height:190px; border-radius:14px; display:flex; flex-direction:column; align-items:center; justify-content:center; position:relative; }
      .vgc-slot-empty { background:#121824; border:2px dashed #334155; color:#8e9bb0; cursor:pointer; transition: all .2s; gap:8px; }
      .vgc-slot-empty:hover { border-color:#84cc16; color:#84cc16; background:#151d2c; }
      .vgc-slot-plus { font-size:2rem; font-weight:800; line-height:1; }
      .vgc-slot-empty-label { font-size:0.8rem; font-weight:600; }

      .vgc-slot-filled { background:rgba(24,32,48,0.85); border:1px solid rgba(99,102,241,0.5); padding:14px; box-shadow: 0 0 14px rgba(99,102,241,0.25); }
      .vgc-flip-in { animation: vgcFlipIn .5s cubic-bezier(.2,.8,.3,1.2); }
      @keyframes vgcFlipIn { 0% { transform: rotateY(90deg); opacity:0; } 100% { transform: rotateY(0deg); opacity:1; } }
      @media (prefers-reduced-motion: reduce) {
        .vgc-flip-in, .vgc-cascade { animation: none !important; }
      }

      .vgc-slot-remove { position:absolute; top:8px; right:8px; background:transparent; border:none; color:#8e9bb0; cursor:pointer; font-size:0.9rem; }
      .vgc-slot-remove:hover { color:#ef4444; }
      .vgc-slot-sprite { width:72px; height:72px; object-fit:contain; }
      .vgc-slot-name { font-weight:800; margin-top:4px; text-align:center; }
      .vgc-slot-types { display:flex; gap:4px; margin:6px 0; flex-wrap:wrap; justify-content:center; }
      .vgc-type-chip { background: var(--tc, #666); color:#fff; font-size:0.65rem; font-weight:700; padding:2px 7px; border-radius:5px; }
      .vgc-slot-meta { font-size:0.7rem; color:#8e9bb0; margin-bottom:8px; text-align:center; }
      .vgc-slot-edit-btn { background:#84cc16; color:#000; border:none; padding:6px 14px; border-radius:6px; font-weight:800; font-size:0.75rem; cursor:pointer; }

      .vgc-overlay { position:fixed; inset:0; background:rgba(5,8,15,0.85); display:flex; align-items:center; justify-content:center; z-index:10001; padding:20px; }
      .vgc-picker-box, .vgc-slot-detail-box { background:rgba(16,24,39,0.92); backdrop-filter: blur(10px) saturate(140%); -webkit-backdrop-filter: blur(10px) saturate(140%); border:1px solid rgba(99,102,241,0.4); box-shadow: 0 16px 48px rgba(0,0,0,0.5); border-radius:18px; padding:20px; width:100%; max-width:640px; max-height:85vh; overflow-y:auto; position:relative; animation: vgcModalPop .25s ease; }
      @keyframes vgcModalPop { 0% { transform:scale(.92); opacity:0; } 100% { transform:scale(1); opacity:1; } }
      .vgc-modal-close { position:absolute; top:14px; right:14px; background:#182030; border:1px solid #26334d; color:#fff; width:28px; height:28px; border-radius:50%; cursor:pointer; }
      .vgc-picker-header { display:flex; gap:10px; margin-bottom:12px; margin-right: 36px; }
      .vgc-picker-header input { flex:1; background:#0b0e14; border:1px solid #26334d; border-radius:8px; padding:10px; color:#fff; }
      .vgc-picker-types { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:14px; }
      .vgc-picker-type-btn { background:#0b0e14; border:1px solid #26334d; color:#fff; padding:5px 10px; border-radius:6px; font-size:0.7rem; cursor:pointer; }
      .vgc-picker-type-btn.active { background: var(--tc); border-color: var(--tc); color:#000; font-weight:800; }
      .vgc-picker-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(90px,1fr)); gap:10px; }
      .vgc-picker-card { background:rgba(24,32,48,0.85); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:8px; display:flex; flex-direction:column; align-items:center; cursor:pointer; color:#fff; transition: transform .15s, border-color .15s; }
      .vgc-picker-card:hover { transform:translateY(-2px); border-color:#84cc16; }
      .vgc-picker-card img { width:48px; height:48px; object-fit:contain; }
      .vgc-picker-card span { font-size:0.7rem; margin-top:4px; text-align:center; }

      .vgc-slot-detail-header { display:flex; align-items:center; gap:14px; margin-bottom:16px; margin-right: 30px; }
      .vgc-slot-detail-sprite { width:64px; height:64px; object-fit:contain; }
      .vgc-detail-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:18px; }
      .vgc-detail-grid label { display:flex; flex-direction:column; gap:6px; font-size:0.75rem; color:#8e9bb0; font-weight:700; }
      .vgc-detail-grid select { background:#0b0e14; border:1px solid #26334d; color:#fff; padding:8px; border-radius:8px; }
      .vgc-ev-header { font-size:0.8rem; font-weight:700; color:#84cc16; margin-bottom:10px; }
      .vgc-ev-warning { color:#f59e0b; }
      .vgc-stats-block { display:flex; flex-direction:column; gap:8px; margin-bottom:18px; }
      .vgc-stat-row { display:grid; grid-template-columns:60px 40px 1fr 55px; align-items:center; gap:8px; font-size:0.78rem; }
      .vgc-stat-label { color:#8e9bb0; }
      .vgc-stat-total { font-weight:800; }
      .vgc-stat-bar-bg { background:#0b0e14; height:6px; border-radius:3px; overflow:hidden; }
      .vgc-stat-bar-fill { height:100%; background:linear-gradient(90deg,#84cc16,#6366f1); transition: width .4s ease; }
      .vgc-ev-input { width:48px; background:#0b0e14; border:1px solid #26334d; color:#fff; text-align:center; border-radius:5px; padding:3px; }
      .vgc-moves-header { font-size:0.8rem; font-weight:700; color:#84cc16; margin-bottom:10px; }
      .vgc-moves-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:10px; }
      .vgc-move-select { background:#0b0e14; border:1px solid #26334d; color:#fff; padding:8px; border-radius:8px; font-size:0.78rem; width:100%; }

      .vgc-analysis-panel { display:flex; flex-direction:column; gap:20px; }
      .vgc-analysis-block { background:rgba(18,24,36,0.9); border:1px solid rgba(255,255,255,0.08); box-shadow: 0 8px 24px rgba(0,0,0,0.3); border-radius:16px; padding:18px 20px; }
      .vgc-analysis-block h3 { font-size:0.9rem; margin-bottom:12px; }
      .vgc-analysis-empty { color:#8e9bb0; font-size:0.82rem; }
      .vgc-heatmap { display:flex; flex-direction:column; gap:8px; }
      .vgc-heat-row { display:grid; grid-template-columns:110px 1fr 70px; align-items:center; gap:10px; }
      .vgc-heat-type { background:var(--tc); color:#fff; font-size:0.65rem; font-weight:800; padding:3px 8px; border-radius:5px; text-align:center; }
      .vgc-heat-bar-bg { background:#0b0e14; height:8px; border-radius:4px; overflow:hidden; }
      .vgc-heat-bar-fill { height:100%; background:#f97316; transition: width .5s ease; }
      .vgc-heat-bar-fill.vgc-heat-critical { background:#ef4444; }
      .vgc-heat-count { font-size:0.72rem; color:#8e9bb0; text-align:right; }
      .vgc-chip-row, .vgc-badge-row { display:flex; flex-wrap:wrap; gap:8px; }
      .vgc-chip { background:var(--tc); color:#fff; font-size:0.7rem; font-weight:800; padding:4px 10px; border-radius:6px; }
      .vgc-speed-list { display:flex; flex-direction:column; gap:6px; }
      .vgc-speed-row { display:grid; grid-template-columns:36px 1fr 60px; font-size:0.8rem; padding:6px 10px; background:#0b0e14; border-radius:6px; align-items:center; }
      .vgc-speed-row-tw { grid-template-columns:36px 1fr 60px auto; gap:8px; }
      .vgc-speed-rank { color:#6366f1; font-weight:800; }
      .vgc-speed-value { text-align:right; font-weight:800; color:#84cc16; }
      .vgc-speed-tailwind { text-align:right; font-weight:800; color:#38bdf8; font-size:0.75rem; white-space:nowrap; }
      .vgc-badge { background:rgba(11,14,20,0.85); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:8px 12px; font-size:0.78rem; display:flex; align-items:center; gap:8px; }
      .vgc-badge-icon { font-size:1rem; }
      .vgc-cascade { animation: vgcCascadeIn .4s ease both; }
      @keyframes vgcCascadeIn { 0% { opacity:0; transform:translateY(10px); } 100% { opacity:1; transform:translateY(0); } }
      .vgc-suggestions-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(100px,1fr)); gap:10px; }
      .vgc-suggestion-card { background:rgba(11,14,20,0.85); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:10px; display:flex; flex-direction:column; align-items:center; cursor:pointer; color:#fff; transition: transform .15s, box-shadow .15s; }
      .vgc-suggestion-card:hover { transform:translateY(-3px); box-shadow:0 6px 18px rgba(99,102,241,0.35); border-color:#6366f1; }
      .vgc-suggestion-card img { width:56px; height:56px; object-fit:contain; }
      .vgc-suggestion-name { font-size:0.72rem; font-weight:700; margin-top:4px; text-align:center; }
      .vgc-suggestion-score { font-size:0.65rem; color:#84cc16; font-weight:800; margin-top:2px; }

      @media (max-width:780px) {
        .vgc-formation { grid-template-columns: repeat(2,1fr); }
        .vgc-header { flex-direction:column; }
      }
    `;
    document.head.appendChild(style);
  }

  // ===============================
  // Gestione squadre
  // ===============================
  function renderTeamSelector() {
    const select = document.getElementById('vgc-team-select');
    if (!select) return;
    select.innerHTML = teams.map(t => `<option value="${t.id}" ${t.id === activeTeamId ? 'selected' : ''}>${t.name}</option>`).join('');
  }

  window.vgcSwitchTeam = function (id) {
    activeTeamId = id;
    scheduleSave();
    renderFormation();
    renderAnalysis();
  };

  window.vgcNewTeam = function () {
    const t = createEmptyTeam(`Squadra ${teams.length + 1}`);
    teams.push(t);
    activeTeamId = t.id;
    scheduleSave();
    renderTeamSelector();
    renderFormation();
    renderAnalysis();
  };

  window.vgcRenameTeam = function () {
    const team = getActiveTeam();
    const nameInput = document.getElementById('vgc-team-name-input');
    nameInput.style.display = 'inline-block';
    nameInput.value = team.name;
    nameInput.focus();
    nameInput.select();
  };

  window.vgcConfirmRename = function (value) {
    const nameInput = document.getElementById('vgc-team-name-input');
    if (nameInput.style.display === 'none') return;
    const team = getActiveTeam();
    if (value && value.trim()) team.name = value.trim();
    nameInput.style.display = 'none';
    team.updatedAt = Date.now();
    scheduleSave();
    renderTeamSelector();
  };

  window.vgcDeleteTeam = function () {
    if (teams.length <= 1) { alert('Deve rimanere almeno una squadra.'); return; }
    if (!confirm(`Eliminare "${getActiveTeam().name}"? L'azione non è reversibile.`)) return;
    teams = teams.filter(t => t.id !== activeTeamId);
    activeTeamId = teams[0].id;
    scheduleSave();
    renderTeamSelector();
    renderFormation();
    renderAnalysis();
  };

  // ===============================
  // Formazione (6 slot)
  // ===============================
  function renderFormation() {
    const container = document.getElementById('vgc-formation');
    const team = getActiveTeam();
    if (!container || !team) return;
    container.innerHTML = team.slots.map((slot, idx) => slot ? renderFilledSlotCard(slot, idx) : renderEmptySlotCard(idx)).join('');
  }

  function renderEmptySlotCard(idx) {
    return `
      <button class="vgc-slot vgc-slot-empty" onclick="window.vgcOpenPicker(${idx})">
        <span class="vgc-slot-plus">+</span>
        <span class="vgc-slot-empty-label">Aggiungi Pokémon</span>
      </button>
    `;
  }

  function renderFilledSlotCard(slot, idx) {
    const engine = ENGINE();
    const typesHtml = slot.types.map(t => `<span class="vgc-type-chip" style="--tc: var(--type-${t});">${(engine.TYPE_NAMES_ITA[t] || t).toUpperCase()}</span>`).join('');
    const movesFilled = (slot.moves || []).filter(Boolean).length;
    return `
      <div class="vgc-slot vgc-slot-filled vgc-flip-in">
        <button class="vgc-slot-remove" title="Rimuovi" onclick="window.vgcRemoveSlot(${idx})">✕</button>
        <img src="${slot.image}" class="vgc-slot-sprite" alt="${slot.speciesName}" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${slot.speciesId}.png'">
        <div class="vgc-slot-name">${slot.speciesName}</div>
        <div class="vgc-slot-types">${typesHtml}</div>
        <div class="vgc-slot-meta">${slot.abilityDisplayName || 'Abilità?'} · ${movesFilled}/4 mosse</div>
        <button class="vgc-slot-edit-btn" onclick="window.vgcOpenSlotDetail(${idx})">Modifica</button>
      </div>
    `;
  }

  window.vgcRemoveSlot = function (idx) {
    const team = getActiveTeam();
    team.slots[idx] = null;
    team.updatedAt = Date.now();
    scheduleSave();
    renderFormation();
    renderAnalysis();
  };

  // ===============================
  // Picker Pokémon
  // ===============================
  window.vgcOpenPicker = function (idx) {
    pickerTargetSlotIndex = idx;
    document.getElementById('vgc-picker-overlay').style.display = 'flex';
    document.getElementById('vgc-picker-search').value = '';
    renderPickerTypes();
    renderPickerGrid();
    document.getElementById('vgc-picker-search').focus();
  };

  window.vgcClosePicker = function () {
    document.getElementById('vgc-picker-overlay').style.display = 'none';
    pickerTargetSlotIndex = null;
  };

  function renderPickerTypes() {
    const container = document.getElementById('vgc-picker-types');
    if (!container) return;
    const engine = ENGINE();
    container.innerHTML = engine.TYPES_CONFIG.map(t => `
      <button class="vgc-picker-type-btn ${selectedPickerTypes.includes(t.id) ? 'active' : ''}" style="--tc: var(--type-${t.id});" onclick="window.vgcTogglePickerType('${t.id}')">${t.name}</button>
    `).join('');
  }

  window.vgcTogglePickerType = function (id) {
    if (selectedPickerTypes.includes(id)) selectedPickerTypes = selectedPickerTypes.filter(x => x !== id);
    else if (selectedPickerTypes.length < 2) selectedPickerTypes.push(id);
    renderPickerTypes();
    renderPickerGrid();
  };

  function renderPickerGrid() {
    const container = document.getElementById('vgc-picker-grid');
    if (!container) return;
    const searchEl = document.getElementById('vgc-picker-search');
    const query = (searchEl ? searchEl.value : '').toLowerCase().trim();
    const team = getActiveTeam();
    const usedIds = new Set(team ? team.slots.filter(Boolean).map(s => s.speciesId) : []);

    const filtered = dexList.filter(p => {
      if (usedIds.has(p.id)) return false;
      const matchesQuery = !query || p.name.toLowerCase().includes(query) || String(p.id).includes(query);
      const matchesTypes = selectedPickerTypes.length === 0 || selectedPickerTypes.every(t => p.types && p.types.includes(t));
      return matchesQuery && matchesTypes;
    }).slice(0, 60);

    if (!dexList.length) {
      container.innerHTML = `<p class="vgc-analysis-empty">Caricamento Pokédex in corso...</p>`;
      return;
    }

    container.innerHTML = filtered.map(p => `
      <button class="vgc-picker-card" onclick="window.vgcSelectPickerPokemon(${p.id})">
        <img src="${p.image}" alt="${p.name}" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png'">
        <span>${p.name}</span>
      </button>
    `).join('') || `<p class="vgc-analysis-empty">Nessun Pokémon trovato.</p>`;
  }

  window.vgcSelectPickerPokemon = async function (id) {
    const idx = pickerTargetSlotIndex;
    window.vgcClosePicker();
    await assignSpeciesToSlot(idx, id);
  };

  async function assignSpeciesToSlot(idx, id) {
    const team = getActiveTeam();
    try {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
      const data = await res.json();
      const name = data.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

      const statsBase = {};
      data.stats.forEach(s => { statsBase[s.stat.name] = s.base_stat; });

      const abilitiesResolved = await Promise.all(data.abilities.map(async a => {
        let displayName = a.ability.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        try {
          const abRes = await fetch(a.ability.url);
          const abData = await abRes.json();
          const it = abData.names.find(n => n.language.name === 'it');
          if (it) displayName = it.name;
        } catch (e) { /* mantieni il nome inglese come fallback */ }
        return { slug: a.ability.name, displayName, isHidden: a.is_hidden };
      }));

      const slot = {
        speciesId: data.id,
        speciesName: name,
        image: (data.sprites.other['official-artwork'] && data.sprites.other['official-artwork'].front_default) || data.sprites.front_default,
        types: data.types.map(t => t.type.name),
        statsBase,
        abilitiesAvailable: abilitiesResolved,
        abilitySlug: abilitiesResolved[0] ? abilitiesResolved[0].slug : '',
        abilityDisplayName: abilitiesResolved[0] ? abilitiesResolved[0].displayName : '',
        item: '',
        itemDisplayName: '',
        nature: 'Ardita',
        evs: { hp: 0, attack: 0, defense: 0, 'special-attack': 0, 'special-defense': 0, speed: 0 },
        moves: [null, null, null, null]
      };

      team.slots[idx] = slot;
      team.updatedAt = Date.now();
      scheduleSave();
      renderFormation();
      renderAnalysis();
    } catch (e) {
      console.error('Errore assegnazione slot Squadra VGC:', e);
    }
  }

  // ===============================
  // Editor slot (abilità/oggetto/natura/EV/mosse)
  // ===============================
  window.vgcOpenSlotDetail = function (idx) {
    editingSlotIndex = idx;
    document.getElementById('vgc-slot-detail-overlay').style.display = 'flex';
    renderSlotDetail();
  };

  window.vgcCloseSlotDetail = function () {
    document.getElementById('vgc-slot-detail-overlay').style.display = 'none';
    editingSlotIndex = null;
  };

  function renderSlotDetail() {
    if (editingSlotIndex === null) return;
    const engine = ENGINE();
    const team = getActiveTeam();
    const slot = team.slots[editingSlotIndex];
    const box = document.getElementById('vgc-slot-detail-box');
    if (!slot || !box) return;

    const abilityOptionsHtml = slot.abilitiesAvailable.map(a =>
      `<option value="${a.slug}" ${a.slug === slot.abilitySlug ? 'selected' : ''}>${a.displayName}${a.isHidden ? ' (Nascosta)' : ''}</option>`
    ).join('');

    const natureOptionsHtml = Object.keys(engine.NATURES).sort().map(n => {
      const eff = engine.NATURES[n];
      const label = eff ? ` (+${engine.STAT_LABELS_IT[eff.up]} / -${engine.STAT_LABELS_IT[eff.down]})` : ' (Neutra)';
      return `<option value="${n}" ${n === slot.nature ? 'selected' : ''}>${n}${label}</option>`;
    }).join('');

    const itemOptionsHtml = `<option value="">Nessun oggetto</option>` + ITEM_SLUGS.map(s =>
      `<option value="${s}" ${s === slot.item ? 'selected' : ''}>${itemNameCache[s] || s}</option>`
    ).join('');

    const statRows = ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'].map(statKey => {
      const total = engine.computeStatTotal(slot.statsBase[statKey], slot.evs[statKey], statKey, slot.nature);
      return `
        <div class="vgc-stat-row">
          <span class="vgc-stat-label">${engine.STAT_LABELS_IT[statKey]}</span>
          <span class="vgc-stat-total">${total}</span>
          <div class="vgc-stat-bar-bg"><div class="vgc-stat-bar-fill" style="width:${Math.min(100, (total / 300) * 100)}%"></div></div>
          <input type="number" min="0" max="32" value="${slot.evs[statKey]}" class="vgc-ev-input" onchange="window.vgcUpdateEV(${editingSlotIndex}, '${statKey}', this.value)">
        </div>
      `;
    }).join('');

    const evTotal = Object.values(slot.evs).reduce((a, b) => a + b, 0);

    const movesDetailed = getPokemonMoves(slot.speciesName);
    const moveSelectsHtml = [0, 1, 2, 3].map(i => {
      const current = slot.moves[i];
      const options = movesDetailed.map(m =>
        `<option value="${m.name}" ${current && current.name === m.name ? 'selected' : ''}>[${m.type}] ${m.name}</option>`
      ).join('');
      const emptyOptionsMsg = movesDetailed.length === 0 ? `<option value="">Nessuna mossa trovata nel DB</option>` : `<option value="">— Mossa ${i + 1} —</option>${options}`;
      return `<select class="vgc-move-select" onchange="window.vgcUpdateMove(${editingSlotIndex}, ${i}, this.value)">${emptyOptionsMsg}</select>`;
    }).join('');

    const typesHtml = slot.types.map(t => `<span class="vgc-type-chip" style="--tc: var(--type-${t});">${(engine.TYPE_NAMES_ITA[t] || t).toUpperCase()}</span>`).join('');

    box.innerHTML = `
      <button class="vgc-modal-close" onclick="window.vgcCloseSlotDetail()">✕</button>
      <div class="vgc-slot-detail-header">
        <img src="${slot.image}" class="vgc-slot-detail-sprite" alt="${slot.speciesName}">
        <div>
          <h2>${slot.speciesName}</h2>
          <div class="vgc-slot-types">${typesHtml}</div>
        </div>
      </div>

      <div class="vgc-detail-grid">
        <label>Abilità<select onchange="window.vgcUpdateAbility(${editingSlotIndex}, this.value)">${abilityOptionsHtml}</select></label>
        <label>Oggetto<select onchange="window.vgcUpdateItem(${editingSlotIndex}, this.value)">${itemOptionsHtml}</select></label>
        <label>Natura<select onchange="window.vgcUpdateNature(${editingSlotIndex}, this.value)">${natureOptionsHtml}</select></label>
      </div>

      <div class="vgc-ev-header">Punti Sforzo (EV 0–32 per stat) — <span class="${evTotal > 192 ? 'vgc-ev-warning' : ''}">${evTotal} totali</span></div>
      <div class="vgc-stats-block">${statRows}</div>

      <div class="vgc-moves-header">Mosse</div>
      <div class="vgc-moves-grid">${moveSelectsHtml}</div>
    `;
  }

  window.vgcUpdateAbility = function (idx, slug) {
    const team = getActiveTeam();
    const slot = team.slots[idx];
    const found = slot.abilitiesAvailable.find(a => a.slug === slug);
    slot.abilitySlug = slug;
    slot.abilityDisplayName = found ? found.displayName : slug;
    team.updatedAt = Date.now();
    scheduleSave();
    renderFormation();
    renderAnalysis();
  };

  window.vgcUpdateItem = function (idx, slug) {
    const team = getActiveTeam();
    const slot = team.slots[idx];
    slot.item = slug;
    slot.itemDisplayName = slug ? (itemNameCache[slug] || slug) : '';
    team.updatedAt = Date.now();
    scheduleSave();
  };

  window.vgcUpdateNature = function (idx, nature) {
    const team = getActiveTeam();
    team.slots[idx].nature = nature;
    team.updatedAt = Date.now();
    scheduleSave();
    renderSlotDetail();
    renderAnalysis();
  };

  window.vgcUpdateEV = function (idx, statKey, value) {
    let v = parseInt(value, 10);
    if (isNaN(v) || v < 0) v = 0;
    if (v > 32) v = 32;
    const team = getActiveTeam();
    team.slots[idx].evs[statKey] = v;
    team.updatedAt = Date.now();
    scheduleSave();
    renderSlotDetail();
    renderFormation();
    renderAnalysis();
  };

  window.vgcUpdateMove = function (idx, moveIndex, moveName) {
    const team = getActiveTeam();
    const slot = team.slots[idx];
    if (!moveName) {
      slot.moves[moveIndex] = null;
    } else {
      const movesDetailed = getPokemonMoves(slot.speciesName);
      slot.moves[moveIndex] = movesDetailed.find(m => m.name === moveName) || null;
    }
    team.updatedAt = Date.now();
    scheduleSave();
    renderFormation();
    renderAnalysis();
  };

  // ===============================
  // Pannello Analisi
  // ===============================
  function renderAnalysis() {
    const engine = ENGINE();
    const team = getActiveTeam();
    const panel = document.getElementById('vgc-analysis-panel');
    if (!team || !panel) return;

    const analysis = engine.analyzeTeam(team.slots);

    if (analysis.filledCount === 0) {
      panel.innerHTML = `<p class="vgc-analysis-empty">Aggiungi almeno un Pokémon alla formazione per iniziare l'analisi.</p>`;
      return;
    }

    const weakEntries = Object.keys(analysis.weaknessCounts)
      .map(t => ({ type: t, count: analysis.weaknessCounts[t] }))
      .filter(e => e.count > 0)
      .sort((a, b) => b.count - a.count);

    const heatmapHtml = weakEntries.length ? weakEntries.map(e => `
      <div class="vgc-heat-row">
        <span class="vgc-heat-type" style="--tc: var(--type-${e.type});">${(engine.TYPE_NAMES_ITA[e.type] || e.type).toUpperCase()}</span>
        <div class="vgc-heat-bar-bg"><div class="vgc-heat-bar-fill ${e.count >= 2 ? 'vgc-heat-critical' : ''}" style="width:${Math.min(100, (e.count / 6) * 100)}%"></div></div>
        <span class="vgc-heat-count">${e.count} debol${e.count > 1 ? 'i' : 'e'}</span>
      </div>
    `).join('') : `<p class="vgc-analysis-empty">Nessuna debolezza condivisa rilevata.</p>`;

    const gapsHtml = analysis.offensiveGaps.length ? analysis.offensiveGaps.map(t =>
      `<span class="vgc-chip" style="--tc: var(--type-${t});">${(engine.TYPE_NAMES_ITA[t] || t).toUpperCase()}</span>`
    ).join('') : `<p class="vgc-analysis-empty">Copertura offensiva completa su tutti i tipi.</p>`;

    const speedHtml = analysis.speedTiers.map((s, i) => `
      <div class="vgc-speed-row ${analysis.tailwindActive ? 'vgc-speed-row-tw' : ''}">
        <span class="vgc-speed-rank">#${i + 1}</span>
        <span class="vgc-speed-name">${s.name}</span>
        <span class="vgc-speed-value">${s.speed}</span>
        ${analysis.tailwindActive ? `<span class="vgc-speed-tailwind">💨 ×2 → ${s.speedTailwind}</span>` : ''}
      </div>
    `).join('');
    const speedTitle = analysis.tailwindActive
      ? '💨 Speed Tier (Livello 50) — con Ventoincoda attivo'
      : '💨 Speed Tier (Livello 50)';

    const badgesHtml = analysis.synergyBadges.length ? analysis.synergyBadges.map((b, i) =>
      `<div class="vgc-badge vgc-cascade" style="animation-delay:${i * 70}ms;"><span class="vgc-badge-icon">${b.icon}</span>${b.text}</div>`
    ).join('') : `<p class="vgc-analysis-empty">Nessuna sinergia da doppio rilevata ancora: prova ad aggiungere abilità meteo/terreno, Intimidazione, o mosse come Sonoqui, Polverabbia, Distortozona.</p>`;

    panel.innerHTML = `
      <section class="vgc-analysis-block">
        <h3>🛡️ Debolezze Condivise</h3>
        <div class="vgc-heatmap">${heatmapHtml}</div>
      </section>
      <section class="vgc-analysis-block">
        <h3>⚔️ Buchi di Copertura Offensiva</h3>
        <div class="vgc-chip-row">${gapsHtml}</div>
      </section>
      <section class="vgc-analysis-block">
        <h3>${speedTitle}</h3>
        <div class="vgc-speed-list">${speedHtml}</div>
      </section>
      <section class="vgc-analysis-block">
        <h3>🤝 Sinergie da Doppio</h3>
        <div class="vgc-badge-row">${badgesHtml}</div>
      </section>
      <section class="vgc-analysis-block" id="vgc-suggestions-block">
        <h3>✨ Pokémon Suggeriti</h3>
        <div id="vgc-suggestions" class="vgc-suggestions-grid"><p class="vgc-analysis-empty">Caricamento suggerimenti...</p></div>
      </section>
    `;

    renderSuggestions(analysis, team);
  }

  function renderSuggestions(analysis, team) {
    const engine = ENGINE();
    const container = document.getElementById('vgc-suggestions');
    if (!container) return;

    if (!dexList.length) {
      container.innerHTML = `<p class="vgc-analysis-empty">Caricamento dex in corso...</p>`;
      return;
    }

    const excludeIds = new Set(team.slots.filter(Boolean).map(s => s.speciesId));
    const results = engine.suggestCandidates(analysis, dexList, excludeIds, 8);

    if (!results.length) {
      container.innerHTML = `<p class="vgc-analysis-empty">Nessun suggerimento specifico: la squadra è già ben bilanciata sui dati disponibili.</p>`;
      return;
    }

    container.innerHTML = results.map((r, i) => `
      <button class="vgc-suggestion-card vgc-cascade" style="animation-delay:${i * 60}ms;" onclick="window.vgcAssignSuggestion(${r.pokemon.id})" title="${r.reasons.join(', ')}">
        <img src="${r.pokemon.image}" alt="${r.pokemon.name}" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${r.pokemon.id}.png'">
        <span class="vgc-suggestion-name">${r.pokemon.name}</span>
        <span class="vgc-suggestion-score">Punteggio ${r.score}</span>
      </button>
    `).join('');
  }

  window.vgcAssignSuggestion = function (id) {
    const team = getActiveTeam();
    const freeIdx = team.slots.findIndex(s => !s);
    if (freeIdx === -1) return;
    assignSpeciesToSlot(freeIdx, id);
  };

  // ===============================
  // Bootstrap
  // ===============================
  document.addEventListener('DOMContentLoaded', async () => {
    injectTeamBuilderStyles();
    initTeamBuilderLayout();

    const stored = loadTeamsFromStorage();
    if (stored && stored.teams && stored.teams.length) {
      teams = stored.teams;
      activeTeamId = (stored.activeTeamId && teams.some(t => t.id === stored.activeTeamId)) ? stored.activeTeamId : teams[0].id;
    } else {
      const t = createEmptyTeam('Squadra 1');
      teams = [t];
      activeTeamId = t.id;
    }

    renderTeamSelector();
    renderFormation();
    renderAnalysis();

    await Promise.all([
      window.SharedData.movesReady,
      loadDexWithTypes(),
      loadItemNames()
    ]);
  });
})();
