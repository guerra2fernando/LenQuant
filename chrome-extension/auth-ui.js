/**
 * Authentication UI components for LenQuant extension.
 * Supports both Google OAuth and Email registration.
 */

class AuthUI {
  constructor(licenseManager) {
    this.licenseManager = licenseManager;
    this.modalContainer = null;
  }

  /**
   * Show authentication modal with both options.
   */
  showAuthModal() {
    this._createModal(`
      <div class="lq-auth-modal">
        <div class="lq-auth-header">
          <img src="${chrome.runtime.getURL('icons/icon48.png')}" alt="LenQuant" class="lq-auth-logo">
          <h2>Welcome to LenQuant</h2>
        </div>

        <div class="lq-auth-content">
          <p class="lq-auth-subtitle">Get 3 days of Pro features free!</p>

          <!-- Google Sign In Button -->
          <button type="button" class="lq-auth-google-btn" id="lq-google-btn">
            <svg class="lq-google-icon" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>

          <div class="lq-auth-divider">
            <span>or</span>
          </div>

          <!-- Email Registration Form -->
          <form id="lq-email-form">
            <div class="lq-auth-field">
              <label for="lq-email">Email Address</label>
              <input type="email" id="lq-email" placeholder="your@email.com" required>
            </div>

            <button type="submit" class="lq-auth-submit" id="lq-email-btn">
              Continue with Email
            </button>
          </form>

          <div class="lq-auth-features">
            <h4>Pro Trial Includes:</h4>
            <ul>
              <li>✅ Backend-powered analysis</li>
              <li>✅ AI trade explanations</li>
              <li>✅ Multi-timeframe confluence</li>
              <li>✅ Behavioral guardrails</li>
              <li>✅ Cloud journal</li>
            </ul>
          </div>

          <p class="lq-auth-terms">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>

        <div class="lq-auth-error" id="lq-auth-error" style="display: none;"></div>
      </div>
    `);

    // Attach handlers
    const googleBtn = this.modalContainer.querySelector('#lq-google-btn');
    const emailForm = this.modalContainer.querySelector('#lq-email-form');
    const emailInput = this.modalContainer.querySelector('#lq-email');
    const emailBtn = this.modalContainer.querySelector('#lq-email-btn');
    const errorEl = this.modalContainer.querySelector('#lq-auth-error');

    // Google Sign In
    googleBtn.addEventListener('click', async () => {
      googleBtn.disabled = true;
      googleBtn.innerHTML = '<span class="lq-spinner"></span> Signing in...';
      errorEl.style.display = 'none';

      const result = await this.licenseManager.authenticateWithGoogle();

      if (result.success) {
        this.hideModal();
        this.showWelcomeMessage(result.license);
      } else {
        errorEl.textContent = result.message || 'Google sign-in failed';
        errorEl.style.display = 'block';
        googleBtn.disabled = false;
        googleBtn.innerHTML = `
          <svg class="lq-google-icon" viewBox="0 0 24 24">...</svg>
          Sign in with Google
        `;
      }
    });

    // Email Registration
    emailForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = emailInput.value.trim();
      if (!email || !email.includes('@')) {
        errorEl.textContent = 'Please enter a valid email address';
        errorEl.style.display = 'block';
        return;
      }

      emailBtn.disabled = true;
      emailBtn.textContent = 'Registering...';
      errorEl.style.display = 'none';

      const result = await this.licenseManager.registerWithEmail(email);

      if (result.success) {
        this.hideModal();
        this.showWelcomeMessage(result.license);
      } else {
        errorEl.textContent = result.message || 'Registration failed';
        errorEl.style.display = 'block';
        emailBtn.disabled = false;
        emailBtn.textContent = 'Continue with Email';
      }
    });
  }

  /**
   * Show paywall modal for locked features.
   */
  showPaywall(feature, callback) {
    const featureNames = {
      'ai_explain': 'AI Trade Explanations',
      'mtf_analysis': 'Multi-Timeframe Analysis',
      'cloud_journal': 'Cloud Journal',
      'trade_sync': 'Trade Sync',
      'behavioral': 'Behavioral Analysis',
    };

    const featureName = featureNames[feature] || feature;

    this._createModal(`
      <div class="lq-paywall-modal">
        <div class="lq-paywall-header">
          <span class="lq-paywall-icon">🔒</span>
          <h2>Pro Feature</h2>
        </div>

        <div class="lq-paywall-content">
          <p class="lq-paywall-feature">${featureName}</p>
          <p class="lq-paywall-subtitle">This feature requires a Pro subscription.</p>

          <div class="lq-paywall-plans">
            <div class="lq-plan lq-plan-pro">
              <h3>Pro</h3>
              <div class="lq-plan-price">$19.99<span>/mo</span></div>
              <ul>
                <li>Backend-powered analysis</li>
                <li>AI explanations</li>
                <li>Multi-timeframe</li>
                <li>30-day journal</li>
              </ul>
              <button class="lq-plan-btn" data-plan="pro_monthly">Choose Pro</button>
            </div>

            <div class="lq-plan lq-plan-premium">
              <div class="lq-plan-badge">BEST VALUE</div>
              <h3>Premium</h3>
              <div class="lq-plan-price">$39.99<span>/mo</span></div>
              <ul>
                <li>Everything in Pro</li>
                <li>Trade sync</li>
                <li>365-day journal</li>
                <li>Priority support</li>
              </ul>
              <button class="lq-plan-btn lq-plan-btn-primary" data-plan="premium_monthly">Choose Premium</button>
            </div>
          </div>
        </div>

        <button class="lq-paywall-close">Maybe Later</button>
      </div>
    `);

    // Attach handlers
    const planBtns = this.modalContainer.querySelectorAll('.lq-plan-btn');
    planBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const plan = btn.dataset.plan;
        this.hideModal();
        if (callback) callback(plan);
      });
    });

    const closeBtn = this.modalContainer.querySelector('.lq-paywall-close');
    closeBtn.addEventListener('click', () => this.hideModal());
  }

  /**
   * Show trial countdown banner.
   */
  showTrialBanner(hoursRemaining) {
    const existingBanner = document.querySelector('.lq-trial-banner');
    if (existingBanner) existingBanner.remove();

    const banner = document.createElement('div');
    banner.className = 'lq-trial-banner';

    let urgency = '';
    if (hoursRemaining < 12) urgency = 'urgent';
    else if (hoursRemaining < 24) urgency = 'warning';

    const display = hoursRemaining < 24
      ? `${Math.round(hoursRemaining)} hours`
      : `${Math.floor(hoursRemaining / 24)} days`;

    banner.innerHTML = `
      <div class="lq-trial-banner-content ${urgency}">
        <span class="lq-trial-icon">⏱️</span>
        <span class="lq-trial-text">Trial ends in ${display}</span>
        <button class="lq-trial-upgrade-btn">Upgrade Now</button>
        <button class="lq-trial-dismiss">×</button>
      </div>
    `;

    document.body.appendChild(banner);

    banner.querySelector('.lq-trial-upgrade-btn').addEventListener('click', () => {
      this.showPaywall('upgrade');
    });

    banner.querySelector('.lq-trial-dismiss').addEventListener('click', () => {
      banner.remove();
    });
  }

  /**
   * Show welcome message after authentication.
   */
  showWelcomeMessage(license) {
    const trial = this.licenseManager.getTrialRemaining();
    const authMethod = license.auth_method === 'google' ? 'Google' : 'email';

    const notification = document.createElement('div');
    notification.className = 'lq-welcome-notification';
    notification.innerHTML = `
      <div class="lq-welcome-content">
        <span class="lq-welcome-icon">🎉</span>
        <div class="lq-welcome-text">
          <strong>Welcome to LenQuant Pro!</strong>
          <p>Signed in with ${authMethod}. Your ${trial?.display || '3-day'} trial has started.</p>
        </div>
        <button class="lq-welcome-close">×</button>
      </div>
    `;

    document.body.appendChild(notification);

    notification.querySelector('.lq-welcome-close').addEventListener('click', () => {
      notification.remove();
    });

    setTimeout(() => notification.remove(), 5000);
  }

  /**
   * Show user account info.
   */
  showAccountInfo(license) {
    const authIcon = license.auth_method === 'google'
      ? '<svg class="lq-auth-icon" viewBox="0 0 24 24">...</svg>'
      : '📧';

    return `
      <div class="lq-account-info">
        <span class="lq-account-method">${authIcon}</span>
        <span class="lq-account-email">${license.email}</span>
        <span class="lq-account-tier lq-tier-${license.tier}">${license.tier.toUpperCase()}</span>
      </div>
    `;
  }

  /**
   * Hide current modal.
   */
  hideModal() {
    if (this.modalContainer) {
      this.modalContainer.remove();
      this.modalContainer = null;
    }
  }

  // ============================================================
  // Private methods
  // ============================================================

  _createModal(content) {
    this.hideModal();

    this.modalContainer = document.createElement('div');
    this.modalContainer.className = 'lq-modal-overlay';
    this.modalContainer.innerHTML = `
      <div class="lq-modal-container">
        ${content}
      </div>
    `;

    document.body.appendChild(this.modalContainer);

    this.modalContainer.addEventListener('click', (e) => {
      if (e.target === this.modalContainer) {
        this.hideModal();
      }
    });
  }
}

// Export for browser environment
if (typeof window !== 'undefined') {
  window.AuthUI = AuthUI;
}

// Export for Node.js environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AuthUI };
}


