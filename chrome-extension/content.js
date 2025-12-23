/**
 * LenQuant Binance Assistant - Content Script
 * 
 * Injected into Binance Futures pages to:
 * - Observe DOM for context changes (symbol, timeframe)
 * - Inject trading assistant panel
 * - Handle user interactions
 * - Display analysis results
 */

// Configuration
const CONFIG = {
  DEBOUNCE_MS: 300,
  PANEL_WIDTH: 320,
  OBSERVER_THROTTLE_MS: 500,
};

// State
let currentContext = {
  symbol: null,
  timeframe: null,
};
let currentAnalysis = null;
let panel = null;
let sessionId = null;

// ============================================================================
// DOM Observation
// ============================================================================

class BinanceContextObserver {
  constructor() {
    this.debounceTimer = null;
    this.lastUpdate = 0;
  }
  
  init() {
    console.log('[LenQuant] Initializing context observer');
    
    // Initial context capture
    this.captureContext();
    
    // Set up mutation observer
    this.setupObserver();
    
    // Also listen for URL changes (for symbol switches)
    this.watchUrlChanges();
  }
  
  setupObserver() {
    const observer = new MutationObserver((mutations) => {
      // Throttle observations
      const now = Date.now();
      if (now - this.lastUpdate < CONFIG.OBSERVER_THROTTLE_MS) {
        return;
      }
      
      this.lastUpdate = now;
      this.debouncedCapture();
    });
    
    // Observe the main chart container area
    const targetNode = document.body;
    observer.observe(targetNode, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }
  
  watchUrlChanges() {
    // Watch for hash/path changes
    window.addEventListener('popstate', () => this.debouncedCapture());
    
    // Also intercept pushState
    const originalPushState = history.pushState;
    history.pushState = function() {
      originalPushState.apply(this, arguments);
      window.dispatchEvent(new Event('pushstate'));
    };
    window.addEventListener('pushstate', () => this.debouncedCapture());
  }
  
  debouncedCapture() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      this.captureContext();
    }, CONFIG.DEBOUNCE_MS);
  }
  
  captureContext() {
    const newContext = {
      exchange: 'binance',
      market: 'futures',
      symbol: this.extractSymbol(),
      contract: 'PERP',
      timeframe: this.extractTimeframe(),
      timestamp: Date.now(),
    };
    
    // Check if context changed
    if (
      newContext.symbol !== currentContext.symbol ||
      newContext.timeframe !== currentContext.timeframe
    ) {
      currentContext = newContext;
      
      if (newContext.symbol && newContext.timeframe) {
        console.log('[LenQuant] Context changed:', newContext);
        this.onContextChange(newContext);
      }
    }
  }
  
  extractSymbol() {
    // Try multiple selectors for symbol
    const selectors = [
      // Main symbol display
      '[data-testid="symbol-info"] span',
      '.symbol-name',
      '.chart-container .symbol',
      // URL-based extraction
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent) {
        const text = element.textContent.trim();
        if (text.match(/^[A-Z]+USDT?$/)) {
          return text;
        }
      }
    }
    
    // Fallback: extract from URL
    const urlMatch = window.location.pathname.match(/\/futures\/([A-Z]+)/i);
    if (urlMatch) {
      return urlMatch[1].toUpperCase();
    }
    
    return null;
  }
  
  extractTimeframe() {
    // Try to find active timeframe selector
    const selectors = [
      '.chart-toolbar .active',
      '[data-testid="timeframe-selector"] .selected',
      '.interval-selector .active',
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent) {
        const tf = element.textContent.trim().toLowerCase();
        if (['1m', '5m', '15m', '30m', '1h', '4h', '1d'].includes(tf)) {
          return tf;
        }
      }
    }
    
    // Default to 1m
    return '1m';
  }
  
  async onContextChange(context) {
    try {
      // Notify background script
      const response = await chrome.runtime.sendMessage({
        type: 'CONTEXT_CHANGED',
        symbol: context.symbol,
        timeframe: context.timeframe,
        context,
      });
      
      if (response.analysis) {
        currentAnalysis = response.analysis;
        updatePanel(response.analysis);
      }
      
      // Check for cooldown
      if (response.cooldown && response.cooldown.active) {
        showCooldownOverlay(response.cooldown);
      } else {
        hideCooldownOverlay();
      }
      
    } catch (error) {
      console.error('[LenQuant] Context change handler error:', error);
    }
  }
}

// ============================================================================
// Trading Panel
// ============================================================================

class TradingPanel {
  constructor() {
    this.container = null;
    this.collapsed = false;
  }
  
  inject() {
    if (this.container) return;
    
    // Create panel container
    this.container = document.createElement('div');
    this.container.id = 'lenquant-panel';
    this.container.innerHTML = this.getTemplate();
    
    document.body.appendChild(this.container);
    
    // Attach event listeners
    this.attachEventListeners();
    
    console.log('[LenQuant] Panel injected');
  }
  
  getTemplate() {
    return `
      <div class="lq-panel">
        <div class="lq-header">
          <span class="lq-logo">LenQuant</span>
          <div class="lq-header-actions">
            <button class="lq-btn-icon lq-collapse-btn" title="Collapse">−</button>
            <button class="lq-btn-icon lq-close-btn" title="Close">×</button>
          </div>
        </div>
        
        <div class="lq-content">
          <div class="lq-context">
            <span class="lq-symbol">--</span>
            <span class="lq-separator">•</span>
            <span class="lq-timeframe">--</span>
          </div>
          
          <div class="lq-grade-section">
            <div class="lq-grade-circle">
              <span class="lq-grade">-</span>
            </div>
            <div class="lq-market-state">
              <span class="lq-state-label">Market State</span>
              <span class="lq-state-value">Loading...</span>
            </div>
          </div>
          
          <div class="lq-setup-section">
            <span class="lq-setup-label">Setup:</span>
            <span class="lq-setup-value">--</span>
          </div>
          
          <div class="lq-risk-section">
            <div class="lq-risk-flags"></div>
          </div>
          
          <div class="lq-leverage-section">
            <span class="lq-leverage-label">Leverage Band:</span>
            <span class="lq-leverage-value">--</span>
            <div class="lq-leverage-bar">
              <div class="lq-leverage-fill"></div>
            </div>
            <div class="lq-regime-info">
              <span class="lq-regime-multiplier"></span>
              <span class="lq-regime-desc"></span>
            </div>
          </div>
          
          <div class="lq-sizing-note" style="display: none;">
            <span class="lq-sizing-icon">📊</span>
            <span class="lq-sizing-text"></span>
          </div>
          
          <div class="lq-reason">
            <span class="lq-reason-text">Waiting for context...</span>
          </div>
          
          <div class="lq-actions">
            <button class="lq-btn lq-btn-explain">🔍 Explain</button>
            <button class="lq-btn lq-btn-bookmark">📑 Bookmark</button>
          </div>
          
          <div class="lq-actions lq-actions-secondary">
            <button class="lq-btn lq-btn-secondary lq-btn-break">⏸️ Take Break</button>
            <button class="lq-btn lq-btn-secondary lq-btn-sync">🔄 Sync</button>
          </div>
          
          <div class="lq-explanation" style="display: none;">
            <div class="lq-explanation-header">
              <span>Trade Plan</span>
              <button class="lq-btn-icon lq-close-explanation">×</button>
            </div>
            <div class="lq-explanation-content"></div>
          </div>
          
          <div class="lq-alerts"></div>
        </div>
        
        <div class="lq-footer">
          <span class="lq-latency">--ms</span>
          <span class="lq-sync-status">Not connected</span>
        </div>
      </div>
    `;
  }
  
  attachEventListeners() {
    // Collapse button
    const collapseBtn = this.container.querySelector('.lq-collapse-btn');
    collapseBtn.addEventListener('click', () => this.toggleCollapse());
    
    // Close button
    const closeBtn = this.container.querySelector('.lq-close-btn');
    closeBtn.addEventListener('click', () => this.hide());
    
    // Explain button
    const explainBtn = this.container.querySelector('.lq-btn-explain');
    explainBtn.addEventListener('click', () => this.requestExplanation());
    
    // Bookmark button
    const bookmarkBtn = this.container.querySelector('.lq-btn-bookmark');
    bookmarkBtn.addEventListener('click', () => this.addBookmark());
    
    // Close explanation
    const closeExplainBtn = this.container.querySelector('.lq-close-explanation');
    closeExplainBtn.addEventListener('click', () => this.hideExplanation());
    
    // Take break button
    const breakBtn = this.container.querySelector('.lq-btn-break');
    breakBtn.addEventListener('click', () => this.startBreak());
    
    // Sync button
    const syncBtn = this.container.querySelector('.lq-btn-sync');
    syncBtn.addEventListener('click', () => this.syncTrades());
  }
  
  async startBreak() {
    const minutes = parseInt(prompt('How many minutes? (5-60):', '15'), 10);
    if (isNaN(minutes) || minutes < 5 || minutes > 60) {
      alert('Please enter a number between 5 and 60');
      return;
    }
    
    await startCooldownFromPanel(minutes, 'User-initiated break');
  }
  
  async syncTrades() {
    const syncBtn = this.container.querySelector('.lq-btn-sync');
    syncBtn.disabled = true;
    syncBtn.textContent = '⏳ Syncing...';
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SYNC_TRADES',
        mode: 'testnet',
      });
      
      if (response && !response.error) {
        const msg = `Imported: ${response.trades_imported}, Matched: ${response.trades_matched}`;
        alert(`Sync complete!\n${msg}`);
      } else {
        alert('Sync failed: ' + (response.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('[LenQuant] Sync error:', error);
      alert('Sync failed: ' + error.message);
    } finally {
      syncBtn.disabled = false;
      syncBtn.textContent = '🔄 Sync';
    }
  }
  
  toggleCollapse() {
    this.collapsed = !this.collapsed;
    const content = this.container.querySelector('.lq-content');
    const footer = this.container.querySelector('.lq-footer');
    const btn = this.container.querySelector('.lq-collapse-btn');
    
    if (this.collapsed) {
      content.style.display = 'none';
      footer.style.display = 'none';
      btn.textContent = '+';
    } else {
      content.style.display = 'block';
      footer.style.display = 'flex';
      btn.textContent = '−';
    }
  }
  
  hide() {
    this.container.style.display = 'none';
  }
  
  show() {
    this.container.style.display = 'block';
  }
  
  async requestExplanation() {
    if (!currentContext.symbol || !currentAnalysis) {
      console.log('[LenQuant] No context/analysis for explanation');
      return;
    }
    
    const explainBtn = this.container.querySelector('.lq-btn-explain');
    explainBtn.disabled = true;
    explainBtn.textContent = '⏳ Loading...';
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'REQUEST_EXPLAIN',
        context: currentContext,
        fastAnalysis: currentAnalysis,
      });
      
      if (response.explanation) {
        this.showExplanation(response.explanation);
      } else if (response.error) {
        console.error('[LenQuant] Explanation error:', response.error);
      }
      
    } catch (error) {
      console.error('[LenQuant] Explanation request error:', error);
    } finally {
      explainBtn.disabled = false;
      explainBtn.textContent = '🔍 Explain';
    }
  }
  
  showExplanation(explanation) {
    const section = this.container.querySelector('.lq-explanation');
    const content = this.container.querySelector('.lq-explanation-content');
    
    const plan = explanation.trade_plan;
    
    content.innerHTML = `
      <div class="lq-plan-bias ${plan.bias}">
        <strong>Bias:</strong> ${plan.bias.toUpperCase()}
      </div>
      <div class="lq-plan-setup">
        <strong>Setup:</strong> ${plan.setup_name}
      </div>
      <div class="lq-plan-trigger">
        <strong>Trigger:</strong> ${plan.trigger}
      </div>
      <div class="lq-plan-invalidation">
        <strong>Invalidation:</strong> ${plan.invalidation}
      </div>
      <div class="lq-plan-targets">
        <strong>Targets:</strong> ${plan.targets.join(', ') || 'N/A'}
      </div>
      <div class="lq-plan-confidence">
        <strong>Confidence:</strong> ${plan.confidence_pattern}%
      </div>
      ${plan.do_not_trade ? '<div class="lq-do-not-trade">⚠️ NOT RECOMMENDED TO TRADE</div>' : ''}
      <div class="lq-reasoning">${explanation.reasoning}</div>
      <div class="lq-provider">via ${explanation.provider} (${explanation.latency_ms}ms)</div>
    `;
    
    section.style.display = 'block';
  }
  
  hideExplanation() {
    const section = this.container.querySelector('.lq-explanation');
    section.style.display = 'none';
  }
  
  async addBookmark() {
    try {
      const note = prompt('Add a note for this bookmark (optional):');
      
      await chrome.runtime.sendMessage({
        type: 'BOOKMARK',
        symbol: currentContext.symbol,
        timeframe: currentContext.timeframe,
        note: note || '',
      });
      
      // Visual feedback
      const btn = this.container.querySelector('.lq-btn-bookmark');
      btn.textContent = '✓ Saved!';
      setTimeout(() => {
        btn.textContent = '📑 Bookmark';
      }, 2000);
      
    } catch (error) {
      console.error('[LenQuant] Bookmark error:', error);
    }
  }
  
  showAlert(alert) {
    const alertsContainer = this.container.querySelector('.lq-alerts');
    
    const alertEl = document.createElement('div');
    alertEl.className = `lq-alert lq-alert-${alert.severity}`;
    alertEl.innerHTML = `
      <span class="lq-alert-icon">${alert.severity === 'critical' ? '🚨' : '⚠️'}</span>
      <span class="lq-alert-message">${alert.message}</span>
      <button class="lq-btn-icon lq-dismiss-alert">×</button>
    `;
    
    alertEl.querySelector('.lq-dismiss-alert').addEventListener('click', () => {
      alertEl.remove();
    });
    
    alertsContainer.appendChild(alertEl);
    
    // Auto-dismiss info alerts after 10s
    if (alert.severity === 'info') {
      setTimeout(() => alertEl.remove(), 10000);
    }
  }
}

// ============================================================================
// Update Functions
// ============================================================================

function updatePanel(analysis) {
  if (!panel || !panel.container) return;
  
  // Update context
  panel.container.querySelector('.lq-symbol').textContent = currentContext.symbol || '--';
  panel.container.querySelector('.lq-timeframe').textContent = currentContext.timeframe || '--';
  
  // Update grade
  const grade = calculateGrade(analysis);
  const gradeEl = panel.container.querySelector('.lq-grade');
  gradeEl.textContent = grade;
  gradeEl.className = `lq-grade grade-${grade.toLowerCase()}`;
  
  // Update market state
  const stateValue = panel.container.querySelector('.lq-state-value');
  stateValue.textContent = formatMarketState(analysis.market_state, analysis.trend_direction);
  stateValue.className = `lq-state-value state-${analysis.market_state}`;
  
  // Update setup
  const setupValue = panel.container.querySelector('.lq-setup-value');
  setupValue.textContent = analysis.setup_candidates.length > 0 
    ? analysis.setup_candidates[0].replace(/_/g, ' ')
    : 'No setup detected';
  
  // Update risk flags
  const riskContainer = panel.container.querySelector('.lq-risk-flags');
  riskContainer.innerHTML = analysis.risk_flags.map(flag => 
    `<span class="lq-risk-flag">${formatRiskFlag(flag)}</span>`
  ).join('');
  
  // Update leverage
  const [minLev, maxLev] = analysis.suggested_leverage_band;
  panel.container.querySelector('.lq-leverage-value').textContent = `${minLev}x - ${maxLev}x`;
  
  const leverageFill = panel.container.querySelector('.lq-leverage-fill');
  leverageFill.style.width = `${(maxLev / 20) * 100}%`;
  
  // Phase 2: Update regime info
  const regimeMultiplier = analysis.regime_multiplier || 1.0;
  const regimeDesc = analysis.regime_description;
  
  const regimeMultiplierEl = panel.container.querySelector('.lq-regime-multiplier');
  const regimeDescEl = panel.container.querySelector('.lq-regime-desc');
  
  if (regimeMultiplierEl && regimeMultiplier !== 1.0) {
    const multiplierPct = Math.round(regimeMultiplier * 100);
    const multiplierClass = regimeMultiplier >= 1.0 ? 'positive' : regimeMultiplier >= 0.7 ? 'neutral' : 'negative';
    regimeMultiplierEl.textContent = `${multiplierPct}%`;
    regimeMultiplierEl.className = `lq-regime-multiplier ${multiplierClass}`;
    regimeMultiplierEl.style.display = 'inline';
  } else if (regimeMultiplierEl) {
    regimeMultiplierEl.style.display = 'none';
  }
  
  if (regimeDescEl && regimeDesc) {
    regimeDescEl.textContent = regimeDesc;
    regimeDescEl.style.display = 'inline';
  } else if (regimeDescEl) {
    regimeDescEl.style.display = 'none';
  }
  
  // Phase 2: Update position sizing note
  const sizingNote = analysis.position_sizing_note;
  const sizingNoteSection = panel.container.querySelector('.lq-sizing-note');
  const sizingTextEl = panel.container.querySelector('.lq-sizing-text');
  
  if (sizingNote && sizingNoteSection && sizingTextEl) {
    sizingTextEl.textContent = sizingNote;
    sizingNoteSection.style.display = 'flex';
  } else if (sizingNoteSection) {
    sizingNoteSection.style.display = 'none';
  }
  
  // Update reason
  panel.container.querySelector('.lq-reason-text').textContent = analysis.reason;
  
  // Update latency
  panel.container.querySelector('.lq-latency').textContent = `${analysis.latency_ms}ms`;
  
  // Update connection status
  panel.container.querySelector('.lq-sync-status').textContent = 
    analysis.cached ? 'Cached' : 'Live';
}

function calculateGrade(analysis) {
  if (!analysis.trade_allowed) return 'D';
  
  const confidence = analysis.confidence_pattern || 50;
  const riskCount = analysis.risk_flags.length;
  const hasSetup = analysis.setup_candidates.length > 0;
  
  let score = confidence;
  
  // Penalize for risk flags
  score -= riskCount * 10;
  
  // Bonus for setups
  if (hasSetup) score += 10;
  
  // Map to grade
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

function formatMarketState(state, direction) {
  const stateMap = {
    trend: direction === 'up' ? '📈 TRENDING UP' : direction === 'down' ? '📉 TRENDING DOWN' : '📊 TRENDING',
    trend_volatile: '⚡ TREND (VOLATILE)',
    range: '↔️ RANGING',
    chop: '🌊 CHOPPY',
    volatile: '⚡ HIGH VOLATILITY',
    undefined: '❓ UNDEFINED',
  };
  
  return stateMap[state] || state.toUpperCase();
}

function formatRiskFlag(flag) {
  const flagMap = {
    low_volume: '📉 Low Volume',
    extreme_volatility: '⚡ Extreme Vol',
    overbought: '🔴 Overbought',
    oversold: '🟢 Oversold',
    choppy_momentum: '🌊 Choppy',
    insufficient_data: '📊 Low Data',
  };
  
  return flagMap[flag] || flag.replace(/_/g, ' ');
}

// ============================================================================
// Cooldown Overlay
// ============================================================================

let cooldownOverlay = null;

function showCooldownOverlay(cooldown) {
  if (!cooldownOverlay) {
    cooldownOverlay = document.createElement('div');
    cooldownOverlay.id = 'lenquant-cooldown-overlay';
    cooldownOverlay.innerHTML = `
      <div class="lq-cooldown-content">
        <div class="lq-cooldown-icon">⏸️</div>
        <div class="lq-cooldown-title">Trading Cooldown Active</div>
        <div class="lq-cooldown-time"></div>
        <div class="lq-cooldown-reason"></div>
        <button class="lq-cooldown-dismiss">End Cooldown</button>
      </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      #lenquant-cooldown-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(11, 14, 17, 0.85);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(4px);
      }
      .lq-cooldown-content {
        background: linear-gradient(180deg, #1e2329 0%, #0b0e11 100%);
        border: 1px solid #f0b90b;
        border-radius: 16px;
        padding: 40px;
        text-align: center;
        max-width: 400px;
      }
      .lq-cooldown-icon {
        font-size: 48px;
        margin-bottom: 16px;
      }
      .lq-cooldown-title {
        color: #f0b90b;
        font-size: 24px;
        font-weight: 700;
        margin-bottom: 12px;
      }
      .lq-cooldown-time {
        color: #eaecef;
        font-size: 32px;
        font-weight: 600;
        margin-bottom: 8px;
      }
      .lq-cooldown-reason {
        color: #848e9c;
        font-size: 14px;
        margin-bottom: 24px;
        line-height: 1.5;
      }
      .lq-cooldown-dismiss {
        background: #2b3139;
        border: 1px solid #474d57;
        color: #eaecef;
        padding: 12px 32px;
        border-radius: 8px;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
      }
      .lq-cooldown-dismiss:hover {
        background: #3a4048;
        border-color: #f0b90b;
      }
    `;
    document.head.appendChild(style);
    
    // Add dismiss handler
    cooldownOverlay.querySelector('.lq-cooldown-dismiss').addEventListener('click', async () => {
      try {
        await chrome.runtime.sendMessage({ type: 'CHECK_COOLDOWN' });
        hideCooldownOverlay();
      } catch (e) {
        hideCooldownOverlay();
      }
    });
    
    document.body.appendChild(cooldownOverlay);
  }
  
  // Update content
  const remaining = cooldown.remainingMin || cooldown.remaining_min || 0;
  const minutes = Math.floor(remaining);
  const seconds = Math.round((remaining - minutes) * 60);
  
  cooldownOverlay.querySelector('.lq-cooldown-time').textContent = 
    `${minutes}:${seconds.toString().padStart(2, '0')} remaining`;
  
  cooldownOverlay.querySelector('.lq-cooldown-reason').textContent = 
    cooldown.reason || 'Take a break to avoid emotional trading.';
  
  cooldownOverlay.style.display = 'flex';
}

function hideCooldownOverlay() {
  if (cooldownOverlay) {
    cooldownOverlay.style.display = 'none';
  }
}

// ============================================================================
// Start Cooldown from Panel
// ============================================================================

async function startCooldownFromPanel(minutes, reason) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'START_COOLDOWN',
      minutes,
      reason,
    });
    
    if (response && !response.error) {
      showCooldownOverlay({
        remainingMin: minutes,
        reason: reason || 'User-initiated cooldown',
      });
    }
  } catch (error) {
    console.error('[LenQuant] Failed to start cooldown:', error);
  }
}

// ============================================================================
// Message Handling
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'CANDLE_UPDATE':
      // Could trigger re-analysis if needed
      console.log('[LenQuant] Candle update:', message.payload);
      break;
      
    case 'SIGNAL_UPDATE':
      // Handle market state changes
      console.log('[LenQuant] Signal update:', message.payload);
      break;
      
    default:
      break;
  }
});

// ============================================================================
// Initialization
// ============================================================================

async function init() {
  console.log('[LenQuant] Content script initializing');
  
  // Get session ID from background
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_SESSION' });
    sessionId = response.sessionId;
    console.log('[LenQuant] Session:', sessionId);
  } catch (error) {
    console.error('[LenQuant] Failed to get session:', error);
  }
  
  // Initialize panel
  panel = new TradingPanel();
  panel.inject();
  
  // Initialize context observer
  const observer = new BinanceContextObserver();
  observer.init();
  
  // Check for behavior alerts periodically
  setInterval(async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'CHECK_BEHAVIOR' });
      if (response.alerts && response.alerts.length > 0) {
        for (const alert of response.alerts) {
          panel.showAlert(alert);
        }
      }
    } catch (error) {
      // Ignore errors
    }
  }, 60000); // Check every minute
  
  console.log('[LenQuant] Initialization complete');
}

// Wait for page to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

