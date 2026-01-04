import { CONFIG } from './config.js';

const DEFAULT_FLAGS = {
  // Core features
  analysis: true,
  panel: true,

  // Pro features
  ai_explain: true,
  mtf_analysis: true,
  behavior_alerts: true,

  // Premium features
  trade_sync: true,

  // Experimental
  auto_explain: false,
  minimize_mode: false,
  multi_exchange: true,
  sound_alerts: false,

  // Debug
  verbose_logging: false,
  performance_metrics: false,
};

class FeatureFlags {
  constructor() {
    this.flags = { ...DEFAULT_FLAGS };
    this.overrides = {};
  }

  async init() {
    try {
      // Load server-side flags
      const response = await fetch(`${CONFIG.API_BASE_URL}/flags`);
      if (response.ok) {
        const serverFlags = await response.json();
        this.flags = { ...this.flags, ...serverFlags };
      }

      // Load local overrides
      const result = await chrome.storage.local.get(['featureFlags']);
      if (result.featureFlags) {
        this.overrides = result.featureFlags;
      }
    } catch (e) {
      console.warn('[LenQuant] Could not load feature flags:', e);
    }
  }

  isEnabled(flag) {
    // Local override takes precedence
    if (Object.prototype.hasOwnProperty.call(this.overrides, flag)) {
      return this.overrides[flag];
    }
    return this.flags[flag] ?? false;
  }

  async setOverride(flag, value) {
    this.overrides[flag] = value;
    await chrome.storage.local.set({ featureFlags: this.overrides });
  }

  async clearOverrides() {
    this.overrides = {};
    await chrome.storage.local.remove('featureFlags');
  }

  getAllFlags() {
    const result = { ...this.flags };

    // Apply overrides
    for (const [flag, value] of Object.entries(this.overrides)) {
      result[flag] = value;
    }

    return result;
  }
}

export const featureFlags = new FeatureFlags();
