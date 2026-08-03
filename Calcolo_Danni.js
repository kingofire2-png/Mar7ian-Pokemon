/**
 * Calcolo_Danni.js
 * Modulo per il calcolo danni Pokédex & Integrazione Calcolatore
 */

// Scope globale per la gestione dello switch sezioni
window.switchAppSection = function(section) {
  const pokedexView = document.getElementById('main-pokedex-view');
  const calcView = document.getElementById('damage-calc-view');

  if (section === 'damage-calc' || section === 'calcolo' || section === 'calculator') {
    if (pokedexView) pokedexView.style.display = 'none';
    if (calcView) calcView.style.display = 'block';

    // Inizializza ed eventualmente ripopola i menu a tendina
    window.initCalculatorDropdowns();
  } else {
    if (pokedexView) pokedexView.style.display = 'block';
    if (calcView) calcView.style.display = 'none';
  }
};

/**
 * Popola e gestisce i menu dei Pokémon per il calcolatore di danni
 */
window.initCalculatorDropdowns = function() {
  const selectA = document.getElementById('select-pokemon-a');
  const selectB = document.getElementById('select-pokemon-b');

  if (!selectA || !selectB) return;

  // Popola solo se il menu contiene la sola voce predefinita
  if (selectA.options.length <= 1 && typeof allPokemon !== 'undefined' && Array.isArray(allPokemon) && allPokemon.length > 0) {
    const optionsHtml = allPokemon.map(p => `<option value="${p.rawName}">${p.name}</option>`).join('');
    selectA.innerHTML = '<option value="">-- Seleziona Pokémon A --</option>' + optionsHtml;
    selectB.innerHTML = '<option value="">-- Seleziona Pokémon B --</option>' + optionsHtml;

    selectA.onchange = (e) => {
      const p = allPokemon.find(item => item.rawName === e.target.value);
      if (p && typeof assignPokemonSlot === 'function') {
        assignPokemonSlot(p.id, 'A');
      }
    };

    selectB.onchange = (e) => {
      const p = allPokemon.find(item => item.rawName === e.target.value);
      if (p && typeof assignPokemonSlot === 'function') {
        assignPokemonSlot(p.id, 'B');
      }
    };
  }
};

/**
 * Calcolo Formula Danno VGC / Standard (Livello 50)
 * @param {Object} attacker - Dati dell'attaccante
 * @param {Object} defender - Dati del difensore
 * @param {Object} move - Dati della mossa
 * @returns {Object} Risultato del calcolo (danni min/max e percentuali)
 */
window.calculateDamage = function(attacker, defender, move) {
  if (!attacker || !defender || !move || !move.power) {
    return { minDamage: 0, maxDamage: 0, minPercent: '0%', maxPercent: '0%', rolls: [] };
  }

  const level = attacker.level || 50;
  const isPhysical = move.category === 'Physical' || move.category === 'Fisico';
  
  const atkStat = isPhysical ? attacker.stats.atk : attacker.stats.spa;
  const defStat = isPhysical ? defender.stats.def : defender.stats.spd;

  // Calcolo del danno base secondo la formula ufficiale
  let baseDamage = Math.floor(Math.floor((2 * level / 5) + 2) * move.power * (atkStat / defStat) / 50) + 2;

  // STAB (Same Type Attack Bonus)
  const isStab = Array.isArray(attacker.types) && attacker.types.includes(move.type);
  const stabMultiplier = isStab ? 1.5 : 1.0;

  // Moltiplicatore di efficacia del tipo
  const typeMultiplier = typeof getTypeEffectiveness === 'function' 
    ? getTypeEffectiveness(move.type, defender.types) 
    : 1.0;

  const rolls = [];
  for (let roll = 85; roll <= 100; roll++) {
    let damage = Math.floor(baseDamage * (roll / 100));
    damage = Math.floor(damage * stabMultiplier);
    damage = Math.floor(damage * typeMultiplier);
    rolls.push(damage);
  }

  const minDamage = rolls[0];
  const maxDamage = rolls[rolls.length - 1];

  const defenderHp = defender.stats.hp || 1;
  const minPercent = ((minDamage / defenderHp) * 100).toFixed(1) + '%';
  const maxPercent = ((maxDamage / defenderHp) * 100).toFixed(1) + '%';

  return {
    minDamage,
    maxDamage,
    minPercent,
    maxPercent,
    rolls,
    typeMultiplier
  };
};

// Aggancio automatico dell'evento di navigazione topbar al caricamento della pagina
document.addEventListener('DOMContentLoaded', () => {
  const navSelect = document.getElementById('app-navigation-select');
  if (navSelect) {
    navSelect.addEventListener('change', (e) => {
      window.switchAppSection(e.target.value);
    });
  }
});
