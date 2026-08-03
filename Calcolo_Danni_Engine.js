/**
 * Calcolo_Danni_Engine.js (Versione Pulita)
 * Gestione calcoli e UI sincronizzati esclusivamente con Pokémon Central Wiki.
 */

(function () {
  'use strict';

  const TYPE_CHART = {
    normal:   { rock: 0.5, ghost: 0, steel: 0.5 },
    fire:     { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
    water:    { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
    grass:    { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
    electric: { water: 2, grass: 0.5, electric: 0.5, ground: 0, flying: 2, dragon: 0.5 },
    ice:      { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
    fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
    poison:   { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
    ground:   { fire: 2, grass: 0.5, electric: 2, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
    flying:   { grass: 2, electric: 0.5, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
    psychic:  { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
    bug:      { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
    rock:     { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
    ghost:    { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
    dragon:   { dragon: 2, steel: 0.5, fairy: 0 },
    dark:     { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
    steel:    { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
    fairy:    { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 }
  };

  const CATEGORY_TRANSLATIONS = { physical: 'Fisico', special: 'Speciale', status: 'Stato' };

  const TYPE_ITA_TO_ENG = {
    'normale': 'normal', 'fuoco': 'fire', 'acqua': 'water', 'erba': 'grass',
    'elettro': 'electric', 'ghiaccio': 'ice', 'lotta': 'fighting', 'veleno': 'poison',
    'terra': 'ground', 'volante': 'flying', 'psico': 'psychic', 'coleottero': 'bug',
    'roccia': 'rock', 'spettro': 'ghost', 'drago': 'dragon', 'buio': 'dark',
    'acciaio': 'steel', 'folletto': 'fairy'
  };

  let currentMoveCategory = 'physical';
  let currentMoveType = 'normal';

  document.addEventListener('DOMContentLoaded', () => {
    injectEngineStyles();
    observeSelectionChanges();
  });

  function injectEngineStyles() {
    if (document.getElementById('engine-styles')) return;
    const style = document.createElement('style');
    style.id = 'engine-styles';
    style.innerHTML = `
      @keyframes popIn { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
      .damage-modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(5, 8, 15, 0.85); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; z-index: 9999; }
      .damage-modal-card { background: #182030; border: 2px solid #84cc16; border-radius: 16px; padding: 24px; max-width: 520px; width: 90%; color: #fff; animation: popIn 0.25s ease-out forwards; }
    `;
    document.head.appendChild(style);
  }

  function observeSelectionChanges() {
  const observer = new MutationObserver(() => {
    const selectMove = document.getElementById('select-move-a');
    const pokemonSelect = document.getElementById('select-pokemon-a');

    // Integrazione con CentralWikiFetcher
    if (pokemonSelect && !pokemonSelect.dataset.wikiHooked) {
      pokemonSelect.dataset.wikiHooked = "true";
      pokemonSelect.addEventListener('change', async () => {
        const selectedPokemon = pokemonSelect.value;
        if (window.CentralWikiFetcher && selectedPokemon && selectMove) {
          selectMove.innerHTML = '<option value="">⏳ Caricamento mosse (Central Wiki)...</option>';
          const wikiMoves = await window.CentralWikiFetcher.fetchMoves(selectedPokemon);
          populateMoveSelect(selectMove, wikiMoves);
        }
      });
    }

    if (selectMove && !selectMove.dataset.engineHooked) {
      selectMove.dataset.engineHooked = "true";
      selectMove.addEventListener('change', updateSelectedMoveData);
      injectCalcButton();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

  function populateMoveSelect(selectEl, moves) {
    if (!moves || moves.length === 0) {
      selectEl.innerHTML = '<option value="">-- Nessuna mossa trovata --</option>';
      return;
    }

    selectEl.innerHTML = '<option value="">-- Seleziona Mossa (Central Wiki) --</option>';
    moves.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.name;
      opt.textContent = m.name;
      opt.setAttribute('data-name', m.name);
      opt.setAttribute('data-power', m.power);
      opt.setAttribute('data-type', m.type);
      opt.setAttribute('data-category', m.category);
      selectEl.appendChild(opt);
    });
  }

  function updateSelectedMoveData() {
    const selectEl = document.getElementById('select-move-a');
    if (!selectEl) return;

    const opt = selectEl.options[selectEl.selectedIndex];
    if (!opt) return;

    currentMoveCategory = opt.getAttribute('data-category') || 'physical';
    currentMoveType = opt.getAttribute('data-type') || 'normal';
    const power = opt.getAttribute('data-power') || '0';

    const powerEl = document.getElementById('move-power-val');
    if (powerEl) {
      const catText = CATEGORY_TRANSLATIONS[currentMoveCategory] || currentMoveCategory;
      const catColor = currentMoveCategory === 'physical' ? '#f97316' : (currentMoveCategory === 'special' ? '#3b82f6' : '#a855f7');
      powerEl.innerHTML = `Potenza: <b>${power}</b> | Categoria: <span style="color: ${catColor}; font-weight: 800;">${catText.toUpperCase()}</span>`;
    }
  }

  function injectCalcButton() {
    const boxA = document.getElementById('box-a');
    if (!boxA || document.getElementById('btn-calculate-damage')) return;

    const btn = document.createElement('button');
    btn.id = 'btn-calculate-damage';
    btn.textContent = '⚡ CALCOLA DANNO';
    btn.style.cssText = 'width: 100%; margin-top: 16px; padding: 12px; background: linear-gradient(135deg, #84cc16, #65a30d); border: none; border-radius: 8px; color: #000; font-weight: 800; font-size: 1rem; cursor: pointer;';
    btn.onclick = calculateAndShowDamage;
    boxA.appendChild(btn);
  }

  function getStatFromDOM(boxId, statNameSearch) {
    const box = document.getElementById(boxId);
    if (!box) return 1;

    const rows = box.querySelectorAll('div[style*="grid-template-columns"]');
    for (const row of rows) {
      const spans = row.querySelectorAll('span');
      if (spans.length >= 2 && spans[0].textContent.trim().toLowerCase() === statNameSearch.toLowerCase()) {
        return parseInt(spans[1].textContent.trim(), 10) || 1;
      }
    }
    return 1;
  }

  function getPokemonTypesFromDOM(boxId) {
    const box = document.getElementById(boxId);
    if (!box) return [];

    const spans = box.querySelectorAll('span[style*="border-radius: 4px"]');
    const types = [];
    spans.forEach(s => {
      const rawType = s.textContent.trim().toLowerCase();
      types.push(TYPE_ITA_TO_ENG[rawType] || rawType);
    });
    return types;
  }

  function calculateAndShowDamage() {
    const selectEl = document.getElementById('select-move-a');
    if (!selectEl || !selectEl.value) {
      alert("Seleziona una mossa per l'attaccante!");
      return;
    }

    const opt = selectEl.options[selectEl.selectedIndex];
    const movePower = parseInt(opt.getAttribute('data-power') || '0', 10);
    const moveName = opt.getAttribute('data-name') || selectEl.value;

    const nameA = document.getElementById('box-a')?.querySelector('h3')?.textContent || 'Pokémon A';
    const nameB = document.getElementById('box-b')?.querySelector('h3')?.textContent || 'Pokémon B';

    const hpB = getStatFromDOM('box-b', 'PS');
    let attackStat = 0, defenseStat = 0;
    let statOffensivaNome = '', statDifensivaNome = '';

    if (currentMoveCategory === 'physical') {
      attackStat = getStatFromDOM('box-a', 'Attacco');
      defenseStat = getStatFromDOM('box-b', 'Difesa');
      statOffensivaNome = 'Attacco';
      statDifensivaNome = 'Difesa';
    } else {
      attackStat = getStatFromDOM('box-a', 'Sp. Atk');
      defenseStat = getStatFromDOM('box-b', 'Sp. Def');
      statOffensivaNome = 'Sp. Atk';
      statDifensivaNome = 'Sp. Def';
    }

    const typesA = getPokemonTypesFromDOM('box-a');
    const typesB = getPokemonTypesFromDOM('box-b');

    let typeMultiplier = 1;
    typesB.forEach(defType => {
      if (TYPE_CHART[currentMoveType] && TYPE_CHART[currentMoveType][defType] !== undefined) {
        typeMultiplier *= TYPE_CHART[currentMoveType][defType];
      }
    });

    const isStab = typesA.includes(currentMoveType);
    const stabMultiplier = isStab ? 1.5 : 1;
    const level = 50;

    let baseDamage = Math.floor(Math.floor((Math.floor((2 * level) / 5 + 2) * movePower * attackStat) / defenseStat) / 50) + 2;
    baseDamage = Math.floor(baseDamage * stabMultiplier);

    const maxDamage = Math.floor(baseDamage * typeMultiplier);
    const minDamage = Math.floor(maxDamage * 0.85);

    const minPercent = ((minDamage / hpB) * 100).toFixed(1);
    const maxPercent = ((maxDamage / hpB) * 100).toFixed(1);

    const isGuaranteedKO = minDamage >= hpB;
    const isPossibleKO = maxDamage >= hpB;
    const hitsToKO = Math.ceil(hpB / maxDamage);

    let statusText = "";
    if (isGuaranteedKO) {
      statusText = `<span style="color: #ef4444; font-weight: 800;">KO GARANTITO IN 1 COLPO (${maxPercent}%)</span>`;
    } else if (isPossibleKO) {
      statusText = `<span style="color: #f59e0b; font-weight: 800;">POSSIBILE KO IN 1 COLPO (${minPercent}% - ${maxPercent}%)</span>`;
    } else {
      statusText = `<span style="color: #84cc16; font-weight: 800;">NON MANDA KO (KO in ${hitsToKO} colpi)</span>`;
    }

    showModal({
      title: `${nameA} ➔ ${nameB}`,
      statusText,
      moveName,
      category: CATEGORY_TRANSLATIONS[currentMoveCategory] || currentMoveCategory,
      minDamage, maxDamage, hpB, minPercent, maxPercent,
      attackStat, defenseStat, statOffensivaNome, statDifensivaNome
    });
  }

  function showModal(data) {
    const overlay = document.createElement('div');
    overlay.className = 'damage-modal-overlay';
    overlay.innerHTML = `
      <div class="damage-modal-card">
        <h2 style="font-size: 1.2rem; color: #84cc16; text-align: center; margin-bottom: 12px;">${data.title}</h2>
        <div style="text-align: center; background: #0b0e14; padding: 10px; border-radius: 8px; margin-bottom: 12px;">
          ${data.statusText}
        </div>
        <div style="font-size: 0.85rem; color: #cbd5e1; background: #0b0e14; padding: 12px; border-radius: 8px;">
          <ul style="padding-left: 18px; margin: 0;">
            <li>Mossa: <b>${data.moveName}</b> (${data.category})</li>
            <li>Danno Totale: <b>${data.minDamage} - ${data.maxDamage} HP</b> (${data.minPercent}% - ${data.maxPercent}%) su ${data.hpB} HP</li>
            <li>Stat. Offensiva (${data.statOffensivaNome}): <b>${data.attackStat}</b></li>
            <li>Stat. Difensiva (${data.statDifensivaNome}): <b>${data.defenseStat}</b></li>
          </ul>
        </div>
        <button id="btn-close-modal" style="width: 100%; margin-top: 14px; padding: 10px; background: #26334d; border: none; color: #fff; border-radius: 8px; font-weight: 700; cursor: pointer;">CHIUDI</button>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('btn-close-modal').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  }

})();
