/**
 * Calcolo_Danni_2v2.js
 * Modalita' 2vs2 (Doppio) del Calcolo Danni, stile turno VGC: i 2 riquadri alleati sono box
 * "attaccante" (Pokemon + oggetto + natura + mossa + bersaglio + fasi statistiche + EV), i 2
 * riquadri avversari sono box "bersaglio" (stessi dati tranne mossa/bersaglio). Un solo click
 * su "Calcola Danno" risolve entrambe le azioni alleate in ordine di Velocita' (come in una
 * lotta doppia reale), applica le mosse che alzano le statistiche (tabella curata in
 * shared-data.js) e mostra un riepilogo di turno con barra HP animata per ogni avversario
 * colpito. Riusa i dati condivisi (shared-data.js) e la stessa matematica/effetti oggetto del
 * calcolo 1vs1 (window.CalcDanniEngine) - qui c'e' solo l'interfaccia e la logica di turno.
 */

(function () {
  'use strict';

  const TYPE_NAMES_ITA = window.SharedData.TYPE_NAMES_ITA;
  const STAT_NAMES_ITA = {
    'hp': 'PS', 'attack': 'Attacco', 'defense': 'Difesa',
    'special-attack': 'Sp. Atk', 'special-defense': 'Sp. Def', 'speed': 'Velocità'
  };
  const STAT_KEYS = ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'];
  const STAGE_STAT_KEYS = ['attack', 'defense', 'special-attack', 'special-defense', 'speed'];

  const SLOT_META = {
    ally1: { label: 'Alleato 1', side: 'ally', color: 'var(--accent)' },
    ally2: { label: 'Alleato 2', side: 'ally', color: 'var(--accent)' },
    opp1: { label: 'Avversario 1', side: 'opp', color: 'var(--violet)' },
    opp2: { label: 'Avversario 2', side: 'opp', color: 'var(--violet)' }
  };

  // Priorità di turno delle mosse più comuni (valore di gioco fisso, non dipende dal Pokémon).
  // Non è un elenco esaustivo di tutte le mosse a priorità esistenti, solo le più diffuse in
  // VGC — verificate una per una contro pokemon-moves.json per non confondere nomi simili
  // (es. Fintoattacco/Fake Out e Anticipo/Feint hanno le stesse statistiche in italiano).
  const MOVE_PRIORITY = {
    'Altruismo': 5,     // Helping Hand
    'Protezione': 4,    // Protect
    'Individua': 4,     // Detect
    'Fintoattacco': 3,  // Fake Out
    'Extrarapido': 2,   // Extreme Speed
    'Pugnorapido': 1,   // Mach Punch
    'Pugnoscarica': 1,  // Bullet Punch
    'Geloscheggia': 1,  // Ice Shard
    'Acquagetto': 1,    // Aqua Jet
    'Furtivombra': 1,   // Shadow Sneak
    'Vuotonda': 1,      // Vacuum Wave
    'Sbigoattacco': 1,  // Sucker Punch
    'Attacco Rapido': 1, // Quick Attack
    'Rocciarapida': 1   // Accelerock
  };

  let slots = { ally1: null, ally2: null, opp1: null, opp2: null };
  let pickerTargetSlot = null;
  let selectedPickerTypes = [];
  let dexList = [];
  let initialized = false;

  // Condizioni di campo: meteo/terreno sono globali (influenzano entrambi i lati), gli schermi
  // sono per lato (chi li ha piazzati protegge se stesso), bruciatura/critico sono per singolo
  // Pokemon alleato (salvati sullo slot stesso, vedi assignSlot) dato che sono uno stato del
  // singolo attaccante, non del campo.
  let fieldWeather = '';
  let fieldTerrain = '';
  let screensOpp = { reflect: false, lightscreen: false, auroraveil: false };

  function emptyEvs() {
    return { hp: 0, attack: 0, defense: 0, 'special-attack': 0, 'special-defense': 0, speed: 0 };
  }
  function emptyStages() {
    return { attack: 0, defense: 0, 'special-attack': 0, 'special-defense': 0, speed: 0 };
  }
  function clampStage(v) {
    return Math.max(-6, Math.min(6, v));
  }
  function otherAllyKey(key) {
    return key === 'ally1' ? 'ally2' : 'ally1';
  }
  function clampPct(v) {
    return Math.max(0, Math.min(100, v));
  }
  function colorForPercent(p) {
    return p <= 20 ? '#ef4444' : (p <= 50 ? '#f97316' : '#84cc16');
  }

  // Statistica finale: base + offset + EV, poi Natura (window.SharedData.computeStatTotal),
  // poi moltiplicatore di fase (mai su PS).
  function baseStatTotal(slot, statKey) {
    const statObj = slot.stats.find(s => s.stat.name === statKey);
    const base = statObj ? statObj.base_stat : 1;
    return window.SharedData.computeStatTotal(base, slot.evs[statKey] || 0, statKey, slot.nature);
  }
  function stageMultiplier(stage) {
    return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
  }
  function effectiveStat(slot, statKey) {
    const raw = baseStatTotal(slot, statKey);
    if (statKey === 'hp') return raw;
    const stage = (slot.statStages && slot.statStages[statKey]) || 0;
    return Math.floor(raw * stageMultiplier(stage));
  }

  // ===============================
  // Layout
  // ===============================
  function initLayout() {
    const container = document.getElementById('calc-2v2-view');
    if (!container || initialized) return;
    initialized = true;

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px;">
        <div id="slot-card-ally1"></div>
        <div id="slot-card-ally2"></div>
        <div id="slot-card-opp1"></div>
        <div id="slot-card-opp2"></div>
      </div>

      <div style="background-image: var(--glass-sheen); background-color: rgba(18,24,36,0.45); backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); box-shadow: 0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 var(--glass-highlight); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-lg); padding: 20px; margin-bottom: 24px;">
        <h3 style="color: #fff; margin-bottom: 14px; text-align: center;">Calcola Danno</h3>
        <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:16px; margin-bottom:14px;">
          <label style="font-size:0.75rem; color:var(--text-muted); display:flex; align-items:center; gap:6px; cursor:pointer;">
            <input type="checkbox" id="dv-tailwind-ally" onchange="window.Calc2v2.updateTailwindAlly()"> 💨 Ventoincoda attivo lato Alleati (raddoppia la Velocità)
          </label>
          <label style="font-size:0.75rem; color:var(--text-muted); display:flex; align-items:center; gap:6px; cursor:pointer;">
            <input type="checkbox" id="dv-tailwind-opp" onchange="window.Calc2v2.updateTailwindOpp()"> 💨 Ventoincoda attivo lato Avversari (raddoppia la Velocità)
          </label>
        </div>
        <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:16px; margin-bottom:14px;">
          <label style="font-size:0.72rem; color:var(--text-muted); font-weight:700; display:flex; align-items:center; gap:6px;">METEO
            <select id="dv-field-weather" onchange="window.Calc2v2.updateFieldWeather(this.value)" style="background:var(--bg-dark); border:1px solid var(--border-color); color:#fff; padding:5px; border-radius:6px; font-size:0.72rem;">
              <option value="">Nessuno</option>
              <option value="rain">Pioggia</option>
              <option value="sun">Sole</option>
            </select>
          </label>
          <label style="font-size:0.72rem; color:var(--text-muted); font-weight:700; display:flex; align-items:center; gap:6px;">TERRENO
            <select id="dv-field-terrain" onchange="window.Calc2v2.updateFieldTerrain(this.value)" style="background:var(--bg-dark); border:1px solid var(--border-color); color:#fff; padding:5px; border-radius:6px; font-size:0.72rem;">
              <option value="">Nessuno</option>
              <option value="grassy">Erboso</option>
              <option value="electric">Elettrico</option>
              <option value="psychic">Psichico</option>
              <option value="misty">Fatato</option>
            </select>
          </label>
        </div>
        <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:14px; margin-bottom:14px; font-size:0.72rem; color:var(--text-muted);">
          <span style="font-weight:700;">SCHERMI LATO AVVERSARI:</span>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" onchange="window.Calc2v2.updateScreenOpp('reflect', this.checked)"> 🛡️ Riflesso</label>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" onchange="window.Calc2v2.updateScreenOpp('lightscreen', this.checked)"> 🛡️ Schermoluce</label>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" onchange="window.Calc2v2.updateScreenOpp('auroraveil', this.checked)"> 🛡️ Velo Aurora</label>
        </div>
        <button id="dv-calculate-btn" onclick="window.Calc2v2.calculate()" style="width: 100%; padding: 12px; background: linear-gradient(135deg, var(--accent), #0284c7); border: none; border-radius: 8px; color: #04202e; font-weight: 800; font-size: 1rem; cursor: pointer;">⚡ CALCOLA DANNO</button>
      </div>
    `;

    Object.keys(SLOT_META).forEach(renderSlotCard);
    injectPickerModal();
  }

  function injectPickerModal() {
    if (document.getElementById('dv2v2-picker-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'dv2v2-picker-overlay';
    overlay.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(5,8,15,0.75); backdrop-filter: blur(4px); align-items:center; justify-content:center; z-index:10001; padding:20px;';
    overlay.innerHTML = `
      <div style="background: var(--panel-bg); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 20px; width:100%; max-width:640px; max-height:80vh; overflow-y:auto; position:relative;">
        <button onclick="window.Calc2v2.closePicker()" style="position:absolute; top:12px; right:12px; background:var(--bg-dark); border:1px solid var(--border-color); color:#fff; width:28px; height:28px; border-radius:50%; cursor:pointer;">✕</button>
        <div style="margin-bottom:12px; margin-right:36px;">
          <input type="text" id="dv2v2-picker-search" placeholder="🔍 Cerca Pokémon per nome o numero..." style="width:100%; background:var(--bg-dark); border:1px solid var(--border-color); border-radius:8px; padding:10px; color:#fff;">
        </div>
        <div id="dv2v2-picker-types" style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:14px;"></div>
        <div id="dv2v2-picker-grid" style="display:grid; grid-template-columns:repeat(auto-fill,minmax(90px,1fr)); gap:10px;"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('dv2v2-picker-search').addEventListener('input', renderPickerGrid);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closePicker(); });
  }

  // ===============================
  // Card di uno slot
  // ===============================
  function buildItemOptionsHtml(selectedSlug) {
    const groups = { damage: [], defense: [], utility: [], other: [] };
    window.SharedData.ITEM_SLUGS.forEach(s => {
      const cat = window.SharedData.getItemCategory(s);
      (groups[cat] || groups.other).push(s);
    });
    const labels = window.SharedData.ITEM_CATEGORY_LABELS;
    return ['damage', 'defense', 'utility', 'other'].map(cat => {
      if (!groups[cat].length) return '';
      const opts = groups[cat].map(s =>
        `<option value="${s}" ${s === selectedSlug ? 'selected' : ''}>${window.SharedData.getItemName(s)}</option>`
      ).join('');
      return `<optgroup label="${labels[cat]}">${opts}</optgroup>`;
    }).join('');
  }

  function buildNatureOptionsHtml(selectedNature) {
    return Object.keys(window.SharedData.NATURES).map(n =>
      `<option value="${n}" ${n === selectedNature ? 'selected' : ''}>${n}</option>`
    ).join('');
  }

  function buildAbilityOptionsHtml(slot) {
    if (!slot.abilitiesAvailable || !slot.abilitiesAvailable.length) return `<option value="">— Nessuna abilità nota —</option>`;
    return slot.abilitiesAvailable.map(a =>
      `<option value="${a.slug}" ${a.slug === slot.abilitySlug ? 'selected' : ''}>${a.displayName}${a.isHidden ? ' (Nascosta)' : ''}</option>`
    ).join('');
  }

  // Mosse raggruppate per tipo (stesso schema già usato nel Calcolo Danni 1v1 e nella
  // Squadra VGC), invece dell'elenco piatto in ordine alfabetico di prima.
  function buildMoveOptionsHtml(slot) {
    const moves = window.SharedData.getPokemonMoves(slot.name);
    if (!moves.length) return `<option value="">Nessuna mossa nel DB</option>`;

    const groupedMoves = {};
    moves.forEach(m => {
      if (!groupedMoves[m.type]) groupedMoves[m.type] = [];
      groupedMoves[m.type].push(m);
    });

    let optionsHtml = '';
    for (const [typeKey, movesGroup] of Object.entries(groupedMoves)) {
      const typeLabelITA = typeKey.toUpperCase();
      optionsHtml += `<optgroup label="TIPO ${typeLabelITA}">`;
      movesGroup.forEach(m => {
        optionsHtml += `<option value="${m.name}" ${m.name === slot.selectedMove ? 'selected' : ''}>[${typeLabelITA}] ${m.name} (${m.category})</option>`;
      });
      optionsHtml += `</optgroup>`;
    }
    return `<option value="">— scegli mossa —</option>` + optionsHtml;
  }

  function moveCategoryOf(move) {
    return move.category === 'Fisico' ? 'physical' : (move.category === 'Speciale' ? 'special' : 'status');
  }

  function buildTargetBlockHtml(key, slot) {
    if (!slot.selectedMove) {
      return `<div style="font-size:0.68rem; color:var(--text-muted); margin-bottom:10px;">Scegli prima una mossa</div>`;
    }
    const moves = window.SharedData.getPokemonMoves(slot.name);
    const move = moves.find(m => m.name === slot.selectedMove);
    if (!move) return '';
    if (moveCategoryOf(move) === 'status') {
      return `<div style="font-size:0.68rem; color:var(--violet); margin-bottom:10px;">🛡️ Mossa di supporto — nessun bersaglio avversario necessario</div>`;
    }
    const moveTargetCategory = window.SharedData.getMoveTarget(slot.selectedMove);
    const isSpread = moveTargetCategory === 'all-opponents' || moveTargetCategory === 'all-other-pokemon' || moveTargetCategory === 'all-pokemon';
    if (isSpread) {
      return `<div style="font-size:0.68rem; color:#38bdf8; margin-bottom:10px;">🌀 Colpisce entrambi gli avversari</div>`;
    }
    const oppKeys = ['opp1', 'opp2'].filter(k => slots[k]);
    const optsHtml = oppKeys.length
      ? `<option value="">— scegli bersaglio —</option>` + oppKeys.map(k =>
          `<option value="${k}" ${k === slot.selectedTarget ? 'selected' : ''}>${SLOT_META[k].label}: ${slots[k].name}</option>`
        ).join('')
      : `<option value="">Nessun avversario disponibile</option>`;
    return `
      <label style="font-size:0.68rem; color:var(--text-muted); font-weight:700; display:block; margin-bottom:10px;">Bersaglio
        <select onchange="window.Calc2v2.onSlotTargetChange('${key}', this.value)" style="width:100%; margin-top:4px; background:var(--bg-dark); border:1px solid var(--border-color); color:#fff; padding:6px; border-radius:6px; font-size:0.72rem;">
          ${optsHtml}
        </select>
      </label>
    `;
  }

  // Descrive gli effetti di una mossa potenziante (es. "+1 Attacco, +1 Velocità") riusando le
  // stesse etichette di STAT_NAMES_ITA e lo stesso segno mostrato dai giochi.
  function describeBoostChanges(changes) {
    return changes.map(c => `${c.stages > 0 ? '+' : ''}${c.stages} ${STAT_NAMES_ITA[c.stat] || c.stat}`).join(', ');
  }

  // Un checkbox per mossa potenziante (Danzaspada, Dragodanza, ecc.) invece dei pulsanti +/- a
  // fase singola, più intuitivo — stessa tabella già usata per l'applicazione automatica delle
  // mosse alleate (window.SharedData.STAT_BOOST_MOVES, solo le mosse target:'self': quelle che
  // buffano l'alleato di squadra, es. Coaching, restano gestite dal menu "Mossa" già esistente).
  function buildStageAdjustorHtml(key, slot) {
    const boostRows = Object.entries(window.SharedData.STAT_BOOST_MOVES)
      .filter(([, boost]) => boost.target === 'self')
      .map(([name, boost]) => `
        <label style="display:flex; align-items:center; gap:5px; font-size:0.66rem; cursor:pointer;">
          <input type="checkbox" ${slot.selfBoosts[name] ? 'checked' : ''} onchange="window.Calc2v2.toggleSelfBoost('${key}', '${name}', this.checked)">
          <span>${name}</span>
          <span style="color:var(--text-muted); font-size:0.58rem;">(${describeBoostChanges(boost.changes)})</span>
        </label>
      `).join('');

    const summaryRows = STAGE_STAT_KEYS
      .filter(k => slot.statStages[k])
      .map(k => {
        const v = slot.statStages[k];
        const color = v > 0 ? 'var(--lime)' : '#ef4444';
        return `<span style="color:${color}; font-weight:800;">${STAT_NAMES_ITA[k]} ${v > 0 ? '+' + v : v}</span>`;
      });
    const summaryHtml = summaryRows.length
      ? `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; padding-top:6px; border-top:1px solid var(--border-color); font-size:0.64rem;">${summaryRows.join('')}</div>`
      : '';

    return `
      <div style="margin-bottom:10px;">
        <div style="font-size:0.62rem; font-weight:800; color:var(--text-muted); margin-bottom:4px; letter-spacing:0.4px;">MOSSE POTENZIANTI GIÀ USATE</div>
        <div style="display:flex; flex-direction:column; gap:4px;">${boostRows}</div>
        ${summaryHtml}
      </div>
    `;
  }

  function renderSlotCard(key) {
    const el = document.getElementById(`slot-card-${key}`);
    if (!el) return;
    const meta = SLOT_META[key];
    const slot = slots[key];
    const isAlly = meta.side === 'ally';

    if (!slot) {
      el.innerHTML = `
        <button onclick="window.Calc2v2.openPicker('${key}')" style="width:100%; height:100%; min-height:160px; background: rgba(24,32,48,0.4); border: 2px dashed var(--border-color); border-radius: var(--radius-lg); color: var(--text-muted); cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px;">
          <span style="font-size:0.7rem; font-weight:800; letter-spacing:0.5px; color:${meta.color};">${meta.label.toUpperCase()}</span>
          <span style="font-size:1.8rem; font-weight:800;">+</span>
          <span style="font-size:0.8rem;">Aggiungi Pokémon</span>
        </button>
      `;
      return;
    }

    const typesHtml = slot.types.map(t => `<span style="background: var(--border-color); padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; margin-right: 4px;">${(TYPE_NAMES_ITA[t] || t).toUpperCase()}</span>`).join('');
    // Ventoincoda raddoppia la Velocità solo del lato che lo ha attivo: la Velocità mostrata
    // in scheda riflette il checkbox del proprio lato (alleati/avversari), letto dal DOM come
    // gia' fa window.Calc2v2.calculate() per l'ordine di turno degli alleati.
    const tailwindActiveForSide = document.getElementById(isAlly ? 'dv-tailwind-ally' : 'dv-tailwind-opp')?.checked || false;
    const evRowsHtml = STAT_KEYS.map(k => {
      const displayVal = (k === 'speed' && tailwindActiveForSide) ? effectiveStat(slot, k) * 2 : effectiveStat(slot, k);
      return `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; font-size:0.68rem;">
        <span style="color:var(--text-muted);">${STAT_NAMES_ITA[k]}</span>
        <span style="font-weight:700;">${displayVal}</span>
        <input type="number" min="0" max="32" value="${slot.evs[k]}" onchange="window.Calc2v2.updateEv('${key}', '${k}', this.value)" style="width:38px; background:var(--bg-dark); border:1px solid var(--border-color); color:#fff; text-align:center; border-radius:4px; padding:2px; font-size:0.68rem;">
      </div>
    `;
    }).join('');

    el.innerHTML = `
      <div style="background-image: var(--glass-sheen); background-color: rgba(24,32,48,0.45); backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); box-shadow: 0 8px 20px rgba(0,0,0,0.3), inset 0 1px 0 var(--glass-highlight); border: 1px solid ${meta.color}; border-radius: var(--radius-lg); padding: 14px; position:relative;">
        <button onclick="window.Calc2v2.clearSlot('${key}')" title="Rimuovi" style="position:absolute; top:8px; right:8px; background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:0.85rem;">✕</button>
        <div style="font-size:0.65rem; font-weight:800; letter-spacing:0.5px; color:${meta.color}; margin-bottom:6px;">${meta.label.toUpperCase()}</div>
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
          <img src="${slot.image}" style="width:52px; height:52px; object-fit:contain;" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${slot.id}.png'">
          <div>
            <div style="font-weight:800; font-size:0.9rem;">${slot.name}</div>
            <div>${typesHtml}</div>
          </div>
        </div>
        <input
            type="text"
            id="item-search-${key}"
            placeholder="🔍 Cerca un oggetto..."
            style="width:100%; background:var(--bg-dark); color:white; border:1px solid var(--border-color); padding:6px; border-radius:6px; font-size:0.72rem; margin-bottom:6px;">
        <div id="item-search-results-${key}" style="display:none; max-height:160px; overflow-y:auto; margin-bottom:8px; background:var(--bg-dark); border:1px solid var(--border-color); border-radius:6px;"></div>
        <select id="select-item-${key}" onchange="window.Calc2v2.updateItem('${key}', this.value)" style="width:100%; margin-bottom:8px; background:var(--bg-dark); border:1px solid var(--border-color); color:var(--violet); padding:6px; border-radius:6px; font-size:0.75rem;">
          <option value="">— Nessun oggetto —</option>
          ${buildItemOptionsHtml(slot.item)}
        </select>
        <label style="font-size:0.62rem; color:var(--text-muted); font-weight:700; display:block; margin-bottom:8px;">Natura
          <select onchange="window.Calc2v2.updateNature('${key}', this.value)" style="width:100%; margin-top:4px; background:var(--bg-dark); border:1px solid var(--border-color); color:#fff; padding:6px; border-radius:6px; font-size:0.72rem;">
            ${buildNatureOptionsHtml(slot.nature)}
          </select>
        </label>
        <label style="font-size:0.62rem; color:var(--text-muted); font-weight:700; display:block; margin-bottom:8px;">Abilità
          <select onchange="window.Calc2v2.updateAbility('${key}', this.value)" style="width:100%; margin-top:4px; background:var(--bg-dark); border:1px solid var(--border-color); color:#fff; padding:6px; border-radius:6px; font-size:0.72rem;">
            ${buildAbilityOptionsHtml(slot)}
          </select>
        </label>
        ${isAlly ? `
        <label style="font-size:0.62rem; color:var(--text-muted); font-weight:700; display:block; margin-bottom:8px;">Mossa
          <select onchange="window.Calc2v2.onSlotMoveChange('${key}', this.value)" style="width:100%; margin-top:4px; background:var(--bg-dark); border:1px solid var(--border-color); color:#fff; padding:6px; border-radius:6px; font-size:0.72rem;">
            ${buildMoveOptionsHtml(slot)}
          </select>
        </label>
        ${buildTargetBlockHtml(key, slot)}
        <div style="display:flex; gap:10px; margin-bottom:8px; font-size:0.62rem; color:var(--text-muted);">
          <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" ${slot.isBurned ? 'checked' : ''} onchange="window.Calc2v2.updateBurn('${key}', this.checked)"> 🔥 Bruciato</label>
          <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" ${slot.isCrit ? 'checked' : ''} onchange="window.Calc2v2.updateCrit('${key}', this.checked)"> ✨ Critico</label>
        </div>
        ` : ''}
        ${buildStageAdjustorHtml(key, slot)}
        <div style="display:flex; flex-direction:column; gap:3px;">${evRowsHtml}</div>
      </div>
    `;
    initItemSearch(key);
  }

  function initItemSearch(key) {
    const input = document.getElementById(`item-search-${key}`);
    const results = document.getElementById(`item-search-results-${key}`);
    const select = document.getElementById(`select-item-${key}`);
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
        const catLabel = window.SharedData.ITEM_CATEGORY_LABELS[window.SharedData.getItemCategory(slug)];
        const item = document.createElement('div');
        item.innerHTML = `${name} <span style="float:right; font-size:0.6rem; color:var(--text-muted);">${catLabel}</span>`;
        item.style.padding = '8px';
        item.style.cursor = 'pointer';
        item.style.borderBottom = '1px solid var(--border-color)';
        item.style.color = 'var(--violet)';
        item.style.fontSize = '0.75rem';
        item.onmouseenter = () => { item.style.background = '#1e293b'; };
        item.onmouseleave = () => { item.style.background = ''; };
        item.onclick = () => {
          select.value = slug;
          window.Calc2v2.updateItem(key, slug);
          input.value = '';
          results.style.display = 'none';
        };
        results.appendChild(item);
      });
    };
  }

  // ===============================
  // Picker Pokémon (autonomo, come team-builder/1vs1)
  // ===============================
  window.Calc2v2 = window.Calc2v2 || {};

  window.Calc2v2.openPicker = function (slotKey) {
    pickerTargetSlot = slotKey;
    dexList = window.SharedData.getDex();
    document.getElementById('dv2v2-picker-overlay').style.display = 'flex';
    document.getElementById('dv2v2-picker-search').value = '';
    renderPickerTypes();
    renderPickerGrid();
  };

  function closePicker() {
    document.getElementById('dv2v2-picker-overlay').style.display = 'none';
    pickerTargetSlot = null;
  }
  window.Calc2v2.closePicker = closePicker;

  function renderPickerTypes() {
    const container = document.getElementById('dv2v2-picker-types');
    if (!container) return;
    container.innerHTML = window.SharedData.TYPES_CONFIG.map(t => `
      <button onclick="window.Calc2v2.togglePickerType('${t.id}')" style="background: ${selectedPickerTypes.includes(t.id) ? `var(--type-${t.id})` : 'var(--bg-dark)'}; border:1px solid var(--border-color); color:${selectedPickerTypes.includes(t.id) ? '#000' : '#fff'}; padding:5px 10px; border-radius:6px; font-size:0.7rem; cursor:pointer; font-weight:${selectedPickerTypes.includes(t.id) ? '800' : '400'};">${t.name}</button>
    `).join('');
  }
  window.Calc2v2.togglePickerType = function (id) {
    if (selectedPickerTypes.includes(id)) selectedPickerTypes = selectedPickerTypes.filter(x => x !== id);
    else if (selectedPickerTypes.length < 2) selectedPickerTypes.push(id);
    renderPickerTypes();
    renderPickerGrid();
  };

  function renderPickerGrid() {
    const container = document.getElementById('dv2v2-picker-grid');
    if (!container) return;
    const query = (document.getElementById('dv2v2-picker-search')?.value || '').toLowerCase().trim();

    if (!dexList.length) {
      container.innerHTML = `<p style="color: var(--text-muted); font-size:0.85rem;">Caricamento Pokédex in corso...</p>`;
      return;
    }

    const filtered = dexList.filter(p => {
      const matchesQuery = !query || p.name.toLowerCase().includes(query) || String(p.id).includes(query);
      const matchesTypes = selectedPickerTypes.length === 0 || selectedPickerTypes.every(t => p.types && p.types.includes(t));
      return matchesQuery && matchesTypes;
    }).slice(0, 60);

    container.innerHTML = filtered.map(p => `
      <button onclick="window.Calc2v2.assignSlot(${p.id})" style="background: rgba(24,32,48,0.85); border:1px solid var(--border-color); border-radius:10px; padding:8px; display:flex; flex-direction:column; align-items:center; cursor:pointer; color:#fff;">
        <img src="${p.image}" alt="${p.name}" style="width:48px; height:48px; object-fit:contain;" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png'">
        <span style="font-size:0.7rem; margin-top:4px; text-align:center;">${p.name}</span>
      </button>
    `).join('') || `<p style="color: var(--text-muted); font-size:0.85rem;">Nessun Pokémon trovato.</p>`;
  }

  window.Calc2v2.assignSlot = async function (id) {
    const key = pickerTargetSlot;
    closePicker();
    if (!key) return;
    try {
      const data = await window.SharedData.getSpeciesDetail(id);

      // Stesso schema di risoluzione abilità già usato nella Squadra VGC (team-builder.js):
      // nome italiano ufficiale via PokeAPI, con fallback al nome inglese se la traduzione
      // fallisce. Serve sia da mostrare in scheda sia per effetti come Burla (vedi calculate()).
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

      slots[key] = {
        id: data.id,
        name: data.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        image: data.sprites.other['official-artwork'].front_default || data.sprites.front_default,
        types: data.types.map(t => t.type.name),
        stats: data.stats,
        abilitiesAvailable: abilitiesResolved,
        abilitySlug: abilitiesResolved[0] ? abilitiesResolved[0].slug : '',
        abilityDisplayName: abilitiesResolved[0] ? abilitiesResolved[0].displayName : '',
        item: '',
        evs: emptyEvs(),
        nature: 'Ardita',
        statStages: emptyStages(),
        selfBoosts: {},
        selectedMove: '',
        selectedTarget: '',
        appliedBoost: null,
        isBurned: false,
        isCrit: false
      };
      renderSlotCard(key);
    } catch (e) {
      console.error('Errore assegnazione slot 2vs2:', e);
    }
  };

  window.Calc2v2.clearSlot = function (key) {
    const slot = slots[key];
    if (slot && slot.appliedBoost) {
      const t = slots[slot.appliedBoost.targetKey];
      if (t) {
        slot.appliedBoost.changes.forEach(c => {
          t.statStages[c.stat] = clampStage(t.statStages[c.stat] - c.stages);
        });
      }
    }
    // Se un'altra mossa alleata aveva applicato un boost proprio su questo slot, la voce
    // diventa non piu' valida insieme allo slot: la annulliamo per evitare riferimenti stantii.
    Object.keys(slots).forEach(k => {
      if (slots[k] && slots[k].appliedBoost && slots[k].appliedBoost.targetKey === key) {
        slots[k].appliedBoost = null;
      }
    });
    slots[key] = null;
    renderSlotCard(key);
    if (SLOT_META[key].side === 'ally') renderSlotCard(otherAllyKey(key));
  };

  window.Calc2v2.updateItem = function (key, slug) {
    if (slots[key]) slots[key].item = slug;
  };

  window.Calc2v2.updateNature = function (key, natureKey) {
    if (!slots[key]) return;
    slots[key].nature = natureKey;
    renderSlotCard(key);
  };

  window.Calc2v2.updateAbility = function (key, slug) {
    const slot = slots[key];
    if (!slot) return;
    const found = (slot.abilitiesAvailable || []).find(a => a.slug === slug);
    slot.abilitySlug = slug;
    slot.abilityDisplayName = found ? found.displayName : slug;
    renderSlotCard(key);
  };

  window.Calc2v2.toggleSelfBoost = function (key, moveName, checked) {
    const slot = slots[key];
    const boost = window.SharedData.STAT_BOOST_MOVES[moveName];
    if (!slot || !boost || boost.target !== 'self') return;
    slot.selfBoosts[moveName] = checked;
    const sign = checked ? 1 : -1;
    boost.changes.forEach(c => {
      slot.statStages[c.stat] = clampStage((slot.statStages[c.stat] || 0) + sign * c.stages);
    });
    renderSlotCard(key);
  };

  window.Calc2v2.updateFieldWeather = function (value) { fieldWeather = value; };
  window.Calc2v2.updateFieldTerrain = function (value) { fieldTerrain = value; };
  window.Calc2v2.updateScreenOpp = function (key, checked) { screensOpp[key] = checked; };

  // Ridisegna solo le schede del lato interessato, cosi' la Velocità mostrata si aggiorna
  // subito quando si spunta/toglie Ventoincoda, senza dover ricalcolare il danno.
  window.Calc2v2.updateTailwindAlly = function () { ['ally1', 'ally2'].forEach(k => { if (slots[k]) renderSlotCard(k); }); };
  window.Calc2v2.updateTailwindOpp = function () { ['opp1', 'opp2'].forEach(k => { if (slots[k]) renderSlotCard(k); }); };

  window.Calc2v2.updateBurn = function (key, checked) {
    if (slots[key]) slots[key].isBurned = checked;
  };
  window.Calc2v2.updateCrit = function (key, checked) {
    if (slots[key]) slots[key].isCrit = checked;
  };

  window.Calc2v2.updateEv = function (key, statKey, value) {
    let v = parseInt(value, 10);
    if (isNaN(v) || v < 0) v = 0;
    if (v > 32) v = 32;
    if (slots[key]) {
      slots[key].evs[statKey] = v;
      renderSlotCard(key);
    }
  };

  // ===============================
  // Mossa / bersaglio per box alleato
  // ===============================
  window.Calc2v2.onSlotMoveChange = function (key, moveName) {
    const slot = slots[key];
    if (!slot) return;

    // Annulla l'eventuale boost applicato dalla mossa selezionata in precedenza in questo box,
    // cosi' cambiare mossa (o tornare alla stessa) non accumula bonus non voluti.
    const prevTargetKey = slot.appliedBoost ? slot.appliedBoost.targetKey : null;
    if (slot.appliedBoost) {
      const prevTarget = slots[prevTargetKey];
      if (prevTarget) {
        slot.appliedBoost.changes.forEach(c => {
          prevTarget.statStages[c.stat] = clampStage(prevTarget.statStages[c.stat] - c.stages);
        });
      }
      slot.appliedBoost = null;
    }

    slot.selectedMove = moveName;
    slot.selectedTarget = '';

    const boost = window.SharedData.STAT_BOOST_MOVES[moveName];
    let boostTargetKey = null;
    if (boost) {
      boostTargetKey = boost.target === 'ally' ? otherAllyKey(key) : key;
      if (slots[boostTargetKey]) {
        boost.changes.forEach(c => {
          slots[boostTargetKey].statStages[c.stat] = clampStage(slots[boostTargetKey].statStages[c.stat] + c.stages);
        });
        slot.appliedBoost = { targetKey: boostTargetKey, changes: boost.changes };
      }
    }

    renderSlotCard(key);
    // Ri-renderizza qualunque altro box i cui dati sono cambiati: il nuovo bersaglio del boost
    // e/o il bersaglio del boost precedente appena annullato (potrebbero essere lo stesso box,
    // uno dei due, o nessuno - un Set evita di renderizzare due volte lo stesso box).
    const keysToRefresh = new Set();
    if (boostTargetKey && boostTargetKey !== key) keysToRefresh.add(boostTargetKey);
    if (prevTargetKey && prevTargetKey !== key) keysToRefresh.add(prevTargetKey);
    keysToRefresh.forEach(k => { if (slots[k]) renderSlotCard(k); });
  };

  window.Calc2v2.onSlotTargetChange = function (key, targetValue) {
    if (slots[key]) slots[key].selectedTarget = targetValue;
  };

  // ===============================
  // Calcolo di un singolo colpo (riusa window.CalcDanniEngine, come nella versione precedente)
  // ===============================
  function computeSingleHit(action, oppKey, spreadMult, category, hpBeforeHit) {
    const attacker = action.slot;
    const defender = slots[oppKey];
    const engine = window.CalcDanniEngine;
    const moveType = engine.TYPE_ITA_TO_ENG[(action.move.type || '').toLowerCase()] || 'normal';
    const movePower = parseInt(action.move.power, 10) || 0;

    const statOffKey = category === 'physical' ? 'attack' : 'special-attack';
    const statDefKey = category === 'physical' ? 'defense' : 'special-defense';
    const baseAttackStat = effectiveStat(attacker, statOffKey);
    const baseDefenseStat = effectiveStat(defender, statDefKey);
    const hpDefender = effectiveStat(defender, 'hp');

    const typeChart = window.SharedData.TYPE_CHART_BY_ATTACKER;
    let typeMultiplier = 1;
    defender.types.forEach(defType => {
      if (typeChart[moveType] && typeChart[moveType][defType] !== undefined) {
        typeMultiplier *= typeChart[moveType][defType];
      }
    });

    const isStab = attacker.types.includes(moveType);

    const offense = engine.applyOffensiveItemEffects({
      itemSlug: attacker.item, category, moveType, typeMultiplier, baseStat: baseAttackStat
    });
    const defense = engine.applyDefensiveItemEffects({
      itemSlug: defender.item, category, baseStat: baseDefenseStat, moveType
    });
    // Aerostato: azzera il moltiplicatore di tipo se la mossa e' di tipo Terra, indipendentemente
    // da cosa direbbe la tabella tipi.
    if (defense.groundImmune) typeMultiplier = 0;
    const itemLabels = [...offense.labels, ...defense.labels];

    // Meteo/terreno sono globali; bruciatura/critico sono per singolo attaccante (salvati sullo
    // slot); gli schermi qui riguardano sempre il lato Avversari perche' in questo motore
    // l'attaccante e' sempre un alleato e il difensore un avversario (vedi calculate()).
    const weatherMult = engine.weatherMultiplierFor(fieldWeather, moveType);
    const terrainMult = engine.terrainMultiplierFor(fieldTerrain, moveType);
    const critMult = attacker.isCrit ? 1.5 : 1;
    const burnMult = (attacker.isBurned && category === 'physical') ? 0.5 : 1;
    const screenActive = category === 'physical'
      ? (screensOpp.reflect || screensOpp.auroraveil)
      : (screensOpp.lightscreen || screensOpp.auroraveil);
    const screenMult = screenActive ? 0.5 : 1;

    const maxDamage = engine.computeDamage({
      level: 50, movePower, attackStat: offense.stat, defenseStat: defense.stat,
      isStab, typeMultiplier, extraDamageMult: offense.damageMult, spreadMult,
      weatherMult, terrainMult, critMult, burnMult, screenMult
    });
    const minDamage = Math.floor(maxDamage * engine.MIN_ROLL);
    const minPercent = ((minDamage / hpDefender) * 100).toFixed(1);
    const maxPercent = ((maxDamage / hpDefender) * 100).toFixed(1);

    const sashCheck = engine.checkFocusSashSurvival({
      itemSlug: defender.item, hpBeforeHit: hpBeforeHit != null ? hpBeforeHit : hpDefender, hpMax: hpDefender, damage: minDamage
    });
    if (sashCheck.saved) itemLabels.push(sashCheck.label);

    const isGuaranteedKO = minDamage >= hpDefender && !sashCheck.saved;
    const isPossibleKO = maxDamage >= hpDefender;
    const hitsToKO = Math.max(1, Math.ceil(hpDefender / Math.max(1, maxDamage)));

    let effectivenessText = 'Effetto normale (x1)';
    if (typeMultiplier === 0) effectivenessText = 'Nessun effetto (x0)';
    else if (typeMultiplier >= 2) effectivenessText = `Super Efficace (x${typeMultiplier})`;
    else if (typeMultiplier < 1) effectivenessText = `Poco Efficace (x${typeMultiplier})`;

    return {
      targetKey: oppKey, targetName: defender.name,
      minDamage, maxDamage, hpDefender, minPercent, maxPercent,
      isGuaranteedKO, isPossibleKO, hitsToKO, sashSaved: sashCheck.saved,
      effectivenessText, isStab, itemLabels
    };
  }

  // Ordine di turno per tutti e 4 gli slot occupati, non solo gli alleati: prima la priorità
  // della mossa scelta (con il bonus dell'abilità Burla sulle mosse di stato), poi a parità di
  // priorità la Velocità effettiva (Ventoincoda del proprio lato già incluso). Gli avversari,
  // che in questo calcolatore non scelgono una mossa da eseguire, restano a priorità 0 e vengono
  // ordinati solo per Velocità — utile comunque per farsi un'idea di quando agirebbero davvero.
  function computeSpeedOrder() {
    const tailwindAllyOn = document.getElementById('dv-tailwind-ally')?.checked || false;
    const tailwindOppOn = document.getElementById('dv-tailwind-opp')?.checked || false;

    const entries = Object.keys(SLOT_META)
      .filter(key => slots[key])
      .map(key => {
        const slot = slots[key];
        const meta = SLOT_META[key];
        const isAlly = meta.side === 'ally';
        const tailwindOn = isAlly ? tailwindAllyOn : tailwindOppOn;
        const effSpeed = effectiveStat(slot, 'speed') * (tailwindOn ? 2 : 1);

        let priority = 0;
        let reason = 'speed';
        let moveName = null;

        if (isAlly && slot.selectedMove) {
          const move = window.SharedData.getPokemonMoves(slot.name).find(m => m.name === slot.selectedMove);
          if (move) {
            moveName = move.name;
            priority = MOVE_PRIORITY[move.name] || 0;
            const isPrankster = slot.abilitySlug === 'prankster' && moveCategoryOf(move) === 'status';
            if (isPrankster) priority += 1;
            if (priority > 0) reason = isPrankster ? 'ability' : 'move-priority';
          }
        }

        return { key, slot, meta, effSpeed, priority, reason, moveName };
      });

    entries.sort((a, b) => (b.priority - a.priority) || (b.effSpeed - a.effSpeed));
    return entries;
  }

  function describeSpeedOrderEntry(e, isFirst) {
    const lead = isFirst ? ' per primo' : '';
    if (e.reason === 'ability') {
      return `attacca${lead} perché usa <b>${e.moveName}</b> con l'abilità <b>${e.slot.abilityDisplayName}</b> (priorità +${e.priority})`;
    }
    if (e.reason === 'move-priority') {
      return `attacca${lead} perché usa <b>${e.moveName}</b> (priorità +${e.priority})`;
    }
    return `attacca${lead} perché ha Velocità <b>${Math.round(e.effSpeed)}</b>`;
  }

  // ===============================
  // Risoluzione del turno
  // ===============================
  window.Calc2v2.calculate = function () {
    const tailwindAlly = document.getElementById('dv-tailwind-ally')?.checked || false;

    const actions = ['ally1', 'ally2']
      .filter(key => slots[key] && slots[key].selectedMove)
      .map(key => {
        const slot = slots[key];
        const move = window.SharedData.getPokemonMoves(slot.name).find(m => m.name === slot.selectedMove);
        if (!move) return null;
        const effSpeed = effectiveStat(slot, 'speed') * (tailwindAlly ? 2 : 1);
        return { key, slot, move, effSpeed };
      })
      .filter(Boolean);

    if (!actions.length) { alert('Scegli almeno una mossa per un alleato!'); return; }

    actions.sort((a, b) => b.effSpeed - a.effSpeed);

    const remainingHp = {};
    ['opp1', 'opp2'].forEach(k => { if (slots[k]) remainingHp[k] = effectiveStat(slots[k], 'hp'); });

    const log = [];

    actions.forEach(action => {
      const category = moveCategoryOf(action.move);

      if (category === 'status') {
        const boost = window.SharedData.STAT_BOOST_MOVES[action.move.name];
        if (boost) {
          const targetKey = boost.target === 'ally' ? otherAllyKey(action.key) : action.key;
          log.push({
            type: 'boost', attackerKey: action.key, moveName: action.move.name,
            targetKey: slots[targetKey] ? targetKey : null, changes: boost.changes
          });
        } else {
          log.push({ type: 'status-generic', attackerKey: action.key, moveName: action.move.name });
        }
        return;
      }

      // Mossa offensiva: determina bersagli. Riusa la regola gia' corretta per il moltiplicatore
      // x0.75 (conta tutti i bersagli colpiti tranne l'attaccante, non solo il lato opposto).
      const moveTargetCategory = window.SharedData.getMoveTarget(action.move.name);
      const isSpread = moveTargetCategory === 'all-opponents' || moveTargetCategory === 'all-other-pokemon' || moveTargetCategory === 'all-pokemon';
      const targetKeys = isSpread
        ? ['opp1', 'opp2'].filter(k => slots[k])
        : [action.slot.selectedTarget].filter(k => k && slots[k]);

      if (!targetKeys.length) {
        log.push({ type: 'no-target', attackerKey: action.key, moveName: action.move.name });
        return;
      }

      const hitCountForSpread = isSpread
        ? Object.keys(SLOT_META).filter(k => k !== action.key && slots[k]).length
        : 1;
      const spreadMult = (isSpread && hitCountForSpread > 1) ? 0.75 : 1;

      const hits = targetKeys.map(oppKey => {
        const hit = computeSingleHit(action, oppKey, spreadMult, category, remainingHp[oppKey]);
        hit.hpBeforePct = (remainingHp[oppKey] / hit.hpDefender) * 100;
        remainingHp[oppKey] = Math.max(0, remainingHp[oppKey] - hit.maxDamage);
        hit.hpAfterPct = (remainingHp[oppKey] / hit.hpDefender) * 100;
        return hit;
      });

      log.push({
        type: 'damage', attackerKey: action.key, moveName: action.move.name,
        isSpread, spreadApplied: spreadMult < 1, hits
      });
    });

    renderTurnSummary(log, computeSpeedOrder());
  };

  // ===============================
  // Riepilogo turno + barra HP animata
  // ===============================
  function renderTurnSummary(log, speedOrder) {
    const speedOrderHtml = speedOrder.map((e, i) => `
      <div style="display:flex; align-items:baseline; gap:6px; font-size:0.75rem; padding:4px 0; ${i > 0 ? 'border-top:1px solid var(--border-color);' : ''}">
        <span style="font-weight:800; color:${e.meta.color};">${i + 1}.</span>
        <span>
          <b>${e.slot.name}</b> <span style="color:var(--text-muted);">(${e.meta.label})</span> ${describeSpeedOrderEntry(e, i === 0)}
        </span>
      </div>
    `).join('');

    const barAnimations = [];

    const blocksHtml = log.map(entry => {
      if (entry.type === 'boost') {
        const changesText = entry.changes.map(c => `${STAT_NAMES_ITA[c.stat]} ${c.stages > 0 ? '+' : ''}${c.stages}`).join(', ');
        const targetLabel = entry.targetKey ? SLOT_META[entry.targetKey].label : '(nessun bersaglio disponibile)';
        return `
          <div style="padding:10px; background:var(--bg-dark); border-radius:8px; border:1px solid var(--border-color); margin-bottom:10px; font-size:0.8rem;">
            🔧 <b>${SLOT_META[entry.attackerKey].label}</b> usa <b>${entry.moveName}</b> → ${targetLabel}: ${changesText}
          </div>
        `;
      }
      if (entry.type === 'status-generic') {
        return `
          <div style="padding:10px; background:var(--bg-dark); border-radius:8px; border:1px solid var(--border-color); margin-bottom:10px; font-size:0.8rem; color:var(--text-muted);">
            ${SLOT_META[entry.attackerKey].label} usa <b>${entry.moveName}</b>: nessun effetto modellato in questo calcolatore
          </div>
        `;
      }
      if (entry.type === 'no-target') {
        return `
          <div style="padding:10px; background:var(--bg-dark); border-radius:8px; border:1px solid #f59e0b; margin-bottom:10px; font-size:0.8rem; color:#f59e0b;">
            ${SLOT_META[entry.attackerKey].label} usa <b>${entry.moveName}</b>: nessun bersaglio scelto/disponibile
          </div>
        `;
      }

      // type === 'damage'
      const hitsHtml = entry.hits.map(hit => {
        let statusText = '';
        if (hit.sashSaved) statusText = `<span style="color:#f59e0b; font-weight:800;">SOPRAVVIVE A 1 PS (Focus Sash)</span>`;
        else if (hit.isGuaranteedKO) statusText = `<span style="color:#ef4444; font-weight:800;">KO GARANTITO (${hit.maxPercent}%)</span>`;
        else if (hit.isPossibleKO) statusText = `<span style="color:#f59e0b; font-weight:800;">POSSIBILE KO (${hit.minPercent}% - ${hit.maxPercent}%)</span>`;
        else statusText = `<span style="color:#84cc16; font-weight:800;">NON MANDA KO (KO in ${hit.hitsToKO} colpi)</span>`;

        const barId = `hpbar-${Math.random().toString(36).slice(2, 10)}`;
        const beforeW = clampPct(hit.hpBeforePct);
        const afterW = clampPct(hit.hpAfterPct);
        barAnimations.push({ barId, afterW, color: colorForPercent(afterW) });

        return `
          <div style="margin-bottom:10px; padding:8px; background:var(--panel-bg); border-radius:6px;">
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; margin-bottom:4px; gap:8px;">
              <span>${hit.targetName} (${SLOT_META[hit.targetKey].label})</span>
              <span>${statusText}</span>
            </div>
            <div style="height:8px; border-radius:4px; background:rgba(255,255,255,0.08); overflow:hidden;">
              <div id="${barId}" style="height:100%; width:${beforeW}%; background:${colorForPercent(beforeW)}; transition: width 0.6s ease, background-color 0.6s ease; border-radius:4px;"></div>
            </div>
            <div style="font-size:0.7rem; color:var(--text-muted); margin-top:4px;">
              Danno: ${hit.minDamage}-${hit.maxDamage} HP (${hit.minPercent}%-${hit.maxPercent}%) · ${hit.effectivenessText} · STAB: ${hit.isStab ? 'Sì' : 'No'}${hit.itemLabels.length ? ' · ' + hit.itemLabels.join(' · ') : ''}
            </div>
          </div>
        `;
      }).join('');

      return `
        <div style="margin-bottom:14px;">
          <div style="font-size:0.85rem; font-weight:800; color:var(--accent); margin-bottom:6px;">${SLOT_META[entry.attackerKey].label} usa ${entry.moveName}${entry.isSpread ? (entry.spreadApplied ? ' 🌀 (×0.75, area)' : ' 🌀 (area)') : ''}</div>
          ${hitsHtml}
        </div>
      `;
    }).join('');

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(5,8,15,0.7); backdrop-filter: blur(6px); display:flex; align-items:center; justify-content:center; z-index:9999; padding:16px;';
    overlay.innerHTML = `
      <div style="background-image: var(--glass-sheen); background-color: rgba(18,24,36,0.6); backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); border: 1px solid rgba(56,189,248,0.4); border-radius: var(--radius-lg); padding: 24px; max-width: 560px; width: 100%; max-height: 85vh; overflow-y:auto; color: #fff;">
        <h2 style="font-size:1.1rem; color: var(--accent); margin-bottom:10px; text-align:center;">Riepilogo Turno</h2>
        <div style="font-size:0.72rem; font-weight:800; color:var(--text-muted); margin-bottom:4px; letter-spacing:0.4px;">ORDINE DI VELOCITÀ</div>
        <div style="margin-bottom:16px; padding:10px; background:var(--bg-dark); border-radius:8px;">${speedOrderHtml}</div>
        ${blocksHtml}
        <button id="dv2v2-close-modal" style="width:100%; margin-top:6px; padding:10px; background:var(--border-color); border:none; color:#fff; font-weight:700; border-radius:8px; cursor:pointer;">CHIUDI</button>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('dv2v2-close-modal').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    // Applica la larghezza finale dopo un breve delay: la transition CSS anima lo svuotamento.
    setTimeout(() => {
      barAnimations.forEach(b => {
        const bar = document.getElementById(b.barId);
        if (bar) {
          bar.style.width = b.afterW + '%';
          bar.style.background = b.color;
        }
      });
    }, 80);
  }

  document.addEventListener('DOMContentLoaded', () => {
    initLayout();
  });
})();
