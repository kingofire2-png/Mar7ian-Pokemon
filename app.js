    // Configurazione dei tipi Pokémon e colori (fonte unica: shared-data.js)
    const TYPES_CONFIG = window.SharedData.TYPES_CONFIG;
    const TYPE_NAMES_ITA = window.SharedData.TYPE_NAMES_ITA;
    // Matrice dell'efficacia difensiva (danni subiti)
    const TYPE_CHART = window.SharedData.TYPE_CHART;
    // Matrice dell'efficacia offensiva (Super Efficace Contro)
    const OFFENSIVE_CHART = window.SharedData.OFFENSIVE_CHART;

    const statNamesIt = {
      'hp': 'PS',
      'attack': 'Attacco',
      'defense': 'Difesa',
      'special-attack': 'Sp. Atk',
      'special-defense': 'Sp. Def',
      'speed': 'Velocità'
    };

    let allPokemon = [];
    let filteredPokemon = [];
    let selectedPokemon = null;
    let currentLimit = 48;
    let sortAscending = true;
    let selectedTypes = [];

    // Elementi DOM
    const pokemonListEl = document.getElementById('pokemon-list');
    const countBadgeEl = document.getElementById('pokemon-count');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('btn-clear-search');
    const suggestionsDropdown = document.getElementById('suggestions');
    const sortBtn = document.getElementById('btn-sort');
    const loadMoreBtn = document.getElementById('btn-load-more');
    const detailCardEl = document.getElementById('detail-card');
    const resetTypesBtn = document.getElementById('btn-reset-types');

    // Modal Abilità
    const abilityModal = document.getElementById('abilityModal');
    const abilityModalTitle = document.getElementById('abilityModalTitle');
    const abilityModalDesc = document.getElementById('abilityModalDesc');
    const btnCloseAbility = document.getElementById('btn-close-ability');

    document.addEventListener('DOMContentLoaded', () => {
      renderTypeButtons();
      fetchPokemonData();
      setupEventListeners();
    });

    function renderTypeButtons() {
      const container = document.getElementById('type-grid');
      if (!container) return;

      container.innerHTML = TYPES_CONFIG.map(type => `
        <button class="type-button" data-type="${type.id}">
          ${type.name}
        </button>
      `).join('');

      container.querySelectorAll('.type-button').forEach(btn => {
        btn.addEventListener('click', () => {
          const type = btn.getAttribute('data-type');
          if (selectedTypes.includes(type)) {
            selectedTypes = selectedTypes.filter(t => t !== type);
            btn.classList.remove('selected');
            btn.style.backgroundColor = '';
            btn.style.borderColor = '';
            btn.style.color = '';
          } else {
            if (selectedTypes.length < 2) {
              selectedTypes.push(type);
              btn.classList.add('selected');
              btn.style.backgroundColor = `var(--type-${type})`;
              btn.style.borderColor = `var(--type-${type})`;
              btn.style.color = '#ffffff';
            }
          }
          applyFilters();
        });
      });
    }

    async function fetchPokemonData() {
      try {
        allPokemon = await window.SharedData.dexReady;

        filteredPokemon = [...allPokemon];
        renderList();
        selectPokemonById(6);

        window.addEventListener('pokedex-types-ready', () => {
          applyFilters();
        });
      } catch (err) {
        console.error('Errore durante il recupero dati:', err);
      }
    }

    function setupEventListeners() {
      if (searchInput) searchInput.addEventListener('input', handleSearch);
      
      if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
          searchInput.value = '';
          clearSearchBtn.style.display = 'none';
          if (suggestionsDropdown) suggestionsDropdown.classList.remove('show');
          applyFilters();
        });
      }

      document.addEventListener('click', (e) => {
        if (suggestionsDropdown && !e.target.closest('.search-box')) {
          suggestionsDropdown.classList.remove('show');
        }
      });

      if (sortBtn) {
        sortBtn.addEventListener('click', () => {
          sortAscending = !sortAscending;
          sortBtn.innerHTML = sortAscending ? 'Ordina: <span>Numero ↓</span>' : 'Ordina: <span>Numero ↑</span>';
          applyFilters();
        });
      }

      if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
          currentLimit += 48;
          renderList();
        });
      }

      if (resetTypesBtn) {
        resetTypesBtn.addEventListener('click', () => {
          selectedTypes = [];
          document.querySelectorAll('.type-button').forEach(btn => {
            btn.classList.remove('selected');
            btn.style.backgroundColor = '';
            btn.style.borderColor = '';
            btn.style.color = '';
          });
          applyFilters();
        });
      }

      if (btnCloseAbility) {
        btnCloseAbility.addEventListener('click', () => {
          if (abilityModal) abilityModal.style.display = 'none';
        });
      }
    }

    function handleSearch(e) {
      const query = e.target.value.trim().toLowerCase().replace(/[\s-]/g, '');
      if (clearSearchBtn) clearSearchBtn.style.display = query ? 'block' : 'none';
      
      if (query.length > 0) {
        const matches = allPokemon.filter(p => {
          const cleanName = p.name.toLowerCase().replace(/[\s-]/g, '');
          const cleanRaw = p.rawName.toLowerCase().replace(/[\s-]/g, '');
          return cleanName.includes(query) || cleanRaw.includes(query) || String(p.id).includes(query);
        }).slice(0, 6);
        renderSuggestions(matches);
      } else {
        if (suggestionsDropdown) suggestionsDropdown.classList.remove('show');
      }
      applyFilters();
    }

    function renderSuggestions(matches) {
      if (!suggestionsDropdown) return;
      if (matches.length === 0) {
        suggestionsDropdown.classList.remove('show');
        return;
      }
      
      suggestionsDropdown.innerHTML = matches.map(p => `
        <button class="suggestion" onclick="selectAndScrollTo('${p.rawName}')">
          <img src="${p.image}" alt="${p.name}" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png'">
          <span>#${String(p.id).padStart(4, '0')} ${p.name}</span>
        </button>
      `).join('');
      
      suggestionsDropdown.classList.add('show');
    }

    window.selectAndScrollTo = function(rawName) {
      const p = allPokemon.find(item => item.rawName === rawName || item.name.toLowerCase() === rawName.toLowerCase());
      if (p) {
        selectPokemonById(p.id);
        if (suggestionsDropdown) suggestionsDropdown.classList.remove('show');
      }
    };

    function applyFilters() {
      const rawQuery = searchInput ? searchInput.value.trim().toLowerCase() : '';
      const query = rawQuery.replace(/[\s-]/g, '');
      
      filteredPokemon = allPokemon.filter(p => {
        const cleanName = p.name.toLowerCase().replace(/[\s-]/g, '');
        const cleanRaw = p.rawName.toLowerCase().replace(/[\s-]/g, '');
        const matchesName = cleanName.includes(query) || cleanRaw.includes(query) || String(p.id).includes(query);
        
        const matchesType = selectedTypes.length === 0 || selectedTypes.every(t => p.types && p.types.includes(t));
        return matchesName && matchesType;
      });

      filteredPokemon.sort((a, b) => sortAscending ? a.id - b.id : b.id - a.id);
      currentLimit = 48;
      renderList();
    }

    function renderList() {
      if (!pokemonListEl) return;
      
      if (countBadgeEl) {
        countBadgeEl.textContent = `${filteredPokemon.length} POKÉMON`;
      }
      
      const visible = filteredPokemon.slice(0, currentLimit);
      
      pokemonListEl.innerHTML = visible.map(p => {
        const isSelected = selectedPokemon && selectedPokemon.id === p.id;
        const formattedId = '#' + String(p.id).padStart(4, '0');
        const fallbackImage = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png`;
        
        return `
          <button class="pokemon-card ${isSelected ? 'active' : ''}" onclick="selectPokemonById(${p.id})">
            <span class="pokemon-number">${formattedId}</span>
            <img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackImage}';">
            <span class="pokemon-name" style="color: var(--text-main) !important;">${p.name}</span>
          </button>
        `;
      }).join('');
      
      if (loadMoreBtn) {
        loadMoreBtn.style.display = currentLimit < filteredPokemon.length ? 'block' : 'none';
      }
    }

    // Calcolo moltiplicatori difensivi
    function calculateTypeMultipliers(types) {
      const multipliers = {};
      TYPES_CONFIG.forEach(t => multipliers[t.id] = 1);

      types.forEach(pType => {
        const typeChart = TYPE_CHART[pType] || {};
        Object.keys(typeChart).forEach(atkType => {
          multipliers[atkType] *= typeChart[atkType];
        });
      });

      return multipliers;
    }

    // Calcolo Debolezze Difensive
    function calculateWeaknesses(types) {
      const multipliers = calculateTypeMultipliers(types);
      const weaknesses = [];
      Object.keys(multipliers).forEach(type => {
        if (multipliers[type] > 1) {
          weaknesses.push({ type, multiplier: multipliers[type] });
        }
      });
      weaknesses.sort((a,b)=>b.multiplier-a.multiplier);
      return weaknesses;
    }

    // Calcolo Resistenze e Immunità
    function calculateResistancesAndImmunities(types) {
      const multipliers = calculateTypeMultipliers(types);
      const resistances = [];
      const immunities = [];

      Object.keys(multipliers).forEach(type => {
        if (multipliers[type] === 0) {
          immunities.push({ type });
        } else if (multipliers[type] < 1) {
          resistances.push({ type, multiplier: multipliers[type] });
        }
      });

      resistances.sort((a,b)=>a.multiplier-b.multiplier);
      return { resistances, immunities };
    }


// Calcolo Super Efficace Contro (STAB)
    function calculateSuperEffective(types) {
      const effectiveSet = new Set();
      types.forEach(t => {
        const targets = OFFENSIVE_CHART[t] || [];
        targets.forEach(target => effectiveSet.add(target));
      });
      return Array.from(effectiveSet);
    }

    window.selectPokemonById = async function(id) {
      try {
        const data = await window.SharedData.getSpeciesDetail(id);

        const formattedName = data.name
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        const artwork = data.sprites.other['official-artwork'].front_default 
          || data.sprites.front_default 
          || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;

        const abilitiesPromises = data.abilities.map(async (a) => {
          let nameEng = a.ability.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          let nameIta = nameEng;

          try {
            const abRes = await fetch(a.ability.url);
            const abData = await abRes.json();
            
            const itaNameObj = abData.names.find(n => n.language.name === 'it');
            if (itaNameObj) {
              nameIta = itaNameObj.name;
            }
          } catch (e) {
            console.warn('Impossibile recuperare traduzione abilità:', e);
          }

          return {
            rawName: a.ability.name,
            displayName: `${nameEng} | ${nameIta}`,
            url: a.ability.url,
            is_hidden: a.is_hidden
          };
        });

        const parsedAbilities = await Promise.all(abilitiesPromises);
        const pokemonTypes = data.types.map(t => t.type.name);

        selectedPokemon = {
          id: data.id,
          name: formattedName,
          image: artwork,
          types: pokemonTypes,
          superEffective: calculateSuperEffective(pokemonTypes),
          weaknesses: calculateWeaknesses(pokemonTypes),
          ...calculateResistancesAndImmunities(pokemonTypes),
          abilities: parsedAbilities,
          stats: data.stats
        };

        const index = allPokemon.findIndex(item => item.id === id);
        if (index !== -1) allPokemon[index].types = selectedPokemon.types;

        renderList();
        renderDetailCard(selectedPokemon);
      } catch (err) {
        console.error('Errore nel caricamento dettagli:', err);
      }
    };

    function renderDetailCard(p) {
      if (!detailCardEl) return;
      
      const formattedId = '#' + String(p.id).padStart(4, '0');
      
      const typesHtml = (p.types || []).map(t => 
        `<span class="type-badge" style="--type-color: var(--type-${t}, #666);">${t.toUpperCase()}</span>`
      ).join('');

      const superEffectiveHtml = (p.superEffective || []).map(t => {
        const typeIta = TYPE_NAMES_ITA[t] || t;
        return `
          <div class="weakness-badge" style="border: 1px solid var(--type-${t}); background: rgba(0, 0, 0, 0.2); color: #ffffff; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
            <span>${typeIta}</span>
            <span style="color: var(--type-${t}); font-weight: 800;">&times;2</span>
          </div>
        `;
      }).join('');

      const weaknessesHtml = (p.weaknesses || []).map(w => {
        const typeIta = TYPE_NAMES_ITA[w.type] || w.type;
        return `
          <div class="weakness-badge" onclick="showTypeDetails('${w.type}')" style="cursor:pointer;border: 1px solid var(--type-${w.type}); background: rgba(0, 0, 0, 0.2); color: #ffffff; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
            <span>${typeIta}</span>
            <span style="color: var(--type-${w.type}); font-weight: 800;">&times;${w.multiplier}</span>
          </div>
        `;
      }).join('');

      const resistancesHtml = (p.resistances || []).map(r => {
        const typeIta = TYPE_NAMES_ITA[r.type] || r.type;
        const mult = Number.isInteger(r.multiplier) ? r.multiplier : r.multiplier.toFixed(2).replace(/\.0+$|0+$/,'');
        return `
          <div class="weakness-badge" style="border: 1px solid var(--type-${r.type}); background: rgba(0, 0, 0, 0.2); color: #ffffff; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
            <span>${typeIta}</span>
            <span style="color: var(--type-${r.type}); font-weight: 800;">&times;${mult}</span>
          </div>`;
      }).join('');

      const immunitiesHtml = (p.immunities || []).map(i => {
        const typeIta = TYPE_NAMES_ITA[i.type] || i.type;
        return `
          <div class="weakness-badge" style="border: 1px solid var(--type-${i.type}); background: rgba(0, 0, 0, 0.2); color: #ffffff; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
            <span>${typeIta}</span>
            <span style="color: var(--type-${i.type}); font-weight: 800;">×0</span>
          </div>`;
      }).join('');

      const defensesHtml = resistancesHtml + immunitiesHtml;

      const abilitiesHtml = (p.abilities || []).map(a => `
        <button class="ability-btn" onclick="showAbilityDetails('${a.displayName.replace(/'/g, "\\'")}', '${a.url}')">
          ${a.displayName}${a.is_hidden ? ' (Nascosta)' : ''}
        </button>
      `).join('');

      const maxBarValue = 250;
      const statsHtml = (p.stats || []).map(s => {
        const rawName = s.stat ? s.stat.name : s.name;
        const baseVal = s.base_stat !== undefined ? s.base_stat : s.value;
        
        const modifiedVal = (rawName === 'hp') ? (baseVal + 75) : (baseVal + 20);
        const sName = statNamesIt[rawName] || rawName;
        const fillPercent = Math.min(100, Math.max(10, (modifiedVal / maxBarValue) * 100));
        
        let hexColor = '#84cc16';
        let colorClass = 'stat-green';
        
        if (modifiedVal <= 70) {
          hexColor = '#ef4444';
          colorClass = 'stat-red';
        } else if (modifiedVal <= 120) {
          hexColor = '#f97316';
          colorClass = 'stat-orange';
        }

        return `
          <div class="stat-row">
            <span class="stat-label">${sName}</span>
            <span class="stat-value">${modifiedVal}</span>
            <div class="stat-bar-bg">
              <div class="stat-bar-fill ${colorClass}" style="width: ${fillPercent}%; background-color: ${hexColor} !important;"></div>
            </div>
          </div>`;
      }).join('');

      detailCardEl.innerHTML = `
        <div class="detail-top">
          <span class="detail-index">${formattedId}</span>
          <img src="${p.image}" alt="${p.name}">
        </div>
        <div class="detail-content">
          <h2>${p.name}</h2>
          <div class="card-types">${typesHtml}</div>
          
          <div class="weakness-label" style="color: var(--accent); margin-top: 14px;">SUPER EFFICACE CONTRO (STAB)</div>
          <div class="weaknesses-list" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px;">
            ${superEffectiveHtml.length > 0 ? superEffectiveHtml : '<span style="font-size: 0.8rem; color: var(--text-muted);">Nessuna efficacia STAB speciale.</span>'}
          </div>

          <div class="weakness-label" style="color: var(--accent); margin-top: 14px;">DEBOLEZZE (DANNI SUBITI)</div>
          <div class="weaknesses-list" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px;">
            ${weaknessesHtml.length > 0 ? weaknessesHtml : '<span style="font-size: 0.8rem; color: var(--text-muted);">Nessuna debolezza speciale.</span>'}
          </div>

          <div class="weakness-label" style="color: var(--accent); margin-top: 14px;">RESISTENZE E IMMUNITÀ (DANNI RIDOTTI/NULLI)</div>
          <div class="weaknesses-list" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px;">
            ${defensesHtml.length > 0 ? defensesHtml : '<span style="font-size: 0.8rem; color: var(--text-muted);">Nessuna resistenza o immunità.</span>'}
          </div>

          <div class="weakness-label" style="color: var(--accent); margin-top: 14px;">ABILITÀ (CLICCA PER DETTAGLI)</div>
          <div class="abilities-list">${abilitiesHtml}</div>
          
          <div class="weakness-label" style="color: var(--accent); margin-top: 16px;">STATISTICHE (LIV. 50 MOD)</div>
          <div class="stats-container">${statsHtml}</div>
        </div>
      `;
    }

    window.showAbilityDetails = async function(displayName, url) {
      if (!abilityModal) return;
      
      abilityModalTitle.textContent = displayName;
      abilityModalDesc.textContent = "Caricamento descrizione in corso...";
      abilityModal.style.display = 'flex';

      try {
        const res = await fetch(url);
        const data = await res.json();

        let textIta = "";

        if (data.flavor_text_entries && data.flavor_text_entries.length > 0) {
          const itaFlavor = [...data.flavor_text_entries].reverse().find(f => f.language.name === 'it');
          if (itaFlavor) {
            textIta = itaFlavor.flavor_text;
          }
        }

        if (!textIta && data.effect_entries && data.effect_entries.length > 0) {
          const itaEffect = data.effect_entries.find(e => e.language.name === 'it');
          if (itaEffect) {
            textIta = itaEffect.short_effect || itaEffect.effect;
          }
        }

        if (!textIta) {
          const engEffect = data.effect_entries.find(e => e.language.name === 'en');
          const engFlavor = data.flavor_text_entries ? [...data.flavor_text_entries].reverse().find(f => f.language.name === 'en') : null;
          textIta = (engEffect ? (engEffect.short_effect || engEffect.effect) : (engFlavor ? engFlavor.flavor_text : "Descrizione non disponibile."));
        }

        abilityModalDesc.textContent = textIta;
      } catch (err) {
        abilityModalDesc.textContent = "Impossibile caricare i dettagli dell'abilità.";
      }
    };
