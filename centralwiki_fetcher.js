/**
 * centralwiki_fetcher.js
 * Modulo per il recupero diretto delle mosse da Pokémon Central Wiki (MediaWiki API)
 * Con sistema di caching in localStorage per eliminare i rallentamenti della web app.
 */

window.CentralWikiFetcher = (function () {
  'use strict';

  const API_URL = 'https://pokemoncentral.it/wiki/api.php';

  /**
   * Formatta il nome per trovare la pagina wiki corretta (es. "gengar-mega" -> "MegaGengar")
   */
  function formatPokemonWikiTitle(pokemonName) {
    if (!pokemonName) return '';
    let clean = pokemonName.toLowerCase().trim();

    if (clean.includes('-mega')) {
      const baseName = clean.replace('-mega', '');
      const formattedBase = baseName.charAt(0).toUpperCase() + baseName.slice(1);
      return `Mega${formattedBase}`;
    }

    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  /**
   * Recupera le mosse da Central Wiki con supporto localStorage
   * @param {string} pokemonName Nome del Pokémon (es. "gengar", "gengar-mega")
   * @returns {Promise<Array>} Array di oggetti mossa { name, power, type, category }
   */
  async function fetchMovesFromCentralWiki(pokemonName) {
    const wikiTitle = formatPokemonWikiTitle(pokemonName);
    if (!wikiTitle) return [];

    // 1. VERIFICA CACHE LOCALE (localStorage): caricamento istantaneo senza attese di rete
    const localKey = `wiki_moves_${wikiTitle.toLowerCase()}`;
    const cachedData = localStorage.getItem(localKey);
    if (cachedData) {
      try {
        return JSON.parse(cachedData);
      } catch (e) {
        localStorage.removeItem(localKey);
      }
    }

    // 2. CHIAMATA API DI CENTRAL WIKI (se non ancora presente in memoria)
    try {
      const params = new URLSearchParams({
        action: 'parse',
        page: wikiTitle,
        prop: 'wikitext',
        format: 'json',
        origin: '*' // Permette le chiamate CORS da browser
      });

      const response = await fetch(`${API_URL}?${params.toString()}`);
      const data = await response.json();

      if (!data.parse || !data.parse.wikitext) {
        console.warn(`[CentralWiki] Pagina non trovata per: ${wikiTitle}`);
        return [];
      }

      const wikitext = data.parse.wikitext['*'];
      const moves = parseMovesFromWikitext(wikitext);

      // 3. SALVATAGGIO IN LOCALSTORAGE per le prossime interazioni
      if (moves.length > 0) {
        localStorage.setItem(localKey, JSON.stringify(moves));
      }

      return moves;

    } catch (error) {
      console.error(`[CentralWiki] Errore di connessione o parsing per ${wikiTitle}:`, error);
      return [];
    }
  }

  /**
   * Parser del testo Wiki per individuare e ripulire la lista mosse
   */
  function parseMovesFromWikitext(text) {
    const movesMap = new Map();
    // Regex per estrarre i template delle mosse da Central Wiki
    const moveRegex = /\{\{(mossa|m|move)\|([^\|\}]+)/gi;
    let match;

    while ((match = moveRegex.exec(text)) !== null) {
      const moveName = match[2].trim();
      if (moveName && !movesMap.has(moveName.toLowerCase())) {
        movesMap.set(moveName.toLowerCase(), {
          name: moveName,
          power: 80, // Default base per il calcolatore
          type: 'normal',
          category: 'physical'
        });
      }
    }

    return Array.from(movesMap.values());
  }

  return {
    fetchMoves: fetchMovesFromCentralWiki
  };

})();