/**
 * Calcolo_Danni.js - Versione con Autocomplete, Filtri Tipo, EV (0-32) e Wiki Scraping completo via Proxy
 */

(function () {
  'use strict';

  const TYPES_CONFIG = window.SharedData.TYPES_CONFIG;
  const TYPE_NAMES_ITA = window.SharedData.TYPE_NAMES_ITA;

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
// DATABASE MOSSE (condiviso tra le sezioni, vedi shared-data.js)
// ===============================
function getPokemonMoves(name) {
    return window.SharedData.getPokemonMoves(name);
}

  let statsBonusA = { 'hp': 0, 'attack': 0, 'defense': 0, 'special-attack': 0, 'special-defense': 0, 'speed': 0 };
  let statsBonusB = { 'hp': 0, 'attack': 0, 'defense': 0, 'special-attack': 0, 'special-defense': 0, 'speed': 0 };
  let itemA = '';
  let itemB = '';
  let natureA = 'Ardita';
  let natureB = 'Ardita';

  function emptyStages() {
    return { attack: 0, defense: 0, 'special-attack': 0, 'special-defense': 0, speed: 0 };
  }
  function clampStage(v) {
    return Math.max(-6, Math.min(6, v));
  }
  // Stessa formula di Calcolo_Danni_2v2.js/Calcolo_Danni_Engine.js, duplicata qui per lo stesso
  // motivo gia' documentato altrove nel progetto: non dipendere dall'ordine di caricamento
  // degli script (questo file carica prima di Calcolo_Danni_Engine.js).
  function stageMultiplier(stage) {
    return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
  }
  function effectiveStatValue(baseVal, ev, statKey, nature, stage) {
    const raw = window.SharedData.computeStatTotal(baseVal, ev, statKey, nature);
    if (statKey === 'hp') return raw;
    return Math.floor(raw * stageMultiplier(stage || 0));
  }
  let statStagesA = emptyStages();
  let statStagesB = emptyStages();
  // Mosse potenzianti già usate prima dello scambio da calcolare (Danzaspada, Dragodanza,
  // ecc.): un checkbox per mossa invece dei pulsanti +/- a fase singola, più intuitivo. Le
  // fasi statistiche restano il dato usato dal motore di calcolo (statStagesA/B) — i checkbox
  // sono solo un modo più leggibile di impostarle, presa dalla stessa tabella già usata nel
  // Doppio per l'applicazione automatica delle mosse alleate (window.SharedData.STAT_BOOST_MOVES).
  let selfBoostsA = {};
  let selfBoostsB = {};

  // Condizioni di campo/stato lette dal motore di calcolo (Calcolo_Danni_Engine.js) tramite
  // window.getCalc1v1FieldConditions: meteo/terreno sono globali, bruciatura/critico riguardano
  // l'attaccante (A), gli schermi riguardano il difensore (B) — stessa asimmetria attaccante/
  // difensore gia' usata per gli oggetti equipaggiati.
  let fieldWeather = '';
  let fieldTerrain = '';
  let isBurnedA = false;
  let isCritA = false;
  let screensB = { reflect: false, lightscreen: false, auroraveil: false };

  window.getCalc1v1FieldConditions = function () {
    return { weather: fieldWeather, terrain: fieldTerrain, isBurnedA, isCritA, screensB };
  };

  window.updateFieldWeather = function (value) { fieldWeather = value; };
  window.updateFieldTerrain = function (value) { fieldTerrain = value; };
  window.updateBurnA = function (checked) { isBurnedA = checked; };
  window.updateCritA = function (checked) { isCritA = checked; };
  window.updateScreenB = function (key, checked) { screensB[key] = checked; };

  // Stato completo di uno slot (Pokemon + EV + Natura + fasi + oggetto), letto da
  // Calcolo_Danni_Engine.js al posto dello scraping del DOM: stessa fonte di dati usata per
  // disegnare i box A/B, quindi Natura/fasi statistiche non vengono piu' ignorate nel calcolo.
  window.getCalc1v1Slot = function (slot) {
    return slot === 'A'
      ? { pokemon: pokemonA, evs: statsBonusA, nature: natureA, stages: statStagesA, item: itemA }
      : { pokemon: pokemonB, evs: statsBonusB, nature: natureB, stages: statStagesB, item: itemB };
  };

  function buildNatureOptionsHtml(selectedNature) {
    return Object.keys(window.SharedData.NATURES).map(n =>
      `<option value="${n}" ${n === selectedNature ? 'selected' : ''}>${n}</option>`
    ).join('');
  }

  // Descrive gli effetti di una mossa potenziante (es. "+1 Attacco, +1 Velocità") riusando le
  // stesse etichette di STAT_NAMES_ITA e lo stesso segno mostrato dai giochi.
  function describeBoostChanges(changes) {
    return changes.map(c => `${c.stages > 0 ? '+' : ''}${c.stages} ${STAT_NAMES_ITA[c.stat] || c.stat}`).join(', ');
  }

  function buildStageAdjustorHtml(slot, stages, selfBoosts) {
    const boostRows = Object.entries(window.SharedData.STAT_BOOST_MOVES)
      .filter(([, boost]) => boost.target === 'self')
      .map(([name, boost]) => `
        <label style="display:flex; align-items:center; gap:6px; font-size:0.72rem; cursor:pointer;">
          <input type="checkbox" ${selfBoosts[name] ? 'checked' : ''} onchange="window.updateSelfBoost('${slot}', '${name}', this.checked)">
          <span>${name}</span>
          <span style="color:var(--text-muted); font-size:0.62rem;">(${describeBoostChanges(boost.changes)})</span>
        </label>
      `).join('');

    const summaryRows = Object.keys(stages)
      .filter(k => stages[k])
      .map(k => {
        const v = stages[k];
        const color = v > 0 ? '#84cc16' : '#ef4444';
        return `<span style="color:${color}; font-weight:800;">${STAT_NAMES_ITA[k] || k} ${v > 0 ? '+' + v : v}</span>`;
      });
    const summaryHtml = summaryRows.length
      ? `<div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; padding-top:8px; border-top:1px solid var(--border-color); font-size:0.7rem;">${summaryRows.join('')}</div>`
      : `<div style="margin-top:8px; padding-top:8px; border-top:1px solid var(--border-color); font-size:0.68rem; color:var(--text-muted);">Nessuna fase statistica attiva</div>`;

    return `
      <div style="background: var(--bg-dark); padding: 10px; border-radius: 8px; margin-bottom: 12px; border: 1px solid var(--border-color);">
        <div style="font-size:0.68rem; font-weight:800; color:var(--text-muted); margin-bottom:6px; letter-spacing:0.4px;">MOSSE POTENZIANTI GIÀ USATE</div>
        <div style="display:flex; flex-direction:column; gap:5px;">${boostRows}</div>
        ${summaryHtml}
      </div>
    `;
  }

  window.updateNature = function (slot, natureKey) {
    if (slot === 'A') { natureA = natureKey; renderPokemonA(); }
    else { natureB = natureKey; renderPokemonB(); }
  };

  window.updateSelfBoost = function (slot, moveName, checked) {
    const boost = window.SharedData.STAT_BOOST_MOVES[moveName];
    if (!boost || boost.target !== 'self') return;
    const stages = slot === 'A' ? statStagesA : statStagesB;
    const selfBoosts = slot === 'A' ? selfBoostsA : selfBoostsB;
    selfBoosts[moveName] = checked;
    const sign = checked ? 1 : -1;
    boost.changes.forEach(c => {
      stages[c.stat] = clampStage((stages[c.stat] || 0) + sign * c.stages);
    });
    if (slot === 'A') renderPokemonA(); else renderPokemonB();
  };

  function buildItemOptionsHtml(selectedSlug) {
    return window.SharedData.ITEM_SLUGS.map(slug => {
      const name = window.SharedData.getItemName(slug);
      return `<option value="${slug}" ${slug === selectedSlug ? 'selected' : ''}>${name}</option>`;
    }).join('');
  }

  function buildItemBlockHtml(slot, selectedSlug) {
    const lower = slot.toLowerCase();
    return `
      <div style="background: var(--bg-dark); padding: 12px; border-radius: 8px; margin-bottom: 16px; border: 1px solid var(--border-color);">
        <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 6px;">OGGETTO EQUIPAGGIATO</label>
        <input
            type="text"
            id="item-search-${lower}"
            placeholder="🔍 Cerca un oggetto..."
            style="width:100%; background:#101827; color:white; border:1px solid var(--border-color); padding:8px; border-radius:6px; font-size:0.85rem; margin-bottom:8px;">
        <div id="item-search-results-${lower}" style="display:none; max-height:180px; overflow-y:auto; margin-bottom:8px; background:#101827; border:1px solid #334155; border-radius:6px;"></div>
        <select
            id="select-item-${lower}"
            onchange="window.updateItemSelection('${slot}', this.value)"
            style="width:100%; background:var(--panel-bg); border:1px solid var(--border-color); color:var(--violet); padding:8px; border-radius:6px; font-size:0.85rem; font-weight:700;">
          <option value="">— Nessun oggetto —</option>
          ${buildItemOptionsHtml(selectedSlug)}
        </select>
      </div>
    `;
  }

  window.updateItemSelection = function (slot, slug) {
    if (slot === 'A') itemA = slug; else itemB = slug;
    const box = document.getElementById(slot === 'A' ? 'box-a' : 'box-b');
    if (box) box.dataset.itemSlug = slug || '';
  };

  window.initItemSearch = function (slot) {
    const lower = slot.toLowerCase();
    const input = document.getElementById(`item-search-${lower}`);
    const results = document.getElementById(`item-search-results-${lower}`);
    const select = document.getElementById(`select-item-${lower}`);
    if (!input || !results || !select) return;

    input.oninput = function () {
      const text = this.value.trim().toLowerCase();
      results.innerHTML = '';
      if (!text) { results.style.display = 'none'; return; }

      const found = window.SharedData.ITEM_SLUGS
        .filter(s => window.SharedData.getItemName(s).toLowerCase().includes(text))
        .slice(0, 20);

      if (!found.length) { results.style.display = 'none'; return; }
      results.style.display = 'block';

      found.forEach(slug => {
        const name = window.SharedData.getItemName(slug);
        const item = document.createElement('div');
        item.textContent = name;
        item.style.padding = '8px';
        item.style.cursor = 'pointer';
        item.style.borderBottom = '1px solid var(--border-color)';
        item.style.color = 'var(--violet)';
        item.onmouseenter = () => { item.style.background = '#1e293b'; };
        item.onmouseleave = () => { item.style.background = ''; };
        item.onclick = () => {
          select.value = slug;
          window.updateItemSelection(slot, slug);
          input.value = '';
          results.style.display = 'none';
        };
        results.appendChild(item);
      });
    };
  };

  window.switchAppSection = function (sectionId) {
    const views = {
      'pokedex': document.getElementById('main-pokedex-view'),
      'damage-calc': document.getElementById('damage-calc-view'),
      'team-builder': document.getElementById('team-builder-view')
    };

    Object.keys(views).forEach(key => {
      if (views[key]) views[key].style.display = (key === sectionId) ? 'block' : 'none';
    });
  };

  window.switchCalcFormat = function (format) {
    const view1v1 = document.getElementById('calc-1v1-view');
    const view2v2 = document.getElementById('calc-2v2-view');
    const btn1v1 = document.getElementById('calc-format-1v1');
    const btn2v2 = document.getElementById('calc-format-2v2');
    if (!view1v1 || !view2v2) return;

    const active = 'border: 2px solid var(--accent); background: var(--accent); color: #04202e;';
    const inactive = 'border: 2px solid rgba(255,255,255,0.12); background: rgba(24,32,48,0.5); backdrop-filter: blur(8px); color: #fff;';
    const baseStyle = 'flex: 1; max-width: 220px; padding: 16px; border-radius: var(--radius-lg); font-weight: 800; font-size: 1rem; cursor: pointer;';

    if (format === '2v2') {
      view1v1.style.display = 'none';
      view2v2.style.display = 'block';
      if (btn1v1) btn1v1.style.cssText = baseStyle + inactive;
      if (btn2v2) btn2v2.style.cssText = baseStyle + active;
      window.dispatchEvent(new CustomEvent('calc-format-2v2-shown'));
    } else {
      view1v1.style.display = 'block';
      view2v2.style.display = 'none';
      if (btn1v1) btn1v1.style.cssText = baseStyle + active;
      if (btn2v2) btn2v2.style.cssText = baseStyle + inactive;
    }
  };

  document.addEventListener('DOMContentLoaded', async () => {

    initDamageCalcLayout();

    await Promise.all([window.SharedData.movesReady, window.SharedData.itemNamesReady]);

    await loadPokemonDataset();

});

  function initDamageCalcLayout() {
    const calcContainer = document.getElementById('damage-calc-view');
    if (!calcContainer) return;

    calcContainer.style.cssText = 'display: none; max-width: 1280px; margin: 20px auto; padding: 20px; font-family: system-ui, sans-serif; color: #f0f4fc;';

    calcContainer.innerHTML = `
      <header style="margin-bottom: 24px; text-align: center;">
        <h1 style="font-family: var(--font-display, 'Rajdhani', sans-serif); font-size: 2.4rem; font-weight: 700; background: linear-gradient(90deg, var(--accent), var(--violet)); -webkit-background-clip: text; background-clip: text; color: transparent;">Calcolo Danni Pokémon</h1>
        <p style="color: var(--text-muted);">Statistiche (HP+75, Altre+20), EV (0-32) e ricerca avanzata.</p>
      </header>

      <div id="calc-format-switcher" style="display: flex; justify-content: center; gap: 16px; margin-bottom: 28px;">
        <button id="calc-format-1v1" onclick="window.switchCalcFormat('1v1')" style="flex: 1; max-width: 220px; padding: 16px; border-radius: var(--radius-lg); font-weight: 800; font-size: 1rem; cursor: pointer; border: 2px solid var(--accent); background: var(--accent); color: #04202e;">
          1 vs 1
        </button>
        <button id="calc-format-2v2" onclick="window.switchCalcFormat('2v2')" style="flex: 1; max-width: 220px; padding: 16px; border-radius: var(--radius-lg); font-weight: 800; font-size: 1rem; cursor: pointer; border: 2px solid rgba(255,255,255,0.12); background: rgba(24,32,48,0.5); backdrop-filter: blur(8px); color: #fff;">
          2 vs 2 (Doppio)
        </button>
      </div>

      <div id="calc-1v1-view">
        <div style="display: flex; justify-content: center; gap: 16px; margin-bottom: 24px;">
          <button id="btn-target-a" style="padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; border: 2px solid var(--accent); background: var(--accent); color: #04202e;">
            Target: Pokémon A (Attaccante)
          </button>
          <button id="btn-target-b" style="padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; border: 2px solid rgba(255,255,255,0.12); background: rgba(24,32,48,0.5); backdrop-filter: blur(8px); color: #fff;">
            Target: Pokémon B (Difensore)
          </button>
        </div>

        <div style="display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; margin-bottom: 24px; background: rgba(18,24,36,0.45); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-lg); padding: 14px 20px;">
          <label style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; display: flex; align-items: center; gap: 6px;">METEO
            <select onchange="window.updateFieldWeather(this.value)" style="background: var(--bg-dark); border: 1px solid var(--border-color); color: #fff; padding: 6px; border-radius: 6px; font-size: 0.8rem;">
              <option value="">Nessuno</option>
              <option value="rain">Pioggia (Acqua ×1.5 / Fuoco ×0.5)</option>
              <option value="sun">Sole (Fuoco ×1.5 / Acqua ×0.5)</option>
            </select>
          </label>
          <label style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; display: flex; align-items: center; gap: 6px;">TERRENO
            <select onchange="window.updateFieldTerrain(this.value)" style="background: var(--bg-dark); border: 1px solid var(--border-color); color: #fff; padding: 6px; border-radius: 6px; font-size: 0.8rem;">
              <option value="">Nessuno</option>
              <option value="grassy">Erboso (Erba ×1.3)</option>
              <option value="electric">Elettrico (Elettro ×1.3)</option>
              <option value="psychic">Psichico (Psico ×1.3)</option>
              <option value="misty">Fatato (Folletto ×1.3)</option>
            </select>
          </label>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; margin-bottom: 32px;">
          <div id="box-a" style="background-image: var(--glass-sheen); background-color: rgba(24,32,48,0.45); backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); box-shadow: 0 8px 28px rgba(0,0,0,0.35), inset 0 1px 0 var(--glass-highlight); border: 1px solid rgba(56,189,248,0.5); border-radius: var(--radius-lg); padding: 20px;">
            <h3 style="color: var(--accent); text-align: center; margin-bottom: 12px;">POKÉMON A (ATTACCANTE)</h3>
            <div id="content-a"><p style="text-align: center; color: var(--text-muted);">Seleziona un Pokémon dalla lista sottostante</p></div>
          </div>
          <div id="box-b" style="background-image: var(--glass-sheen); background-color: rgba(24,32,48,0.45); backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); box-shadow: 0 8px 28px rgba(0,0,0,0.35), inset 0 1px 0 var(--glass-highlight); border: 1px solid rgba(167,139,250,0.5); border-radius: var(--radius-lg); padding: 20px;">
            <h3 style="color: var(--violet); text-align: center; margin-bottom: 12px;">POKÉMON B (DIFENSORE)</h3>
            <div id="content-b"><p style="text-align: center; color: var(--text-muted);">Seleziona un Pokémon dalla lista sottostante</p></div>
          </div>
        </div>

        <div style="background-image: var(--glass-sheen); background-color: rgba(18,24,36,0.45); backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); box-shadow: 0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 var(--glass-highlight); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-lg); padding: 20px;">
          <!-- BARRA DI RICERCA CON DROPDOWN AUTOCOMPLETE -->
          <div style="position: relative; margin-bottom: 16px;">
            <input type="text" id="calc-search" placeholder="Cerca per nome o numero (es. Annihilape, #0979)..." autocomplete="off" style="width: 100%; padding: 12px; background: rgba(11,14,20,0.55); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; color: #fff;">
            <div id="calc-suggestions" style="position: absolute; top: 100%; left: 0; right: 0; background: rgba(15,20,32,0.75); backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); border: 1px solid rgba(255,255,255,0.08); border-top: none; border-radius: 0 0 12px 12px; max-height: 220px; overflow-y: auto; z-index: 1000; display: none;"></div>
          </div>

          <div id="type-filters" style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px;"></div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px; color: var(--text-muted); font-size: 0.85rem;">
            <span id="calc-pokemon-count">0 POKÉMON TROVATI</span>
          </div>
          <div id="pokemon-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px;"></div>
          <button id="btn-load-more" style="width: 100%; padding: 12px; margin-top: 16px; background: rgba(24,32,48,0.5); border: 1px solid rgba(255,255,255,0.08); color: #fff; border-radius: 10px; cursor: pointer; display: none;">Carica altri</button>
        </div>
      </div>

      <div id="calc-2v2-view" style="display: none;"></div>
    `;

    renderTypeFilters();
    setupTargetControls();
  }

  function renderTypeFilters() {
    const container = document.getElementById('type-filters');
    if (!container) return;
    container.innerHTML = TYPES_CONFIG.map(t => `
      <button class="type-btn" data-type="${t.id}" style="background: var(--bg-dark); border: 1px solid var(--border-color); color: #fff; padding: 6px 12px; border-radius: 6px; font-size: 0.75rem; cursor: pointer;">
        ${t.name}
      </button>
    `).join('');

    container.querySelectorAll('.type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type');
        if (selectedTypes.includes(type)) {
          selectedTypes = selectedTypes.filter(t => t !== type);
          btn.style.backgroundColor = 'var(--bg-dark)';
          btn.style.borderColor = 'var(--border-color)';
          btn.style.color = '#fff';
        } else if (selectedTypes.length < 2) {
          selectedTypes.push(type);
          btn.style.backgroundColor = 'var(--accent)';
          btn.style.borderColor = 'var(--accent)';
          btn.style.color = '#04202e';
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
        btnA.style.background = 'var(--accent)'; btnA.style.borderColor = 'var(--accent)'; btnA.style.color = '#04202e';
        btnB.style.background = 'rgba(24,32,48,0.5)'; btnB.style.borderColor = 'rgba(255,255,255,0.12)'; btnB.style.color = '#fff';
      });

      btnB.addEventListener('click', () => {
        targetSelection = 'B';
        btnB.style.background = 'var(--violet)'; btnB.style.borderColor = 'var(--violet)'; btnB.style.color = '#1e1033';
        btnA.style.background = 'rgba(24,32,48,0.5)'; btnA.style.borderColor = 'rgba(255,255,255,0.12)'; btnA.style.color = '#fff';
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
      <div class="suggestion-item" onclick="window.calcSelectFromSuggestion(${p.id}, '${p.name.replace(/'/g, "\\'")}')" style="padding: 10px 14px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--border-color); cursor: pointer; color: #fff;">
        <img src="${p.image}" style="width: 32px; height: 32px; object-fit: contain;" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png'">
        <span style="font-weight: 600; font-size: 0.9rem;">${p.name}</span>
        <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: auto;">#${String(p.id).padStart(4, '0')}</span>
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
    localPokemonList = await window.SharedData.dexReady;

    filteredPokemon = [...localPokemonList];
    renderGrid();

    window.addEventListener('pokedex-types-ready', () => {
      applyFilters();
    });

    assignPokemonSlot(979, 'A');
    assignPokemonSlot(7, 'B');
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

      let borderStyle = '1px solid rgba(255,255,255,0.08)';
      let bgStyle = 'rgba(18,24,36,0.85)';
      let badgeHtml = '';

      if (isSelectedA) {
        borderStyle = '2px solid var(--accent)';
        bgStyle = 'rgba(56, 189, 248, 0.15)';
        badgeHtml = `<span style="background: var(--accent); color: #04202e; font-weight: 800; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; margin-bottom: 4px;">TARGET A</span>`;
      } else if (isSelectedB) {
        borderStyle = '2px solid var(--violet)';
        bgStyle = 'rgba(167, 139, 250, 0.15)';
        badgeHtml = `<span style="background: var(--violet); color: #fff; font-weight: 800; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; margin-bottom: 4px;">TARGET B</span>`;
      }

      return `
        <button onclick="window.calcAssignPokemon(${p.id})" style="background: ${bgStyle}; border: ${borderStyle}; border-radius: 10px; padding: 10px; display: flex; flex-direction: column; align-items: center; cursor: pointer; color: #fff; transition: all 0.2s ease;">
          ${badgeHtml}
          <span style="font-size: 0.7rem; color: var(--text-muted); align-self: flex-start;">#${String(p.id).padStart(4, '0')}</span>
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
      const data = await window.SharedData.getSpeciesDetail(id);

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
        itemA = '';
        statsBonusA = { 'hp': 0, 'attack': 0, 'defense': 0, 'special-attack': 0, 'special-defense': 0, 'speed': 0 };
        natureA = 'Ardita';
        statStagesA = emptyStages();
        selfBoostsA = {};
        await renderPokemonA();
      } else {
        pokemonB = pokemonObj;
        itemB = '';
        statsBonusB = { 'hp': 0, 'attack': 0, 'defense': 0, 'special-attack': 0, 'special-defense': 0, 'speed': 0 };
        natureB = 'Ardita';
        statStagesB = emptyStages();
        selfBoostsB = {};
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
data-power="${m.power ?? 0}"
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
      const totalVal = effectiveStatValue(baseVal, bonusEV, statKey, natureA, statStagesA[statKey]);

      return `
        <div style="display: grid; grid-template-columns: 80px 50px 1fr 100px; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 0.8rem;">
          <span style="color: var(--text-muted);">${STAT_NAMES_ITA[statKey] || statKey}</span>
          <span style="font-weight: 700;">${totalVal}</span>
          <div style="background: var(--bg-dark); height: 6px; border-radius: 3px; overflow: hidden;">
            <div style="width: ${Math.min(100, (totalVal / 300) * 100)}%; height: 100%; background: var(--accent);"></div>
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            <label style="font-size: 0.7rem; color: var(--text-muted);">EV:</label>
            <input type="number" min="0" max="32" value="${bonusEV}" onchange="window.updateEV('A', '${statKey}', this.value)" style="width: 45px; background: var(--bg-dark); border: 1px solid var(--border-color); color: #fff; text-align: center; border-radius: 4px; padding: 2px;">
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
        <img src="${pokemonA.image}" style="width: 80px; height: 80px; object-fit: contain;">
        <div>
          <h3 style="font-size: 1.2rem; font-weight: 800; color: #fff;">${pokemonA.name}</h3>
          <div>${pokemonA.types.map(t => `<span style="background: var(--border-color); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-right: 4px;">${(TYPE_NAMES_ITA[t] || t).toUpperCase()}</span>`).join('')}</div>
        </div>
      </div>

      <div style="background: var(--bg-dark); padding: 12px; border-radius: 8px; margin-bottom: 16px; border: 1px solid var(--border-color);">

    <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 6px;">
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
            border:1px solid var(--border-color);
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
        style="width:100%; background:var(--panel-bg); border:1px solid var(--border-color); color:var(--accent); padding:8px; border-radius:6px; font-size:0.85rem; font-weight:700; margin-bottom:8px;">

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

      ${buildItemBlockHtml('A', itemA)}

      <div style="background: var(--bg-dark); padding: 12px; border-radius: 8px; margin-bottom: 16px; border: 1px solid var(--border-color);">
        <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 6px;">NATURA</label>
        <select onchange="window.updateNature('A', this.value)" style="width:100%; background:var(--panel-bg); border:1px solid var(--border-color); color:#fff; padding:8px; border-radius:6px; font-size:0.85rem; font-weight:700;">
          ${buildNatureOptionsHtml(natureA)}
        </select>
      </div>

      ${buildStageAdjustorHtml('A', statStagesA, selfBoostsA)}

      <div style="display: flex; gap: 14px; margin-bottom: 12px; font-size: 0.75rem; color: var(--text-muted);">
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
          <input type="checkbox" ${isBurnedA ? 'checked' : ''} onchange="window.updateBurnA(this.checked)"> 🔥 Bruciato (dimezza danno Fisico)
        </label>
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
          <input type="checkbox" ${isCritA ? 'checked' : ''} onchange="window.updateCritA(this.checked)"> ✨ Colpo critico (×1.5)
        </label>
      </div>

      <div style="font-size: 0.75rem; font-weight: 700; color: var(--accent); margin-bottom: 8px;">STATISTICHE (BASE + EV 0-32 + NATURA + FASI)</div>
      <div>${statsHtml}</div>
    `;

    const selectEl = document.getElementById('select-move-a');
    if (selectEl) {
    window.updateMoveSelectionInfo(selectEl);
    window.initMoveSearch(movesDetailed);
}
    window.updateItemSelection('A', itemA);
    window.initItemSearch('A');
  }

  function renderPokemonB() {
    const container = document.getElementById('content-b');
    if (!container || !pokemonB) return;

    const statsHtml = pokemonB.stats.map(s => {
      const statKey = s.stat.name;
      const baseVal = s.base_stat;
      const bonusEV = statsBonusB[statKey] || 0;
      const totalVal = effectiveStatValue(baseVal, bonusEV, statKey, natureB, statStagesB[statKey]);

      return `
        <div style="display: grid; grid-template-columns: 80px 50px 1fr 100px; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 0.8rem;">
          <span style="color: var(--text-muted);">${STAT_NAMES_ITA[statKey] || statKey}</span>
          <span style="font-weight: 700;">${totalVal}</span>
          <div style="background: var(--bg-dark); height: 6px; border-radius: 3px; overflow: hidden;">
            <div style="width: ${Math.min(100, (totalVal / 300) * 100)}%; height: 100%; background: var(--violet);"></div>
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            <label style="font-size: 0.7rem; color: var(--text-muted);">EV:</label>
            <input type="number" min="0" max="32" value="${bonusEV}" onchange="window.updateEV('B', '${statKey}', this.value)" style="width: 45px; background: var(--bg-dark); border: 1px solid var(--border-color); color: #fff; text-align: center; border-radius: 4px; padding: 2px;">
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
        <img src="${pokemonB.image}" style="width: 80px; height: 80px; object-fit: contain;">
        <div>
          <h3 style="font-size: 1.2rem; font-weight: 800; color: #fff;">${pokemonB.name}</h3>
          <div>${pokemonB.types.map(t => `<span style="background: var(--border-color); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-right: 4px;">${(TYPE_NAMES_ITA[t] || t).toUpperCase()}</span>`).join('')}</div>
        </div>
      </div>

      ${buildItemBlockHtml('B', itemB)}

      <div style="background: var(--bg-dark); padding: 12px; border-radius: 8px; margin-bottom: 16px; border: 1px solid var(--border-color);">
        <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 6px;">NATURA</label>
        <select onchange="window.updateNature('B', this.value)" style="width:100%; background:var(--panel-bg); border:1px solid var(--border-color); color:#fff; padding:8px; border-radius:6px; font-size:0.85rem; font-weight:700;">
          ${buildNatureOptionsHtml(natureB)}
        </select>
      </div>

      ${buildStageAdjustorHtml('B', statStagesB, selfBoostsB)}

      <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; font-size: 0.72rem; color: var(--text-muted);">
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
          <input type="checkbox" ${screensB.reflect ? 'checked' : ''} onchange="window.updateScreenB('reflect', this.checked)"> 🛡️ Riflesso
        </label>
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
          <input type="checkbox" ${screensB.lightscreen ? 'checked' : ''} onchange="window.updateScreenB('lightscreen', this.checked)"> 🛡️ Schermoluce
        </label>
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
          <input type="checkbox" ${screensB.auroraveil ? 'checked' : ''} onchange="window.updateScreenB('auroraveil', this.checked)"> 🛡️ Velo Aurora
        </label>
      </div>

      <div style="font-size: 0.75rem; font-weight: 700; color: var(--violet); margin-bottom: 8px;">STATISTICHE (BASE + EV 0-32 + NATURA + FASI)</div>
      <div>${statsHtml}</div>
    `;

    window.updateItemSelection('B', itemB);
    window.initItemSearch('B');
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
            item.style.borderBottom = "1px solid var(--border-color)";
            item.style.color = "var(--accent)";

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
