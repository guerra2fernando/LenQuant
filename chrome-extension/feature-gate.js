/**
 * Feature gating for LenQuant extension.
 *
 * Checks user tier before allowing access to Pro features.
 */

class FeatureGate {
  constructor(licenseManager, authUI) {
    this.licenseManager = licenseManager;
    this.authUI = authUI;
  }

  /**
   * Check if user can access a feature.
   * Shows paywall if not.
   *
   * @param {string} feature - Feature to check
   * @param {Function} callback - Called with true if access granted
   * @returns {boolean} - True if user has access
   */
  async checkAccess(feature, callback) {
    // Ensure license is validated
    if (!this.licenseManager.license) {
      await this.licenseManager.init();
    }

    // Check if user has feature
    if (this.licenseManager.hasFeature(feature)) {
      if (callback) callback(true);
      return true;
    }

    // User doesn't have access - show appropriate UI
    const tier = this.licenseManager.getTier();

    if (!tier || tier === 'free' || tier === 'expired') {
      // Show paywall with upgrade options
      this.authUI.showPaywall(feature, async (plan) => {
        // User selected a plan - redirect to checkout
        await this._createCheckout(plan);
      });
    } else if (tier === 'trial') {
      // Trial user - show trial-specific message
      this.authUI.showPaywall(feature, async (plan) => {
        await this._createCheckout(plan);
      });
    }

    if (callback) callback(false);
    return false;
  }

  /**
   * Wrap a function to require a feature.
   */
  requireFeature(feature, fn) {
    return async (...args) => {
      const hasAccess = await this.checkAccess(feature);
      if (hasAccess) {
        return fn(...args);
      }
      return null;
    };
  }

  /**
   * Create checkout session and redirect.
   */
  async _createCheckout(plan) {
    const license = this.licenseManager.license;

    if (!license) {
      // Not logged in - show registration first
      this.authUI.showRegistrationModal();
      return;
    }

    try {
      const response = await fetch(`${this.licenseManager.apiBaseUrl}/stripe/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: license.email,
          device_id: license.device_id,
          plan: plan,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[LenQuant] Checkout error:', error);
        alert('Failed to create checkout. Please try again.');
        return;
      }

      const result = await response.json();

      // Open Stripe checkout in new tab
      chrome.tabs.create({ url: result.checkout_url });

    } catch (error) {
      console.error('[LenQuant] Checkout error:', error);
      alert('Failed to create checkout. Please try again.');
    }
  }

  /**
   * Open billing portal.
   */
  async openBillingPortal() {
    const license = this.licenseManager.license;

    if (!license) {
      this.authUI.showRegistrationModal();
      return;
    }

    try {
      const response = await fetch(`${this.licenseManager.apiBaseUrl}/stripe/portal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: license.email,
          device_id: license.device_id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[LenQuant] Portal error:', error);
        alert('No billing information found. Please upgrade first.');
        return;
      }

      const result = await response.json();
      chrome.tabs.create({ url: result.portal_url });

    } catch (error) {
      console.error('[LenQuant] Portal error:', error);
    }
  }
}

// Export for browser environment
if (typeof window !== 'undefined') {
  window.FeatureGate = FeatureGate;
}

// Export for Node.js environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FeatureGate };
}
