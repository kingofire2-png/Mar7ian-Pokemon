// Configurazione dei tipi Pokémon
const TYPES_CONFIG = [
  { id: 'normal', name: 'Normale' },
  { id: 'fire', name: 'Fuoco' },
  { id: 'water', name: 'Acqua' },
  { id: 'grass', name: 'Erba' },
  { id: 'electric', name: 'Elettro' },
  { id: 'ice', name: 'Ghiaccio' },
  { id: 'fighting', name: 'Lotta' },
  { id: 'poison', name: 'Veleno' },
  { id: 'ground', name: 'Terra' },
  { id: 'flying', name: 'Volante' },
  { id: 'psychic', name: 'Psico' },
  { id: 'bug', name: 'Coleottero' },
  { id: 'rock', name: 'Roccia' },
  { id: 'ghost', name: 'Spettro' },
  { id: 'dragon', name: 'Drago' },
  { id: 'dark', name: 'Buio' },
  { id: 'steel', name: 'Acciaio' },
  { id: 'fairy', name: 'Folletto' }
];

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
const clearSearchBtn = document.getElementById('clear-search');
const suggestionsDropdown = document.getElementById('suggestions-dropdown');
const sortBtn = document.getElementById('sort-button');
const loadMoreBtn = document.getElementById('load-more-btn');
const detailCardEl = document.getElementById('detail-card');
const resetTypesBtn = document.getElementById('reset-types');

document.addEventListener('DOMContentLoaded', () => {
  renderTypeButtons();
  fetchPokemonData();
  setupEventListeners();
});

// Generazione dinamica dei pulsanti tipo
function renderTypeButtons() {
  const container = document.getElementById('type-filters') || document.querySelector('.type-filters-container') || document.querySelector('.type-filters-grid');
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
      } else {
        if (selectedTypes.length < 2) {
          selectedTypes.push(type);
          btn.classList.add('selected');
        }
      }
      applyFilters();
    });
  });
}

// Fetch completa da PokéAPI (Inclusi ID 10001+ per Mega Evoluzioni e Forme Speciali)
async function fetchPokemonData() {
  try {
    // Scarica sia la lista base (1-1025) sia le forme extra/Mega (10001+)
    const response = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1300');
    if (!response.ok) throw new Error('Errore nel caricamento da PokéAPI');
    
    const data = await response.json();
    
    allPokemon = data.results.map((p) => {
      // Estrae l'ID dall'URL dell'API per gestire anche gli ID 10000+ delle Mega Evoluzioni
      const urlParts = p.url.split('/').filter(Boolean);
      const id = parseInt(urlParts[urlParts.length - 1], 10);
      
      // Formatta il nome leggibile (es. charizard-mega-x -> Charizard Mega X)
      const formattedName = p.name
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      return {
        id: id,
        rawName: p.name,
        name: formattedName,
        url: p.url,
        image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`,
        types: []
      };
    });

    filteredPokemon = [...allPokemon];
    renderList();
    
    // Carica Charizard (#6) all'avvio
    selectPokemonById(6);
  } catch (err) {
    console.error('Errore durante il recupero dei dati:', err);
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
      document.querySelectorAll('.type-button').forEach(btn => btn.classList.remove('selected'));
      applyFilters();
    });
  }
}

function handleSearch(e) {
  const query = e.target.value.trim().toLowerCase();
  if (clearSearchBtn) clearSearchBtn.style.display = query ? 'block' : 'none';
  
  if (query.length > 1) {
    const matches = allPokemon.filter(p => 
      p.name.toLowerCase().includes(query) || String(p.id).includes(query)
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
    <button class="suggestion" onclick="selectAndScrollTo('${p.rawName}')">
      <img src="${p.image}" alt="${p.name}" onerror="this.src='${p.image}'">
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
    // Immagine fallback sulle sprite normali se l'official artwork per una forma non esiste
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

// Caricamento completo dei dettagli da PokéAPI
window.selectPokemonById = async function(id) {
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    const data = await res.json();
    
    const formattedName = data.name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    const artwork = data.sprites.other['official-artwork'].front_default 
      || data.sprites.front_default 
      || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;

    selectedPokemon = {
      id: data.id,
      name: formattedName,
      image: artwork,
      types: data.types.map(t => t.type.name),
      abilities: data.abilities.map(a => ({ name: a.ability.name, is_hidden: a.is_hidden })),
      stats: data.stats
    };

    const index = allPokemon.findIndex(item => item.id === id);
    if (index !== -1) allPokemon[index].types = selectedPokemon.types;

    renderList();
    renderDetailCard(selectedPokemon);
  } catch (err) {
    console.error('Errore nel caricamento del dettaglio Pokémon:', err);
  }
};

function renderDetailCard(p) {
  if (!detailCardEl) return;
  
  const formattedId = '#' + String(p.id).padStart(4, '0');
  
  const typesHtml = (p.types || []).map(t => 
    `<span class="type-badge" style="--type-color: var(--type-${t}, #666);">${t.toUpperCase()}</span>`
  ).join('');

  const abilitiesHtml = (p.abilities || []).map(a => `
    <span class="ability-btn">${a.name}${a.is_hidden ? ' (Nascosta)' : ''}</span>
  `).join('');

  const maxBarValue = 180;
  const statsHtml = (p.stats || []).map(s => {
    const rawName = s.stat ? s.stat.name : s.name;
    const baseVal = s.base_stat !== undefined ? s.base_stat : s.value;
    const sName = statNamesIt[rawName] || rawName;
    const fillPercent = Math.min(100, Math.max(10, (baseVal / maxBarValue) * 100));
    
    let hexColor = '#84cc16'; // Verde (101+)
    let colorClass = 'stat-green';
    
    if (baseVal <= 50) {
      hexColor = '#ef4444'; // Rosso (1-50)
      colorClass = 'stat-red';
    } else if (baseVal <= 100) {
      hexColor = '#f97316'; // Arancione (51-100)
      colorClass = 'stat-orange';
    }

    return `
      <div class="stat-row">
        <span class="stat-label">${sName}</span>
        <span class="stat-value">${baseVal}</span>
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
      
      <div class="weakness-label" style="color: #84cc16; margin-top: 14px;">ABILITÀ (CLICCA PER DETTAGLI)</div>
      <div class="abilities-list">${abilitiesHtml}</div>
      
      <div class="weakness-label" style="color: #84cc16; margin-top: 16px;">STATISTICHE</div>
      <div class="stats-container">${statsHtml}</div>
    </div>
  `;
}
