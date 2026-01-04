/**
 * Panel storage utilities
 */

const STORAGE_KEY = 'lq_panel_position';

class PanelStorage {
  static async savePosition(x, y) {
    try {
      await chrome.storage.local.set({
        [STORAGE_KEY]: { x, y, timestamp: Date.now() }
      });
    } catch (error) {
      console.warn('[LenQuant] Could not save panel position:', error);
    }
  }

  static async loadPosition() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const position = result[STORAGE_KEY];

      if (position && this.isValidPosition(position)) {
        return position;
      }
    } catch (error) {
      console.warn('[LenQuant] Could not load panel position:', error);
    }

    return null;
  }

  static isValidPosition(position) {
    return position &&
           typeof position.x === 'number' &&
           typeof position.y === 'number' &&
           position.x >= 0 &&
           position.y >= 0 &&
           position.x < window.innerWidth &&
           position.y < window.innerHeight;
  }

  static getDefaultPosition() {
    return {
      x: window.innerWidth - 340, // 320px width + 20px margin
      y: 80
    };
  }
}

export { PanelStorage };
