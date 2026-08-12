/**
 * Calcolo_Danni_2v2.js
 * Modalita' 2vs2 (Doppio) del Calcolo Danni: 4 riquadri (2 alleati + 2 avversari), scegli chi
 * attacca, con quale mossa e chi e' il bersaglio. Riusa i dati condivisi (shared-data.js) e la
 * stessa matematica/effetti oggetto del calcolo 1vs1 (window.CalcDanniEngine), per non
 * duplicare formula e regole - qui c'e' solo l'interfaccia e la logica specifica del doppio
 * (riduzione di danno x0.75 sulle mosse ad area).
 */

(function () {
  'use strict';

  const TYPE_NAMES_ITA = window.SharedData.TYPE_NAMES_ITA;
  const STAT_NAMES_ITA = {
    'hp': 'PS', 'attack': 'Attacco', 'defense': 'Difesa',
    'special-attack': 'Sp. Atk', 'special-defense': 'Sp. Def', 'speed': 'Velocità'
  };
  const STAT_KEYS = ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'];

  const SLOT_META = {
    ally1: { label: 'Alleato 1', side: 'ally', color: 'var(--accent)' },
    ally2: { label: 'Alleato 2', side: 'ally', color: 'var(--accent)' },
    opp1: { label: 'Avversario 1', side: 'opp', color: 'var(--violet)' },
    opp2: { label: 'Avversario 2', side: 'opp', color: 'var(--violet)' }
  };

  let slots = { ally1: null, ally2: null, opp1: null, opp2: null };
  let attackerKey = '';
  let targetKey = '';
  let pickerTargetSlot = null;
  let selectedPickerTypes = [];
  let dexList = [];
  let initialized = false;

  function emptyEvs() {
    return { hp: 0, attack: 0, defense: 0, 'special-attack': 0, 'special-defense': 0, speed: 0 };
  }

  function statTotal(slot, statKey) {
    const statObj = slot.stats.find(s => s.stat.name === statKey);
    const base = statObj ? statObj.base_stat : 1;
    const offset = statKey === 'hp' ? 75 : 20;
    return base + offset + (slot.evs[statKey] || 0);
  }

  // ===============================
  // Layout
  // ===============================
  function initLayout() {
    const container = document.getElementById('calc-2v2-view');
    if (!container || initialized) return;
    initialized = true;

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin-bottom: 24px;">
        <div id="slot-card-ally1"></div>
        <div id="slot-card-ally2"></div>
        <div id="slot-card-opp1"></div>
        <div id="slot-card-opp2"></div>
      </div>

      <div style="background-image: var(--glass-sheen); background-color: rgba(18,24,36,0.45); backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); box-shadow: 0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 var(--glass-highlight); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-lg); padding: 20px; margin-bottom: 24px;">
        <h3 style="color: #fff; margin-bottom: 14px; text-align: center;">Calcola Danno</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 14px;">
          <label style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700;">Chi attacca
            <select id="dv-attacker-select" onchange="window.Calc2v2.onAttackerChange(this.value)" style="width:100%; margin-top:4px; background:var(--panel-bg); border:1px solid var(--border-color); color:#fff; padding:8px; border-radius:6px;">
              <option value="">— scegli —</option>
            </select>
          </label>
          <label style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700;">Con quale mossa
            <select id="dv-move-select" onchange="window.Calc2v2.onMoveChange(this.value)" style="width:100%; margin-top:4px; background:var(--panel-bg); border:1px solid var(--border-color); color:#fff; padding:8px; border-radius:6px;">
              <option value="">— scegli prima l'attaccante —</option>
            </select>
          </label>
          <label style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700;">Chi è il bersaglio
            <select id="dv-target-select" onchange="window.Calc2v2.onTargetChange(this.value)" style="width:100%; margin-top:4px; background:var(--panel-bg); border:1px solid var(--border-color); color:#fff; padding:8px; border-radius:6px;">
              <option value="">— scegli prima l'attaccante —</option>
            </select>
          </label>
        </div>
        <button id="dv-calculate-btn" onclick="window.Calc2v2.calculate()" style="width: 100%; padding: 12px; background: linear-gradient(135deg, var(--accent), #0284c7); border: none; border-radius: 8px; color: #04202e; font-weight: 800; font-size: 1rem; cursor: pointer;">⚡ CALCOLA DANNO</button>
      </div>
    `;

    STAT_KEYS.forEach(() => {}); // no-op, mantiene STAT_KEYS referenziato per chiarezza

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
  function renderSlotCard(key) {
    const el = document.getElementById(`slot-card-${key}`);
    if (!el) return;
    const meta = SLOT_META[key];
    const slot = slots[key];

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
    const itemOptionsHtml = window.SharedData.ITEM_SLUGS.map(s =>
      `<option value="${s}" ${s === slot.item ? 'selected' : ''}>${window.SharedData.getItemName(s)}</option>`
    ).join('');
    const evRowsHtml = STAT_KEYS.map(k => `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; font-size:0.68rem;">
        <span style="color:var(--text-muted);">${STAT_NAMES_ITA[k]}</span>
        <span style="font-weight:700;">${statTotal(slot, k)}</span>
        <input type="number" min="0" max="32" value="${slot.evs[k]}" onchange="window.Calc2v2.updateEv('${key}', '${k}', this.value)" style="width:38px; background:var(--bg-dark); border:1px solid var(--border-color); color:#fff; text-align:center; border-radius:4px; padding:2px; font-size:0.68rem;">
      </div>
    `).join('');

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
        <select onchange="window.Calc2v2.updateItem('${key}', this.value)" style="width:100%; margin-bottom:10px; background:var(--bg-dark); border:1px solid var(--border-color); color:var(--violet); padding:6px; border-radius:6px; font-size:0.75rem;">
          <option value="">— Nessun oggetto —</option>
          ${itemOptionsHtml}
        </select>
        <div style="display:flex; flex-direction:column; gap:3px;">${evRowsHtml}</div>
      </div>
    `;
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
      slots[key] = {
        id: data.id,
        name: data.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        image: data.sprites.other['official-artwork'].front_default || data.sprites.front_default,
        types: data.types.map(t => t.type.name),
        stats: data.stats,
        item: '',
        evs: emptyEvs()
      };
      renderSlotCard(key);
      refreshAttackerOptions();
    } catch (e) {
      console.error('Errore assegnazione slot 2vs2:', e);
    }
  };

  window.Calc2v2.clearSlot = function (key) {
    slots[key] = null;
    if (attackerKey === key) { attackerKey = ''; targetKey = ''; }
    renderSlotCard(key);
    refreshAttackerOptions();
  };

  window.Calc2v2.updateItem = function (key, slug) {
    if (slots[key]) slots[key].item = slug;
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
  // Attaccante / mossa / bersaglio
  // ===============================
  function refreshAttackerOptions() {
    const select = document.getElementById('dv-attacker-select');
    if (!select) return;
    const filledKeys = Object.keys(slots).filter(k => slots[k]);
    select.innerHTML = `<option value="">— scegli —</option>` + filledKeys.map(k =>
      `<option value="${k}" ${k === attackerKey ? 'selected' : ''}>${SLOT_META[k].label}: ${slots[k].name}</option>`
    ).join('');
    if (attackerKey && !filledKeys.includes(attackerKey)) attackerKey = '';
    window.Calc2v2.onAttackerChange(attackerKey);
  }

  window.Calc2v2.onAttackerChange = function (key) {
    attackerKey = key;
    const moveSelect = document.getElementById('dv-move-select');
    const targetSelect = document.getElementById('dv-target-select');
    if (!moveSelect || !targetSelect) return;

    if (!key || !slots[key]) {
      moveSelect.innerHTML = `<option value="">— scegli prima l'attaccante —</option>`;
      targetSelect.innerHTML = `<option value="">— scegli prima l'attaccante —</option>`;
      targetKey = '';
      return;
    }

    const moves = window.SharedData.getPokemonMoves(slots[key].name);
    moveSelect.innerHTML = moves.length
      ? moves.map(m => `<option value="${m.name}">[${m.type}] ${m.name}</option>`).join('')
      : `<option value="">Nessuna mossa trovata nel DB</option>`;

    const opposingSide = SLOT_META[key].side === 'ally' ? 'opp' : 'ally';
    const opposingKeys = Object.keys(SLOT_META).filter(k => SLOT_META[k].side === opposingSide && slots[k]);
    targetSelect.innerHTML = opposingKeys.length
      ? `<option value="">— scegli —</option>` + opposingKeys.map(k => `<option value="${k}">${SLOT_META[k].label}: ${slots[k].name}</option>`).join('')
      : `<option value="">Nessun avversario disponibile</option>`;
    targetKey = '';
  };

  window.Calc2v2.onMoveChange = function () {};
  window.Calc2v2.onTargetChange = function (key) { targetKey = key; };

  // ===============================
  // Calcolo
  // ===============================
  window.Calc2v2.calculate = function () {
    const moveSelect = document.getElementById('dv-move-select');
    const moveName = moveSelect ? moveSelect.value : '';

    if (!attackerKey || !slots[attackerKey]) { alert('Scegli chi attacca!'); return; }
    if (!targetKey || !slots[targetKey]) { alert('Scegli il bersaglio!'); return; }
    if (!moveName) { alert('Scegli una mossa!'); return; }

    const attacker = slots[attackerKey];
    const defender = slots[targetKey];
    const moves = window.SharedData.getPokemonMoves(attacker.name);
    const move = moves.find(m => m.name === moveName);
    if (!move) { alert('Mossa non trovata.'); return; }

    const engine = window.CalcDanniEngine;
    const category = move.category === 'Fisico' ? 'physical' : (move.category === 'Speciale' ? 'special' : 'status');
    const moveType = engine.TYPE_ITA_TO_ENG[(move.type || '').toLowerCase()] || 'normal';
    const movePower = parseInt(move.power, 10) || 0;

    if (category === 'status') {
      alert('Questa è una mossa di stato: non infligge danno diretto.');
      return;
    }

    const statOffKey = category === 'physical' ? 'attack' : 'special-attack';
    const statDefKey = category === 'physical' ? 'defense' : 'special-defense';
    const baseAttackStat = statTotal(attacker, statOffKey);
    const baseDefenseStat = statTotal(defender, statDefKey);
    const hpDefender = statTotal(defender, 'hp');

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
      itemSlug: defender.item, category, baseStat: baseDefenseStat
    });
    const itemLabels = [...offense.labels, ...defense.labels];

    // Regola del doppio: le mosse ad area infliggono x0.75 quando colpiscono piu' di un
    // bersaglio. Qui vale quando l'altro slot della squadra bersaglio e' occupato.
    const opposingSide = SLOT_META[attackerKey].side === 'ally' ? 'opp' : 'ally';
    const otherTargetKey = Object.keys(SLOT_META).find(k => SLOT_META[k].side === opposingSide && k !== targetKey);
    const otherTargetFilled = otherTargetKey && !!slots[otherTargetKey];
    const isSpread = window.SharedData.isSpreadMove(moveName);
    const spreadMult = (isSpread && otherTargetFilled) ? 0.75 : 1;

    const maxDamage = engine.computeDamage({
      level: 50, movePower, attackStat: offense.stat, defenseStat: defense.stat,
      isStab, typeMultiplier, extraDamageMult: offense.damageMult, spreadMult
    });
    const minDamage = Math.floor(maxDamage * 0.85);
    const minPercent = ((minDamage / hpDefender) * 100).toFixed(1);
    const maxPercent = ((maxDamage / hpDefender) * 100).toFixed(1);
    const isGuaranteedKO = minDamage >= hpDefender;
    const isPossibleKO = maxDamage >= hpDefender;
    const hitsToKO = Math.max(1, Math.ceil(hpDefender / Math.max(1, maxDamage)));

    let statusText = '';
    if (isGuaranteedKO) statusText = `<span style="color:#ef4444; font-weight:800;">KO GARANTITO IN 1 COLPO (${maxPercent}%)</span>`;
    else if (isPossibleKO) statusText = `<span style="color:#f59e0b; font-weight:800;">POSSIBILE KO IN 1 COLPO (${minPercent}% - ${maxPercent}%)</span>`;
    else statusText = `<span style="color:#84cc16; font-weight:800;">NON MANDA KO (KO in ${hitsToKO} colpi)</span>`;

    let effectivenessText = 'Effetto normale (x1)';
    if (typeMultiplier === 0) effectivenessText = 'Nessun effetto (x0)';
    else if (typeMultiplier >= 2) effectivenessText = `Super Efficace (x${typeMultiplier})`;
    else if (typeMultiplier < 1) effectivenessText = `Poco Efficace (x${typeMultiplier})`;

    showResultModal({
      title: `${attacker.name} (${SLOT_META[attackerKey].label}) ➔ ${defender.name} (${SLOT_META[targetKey].label})`,
      statusText,
      moveName,
      category: move.category,
      minDamage, maxDamage, hpDefender, minPercent, maxPercent,
      effectivenessText,
      isStab,
      itemLabels,
      isSpread,
      spreadApplied: spreadMult < 1
    });
  };

  function showResultModal(data) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(5,8,15,0.7); backdrop-filter: blur(6px); display:flex; align-items:center; justify-content:center; z-index:9999;';
    overlay.innerHTML = `
      <div style="background-image: var(--glass-sheen); background-color: rgba(18,24,36,0.6); backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); border: 1px solid rgba(56,189,248,0.4); border-radius: var(--radius-lg); padding: 24px; max-width: 520px; width: 90%; color: #fff;">
        <h2 style="font-size:1.2rem; color: var(--accent); margin-bottom:8px; text-align:center;">${data.title}</h2>
        <div style="font-size:1rem; text-align:center; margin-bottom:12px; padding:10px; background:var(--bg-dark); border-radius:8px;">${data.statusText}</div>
        ${data.isSpread ? `<div style="font-size:0.8rem; text-align:center; margin-bottom:12px; padding:8px; background:var(--bg-dark); border-radius:8px; border:1px solid ${data.spreadApplied ? '#38bdf8' : 'var(--border-color)'}; color:${data.spreadApplied ? '#38bdf8' : 'var(--text-muted)'};">
          ${data.spreadApplied ? '🌀 Mossa ad area: colpisce più bersagli, danno ×0.75' : 'Mossa ad area, ma il secondo bersaglio non è presente: nessuna riduzione applicata'}
        </div>` : ''}
        <div style="font-size:0.85rem; line-height:1.6; color:#cbd5e1; background:var(--bg-dark); padding:12px; border-radius:8px; border:1px solid var(--border-color);">
          <ul style="padding-left:18px; margin:0;">
            <li>Mossa: <b>${data.moveName}</b> (${data.category})</li>
            <li>Danno Totale: <b>${data.minDamage} - ${data.maxDamage} HP</b> (${data.minPercent}% - ${data.maxPercent}%) su ${data.hpDefender} HP</li>
            <li>Efficacia Tipo: <b>${data.effectivenessText}</b></li>
            <li>Bonus STAB: <b>${data.isStab ? 'Sì (x1.5)' : 'No'}</b></li>
            ${data.itemLabels.length ? `<li>Oggetti: <b>${data.itemLabels.join(' · ')}</b></li>` : ''}
          </ul>
        </div>
        <button id="dv2v2-close-modal" style="width:100%; margin-top:14px; padding:10px; background:var(--border-color); border:none; color:#fff; font-weight:700; border-radius:8px; cursor:pointer;">CHIUDI</button>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('dv2v2-close-modal').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  }

  document.addEventListener('DOMContentLoaded', () => {
    initLayout();
  });
})();
