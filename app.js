// Nomi in italiano delle statistiche
const statNamesIt = {
  'hp': 'PS',
  'attack': 'Attacco',
  'defense': 'Difesa',
  'special-attack': 'Sp. Atk',
  'special-defense': 'Sp. Def',
  'speed': 'Velocità'
};

function calcModdedStat(statName, baseVal, pokemonName) {
  return baseVal;
}

let allPokemon = [];
let filteredPokemon = [];
let selectedPokemon = null;
let currentLimit = 48;
let sortAscending = true;
let selectedTypes = [];

const pokemonListEl = document.getElementById('pokemon-list');
const countBadgeEl = document.getElementById('pokemon-count');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search');
const suggestionsDropdown = document.getElementById('suggestions-dropdown');
const sortBtn = document.getElementById('sort-button');
const loadMoreBtn = document.getElementById('load-more-btn');
const detailCardEl = document.getElementById('detail-card');
const resetTypesBtn = document.getElementById('reset-types');
const typeButtons = document.querySelectorAll('.type-button');

document.addEventListener('DOMContentLoaded', () => {
  fetchPokemonData();
  setupEventListeners();
});

async function fetchPokemonData() {
  try {
    const response = await fetch('./pokemon_data.json');
    if (!response.ok) {
      throw new Error('Impossibile caricare pokemon_data.json');
    }
    allPokemon = await response.json();
    filteredPokemon = [...allPokemon];
    renderList();
    if (allPokemon.length > 0) {
      selectPokemon(allPokemon[5] || allPokemon[0]);
    }
  } catch (err) {
    console.error('Errore nel caricamento dei dati Pokémon:', err);
  }
}

function setupEventListeners() {
  if (searchInput) {
    searchInput.addEventListener('input', handleSearch);
  }
  
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearSearchBtn.style.display = 'none';
      if (suggestionsDropdown) suggestionsDropdown.classList.remove('show');
      applyFilters();
    });
  }

  if (sortBtn) {
    sortBtn.addEventListener('click', () => {
      sortAscending = !sortAscending;
      sortBtn.textContent = sortAscending ? 'Ordina: Numero ↓' : 'Ordina: Numero ↑';
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
      typeButtons.forEach(btn => btn.classList.remove('selected'));
      applyFilters();
    });
  }

  typeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-type');
      if (selectedTypes.includes(type)) {
        selectedTypes = selectedTypes.filter(t => t !== type);
        btn.classList.remove('selected');
      } else {
        selectedTypes.push(type);
        btn.classList.add('selected');
      }
      applyFilters();
    });
  });
}

function handleSearch(e) {
  const query = e.target.value.trim().toLowerCase();
  if (clearSearchBtn) {
    clearSearchBtn.style.display = query ? 'block' : 'none';
  }
  
  if (query.length > 1) {
    const matches = allPokemon.filter(p => 
      p.name.toLowerCase().includes(query) || 
      String(p.id).includes(query)
    ).slice(0, 5);
    
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
    <button class="suggestion" onclick="selectAndScrollTo('${p.name}')">
      <img src="${p.sprite || p.image}" alt="${p.name}">
      <span>#${String(p.id).padStart(4, '0')} ${p.name}</span>
    </button>
  `).join('');
  
  suggestionsDropdown.classList.add('show');
}

window.selectAndScrollTo = function(pokemonName) {
  const p = allPokemon.find(item => item.name.toLowerCase() === pokemonName.toLowerCase());
  if (p) {
    selectPokemon(p);
    if (suggestionsDropdown) suggestionsDropdown.classList.remove('show');
  }
};

function applyFilters() {
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  
  filteredPokemon = allPokemon.filter(p => {
    const matchesName = p.name.toLowerCase().includes(query) || String(p.id).includes(query);
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
    return `
      <button class="pokemon-card ${isSelected ? 'active' : ''}" onclick="selectPokemonById(${p.id})">
        <span class="pokemon-number">${formattedId}</span>
        <img src="${p.image || p.sprite}" alt="${p.name}" loading="lazy">
        <span class="pokemon-name">${p.name}</span>
      </button>
    `;
  }).join('');
  
  if (loadMoreBtn) {
    loadMoreBtn.style.display = currentLimit < filteredPokemon.length ? 'block' : 'none';
  }
}

window.selectPokemonById = function(id) {
  const p = allPokemon.find(item => item.id === id);
  if (p) {
    selectPokemon(p);
  }
};

function selectPokemon(p) {
  selectedPokemon = p;
  renderList();
  renderDetailCard(p);
}

function renderDetailCard(p) {
  if (!detailCardEl) return;
  
  const formattedId = '#' + String(p.id).padStart(4, '0');
  
  const typesHtml = (p.types || []).map(t => 
    `<span class="type-badge" style="--type-color: var(--type-${t}, #666);">${t}</span>`
  ).join('');

  const abilitiesHtml = (p.abilities || []).map(a => `
    <span class="ability-btn">${a.name}${a.is_hidden ? ' (Nascosta)' : ''}</span>
  `).join('');

  const maxBarValue = 180;
  const statsHtml = (p.stats || []).map(s => {
    const sName = statNamesIt[s.stat.name] || s.stat.name;
    const moddedVal = calcModdedStat(s.stat.name, s.base_stat, p.name);
    const fillPercent = Math.min(100, Math.max(10, (moddedVal / maxBarValue) * 100));
    
    let hexColor = '#84cc16';
    let colorClass = 'stat-green';
    
    if (moddedVal <= 50) {
      hexColor = '#ef4444';
      colorClass = 'stat-red';
    } else if (moddedVal <= 100) {
      hexColor = '#f97316';
      colorClass = 'stat-orange';
    }

    return `
      <div class="stat-row">
        <span class="stat-label">${sName}</span>
        <span class="stat-value">${moddedVal}</span>
        <div class="stat-bar-bg">
          <div class="stat-bar-fill ${colorClass}" style="width: ${fillPercent}%; background-color: ${hexColor} !important;"></div>
        </div>
      </div>`;
  }).join('');

  const weaknessesHtml = (p.weaknesses || []).map(w => `
    <span class="weakness" style="--type-color: var(--type-${w.type}, #666);">
      ${w.type} <b>x${w.multiplier}</b>
    </span>
  `).join('');

  detailCardEl.innerHTML = `
    <div class="detail-top">
      <span class="detail-index">${formattedId}</span>
      <img src="${p.image || p.sprite}" alt="${p.name}">
    </div>
    <div class="detail-content">
      <h2>${p.name}</h2>
      <div class="card-types">${typesHtml}</div>
      
      <div class="weakness-label" style="color: #84cc16; margin-top: 14px;">ABILITÀ (CLICCA PER DETTAGLI)</div>
      <div class="abilities-list">${abilitiesHtml}</div>
      
      <div class="weakness-label" style="color: #84cc16; margin-top: 16px;">STATISTICHE</div>
      <div class="stats-container">${statsHtml}</div>
      
      ${weaknessesHtml ? `
        <div class="weakness-label" style="color: #84cc16; margin-top: 18px;">DEBOLEZZE (DANNI SUBITI)</div>
        <div class="weaknesses">${weaknessesHtml}</div>
      ` : ''}
    </div>
  `;
}
