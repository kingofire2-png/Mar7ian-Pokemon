// Module separato per la gestione dei dettagli di efficacia difensiva dei tipi Pokémon
// Questo file estende le funzionalità senza modificare app.js
// Dipende da shared-data.js (window.SharedData.TYPE_NAMES_ITA / getAttackEffectivenessAgainstType),
// deve caricare dopo.

(function() {
  'use strict';

  // Nomi in italiano e tabella efficacie: fonte unica, vedi shared-data.js
  const TYPE_NAMES_ITA = window.SharedData.TYPE_NAMES_ITA;

  // Esponiamo globalmente la funzione per la gestione del Pop-up
  window.showTypeDetails = function(targetType) {
    const targetTypeName = TYPE_NAMES_ITA[targetType] || targetType;
    const effectiveness = window.SharedData.getAttackEffectivenessAgainstType(targetType);

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
