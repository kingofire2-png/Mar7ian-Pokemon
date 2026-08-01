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

// Fetch completa ed estrazione dei tipi
async function fetchPokemonData() {
  try {
    const response = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1300');
    if (!response.ok) throw new Error('Errore PokéAPI');
    
    const data = await response.json();
    
    allPokemon = data.results.map((p) => {
      const urlParts = p.url.split('/').filter(Boolean);
      const id = parseInt(urlParts[urlParts.length - 1], 10);
      
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
    selectPokemonById(6); // Carica Charizard di default

    // Caricamento in background di TUTTI i tipi (Base + Mega + Forme Speciali)
    loadTypesInBackground();
  } catch (err) {
    console.error('Errore durante il recupero dati:', err);
  }
}

// Mappa TUTTI i tipi dei Pokémon (inclusi ID 10001+)
async function loadTypesInBackground() {
  try {
    const res = await fetch('https://pokeapi.co/api/v2/type?limit=20');
    const typeData = await res.json();

    for (const t of typeData.results) {
      const typeRes = await fetch(t.url);
      const details = await typeRes.json();
      
      const typeName = t.name;
      details.pokemon.forEach(item => {
        const urlParts = item.pokemon.url.split('/').filter(Boolean);
        const pId = parseInt(urlParts[urlParts.length - 1], 10);
        const pok = allPokemon.find(p => p.id === pId);
        if (pok && !pok.types.includes(typeName)) {
          pok.types.push(typeName);
        }
      });
    }
    applyFilters();
  } catch (e) {
    console.warn('Caricamento tipi completato parzialmente:', e);
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
      document.querySelectorAll('.type-button').forEach(btn => btn.classList.remove('selected'));
      applyFilters();
    });
  }

  // Chiusura Modale Abilità
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
      abilities: data.abilities.map(a => ({ name: a.ability.name, url: a.ability.url, is_hidden: a.is_hidden })),
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

  const abilitiesHtml = (p.abilities || []).map(a => `
    <button class="ability-btn" onclick="showAbilityDetails('${a.name}', '${a.url}')">
      ${a.name}${a.is_hidden ? ' (Nascosta)' : ''}
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
      
      <div class="weakness-label" style="color: #84cc16; margin-top: 14px;">ABILITÀ (CLICCA PER DETTAGLI)</div>
      <div class="abilities-list">${abilitiesHtml}</div>
      
      <div class="weakness-label" style="color: #84cc16; margin-top: 16px;">STATISTICHE (LIV. 50 MOD)</div>
      <div class="stats-container">${statsHtml}</div>
    </div>
  `;
}

// Funzione Pop-up Dettagli Abilità
window.showAbilityDetails = async function(name, url) {
  if (!abilityModal) return;
  
  const formattedName = name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  abilityModalTitle.textContent = formattedName;
  abilityModalDesc.textContent = "Caricamento in corso...";
  abilityModal.style.display = 'flex';

  try {
    const res = await fetch(url);
    const data = await res.json();

    // Cerca la descrizione in italiano, altrimenti usa l'inglese
    let entry = data.effect_entries.find(e => e.language.name === 'it');
    if (!entry) entry = data.effect_entries.find(e => e.language.name === 'en');
    
    if (entry) {
      abilityModalDesc.textContent = entry.effect || entry.short_effect;
    } else if (data.flavor_text_entries && data.flavor_text_entries.length > 0) {
      const ft = data.flavor_text_entries.find(f => f.language.name === 'it') || data.flavor_text_entries.find(f => f.language.name === 'en');
      abilityModalDesc.textContent = ft ? ft.flavor_text : "Nessuna descrizione disponibile.";
    } else {
      abilityModalDesc.textContent = "Descrizione non disponibile per questa abilità.";
    }
  } catch (err) {
    abilityModalDesc.textContent = "Impossibile caricare i dettagli dell'abilità.";
  }
};
