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
        // Explicit validation failure
        const reason = `Server rejected license (${response.status})`;
        await this.handleValidationFailure(reason);
        return { valid: false, tier: 'expired', features: ['basic_analysis'], reason };
      }

      const result = await response.json();

      if (!result.valid) {
        await this.handleValidationFailure(result.reason || 'License invalid');
        return result;
      }

      // Update license with server response
      if (this.license) {
        this.license.tier = result.tier;
        this.license.features = result.features;
        this.license.expires_at = result.expires_at;
        await this._saveToStorage(this.license);
        this.notifyUpdate();
      }

      return result;

    } catch (error) {
      console.error('[LenQuant] Validation error:', error);

      // Network error - don't invalidate, but warn
      this.notifyWarning('Could not verify license. Some features may be limited.');
      return {
        valid: lic.tier !== 'expired',
        tier: lic.tier || 'expired',
        features: lic.features || ['basic_analysis'],
      };
    }
  }

  async handleValidationFailure(reason) {
    console.warn('[LenQuant] License validation failed:', reason);

    // Store the reason for UI
    this.validationError = reason;

    // Downgrade to expired/free
    if (this.license) {
      this.license.tier = 'expired';
      this.license.features = ['basic_analysis'];
      await this._saveToStorage(this.license);
    }

    // Notify user
    this.notifyExpired(reason);
  }

  notifyExpired(reason) {
    // Dispatch event for UI to handle
    window.dispatchEvent(new CustomEvent('lq:license-expired', {
      detail: { reason }
    }));
  }

  notifyWarning(message) {
    window.dispatchEvent(new CustomEvent('lq:license-warning', {
      detail: { message }
    }));
  }

  notifyUpdate() {
    window.dispatchEvent(new CustomEvent('lq:license-updated'));
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

  async getDeviceId() {
    // Check for stored device ID first
    const result = await chrome.storage.local.get(['device_id']);

    if (result.device_id) {
      // Verify it's still valid
      const currentFingerprint = await this.generateFingerprint();
      const storedPrefix = result.device_id.slice(0, 8);
      const currentPrefix = currentFingerprint.slice(0, 8);

      // If fingerprint changed significantly, log warning but keep old ID
      // This prevents issues when user changes display settings
      if (storedPrefix !== currentPrefix) {
        console.warn('[LenQuant] Device fingerprint changed, keeping original device_id');
      }

      return result.device_id;
    }

    // Generate new device ID
    const fingerprint = await this.generateFingerprint();
    await chrome.storage.local.set({ device_id: fingerprint });

    return fingerprint;
  }

  async generateFingerprint() {
    // Stable fingerprint components (avoid screen dimensions - too volatile)
    const components = [
      navigator.userAgent,
      navigator.language,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ];

    const data = components.join('|');
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  }

  // Legacy method for backwards compatibility
  async _getDeviceFingerprint() {
    return this.getDeviceId();
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


