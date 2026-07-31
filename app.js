const API = 'https://pokeapi.co/api/v2';
const typeMeta = {
  normal:['Normale','#a8a77a'],fire:['Fuoco','#ee8130'],water:['Acqua','#6390f0'],electric:['Elettro','#f7d02c'],grass:['Erba','#7ac74c'],ice:['Ghiaccio','#96d9d6'],fighting:['Lotta','#c22e28'],poison:['Veleno','#a33ea1'],ground:['Terra','#e2bf65'],flying:['Volante','#a98ff3'],psychic:['Psico','#f95587'],bug:['Coleottero','#a6b91a'],rock:['Roccia','#b6a136'],ghost:['Spettro','#735797'],dragon:['Drago','#6f35fc'],dark:['Buio','#705746'],steel:['Acciaio','#b7b7ce'],fairy:['Folletto','#d685ad']
};
const namesIt = {bulbasaur:'Bulbasaur',ivysaur:'Ivysaur',venusaur:'Venusaur',charmander:'Charmander',charmeleon:'Charmeleon',charizard:'Charizard',squirtle:'Squirtle',wartortle:'Wartortle',blastoise:'Blastoise',pikachu:'Pikachu',raichu:'Raichu',eevee:'Eevee',vaporeon:'Vaporeon',jolteon:'Jolteon',flareon:'Flareon',espeon:'Espeon',umbreon:'Umbreon',leafeon:'Leafeon',glaceon:'Glaceon',sylveon:'Sylveon',lucario:'Lucario',garchomp:'Garchomp',gardevoir:'Gardevoir',absol:'Absol',rayquaza:'Rayquaza',diancie:'Diancie'};
const statNamesIt = {
  hp: 'PS',
  attack: 'Attacco',
  defense: 'Difesa',
  'special-attack': 'Sp. Atk',
  'special-defense': 'Sp. Def',
  speed: 'Velocità'
};

const state = { all:[], displayed:[], selectedTypes:[], page:0, ascending:true, detailCache:new Map(), abilityCache:new Map(), typeMembers:new Map(), typeRelations:new Map(), active:null };
const el = id => document.getElementById(id);

const search = el('search-input'), 
      list = el('pokemon-list'), 
      count = el('pokemon-count');

const pretty = name => namesIt[name] || name.replaceAll('-', ' ').replace(/\b\w/g, c=>c.toUpperCase());
const num = item => Number(item.url.split('/').filter(Boolean).pop());
const sprite = (id, name) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${id}.png`;
const tag = type => { const [label,color]=typeMeta[type]; return `<span class="type-badge" style="--type-color:${color}">${label}</span>` };

function calcModdedStat(statName, baseStat, name) {
  if (statName === 'hp') {
    if (name === 'shedinja') return 1;
    return baseStat + 75;
  }
  return baseStat + 20;
}

function renderTypes(){
  el('type-grid').innerHTML = Object.entries(typeMeta).map(([id,[label,color]]) => `<button class="type-button ${state.selectedTypes.includes(id)?'selected':''} ${state.selectedTypes.length===2&&!state.selectedTypes.includes(id)?'disabled':''}" style="--type-color:${color}" data-type="${id}">${label}</button>`).join('');
}

async function loadDex(){
  try {
    const r=await fetch(`${API}/pokemon?limit=10000`); const data=await r.json();
    state.all=data.results.map(x=>({...x,id:num(x)})).filter(x=>!x.name.includes('-gmax'));
    state.displayed=state.all; renderList();
  } catch { list.innerHTML='<div class="empty-results">Impossibile raggiungere il Pokedex. Verifica la connessione e ricarica.</div>'; count.textContent='OFFLINE'; }
}

function filterList(){
  let pool = state.all;
  if(state.selectedTypes.length){
    const sets=state.selectedTypes.map(t=>state.typeMembers.get(t)||new Set());
    pool=pool.filter(p=>sets.every(s=>s.has(p.name)));
  }
  state.displayed=[...pool].sort((a,b)=>state.ascending?a.id-b.id:b.id-a.id); state.page=0; renderList();
}

function renderList(){
  const amount=Math.min((state.page+1)*24,state.displayed.length); const visible=state.displayed.slice(0,amount);
  count.textContent=`${state.displayed.length.toLocaleString('it-IT')} POKÉMON`;
  if(!visible.length){list.innerHTML='<div class="empty-results">Nessun Pokémon con questa combinazione di tipi.</div>';el('btn-load-more').style.display='none';return}
  list.innerHTML=visible.map(p=>`<button class="pokemon-card ${state.active?.name===p.name?'active':''}" data-name="${p.name}" data-id="${p.id}"><span class="pokemon-number">#${String(p.id).padStart(4,'0')}</span><img src="${sprite(p.id,p.name)}" alt="" loading="lazy" onerror="this.style.opacity=.15"><span class="pokemon-name">${pretty(p.name)}</span></button>`).join('');
  el('btn-load-more').style.display = amount >= state.displayed.length ? 'none' : 'block';
}

async function selectPokemon(name,id){
  state.active={name,id}; renderList();
  el('detail-card').innerHTML='<div class="detail-empty"><span class="loader"></span><p>Analisi statistiche e debolezze…</p></div>';
  try {
    let p=state.detailCache.get(name);
    if(!p){const r=await fetch(`${API}/pokemon/${name}`);p=await r.json();state.detailCache.set(name,p)}
    await Promise.all(p.types.map(async x=>{
      if(!state.typeRelations.has(x.type.name)){
        const r=await fetch(`${API}/type/${x.type.name}`); const d=await r.json();
        state.typeRelations.set(x.type.name,d.damage_relations);
      }
    }));
    await renderDetail(p);
  }
  catch {el('detail-card').innerHTML='<div class="detail-empty"><p>Dettaglio non disponibile.</p></div>'}
}

async function getAbilityDetails(url) {
  try {
    const r = await fetch(url);
    const data = await r.json();
    
    // Nome in Italiano
    const nameItObj = data.names?.find(n => n.language.name === 'it');
    const nameEnObj = data.names?.find(n => n.language.name === 'en');
    const nameEn = nameEnObj ? nameEnObj.name : data.name;
    const nameIt = nameItObj ? nameItObj.name : null;

    // Descrizione
    const descObj = data.flavor_text_entries?.find(e => e.language.name === 'it') || data.flavor_text_entries?.find(e => e.language.name === 'en');
    const desc = descObj ? descObj.flavor_text.replace(/[\n\f]/g, ' ') : "Nessuna descrizione disponibile.";

    const fullName = nameIt ? `${nameEn} | ${nameIt}` : nameEn;
    return { fullName, desc };
  } catch {
    return { fullName: 'Abilità', desc: 'Impossibile caricare i dettagli.' };
  }
}

async function showAbilityDetail(abilityName, url) {
  let cached = state.abilityCache.get(abilityName);
  if(!cached) {
    cached = await getAbilityDetails(url);
    state.abilityCache.set(abilityName, cached);
  }
  
  el('abilityModalTitle').textContent = cached.fullName;
  el('abilityModalDesc').textContent = cached.desc;
  el('abilityModal').style.display = 'flex';
}

async function renderDetail(p){
  const types=p.types.sort((a,b)=>a.slot-b.slot).map(x=>x.type.name); 
  
  // 1. DIFESA
  const defenses={};
  for(const t of p.types){ 
    const rel=state.typeRelations.get(t.type.name); 
    for(const x of rel.double_damage_from) defenses[x.name]=(defenses[x.name]||1)*2; 
    for(const x of rel.half_damage_from) defenses[x.name]=(defenses[x.name]||1)*.5; 
    for(const x of rel.no_damage_from) defenses[x.name]=0; 
  }
  const weak=Object.entries(defenses).filter(([,v])=>v>1).sort((a,b)=>b[1]-a[1]);
  const resistant=Object.entries(defenses).filter(([,v])=>v<1).map(([t,v])=>`${typeMeta[t][0]} ${v===0?'×0':'½'}`).join(' · ');

  // 2. ATTACCO
  const offenseSet = new Set();
  for(const t of p.types){
    const rel=state.typeRelations.get(t.type.name);
    for(const x of rel.double_damage_to) {
      offenseSet.add(x.name);
    }
  }
  const superEffective = Array.from(offenseSet);

  // 3. STATISTICHE
  const maxBarValue = 180;
  const statsHtml = p.stats.map(s => {
    const sName = statNamesIt[s.stat.name] || s.stat.name;
    const moddedVal = calcModdedStat(s.stat.name, s.base_stat, p.name);
    const fillPercent = Math.min(100, Math.max(12, (moddedVal / maxBarValue) * 100));
    
    return `
      <div class="stat-row">
        <span class="stat-label">${sName}</span>
        <span class="stat-value">${moddedVal}</span>
        <div class="stat-bar-bg">
          <div class="stat-bar-fill" style="width: ${fillPercent}%;"></div>
        </div>
      </div>`;
  }).join('');

  // 4. ABILITÀ (Recupero nome Inglese | Italiano)
  const abilityPromises = p.abilities.map(async a => {
    let cached = state.abilityCache.get(a.ability.name);
    if (!cached) {
      cached = await getAbilityDetails(a.ability.url);
      state.abilityCache.set(a.ability.name, cached);
    }
    return `
      <button class="ability-btn" onclick="showAbilityDetail('${a.ability.name}', '${a.ability.url}')">
        ${cached.fullName} ${a.is_hidden ? '<small>(Nascosta)</small>' : ''}
      </button>
    `;
  });

  const abilitiesHtmlArray = await Promise.all(abilityPromises);
  const abilitiesHtml = abilitiesHtmlArray.join('');

  const accent=typeMeta[types[0]][1];
  
  el('detail-card').innerHTML=`
    <div class="detail-top" style="--accent:${accent}">
      <span class="detail-index">#${String(p.id).padStart(4,'0')}</span>
      <img src="${p.sprites.other?.home?.front_default||p.sprites.front_default}" alt="${pretty(p.name)}">
    </div>
    <div class="detail-content">
      <h2>${pretty(p.name)}</h2>
      <div class="card-types">${types.map(tag).join('')}</div>
      
      <p class="weakness-label" style="color:var(--lime); margin-top:10px;">ABILITÀ (CLICCA PER DETTAGLI)</p>
      <div class="abilities-list">${abilitiesHtml}</div>

      <p class="weakness-label" style="color:var(--lime); border-bottom:1px solid var(--line); padding-bottom:4px; margin-top:16px;">STATISTICHE (+75 HP / +20 ATK-DEF-SPE)</p>
      <div class="stats-container">
        ${statsHtml}
      </div>

      <p class="weakness-label" style="color:var(--lime); margin-top:16px;">SUPER EFFICACE CONTRO (STAB)</p>
      <div class="weaknesses" style="margin-bottom:18px;">
        ${superEffective.length ? superEffective.map(t=>`<span class="weakness" style="--type-color:${typeMeta[t][1]}">${typeMeta[t][0]}<b>×2</b></span>`).join('') : '<span class="weakness">Nessun tipo</span>'}
      </div>

      <p class="weakness-label">DEBOLEZZE (DANNI SUBITI)</p>
      <div class="weaknesses">
        ${weak.length?weak.map(([t,v])=>`<span class="weakness" style="--type-color:${typeMeta[t][1]}">${typeMeta[t][0]}<b>×${v}</b></span>`).join(''):'<span class="weakness">Nessuna</span>'}
      </div>
      
      <p class="resistance"><strong>Resistenze:</strong> ${resistant||'nessuna'}</p>
    </div>`;
}

async function chooseType(type){
  if(state.selectedTypes.includes(type)) state.selectedTypes=state.selectedTypes.filter(x=>x!==type);
  else { if(state.selectedTypes.length===2) return; state.selectedTypes.push(type); if(!state.typeMembers.has(type)){ const r=await fetch(`${API}/type/${type}`); const d=await r.json(); state.typeMembers.set(type,new Set(d.pokemon.map(x=>x.pokemon.name))); state.typeRelations.set(type,d.damage_relations); } }
  renderTypes();filterList();
}

function showSuggestions(value){
  const q=value.trim().toLowerCase().replace('#',''); if(!q){el('suggestions').classList.remove('show');return}
  const found=state.all.filter(p=>p.name.includes(q)||String(p.id).startsWith(q)||pretty(p.name).toLowerCase().includes(q)).slice(0,7);
  el('suggestions').innerHTML=found.map(p=>`<button class="suggestion" data-name="${p.name}" data-id="${p.id}" role="option"><img src="${sprite(p.id,p.name)}" alt=""><span>${pretty(p.name)}<br><small>#${String(p.id).padStart(4,'0')}</small></span></button>`).join('')||'<div class="suggestion">Nessun risultato</div>';
  el('suggestions').classList.add('show');
}

// EVENT LISTENERS
el('type-grid').addEventListener('click',e=>{const b=e.target.closest('[data-type]');if(b&&!b.classList.contains('disabled'))chooseType(b.dataset.type)});
list.addEventListener('click',e=>{const b=e.target.closest('.pokemon-card');if(b)selectPokemon(b.dataset.name,b.dataset.id)});
el('suggestions').addEventListener('click',e=>{const b=e.target.closest('[data-name]');if(b){search.value=pretty(b.dataset.name);el('suggestions').classList.remove('show');selectPokemon(b.dataset.name,b.dataset.id)}});
search.addEventListener('input',e=>showSuggestions(e.target.value));
el('btn-clear-search').addEventListener('click',()=>{search.value='';showSuggestions('');search.focus()});
el('btn-reset-types').addEventListener('click',()=>{state.selectedTypes=[];renderTypes();filterList()});
el('btn-load-more').addEventListener('click',()=>{state.page++;renderList()});
el('btn-sort').addEventListener('click',()=>{state.ascending=!state.ascending;el('btn-sort').innerHTML=`Ordina: <span>Numero ${state.ascending?'↓':'↑'}</span>`;filterList()});
el('btn-about').addEventListener('click',()=>el('about-dialog').showModal());
el('btn-close-about').addEventListener('click',()=>el('about-dialog').close());
el('btn-close-ability').addEventListener('click',()=>el('abilityModal').style.display='none');

renderTypes();
loadDex();
