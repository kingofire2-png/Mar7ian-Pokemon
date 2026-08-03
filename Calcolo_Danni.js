/**
 * Gestore dell'interfaccia e logica di visualizzazione per il Calcolatore Danni
 */

// Stato locale dei Pokémon e dei bonus EV
let pokemonA = null;
let pokemonB = null;

const statsBonusA = { hp: 0, attack: 0, defense: 0, 'special-attack': 0, 'special-defense': 0, speed: 0 };
const statsBonusB = { hp: 0, attack: 0, defense: 0, 'special-attack': 0, 'special-defense': 0, speed: 0 };

// Mappe di traduzione sicure (non sovrascrivono quelle globali se già presenti)
if (typeof window.TYPE_NAMES_ITA === 'undefined') {
  window.TYPE_NAMES_ITA = {
    normal: 'Normale', fire: 'Fuoco', water: 'Acqua', grass: 'Erba',
    electric: 'Elettro', ice: 'Ghiaccio', fighting: 'Lotta', poison: 'Veleno',
    ground: 'Terra', flying: 'Volante', psychic: 'Psico', bug: 'Coleottero',
    rock: 'Roccia', ghost: 'Spettro', dragon: 'Drago', dark: 'Buio',
    steel: 'Acciaio', fairy: 'Folletto'
  };
}
const TYPE_NAMES_ITA = window.TYPE_NAMES_ITA;

if (typeof window.STAT_NAMES_ITA === 'undefined') {
  window.STAT_NAMES_ITA = {
    hp: 'PS', attack: 'Attacco', defense: 'Difesa',
    'special-attack': 'Att. Sp.', 'special-defense': 'Dif. Sp.', speed: 'Velocità'
  };
}
const STAT_NAMES_ITA = window.STAT_NAMES_ITA;

function getFormattedMoveName(slug) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Assegna il Pokémon al relativo slot (A o B) e avvia il rendering
 */
async function assignPokemonSlot(id, slot) {
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    const data = await res.json();

    const extractedTypes = data.types.map(t => t.type.name);

    if (typeof localPokemonList !== 'undefined') {
      const item = localPokemonList.find(p => p.id === id);
      if (item) item.types = extractedTypes;
    }

    const pokemonObj = {
      id: data.id,
      name: data.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      rawName: data.name,
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

    if (typeof renderGrid === 'function') renderGrid();
  } catch (e) {
    console.error('Errore durante l\'assegnazione del Pokémon:', e);
  }
}

/**
 * Renderizza la scheda del Pokémon A ed estrae le mosse tramite Pokémon Central Wiki
 */
async function renderPokemonA() {
  const container = document.getElementById('content-a');
  if (!container || !pokemonA) return;

  // 1. Tenta il recupero da Pokémon Central Wiki
  let movesDetailed = [];
  if (window.CentralWikiFetcher) {
    movesDetailed = await window.CentralWikiFetcher.fetchMoves(pokemonA.rawName);
  }

  // 2. Fallback automatico su PokéAPI se Central Wiki non restituisce mosse
  if (!movesDetailed || movesDetailed.length === 0) {
    movesDetailed = await Promise.all(pokemonA.moves.slice(0, 50).map(async (m) => {
      const slug = m.move.name;
      try {
        const res = await fetch(m.move.url);
        const data = await res.json();
        const typeName = data.type ? data.type.name : 'normal';
        const categoryName = data.damage_class ? data.damage_class.name : 'physical';
        const itaNameObj = data.names ? data.names.find(n => n.language.name === 'it') : null;
        const finalName = itaNameObj ? itaNameObj.name : getFormattedMoveName(slug);
        return { name: finalName, type: typeName, power: data.power || 0, category: categoryName };
      } catch (e) {
        return { name: getFormattedMoveName(slug), type: 'normal', power: 0, category: 'physical' };
      }
    }));
  }

  // Raggruppamento delle mosse estratte per Tipo
  const groupedMoves = {};
  movesDetailed.forEach(m => {
    const t = m.type || 'normal';
    if (!groupedMoves[t]) groupedMoves[t] = [];
    groupedMoves[t].push(m);
  });

  let selectOptionsHtml = '<option value="">-- Seleziona Mossa --</option>';
  for (const [typeKey, movesGroup] of Object.entries(groupedMoves)) {
    const typeLabelITA = (TYPE_NAMES_ITA[typeKey] || typeKey).toUpperCase();
    selectOptionsHtml += `<optgroup label="TIPO ${typeLabelITA}">`;
    movesGroup.forEach(m => {
      selectOptionsHtml += `<option value="${m.name}" data-power="${m.power}" data-type="${m.type}" data-category="${m.category}">[${typeLabelITA}] ${m.name}</option>`;
    });
    selectOptionsHtml += `</optgroup>`;
  }

  // Calcolo e costruzione del modulo statistiche (Level 50)
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

  // Generazione del DOM finale per Pokémon A
  container.innerHTML = `
    <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
      <img src="${pokemonA.image}" style="width: 80px; height: 80px; object-fit: contain;">
      <div>
        <h3 style="font-size: 1.2rem; font-weight: 800; color: #fff;">${pokemonA.name}</h3>
        <div>${pokemonA.types.map(t => `<span style="background: #26334d; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-right: 4px;">${(TYPE_NAMES_ITA[t] || t).toUpperCase()}</span>`).join('')}</div>
      </div>
    </div>

    <div style="background: #0b0e14; padding: 12px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #26334d;">
      <label style="font-size: 0.75rem; font-weight: 700; color: #8e9bb0; display: block; margin-bottom: 6px;">MOSSE (POKÉMON CENTRAL WIKI)</label>
      <select id="select-move-a" onchange="window.updateMoveSelectionInfo(this)" style="width: 100%; background: #121824; border: 1px solid #26334d; color: #84cc16; padding: 8px; border-radius: 6px; font-size: 0.85rem; font-weight: 700; margin-bottom: 8px;">
        ${selectOptionsHtml}
      </select>
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem;">
        <span id="move-ita-name" style="font-weight: 700; color: #84cc16;">Mossa: -</span>
        <span id="move-power-val" style="font-weight: 700; color: #fff;">Potenza: -</span>
      </div>
    </div>

    <div style="font-size: 0.75rem; font-weight: 700; color: #84cc16; margin-bottom: 8px;">STATISTICHE (BASE + OFFSET + EV 0-32)</div>
    <div>${statsHtml}</div>
  `;

  const selectEl = document.getElementById('select-move-a');
  if (selectEl) window.updateMoveSelectionInfo(selectEl);
}

/**
 * Renderizza la scheda del Pokémon B
 */
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
          <div style="width: ${Math.min(100, (totalVal / 300) * 100)}%; height: 100%; background: #ef4444;"></div>
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
    <div style="font-size: 0.75rem; font-weight: 700; color: #ef4444; margin-bottom: 8px;">STATISTICHE (BASE + OFFSET + EV 0-32)</div>
    <div>${statsHtml}</div>
  `;
}

/**
 * Funzioni Helper esposte sul window object per la gestione degli eventi DOM
 */
window.updateEV = function(slot, statKey, val) {
  const numVal = Math.min(32, Math.max(0, parseInt(val) || 0));
  if (slot === 'A') {
    statsBonusA[statKey] = numVal;
    renderPokemonA();
  } else {
    statsBonusB[statKey] = numVal;
    renderPokemonB();
  }
};

window.updateMoveSelectionInfo = function(selectEl) {
  const selectedOption = selectEl.options[selectEl.selectedIndex];
  const name = selectedOption ? selectedOption.value : '-';
  const power = selectedOption ? selectedOption.getAttribute('data-power') : '-';

  const nameLabel = document.getElementById('move-ita-name');
  const powerLabel = document.getElementById('move-power-val');

  if (nameLabel) nameLabel.textContent = `Mossa: ${name || '-'}`;
  if (powerLabel) powerLabel.textContent = `Potenza: ${power || '-'}`;
};

/**
 * Gestione sicura di switchAppSection: preserva la funzione originale dell'app se già definita
 */
if (typeof window.switchAppSection !== 'function') {
  window.switchAppSection = function(section) {
    const calcSection = document.getElementById('calculator-section');
    const pokedexSection = document.getElementById('pokedex-section');
    if (section === 'calculator' || section === 'calcolo') {
      if (calcSection) calcSection.style.display = 'block';
      if (pokedexSection) pokedexSection.style.display = 'none';
    } else {
      if (calcSection) calcSection.style.display = 'none';
      if (pokedexSection) pokedexSection.style.display = 'block';
    }
  };
}
