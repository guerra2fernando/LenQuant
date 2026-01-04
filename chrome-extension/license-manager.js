/**
 * LenQuant Extension License Manager
 *
 * Handles:
 * - Google OAuth authentication
 * - Email registration
 * - License validation
 * - Feature gating
 * - Trial countdown
 */

const LICENSE_STORAGE_KEY = 'lenquant_license';
const VALIDATION_INTERVAL = 3600000; // 1 hour

class LicenseManager {
  constructor(apiBaseUrl) {
    this.apiBaseUrl = apiBaseUrl;
    this.license = null;
    this.validationTimer = null;
  }

  /**
   * Initialize license manager - load saved license and validate.
   */
  async init() {
    const saved = await this._loadFromStorage();

    if (saved && saved.email && saved.device_id) {
      const validation = await this.validate(saved);

      if (validation.valid) {
        this.license = {
          ...saved,
          ...validation,
        };
        this._startValidationTimer();
        return this.license;
      }
    }

    return null;
  }

  /**
   * Authenticate with Google OAuth.
   * Delegates to background script which has access to chrome.identity API.
   */
  async authenticateWithGoogle() {
    try {
      // Delegate to background script (chrome.identity only works in background/service worker)
      const response = await chrome.runtime.sendMessage({
        type: 'AUTHENTICATE_GOOGLE',
        deviceFingerprint: await this._getDeviceFingerprint(),
      });

      if (response.success) {
        this.license = response.license;
        await this._saveToStorage(this.license);
        this._startValidationTimer();
        return { success: true, message: response.message, license: this.license };
      }

      return { success: false, message: response.message || 'Google authentication failed' };

    } catch (error) {
      console.error('[LenQuant] Google auth error:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Register with email.
   */
  async registerWithEmail(email) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          device_fingerprint: await this._getDeviceFingerprint(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Registration failed');
      }

      const result = await response.json();

      if (result.success) {
        this.license = {
          email: result.email,
          device_id: result.device_id,
          license_token: result.license_token,
          tier: result.tier,
          trial_ends_at: result.trial_ends_at,
          features: result.features,
          auth_method: result.auth_method,
          valid: true,
        };

        await this._saveToStorage(this.license);
        this._startValidationTimer();

        return { success: true, message: result.message, license: this.license };
      }

      return { success: false, message: 'Registration failed' };

    } catch (error) {
      console.error('[LenQuant] Email registration error:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Validate current license with server.
   */
  async validate(license = null) {
    const lic = license || this.license;

    if (!lic || !lic.email || !lic.device_id) {
      return { valid: false, tier: 'expired', features: ['basic_analysis'] };
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: lic.email,
          device_id: lic.device_id,
          license_token: lic.license_token || '',
        }),
      });

      if (!response.ok) {
        console.warn('[LenQuant] License validation failed:', response.status);
        return { valid: false, tier: 'expired', features: ['basic_analysis'] };
      }

      const result = await response.json();

      if (result.valid && this.license) {
        this.license.tier = result.tier;
        this.license.features = result.features;
        this.license.trial_remaining_hours = result.trial_remaining_hours;
        this.license.needs_upgrade = result.needs_upgrade;
        await this._saveToStorage(this.license);
      }

      return result;

    } catch (error) {
      console.error('[LenQuant] Validation error:', error);
      return {
        valid: lic.tier !== 'expired',
        tier: lic.tier || 'expired',
        features: lic.features || ['basic_analysis'],
      };
    }
  }

  /**
   * Check if user has access to a feature.
   */
  hasFeature(feature) {
    if (!this.license || !this.license.valid) {
      return feature === 'basic_analysis';
    }
    return this.license.features.includes(feature);
  }

  /**
   * Get current tier.
   */
  getTier() {
    return this.license?.tier || 'free';
  }

  /**
   * Get auth method.
   */
  getAuthMethod() {
    return this.license?.auth_method || null;
  }

  /**
   * Get trial remaining time.
   */
  getTrialRemaining() {
    if (!this.license || this.license.tier !== 'trial') {
      return null;
    }

    if (this.license.trial_remaining_hours) {
      return {
        hours: this.license.trial_remaining_hours,
        display: this._formatTrialRemaining(this.license.trial_remaining_hours),
      };
    }

    if (this.license.trial_ends_at) {
      const ends = new Date(this.license.trial_ends_at);
      const now = new Date();
      const hours = (ends - now) / 3600000;
      return {
        hours: hours,
        display: this._formatTrialRemaining(hours),
      };
    }

    return null;
  }

  /**
   * Track feature usage.
   */
  async trackUsage(action) {
    if (!this.license) return;

    try {
      await fetch(`${this.apiBaseUrl}/auth/track-usage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: this.license.email,
          device_id: this.license.device_id,
          action: action,
        }),
      });
    } catch (error) {
      // Silent fail for usage tracking
    }
  }

  /**
   * Logout and clear license.
   */
  async logout() {
    this.license = null;
    await chrome.storage.sync.remove(LICENSE_STORAGE_KEY);
    this._stopValidationTimer();
  }

  // ============================================================
  // Private methods
  // ============================================================

  async _loadFromStorage() {
    try {
      const result = await chrome.storage.sync.get(LICENSE_STORAGE_KEY);
      return result[LICENSE_STORAGE_KEY] || null;
    } catch (error) {
      console.error('[LenQuant] Failed to load license:', error);
      return null;
    }
  }

  async _saveToStorage(license) {
    try {
      await chrome.storage.sync.set({ [LICENSE_STORAGE_KEY]: license });
    } catch (error) {
      console.error('[LenQuant] Failed to save license:', error);
    }
  }

  async _getGoogleClientId() {
    // Get from manifest or backend config
    const manifest = chrome.runtime.getManifest();
    if (manifest.oauth2 && manifest.oauth2.client_id) {
      return manifest.oauth2.client_id;
    }
    // Fallback: fetch from backend
    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/config`);
      const config = await response.json();
      return config.google_client_id;
    } catch (error) {
      throw new Error('Could not get Google client ID');
    }
  }

  async _getDeviceFingerprint() {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      new Date().getTimezoneOffset(),
    ];

    const fingerprint = components.join('|');
    const encoder = new TextEncoder();
    const data = encoder.encode(fingerprint);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  }

  _formatTrialRemaining(hours) {
    if (hours <= 0) return 'Expired';
    if (hours < 1) return `${Math.round(hours * 60)} minutes`;
    if (hours < 24) return `${Math.round(hours)} hours`;
    const days = Math.floor(hours / 24);
    const remainingHours = Math.round(hours % 24);
    return `${days}d ${remainingHours}h`;
  }

  _startValidationTimer() {
    this._stopValidationTimer();
    this.validationTimer = setInterval(() => {
      this.validate();
    }, VALIDATION_INTERVAL);
  }

  _stopValidationTimer() {
    if (this.validationTimer) {
      clearInterval(this.validationTimer);
      this.validationTimer = null;
    }
  }
}

// Export for browser environment
if (typeof window !== 'undefined') {
  window.LicenseManager = LicenseManager;
}

// Export for Node.js environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LicenseManager };
}


