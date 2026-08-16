/**
 * Calcolo_Danni_Engine.js
 * Algoritmo di calcolo danni ottimizzato per VGC / Lotte in Doppio
 * Dipende da shared-data.js (window.SharedData.TYPE_CHART_BY_ATTACKER), deve caricare dopo.
 */

(function () {
  'use strict';

  // Vista attaccante-indicizzata derivata dalla tabella difensiva canonica di shared-data.js
  // (fonte unica di verita': niente piu' una seconda tabella tipi mantenuta a mano).
  const TYPE_CHART = window.SharedData.TYPE_CHART_BY_ATTACKER;

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

  // ===============================
  // Formula di danno riusabile (livello 50) e applicazione effetti oggetto.
  // Esposte su window.CalcDanniEngine cosi' il 2vs2 usa la stessa identica matematica.
  // ===============================
  const MIN_ROLL = 0.85;

  // Fase statistica -> moltiplicatore (es. +1 = x1.5, -1 = x0.66), mai su PS. Unica fonte di
  // verita' condivisa tra 1vs1 e 2vs2 (prima duplicata solo in Calcolo_Danni_2v2.js).
  function stageMultiplier(stage) {
    return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
  }

  // Ordine canonico dei moltiplicatori (come Pokemon Showdown/Bulbapedia): bersagli multipli
  // (Doppio) prima di STAB/tipo/oggetto. Ininfluente sull'1vs1 (spreadMult sempre 1 li'), ma
  // corregge scostamenti di arrotondamento nel 2vs2 con mosse ad area. weatherMult/terrainMult/
  // critMult/burnMult/screenMult sono opzionali (default neutro 1) e vanno nello stesso punto
  // della sequenza occupato dai corrispondenti moltiplicatori nel gioco reale.
  function computeDamage({
    level, movePower, attackStat, defenseStat, isStab, typeMultiplier, extraDamageMult = 1,
    spreadMult = 1, weatherMult = 1, terrainMult = 1, critMult = 1, burnMult = 1, screenMult = 1
  }) {
    let bD = Math.floor(Math.floor((Math.floor((2 * level) / 5 + 2) * movePower * attackStat) / defenseStat) / 50) + 2;
    bD = Math.floor(bD * spreadMult);
    bD = Math.floor(bD * weatherMult);
    bD = Math.floor(bD * terrainMult);
    bD = Math.floor(bD * critMult);
    bD = Math.floor(bD * (isStab ? 1.5 : 1));
    bD = Math.floor(bD * typeMultiplier);
    bD = Math.floor(bD * burnMult);
    bD = Math.floor(bD * screenMult);
    bD = Math.floor(bD * extraDamageMult);
    return bD;
  }

  // Meteo/Terreno: moltiplicatore sul tipo della mossa (Pioggia/Sole sui tipi Acqua/Fuoco,
  // i 4 terreni sui rispettivi tipi corrispondenti, +30% invece di +50% per il terreno).
  // Semplificazione dichiarata: non modella Levitazione/tipo Volante (immunita' al terreno) ne'
  // abilita' che annullano meteo/terreno (es. Nove Vite) — coerente con lo stile "niente IV,
  // niente stato di gioco multi-turno" gia' usato nel resto del calcolatore.
  const WEATHER_TYPE_MULT = {
    rain: { water: 1.5, fire: 0.5 },
    sun: { fire: 1.5, water: 0.5 }
  };
  const TERRAIN_TYPE_MULT = {
    grassy: { grass: 1.3 },
    electric: { electric: 1.3 },
    psychic: { psychic: 1.3 },
    misty: { fairy: 1.3 }
  };
  function weatherMultiplierFor(weatherKey, moveType) {
    return (WEATHER_TYPE_MULT[weatherKey] && WEATHER_TYPE_MULT[weatherKey][moveType]) || 1;
  }
  function terrainMultiplierFor(terrainKey, moveType) {
    return (TERRAIN_TYPE_MULT[terrainKey] && TERRAIN_TYPE_MULT[terrainKey][moveType]) || 1;
  }

  // Effetti oggetto lato attaccante: puo' modificare la statistica offensiva (Bendascelta/
  // Fascetta) e/o moltiplicare il danno finale (Sfera Assennata, Cinghia Esperta, Nastro
  // Muscolare/Lenti Saggezza, oggetti che potenziano un tipo). typeMultiplier serve solo per
  // la condizione della Cinghia Esperta (si attiva solo se supereffcace).
  function applyOffensiveItemEffects({ itemSlug, category, moveType, typeMultiplier, baseStat }) {
    const effects = window.SharedData.ITEM_EFFECTS;
    const effect = itemSlug && effects[itemSlug];
    const result = { stat: baseStat, damageMult: 1, labels: [] };
    if (!effect) return result;

    const itemName = window.SharedData.getItemName(itemSlug);
    const statKey = category === 'physical' ? 'attack' : 'special-attack';
    const statLabel = category === 'physical' ? 'Attacco' : 'Att. Sp.';

    if (effect.statMult && effect.statMult[statKey]) {
      result.stat = Math.floor(baseStat * effect.statMult[statKey]);
      result.labels.push(`${itemName}: ${statLabel} ×${effect.statMult[statKey]}`);
    }
    if (effect.damageMult) {
      result.damageMult *= effect.damageMult;
      result.labels.push(`${itemName}: danno ×${effect.damageMult}`);
    }
    if (effect.damageMultByCategory && effect.damageMultByCategory[category]) {
      result.damageMult *= effect.damageMultByCategory[category];
      result.labels.push(`${itemName}: danno ×${effect.damageMultByCategory[category]}`);
    }
    if (effect.damageMultIfSuperEffective && typeMultiplier >= 2) {
      result.damageMult *= effect.damageMultIfSuperEffective;
      result.labels.push(`${itemName}: danno ×${effect.damageMultIfSuperEffective} (colpo supereffcace)`);
    }
    if (effect.typeBoost && effect.typeBoost === moveType) {
      result.damageMult *= effect.mult;
      result.labels.push(`${itemName}: mossa di tipo ${effect.typeBoost} ×${effect.mult}`);
    }
    return result;
  }

  // Effetti oggetto lato difensore: statistica difensiva (Corpetto Assalto, Evolcondensa) e/o
  // immunita' di tipo (Aerostato: immune a mosse di tipo Terra finche' lo tiene equipaggiato).
  function applyDefensiveItemEffects({ itemSlug, category, baseStat, moveType }) {
    const effects = window.SharedData.ITEM_EFFECTS;
    const effect = itemSlug && effects[itemSlug];
    const result = { stat: baseStat, labels: [], groundImmune: false };
    if (!effect) return result;

    const itemName = window.SharedData.getItemName(itemSlug);

    if (effect.groundImmune && moveType === 'ground') {
      result.groundImmune = true;
      result.labels.push(`${itemName}: immune alle mosse di tipo Terra`);
    }
    if (!effect.statMult) return result;

    const statKey = category === 'physical' ? 'defense' : 'special-defense';
    const statLabel = category === 'physical' ? 'Difesa' : 'Dif. Sp.';

    if (effect.statMult[statKey]) {
      result.stat = Math.floor(baseStat * effect.statMult[statKey]);
      result.labels.push(`${itemName}: ${statLabel} ×${effect.statMult[statKey]}`);
    }
    return result;
  }

  // Focus Sash non cambia il danno calcolato: fa sopravvivere a 1 PS un colpo altrimenti letale
  // se il difensore era a PS pieni. Non e' un moltiplicatore quindi va controllato a parte dai
  // chiamanti dopo aver calcolato il danno, non dentro computeDamage.
  function checkFocusSashSurvival({ itemSlug, hpBeforeHit, hpMax, damage }) {
    const effect = itemSlug && window.SharedData.ITEM_EFFECTS[itemSlug];
    if (!effect || !effect.surviveAtOne) return { saved: false };
    if (hpBeforeHit < hpMax) return { saved: false };
    if (damage < hpMax) return { saved: false };
    return { saved: true, label: `${window.SharedData.getItemName(itemSlug)}: sopravvive a 1 PS` };
  }

  document.addEventListener('DOMContentLoaded', () => {
    injectEngineStyles();
    observeMoveSelection();
  });

  function injectEngineStyles() {
    if (document.getElementById('engine-styles')) return;
    const style = document.createElement('style');
    style.id = 'engine-styles';
    style.innerHTML = `
      @keyframes popIn {
        0% { transform: scale(0.7); opacity: 0; }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes pulseGlow {
        0% { box-shadow: 0 0 10px rgba(56, 189, 248, 0.2); }
        50% { box-shadow: 0 0 25px rgba(56, 189, 248, 0.55); }
        100% { box-shadow: 0 0 10px rgba(56, 189, 248, 0.2); }
      }
      .damage-modal-overlay {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(5, 8, 15, 0.7); backdrop-filter: blur(6px);
        display: flex; align-items: center; justify-content: center; z-index: 9999;
      }
      .damage-modal-card {
        background-image: var(--glass-sheen);
        background-color: rgba(18, 24, 36, 0.6); backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate)); -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5), inset 0 1px 0 var(--glass-highlight);
        border: 1px solid rgba(56, 189, 248, 0.4); border-radius: var(--radius-lg);
        padding: 24px; max-width: 520px; width: 90%; color: #fff;
        animation: popIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards, pulseGlow 3s infinite;
      }
    `;
    document.head.appendChild(style);
  }

  function observeMoveSelection() {
    const observer = new MutationObserver(() => {
      const selectEl = document.getElementById('select-move-a');
      if (selectEl && !selectEl.dataset.engineHooked) {
        selectEl.dataset.engineHooked = "true";
        selectEl.addEventListener('change', fetchMoveDetails);
        fetchMoveDetails();
        injectCalcButton();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

 async function fetchMoveDetails() {

    const selectEl = document.getElementById('select-move-a');

    if (!selectEl) return;

    if (selectEl.selectedIndex < 0) return;

    // Recupera i dati direttamente dall'opzione
    const option = selectEl.options[selectEl.selectedIndex];

    if (!option) return;

    // Categoria
    const categoryITA = option.dataset.category || "Fisico";

    switch (categoryITA.toLowerCase()) {

        case "fisico":
            currentMoveCategory = "physical";
            break;

        case "speciale":
            currentMoveCategory = "special";
            break;

        default:
            currentMoveCategory = "status";
            break;

    }

    // Tipo
    const typeITA = (option.dataset.type || "Normale").toLowerCase();

    currentMoveType = TYPE_ITA_TO_ENG[typeITA] || "normal";

    // Potenza
    const power = parseInt(option.dataset.power || "0", 10);

    updateCategoryUI(currentMoveCategory, power);

}

  function updateCategoryUI(category, power) {
    const powerEl = document.getElementById('move-power-val');
    if (powerEl) {
      powerEl.textContent = power > 0 ? power : "—";
    }
  }

  function injectCalcButton() {
    const boxA = document.getElementById('box-a');
    if (!boxA || document.getElementById('btn-calculate-damage')) return;

    const btn = document.createElement('button');
    btn.id = 'btn-calculate-damage';
    btn.textContent = '⚡ CALCOLA DANNO';
    btn.style.cssText = 'width: 100%; margin-top: 16px; padding: 12px; background: linear-gradient(135deg, var(--accent), #0284c7); border: none; border-radius: 8px; color: #04202e; font-weight: 800; font-size: 1rem; cursor: pointer; transition: transform 0.1s;';
    
    btn.onclick = calculateAndShowDamage;
    boxA.appendChild(btn);
  }

  // Statistica finale di uno slot 1vs1 (base + EV + Natura, poi fase statistica su tutto
  // tranne PS). Legge lo stato reale esposto da Calcolo_Danni.js (window.getCalc1v1Slot)
  // invece di fare scraping del DOM: stessa fonte di dati e stessa formula del 2vs2
  // (window.SharedData.computeStatTotal + stageMultiplier), niente piu' Natura/fasi ignorate.
  function statValueFor(slot, statKey) {
    const statObj = slot.pokemon.stats.find(s => s.stat.name === statKey);
    const base = statObj ? statObj.base_stat : 1;
    const raw = window.SharedData.computeStatTotal(base, (slot.evs || {})[statKey] || 0, statKey, slot.nature);
    if (statKey === 'hp') return raw;
    const stage = (slot.stages && slot.stages[statKey]) || 0;
    return Math.floor(raw * stageMultiplier(stage));
  }

  function calculateAndShowDamage() {
    const selectEl = document.getElementById('select-move-a');
    if (!selectEl) {
      alert("Seleziona una mossa per l'attaccante!");
      return;
    }

    if (currentMoveCategory === 'status') {
      alert("Questa mossa non infligge danno diretto (mossa di Stato): scegli una mossa Fisica o Speciale per calcolare il danno.");
      return;
    }

    const slotA = window.getCalc1v1Slot && window.getCalc1v1Slot('A');
    const slotB = window.getCalc1v1Slot && window.getCalc1v1Slot('B');
    if (!slotA || !slotA.pokemon || !slotB || !slotB.pokemon) {
      alert('Seleziona sia il Pokémon A che il Pokémon B!');
      return;
    }

    const moveOpt = selectEl.options[selectEl.selectedIndex];
    const movePower = parseInt(moveOpt?.getAttribute('data-power') || '0', 10) || 0;
    const moveName = moveOpt?.getAttribute('data-name') || selectEl.value;

    const nameA = slotA.pokemon.name;
    const nameB = slotB.pokemon.name;

    const hpB = statValueFor(slotB, 'hp');
    let attackStat = 0;
    let defenseStat = 0;
    let statOffensivaNome = '';
    let statDifensivaNome = '';

    if (currentMoveCategory === 'physical') {
      attackStat = statValueFor(slotA, 'attack');
      defenseStat = statValueFor(slotB, 'defense');
      statOffensivaNome = 'Attacco';
      statDifensivaNome = 'Difesa';
    } else {
      attackStat = statValueFor(slotA, 'special-attack');
      defenseStat = statValueFor(slotB, 'special-defense');
      statOffensivaNome = 'Sp. Atk';
      statDifensivaNome = 'Sp. Def';
    }

    // Tipi gia' in inglese (SharedData.getSpeciesDetail arriva da PokeAPI: data.types[].type.name),
    // stessa indicizzazione di TYPE_CHART_BY_ATTACKER: nessuna conversione ITA->ENG necessaria qui.
    const typesA = slotA.pokemon.types;
    const typesB = slotB.pokemon.types;

    let typeMultiplier = 1;
    typesB.forEach(defType => {
      if (TYPE_CHART[currentMoveType] && TYPE_CHART[currentMoveType][defType] !== undefined) {
        typeMultiplier *= TYPE_CHART[currentMoveType][defType];
      }
    });

    const isStab = typesA.includes(currentMoveType);
    const stabMultiplier = isStab ? 1.5 : 1;

    const level = 50;

    const itemSlugA = slotA.item || '';
    const itemSlugB = slotB.item || '';

    const offense = applyOffensiveItemEffects({
      itemSlug: itemSlugA, category: currentMoveCategory, moveType: currentMoveType,
      typeMultiplier, baseStat: attackStat
    });
    const defense = applyDefensiveItemEffects({
      itemSlug: itemSlugB, category: currentMoveCategory, baseStat: defenseStat, moveType: currentMoveType
    });
    attackStat = offense.stat;
    defenseStat = defense.stat;
    // Aerostato annulla del tutto il moltiplicatore di tipo se la mossa e' di tipo Terra,
    // indipendentemente da cosa direbbe la tabella tipi normale.
    if (defense.groundImmune) typeMultiplier = 0;
    const itemLabels = [...offense.labels, ...defense.labels];

    // Condizioni di campo/stato scelte dall'utente (Calcolo_Danni.js): meteo/terreno globali,
    // bruciatura/critico sull'attaccante A, schermi sul difensore B.
    const field = (window.getCalc1v1FieldConditions && window.getCalc1v1FieldConditions()) || {};
    const weatherMult = weatherMultiplierFor(field.weather, currentMoveType);
    const terrainMult = terrainMultiplierFor(field.terrain, currentMoveType);
    const critMult = field.isCritA ? 1.5 : 1;
    const burnMult = (field.isBurnedA && currentMoveCategory === 'physical') ? 0.5 : 1;
    const screens = field.screensB || {};
    const screenActive = currentMoveCategory === 'physical'
      ? (screens.reflect || screens.auroraveil)
      : (screens.lightscreen || screens.auroraveil);
    const screenMult = screenActive ? 0.5 : 1;

    const computeDamageWithAtk = (atk) => computeDamage({
      level, movePower, attackStat: atk, defenseStat, isStab, typeMultiplier,
      extraDamageMult: offense.damageMult, weatherMult, terrainMult, critMult, burnMult, screenMult
    });

    const maxDamage = computeDamageWithAtk(attackStat);
    const minDamage = Math.floor(maxDamage * MIN_ROLL);

    const minPercent = ((minDamage / hpB) * 100).toFixed(1);
    const maxPercent = ((maxDamage / hpB) * 100).toFixed(1);

    // Focus Sash: sopravvive a 1 PS se il difensore era a PS pieni (assunzione base di questo
    // calcolatore: il difensore parte sempre a PS pieni) e il colpo sarebbe altrimenti KO.
    const sashCheck = checkFocusSashSurvival({ itemSlug: itemSlugB, hpBeforeHit: hpB, hpMax: hpB, damage: minDamage });
    if (sashCheck.saved) itemLabels.push(sashCheck.label);

    const isGuaranteedKO = minDamage >= hpB && !sashCheck.saved;
    const isPossibleKO = maxDamage >= hpB;
    const hitsToKO = Math.max(1, Math.ceil(hpB / Math.max(1, maxDamage)));

    let statusText = "";
    if (sashCheck.saved) {
      statusText = `<span style="color: #f59e0b; font-weight: 800;">SOPRAVVIVE A 1 PS (Focus Sash) — sarebbe stato KO garantito (${maxPercent}%)</span>`;
    } else if (isGuaranteedKO) {
      statusText = `<span style="color: #ef4444; font-weight: 800;">KO GARANTITO IN 1 COLPO (${maxPercent}%)</span>`;
    } else if (isPossibleKO) {
      statusText = `<span style="color: #f59e0b; font-weight: 800;">POSSIBILE KO IN 1 COLPO (${minPercent}% - ${maxPercent}%)</span>`;
    } else {
      statusText = `<span style="color: #84cc16; font-weight: 800;">NON MANDA KO (KO in ${hitsToKO} colpi)</span>`;
    }

    // NUOVI REQUISITI SNELLI E STRATEGIA IN DOPPIO
    let koRequirementHTML = '';
    if (isGuaranteedKO) {
      koRequirementHTML = `<span style="color: #84cc16;">✔ La mossa e le statistiche attuali garantiscono il KO in 1 colpo.</span>`;
    } else {
      let neededPower = movePower;
      if (movePower > 0) {
        while (neededPower < 300) {
          const bD = computeDamage({
            level, movePower: neededPower, attackStat, defenseStat, isStab, typeMultiplier,
            extraDamageMult: offense.damageMult
          });
          if (Math.floor(bD * MIN_ROLL) >= hpB) break;
          neededPower++;
        }
      }

      const remainingHP = Math.max(0, hpB - minDamage);
      const remainingPercent = ((remainingHP / hpB) * 100).toFixed(1);

      let reqList = [];
      
      // 1. Suggerimento tattico / Condizioni da applicare sul campo (al posto degli EV)
      if (typeMultiplier < 2) {
        reqList.push(`Per il KO diretto serve una mossa **Super Efficace (x2)** o un boost di **+1/+2 in ${statOffensivaNome}** (es. Danzaspada, Congiura, Abilità).`);
      } else {
        reqList.push(`Serve un boost di **+1 in ${statOffensivaNome}** o un aumento di danno (es. Strumento come Assorbosfera / Choice Item).`);
      }

      // 2. Potenza mossa richiesta
      if (movePower > 0 && neededPower !== movePower) {
        reqList.push(`Oppure usa una mossa singola da <b>${neededPower} BP</b> (attuale: ${movePower} BP).`);
      }

      // 3. Strategia Lotte in Doppio (Focus Fire)
      let doubleStrategyText = `<b>🤝 STRATEGIA LOTTE IN DOPPIO:</b> Il difensore rimane con <b>${remainingHP} HP (${remainingPercent}%)</b>. `;
      if (remainingPercent <= 25) {
        doubleStrategyText += `Basta un attacco di supporto leggero dell'alleato (mossa ad area o attacco secondario da ~${remainingHP} HP) nello stesso turno per chiudere il KO.`;
      } else {
        doubleStrategyText += `Servirà un attacco dedicato di media/alta potenza del Pokémon alleato (almeno ~${remainingHP} HP di danno) per completare il KO combinato (Focus Fire).`;
      }

      reqList.push(doubleStrategyText);

      koRequirementHTML = `
        <ul style="padding-left: 18px; margin: 0; color: #f59e0b;">
          ${reqList.map(item => `<li style="margin-bottom: 6px;">${item}</li>`).join('')}
        </ul>
      `;
    }

    let effectivenessText = "Effetto normale (x1)";
    if (typeMultiplier === 0) effectivenessText = "Nessun effetto (x0)";
    else if (typeMultiplier >= 2) effectivenessText = `Super Efficace (x${typeMultiplier})`;
    else if (typeMultiplier < 1) effectivenessText = `Poco Efficace (x${typeMultiplier})`;

    showModal({
      title: `${nameA} ➔ ${nameB}`,
      statusText,
      koRequirementHTML,
      moveName,
      category: CATEGORY_TRANSLATIONS[currentMoveCategory] || currentMoveCategory,
      minDamage,
      maxDamage,
      hpB,
      minPercent,
      maxPercent,
      effectivenessText,
      attackStat,
      defenseStat,
      statOffensivaNome,
      statDifensivaNome,
      stabMultiplier,
      itemLabels
    });
  }

  function showModal(data) {
    const overlay = document.createElement('div');
    overlay.className = 'damage-modal-overlay';

    overlay.innerHTML = `
      <div class="damage-modal-card">
        <h2 style="font-size: 1.3rem; color: var(--accent); margin-bottom: 8px; text-align: center;">${data.title}</h2>

        <!-- BOX 1: ESITO KO -->
        <div style="font-size: 1rem; text-align: center; margin-bottom: 12px; padding: 10px; background: var(--bg-dark); border-radius: 8px;">
          ${data.statusText}
        </div>

        <!-- BOX 2: REQUISITI KO & LOTTE IN DOPPIO -->
        <div style="font-size: 0.85rem; line-height: 1.5; color: #cbd5e1; background: var(--bg-dark); padding: 12px; border-radius: 8px; border: 1px solid #f59e0b; margin-bottom: 12px;">
          <h4 style="color: #f59e0b; margin-bottom: 6px; font-weight: 800; font-size: 0.9rem;">⚡ Requisiti KO & Lotte in Doppio:</h4>
          ${data.koRequirementHTML}
        </div>

        <!-- BOX 3: DETTAGLI MATEMATICI -->
        <div style="font-size: 0.85rem; line-height: 1.5; color: #cbd5e1; background: var(--bg-dark); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);">
          <h4 style="color: #fff; margin-bottom: 6px; font-weight: 800; font-size: 0.9rem;">Dettagli del Calcolo Math:</h4>
          <ul style="padding-left: 18px; margin: 0;">
            <li>Mossa: <b>${data.moveName}</b> (${data.category})</li>
            <li>Danno Totale: <b>${data.minDamage} - ${data.maxDamage} HP</b> (${data.minPercent}% - ${data.maxPercent}%) su ${data.hpB} HP</li>
            <li>Efficacia Tipo: <b>${data.effectivenessText}</b></li>
            <li>Statistica Offensiva (${data.statOffensivaNome}): <b>${data.attackStat}</b></li>
            <li>Statistica Difensiva (${data.statDifensivaNome}): <b>${data.defenseStat}</b></li>
            <li>Bonus STAB: <b>${data.stabMultiplier > 1 ? 'Sì (x1.5)' : 'No'}</b></li>
            ${(data.itemLabels && data.itemLabels.length) ? `<li>Oggetti: <b>${data.itemLabels.join(' · ')}</b></li>` : ''}
          </ul>
        </div>

        <button id="btn-close-modal" style="width: 100%; margin-top: 14px; padding: 10px; background: var(--border-color); border: none; color: #fff; font-weight: 700; border-radius: 8px; cursor: pointer;">CHIUDI</button>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('btn-close-modal').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  }

  // Riusata dal Calcolo Danni 2vs2 (Calcolo_Danni_2v2.js), stessa matematica e stessi
  // effetti oggetto del calcolo 1vs1.
  window.CalcDanniEngine = {
    computeDamage,
    applyOffensiveItemEffects,
    applyDefensiveItemEffects,
    checkFocusSashSurvival,
    weatherMultiplierFor,
    terrainMultiplierFor,
    TYPE_ITA_TO_ENG,
    CATEGORY_TRANSLATIONS,
    MIN_ROLL,
    stageMultiplier
  };

})();
