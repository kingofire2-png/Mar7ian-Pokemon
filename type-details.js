// Module separato per la gestione dei dettagli di efficacia difensiva dei tipi Pokémon
// Questo file estende le funzionalità senza modificare app.js

(function() {
  'use strict';

  // Nomi in italiano per la visualizzazione
  const TYPE_NAMES_ITA = {
    normal: 'Normale', fire: 'Fuoco', water: 'Acqua', grass: 'Erba',
    electric: 'Elettro', ice: 'Ghiaccio', fighting: 'Lotta', poison: 'Veleno',
    ground: 'Terra', flying: 'Volante', psychic: 'Psico', bug: 'Coleottero',
    rock: 'Roccia', ghost: 'Spettro', dragon: 'Drago', dark: 'Buio',
    steel: 'Acciaio', fairy: 'Folletto'
  };

  const TYPES_LIST = Object.keys(TYPE_NAMES_ITA);

  // Tabella delle efficacie offensive/difensive
  const TYPE_CHART = {
    normal:   { fighting: 2, ghost: 0 },
    fire:     { water: 2, ground: 2, rock: 2, fire: 0.5, grass: 0.5, ice: 0.5, bug: 0.5, steel: 0.5, fairy: 0.5 },
    water:    { electric: 2, grass: 2, fire: 0.5, water: 0.5, ice: 0.5, steel: 0.5 },
    grass:    { fire: 2, ice: 2, poison: 2, flying: 2, bug: 2, water: 0.5, grass: 0.5, electric: 0.5, ground: 0.5 },
    electric: { ground: 2, electric: 0.5, flying: 0.5, steel: 0.5 },
    ice:      { fire: 2, fighting: 2, rock: 2, steel: 2, ice: 0.5 },
    fighting: { flying: 2, psychic: 2, fairy: 2, bug: 0.5, rock: 0.5, dark: 0.5 },
    poison:   { ground: 2, psychic: 2, grass: 0.5, fighting: 0.5, poison: 0.5, bug: 0.5, fairy: 0.5 },
    ground:   { water: 2, grass: 2, ice: 2, poison: 0.5, rock: 0.5, electric: 0 },
    flying:   { electric: 2, ice: 2, rock: 2, grass: 0.5, fighting: 0.5, bug: 0.5, ground: 0 },
    psychic:  { bug: 2, ghost: 2, dark: 2, fighting: 0.5, psychic: 0.5 },
    bug:      { fire: 2, flying: 2, rock: 2, grass: 0.5, fighting: 0.5, ground: 0.5 },
    rock:     { water: 2, grass: 2, fighting: 2, ground: 2, steel: 2, normal: 0.5, fire: 0.5, poison: 0.5, flying: 0.5 },
    ghost:    { ghost: 2, dark: 2, poison: 0.5, bug: 0.5, normal: 0, fighting: 0 },
    dragon:   { ice: 2, dragon: 2, fairy: 2, fire: 0.5, water: 0.5, grass: 0.5, electric: 0.5 },
    dark:     { fighting: 2, bug: 2, fairy: 2, ghost: 0.5, dark: 0.5, psychic: 0 },
    steel:    { fire: 2, fighting: 2, ground: 2, normal: 0.5, grass: 0.5, ice: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 0.5, dragon: 0.5, steel: 0.5, fairy: 0.5, poison: 0 },
    fairy:    { poison: 2, steel: 2, fighting: 0.5, bug: 0.5, dark: 0.5, dragon: 0 }
  };

  // Funzione per calcolare l'efficacia di tutti i tipi d'attacco verso un tipo difensore
  function getAttackEffectivenessAgainstType(defenderType) {
    const result = {
      superEffective: [],
      normal: [],
      notVeryEffective: [],
      immune: []
    };

    TYPES_LIST.forEach(attackerId => {
      const mult = (TYPE_CHART[defenderType] && TYPE_CHART[defenderType][attackerId] !== undefined)
        ? TYPE_CHART[defenderType][attackerId]
        : 1;

      if (mult === 2) result.superEffective.push(attackerId);
      else if (mult === 1) result.normal.push(attackerId);
      else if (mult === 0.5) result.notVeryEffective.push(attackerId);
      else if (mult === 0) result.immune.push(attackerId);
    });

    return result;
  }

  // Esponiamo globalmente la funzione per la gestione del Pop-up
  window.showTypeDetails = function(targetType) {
    const targetTypeName = TYPE_NAMES_ITA[targetType] || targetType;
    const effectiveness = getAttackEffectivenessAgainstType(targetType);

    const formatBadges = (typesList) => {
      if (!typesList || typesList.length === 0) {
        return '<span style="font-size: 0.8rem; color: var(--text-muted, #94a3b8);">Nessuno</span>';
      }
      return typesList.map(t => {
        const nameIta = TYPE_NAMES_ITA[t] || t;
        return `<span class="type-badge" style="--type-color: var(--type-${t}); margin: 2px; display: inline-block;">${nameIta.toUpperCase()}</span>`;
      }).join(' ');
    };

    const contentHtml = `
      <div style="text-align: left; font-size: 0.85rem; line-height: 1.5;">
        <div style="margin-bottom: 12px;">
          <strong style="color: var(--accent, #38bdf8); display: block; margin-bottom: 4px;">Super Efficace (×2):</strong>
          <div>${formatBadges(effectiveness.superEffective)}</div>
        </div>
        <div style="margin-bottom: 12px;">
          <strong style="color: var(--text-main, #f0f4fc); display: block; margin-bottom: 4px;">Danno Normale (×1):</strong>
          <div>${formatBadges(effectiveness.normal)}</div>
        </div>
        <div style="margin-bottom: 12px;">
          <strong style="color: #f97316; display: block; margin-bottom: 4px;">Poco Efficace (×0.5):</strong>
          <div>${formatBadges(effectiveness.notVeryEffective)}</div>
        </div>
        <div>
          <strong style="color: #ef4444; display: block; margin-bottom: 4px;">Nessun Effetto (×0):</strong>
          <div>${formatBadges(effectiveness.immune)}</div>
        </div>
      </div>
    `;

    const abilityModal = document.getElementById('abilityModal');
    const abilityModalTitle = document.getElementById('abilityModalTitle');
    const abilityModalDesc = document.getElementById('abilityModalDesc');

    if (abilityModal && abilityModalTitle && abilityModalDesc) {
      abilityModalTitle.textContent = `Efficacia Difensiva tipo: ${targetTypeName.toUpperCase()}`;
      abilityModalDesc.innerHTML = contentHtml;
      abilityModal.style.display = 'flex';
    }
  };
})();
