/**
 * Panel content updater
 */

import { logger } from '../../shared/logger.js';
import { GRADE_THRESHOLDS } from '../../shared/config.js';

class PanelUpdater {
  constructor(container) {
    this.container = container;
    this.lastAnalysis = null;
  }

  updateAnalysis(analysis) {
    if (!analysis) return;

    this.lastAnalysis = analysis;

    try {
      // Update signal badge
      this.updateSignalBadge(analysis);

      // Update grade
      this.updateGrade(analysis);

      // Update score
      this.updateScore(analysis);

      // Update risk flags
      this.updateRiskFlags(analysis);

      // Update leverage recommendation
      this.updateLeverageRecommendation(analysis);

      // Update reason text
      this.updateReason(analysis);

      // Update mini icon if panel supports it
      if (this.panel?.updateMiniSignal) {
        this.panel.updateMiniSignal();
      }

      logger.log('panel', 'Analysis updated');
    } catch (error) {
      logger.error('panel', 'Error updating analysis:', error);
    }
  }

  updateSignalBadge(analysis) {
    const badge = this.container.querySelector('.lq-signal-badge');
    const text = this.container.querySelector('.lq-signal-text');

    if (!badge || !text) return;

    // Remove existing classes
    badge.classList.remove('buy', 'wait', 'caution', 'neutral');

    const signal = analysis.signal?.toLowerCase() || 'analyzing';
    badge.classList.add(signal);
    text.textContent = signal.toUpperCase();
  }

  updateGrade(analysis) {
    const gradeEl = this.container.querySelector('.lq-grade-letter');
    if (!gradeEl) return;

    const score = analysis.confidence || 0;
    let grade = 'D';

    if (score >= GRADE_THRESHOLDS.A) grade = 'A';
    else if (score >= GRADE_THRESHOLDS.B) grade = 'B';
    else if (score >= GRADE_THRESHOLDS.C) grade = 'C';

    gradeEl.textContent = grade;
    gradeEl.className = `lq-grade-letter grade-${grade.toLowerCase()}`;
  }

  updateScore(analysis) {
    const fill = this.container.querySelector('.lq-score-fill');
    const text = this.container.querySelector('.lq-score-text');

    if (!fill || !text) return;

    const score = analysis.confidence || 0;
    fill.style.width = `${Math.min(100, score)}%`;
    text.textContent = `${score}%`;
  }

  updateRiskFlags(analysis) {
    const flagsContainer = this.container.querySelector('.lq-risk-flags');
    if (!flagsContainer) return;

    flagsContainer.innerHTML = '';

    const riskFlags = analysis.risk_flags || [];
    riskFlags.forEach(flag => {
      const flagEl = document.createElement('span');
      flagEl.className = `lq-risk-flag ${flag.level}`;
      flagEl.textContent = flag.message;
      flagsContainer.appendChild(flagEl);
    });
  }

  updateLeverageRecommendation(analysis) {
    const rangeEl = this.container.querySelector('.lq-leverage-range');
    if (!rangeEl) return;

    const recommendation = analysis.leverage_recommendation || { min: 5, max: 15 };
    rangeEl.textContent = `${recommendation.min}-${recommendation.max}x`;
  }

  updateReason(analysis) {
    const reasonEl = this.container.querySelector('.lq-reason-text');
    if (!reasonEl) return;

    reasonEl.textContent = analysis.reason || 'Analysis complete';
  }

  showLoading() {
    const badge = this.container.querySelector('.lq-signal-badge');
    const text = this.container.querySelector('.lq-signal-text');

    if (badge && text) {
      badge.className = 'lq-signal-badge neutral';
      text.textContent = 'ANALYZING...';
    }
  }

  showError(message) {
    const reasonEl = this.container.querySelector('.lq-reason-text');
    if (reasonEl) {
      reasonEl.textContent = message;
    }

    const badge = this.container.querySelector('.lq-signal-badge');
    const text = this.container.querySelector('.lq-signal-text');

    if (badge && text) {
      badge.className = 'lq-signal-badge caution';
      text.textContent = 'ERROR';
    }
  }

  showAlert(alert) {
    // Create alert element
    const alertEl = document.createElement('div');
    alertEl.className = `lq-alert ${alert.level || 'info'}`;
    alertEl.innerHTML = `
      <span class="lq-alert-icon">${alert.icon || 'ℹ️'}</span>
      <span class="lq-alert-text">${alert.message}</span>
      <button class="lq-alert-close">×</button>
    `;

    // Add to container
    this.container.appendChild(alertEl);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      alertEl.remove();
    }, 5000);

    // Close button
    alertEl.querySelector('.lq-alert-close').addEventListener('click', () => {
      alertEl.remove();
    });
  }

  updateUserInfo(license) {
    const tierBadge = this.container.querySelector('.lq-tier-badge');
    if (tierBadge) {
      tierBadge.textContent = (license?.tier || 'FREE').toUpperCase();
      tierBadge.className = `lq-tier-badge tier-${(license?.tier || 'free').toLowerCase()}`;
    }

    // Update MTF section based on license
    if (this.lastAnalysis?.symbol) {
      this.updateMTFSection(this.lastAnalysis.symbol, license);
    }
  }

  updateMTFSection(symbol, license) {
    const mtfSection = this.container.querySelector('.lq-mtf-section');
    if (!mtfSection) return;

    const content = mtfSection.querySelector('.lq-mtf-content');
    const locked = mtfSection.querySelector('.lq-mtf-locked');

    // Check access - MTF is premium feature
    const hasAccess = license?.features?.includes('mtf_analysis') ||
                     license?.tier === 'premium' ||
                     license?.tier === 'trial';

    if (!hasAccess) {
      content.style.display = 'none';
      locked.style.display = 'flex';
      return;
    }

    locked.style.display = 'none';
    content.style.display = 'block';

    // Show loading
    const status = mtfSection.querySelector('.lq-mtf-status');
    status.textContent = 'Loading...';

    // Request MTF analysis
    this.requestMTFAnalysis(symbol);
  }

  async requestMTFAnalysis(symbol) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_MTF_ANALYSIS',
        symbol,
        timeframes: ['15m', '1h', '4h', '1d'],
      });

      if (response.error) {
        this.updateMTFError('Error loading MTF data');
        return;
      }

      this.updateMTFData(response);
    } catch (error) {
      logger.error('panel', 'MTF analysis error:', error);
      this.updateMTFError('Error');
    }
  }

  updateMTFData(data) {
    const mtfSection = this.container.querySelector('.lq-mtf-section');
    const tbody = mtfSection.querySelector('.lq-mtf-table tbody');
    const confluence = mtfSection.querySelector('.lq-mtf-confluence-value');
    const status = mtfSection.querySelector('.lq-mtf-status');

    // Populate table
    tbody.innerHTML = data.timeframes.map(tf => `
      <tr>
        <td>${tf.timeframe}</td>
        <td class="trend-${tf.trend}">${tf.trend === 'up' ? '↑' : tf.trend === 'down' ? '↓' : '→'}</td>
        <td class="rsi-${tf.rsi > 70 ? 'high' : tf.rsi < 30 ? 'low' : 'neutral'}">${tf.rsi}</td>
        <td class="signal-${tf.signal}">${tf.signal}</td>
      </tr>
    `).join('');

    // Confluence
    confluence.textContent = data.confluence;
    confluence.className = `value lq-mtf-confluence-value ${data.confluence.toLowerCase()}`;

    status.textContent = '';
  }

  updateMTFError(message) {
    const status = this.container.querySelector('.lq-mtf-status');
    if (status) {
      status.textContent = message;
    }
  }
}

export { PanelUpdater };
