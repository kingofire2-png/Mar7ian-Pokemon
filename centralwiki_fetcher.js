/**
 * Utility per il recupero e parsing delle mosse da Pokémon Central Wiki
 */
const CentralWikiFetcher = {
  /**
   * Recupera il testo wikitext di un Pokémon ed estrae la lista delle mosse.
   * @param {string} pokemonName - Il nome grezzo del Pokémon (es. "charizard").
   * @returns {Promise<Array>} Lista di oggetti mossa.
   */
  async fetchMoves(pokemonName) {
    if (!pokemonName) return [];

    // Formattazione nome prima lettera maiuscola (es. "Pikachu")
    const formattedName = pokemonName.charAt(0).toUpperCase() + pokemonName.slice(1).toLowerCase();
    const url = `https://pokemoncentral.it/wiki/api.php?action=query&prop=revisions&titles=${encodeURIComponent(formattedName)}&rvprop=content&format=json&origin=*`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      const pages = data.query?.pages;
      if (!pages) return [];

      const pageId = Object.keys(pages)[0];
      if (pageId === "-1") return [];

      const wikitext = pages[pageId].revisions[0]['*'];
      return this.parseMovesFromWikitext(wikitext);
    } catch (error) {
      console.error("Errore nel recupero mosse da Pokémon Central Wiki:", error);
      return [];
    }
  },

  /**
   * Effettua il parsing del wikitext estraendo i nomi delle mosse supportate dai template wiki.
   * @param {string} text - Testo in formato Wikitext grezzo.
   * @returns {Array} Array di oggetti contenenti i dettagli delle mosse.
   */
  parseMovesFromWikitext(text) {
    const movesMap = new Map();
    // Regex estesa per supportare i differenti tipi di template usati su Pokémon Central Wiki
    const moveRegex = /\{\{(?:mossa|m|move|MossaAppresa|Mossa\/rigo)\|([^\|\}]+)/gi;
    let match;

    while ((match = moveRegex.exec(text)) !== null) {
      const moveName = match[1].trim();

      // Filtra parametri di sistema, tag non validi o voci duplicate
      if (moveName && !moveName.includes('=') && !movesMap.has(moveName.toLowerCase())) {
        movesMap.set(moveName.toLowerCase(), {
          name: moveName,
          power: 80, // Valore standard di fallback
          type: 'normal',
          category: 'physical'
        });
      }
    }

    return Array.from(movesMap.values());
  }
};

// Esposizione sul window object
window.CentralWikiFetcher = CentralWikiFetcher;
