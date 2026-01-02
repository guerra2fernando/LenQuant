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
  leverage: null,
  position: null,
};
let currentAnalysis = null;
let panel = null;
let sessionId = null;

// ============================================================================
// DOM Data Extraction (Leverage, Positions, etc.)
// ============================================================================

/**
 * Extract current leverage setting from Binance DOM.
 * Binance shows leverage in multiple places - we try several selectors.
 * Priority: Look for the actual leverage button near the order entry form.
 */
function extractLeverage() {
  // Priority 1: Look for leverage button in the trading panel area
  // Binance typically shows leverage near Cross/Isolated mode selector
  const prioritySelectors = [
    // Binance's leverage button often has these patterns
    'button[class*="leverage"]',
    'div[class*="leverage"] button',
    '[class*="contractLeverage"]',
    '[class*="marginLeverage"]',
    // The button near margin type selector
    '[class*="margin-type"] + button',
    '[class*="marginType"] ~ button',
    // Look in the order form area
    '[class*="orderForm"] [class*="leverage"]',
    '[class*="trade-panel"] [class*="leverage"]',
  ];
  
  for (const selector of prioritySelectors) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const text = el.textContent?.trim();
        const match = text?.match(/(\d+)[xX]/);
        if (match) {
          const lev = parseInt(match[1], 10);
          if (lev >= 1 && lev <= 125) {
            console.log('[LenQuant] Found leverage via priority selector:', lev, selector);
            return lev;
          }
        }
      }
    } catch (e) {
      // Continue to next selector
    }
  }
  
  // Priority 2: Look for buttons containing only "XXx" pattern
  const buttons = document.querySelectorAll('button, [role="button"]');
  for (const btn of buttons) {
    const text = btn.textContent?.trim();
    // Match exact patterns like "20x", "125x" - the button's full text
    if (text && /^\d{1,3}[xX]$/.test(text)) {
      const match = text.match(/^(\d{1,3})[xX]$/);
      if (match) {
        const lev = parseInt(match[1], 10);
        if (lev >= 1 && lev <= 125) {
          console.log('[LenQuant] Found leverage via button text:', lev);
          return lev;
        }
      }
    }
  }
  
  // Priority 3: Look for elements near "Cross" or "Isolated" text
  const marginElements = document.querySelectorAll('[class*="cross"], [class*="isolated"], [class*="margin"]');
  for (const marginEl of marginElements) {
    // Check siblings and nearby elements
    const parent = marginEl.parentElement;
    if (parent) {
      const siblings = parent.querySelectorAll('*');
      for (const sib of siblings) {
        if (sib.children.length === 0) {
          const text = sib.textContent?.trim();
          if (text && /^(\d{1,3})[xX]$/.test(text)) {
            const lev = parseInt(text.match(/^(\d{1,3})[xX]$/)[1], 10);
            if (lev >= 1 && lev <= 125) {
              console.log('[LenQuant] Found leverage near margin selector:', lev);
              return lev;
            }
          }
        }
      }
    }
  }
  
  // Priority 4: Scan for any element showing leverage pattern
  // But be more strict - only leaf nodes with exact match
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  let foundLeverages = [];
  let node;
  while (node = walker.nextNode()) {
    const text = node.textContent?.trim();
    if (text && /^(\d{1,3})[xX]$/.test(text)) {
      const match = text.match(/^(\d{1,3})[xX]$/);
      if (match) {
        const lev = parseInt(match[1], 10);
        if (lev >= 1 && lev <= 125) {
          foundLeverages.push(lev);
        }
      }
    }
  }
  
  // If multiple leverages found, prefer higher ones (usually the actual leverage)
  // as lower numbers might be from other UI elements
  if (foundLeverages.length > 0) {
    // Filter out common non-leverage numbers (1, 2, 3, 4, 5 which could be timeframes etc)
    const filtered = foundLeverages.filter(l => l > 5);
    if (filtered.length > 0) {
      const result = Math.max(...filtered);
      console.log('[LenQuant] Found leverages:', foundLeverages, 'Using:', result);
      return result;
    }
    // Fall back to max of all found
    return Math.max(...foundLeverages);
  }
  
  console.log('[LenQuant] Could not detect leverage');
  return null;
}

/**
 * Extract current position info from Binance DOM.
 */
function extractPosition() {
  try {
    // Look for position panel elements
    const positionSelectors = [
      '[class*="position-table"]',
      '[class*="positions"]',
      '[data-testid*="position"]',
    ];
    
    for (const selector of positionSelectors) {
      const container = document.querySelector(selector);
      if (container) {
        // Try to find position rows
        const rows = container.querySelectorAll('tr, [class*="row"]');
        for (const row of rows) {
          const text = row.textContent;
          // Look for long/short indicators and PnL
          const isLong = /long/i.test(text);
          const isShort = /short/i.test(text);
          const pnlMatch = text.match(/([+-]?[\d,]+\.?\d*)\s*(?:USDT|USD)/);
          
          if ((isLong || isShort) && pnlMatch) {
            return {
              side: isLong ? 'long' : 'short',
              pnl: parseFloat(pnlMatch[1].replace(/,/g, '')),
              hasPosition: true,
            };
          }
        }
      }
    }
    
    return { hasPosition: false };
    
  } catch (e) {
    console.error('[LenQuant] Position extraction error:', e);
    return { hasPosition: false };
  }
}

/**
 * Extract margin type (Cross/Isolated) from DOM.
 */
function extractMarginType() {
  const selectors = [
    '[class*="cross"]',
    '[class*="isolated"]',
    '[data-testid*="margin"]',
  ];
  
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      const text = el.textContent?.toLowerCase();
      if (text?.includes('cross')) return 'cross';
      if (text?.includes('isolated')) return 'isolated';
    }
  }
  
  return null;
}

/**
 * Capture screenshot of the chart area for AI analysis.
 */
async function captureChartScreenshot() {
  try {
    // Request screenshot from background script (uses chrome.tabs.captureVisibleTab)
    const response = await chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' });
    return response?.screenshot || null;
  } catch (e) {
    console.error('[LenQuant] Screenshot capture error:', e);
    return null;
  }
}

/**
 * Get all DOM-extracted data in one call.
 */
function extractAllDOMData() {
  return {
    leverage: extractLeverage(),
    position: extractPosition(),
    marginType: extractMarginType(),
    timestamp: Date.now(),
  };
}

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
    // Extract DOM data (leverage, position, etc.)
    const domData = extractAllDOMData();
    
    const newContext = {
      exchange: 'binance',
      market: 'futures',
      symbol: this.extractSymbol(),
      contract: 'PERP',
      timeframe: this.extractTimeframe(),
      timestamp: Date.now(),
      // Include DOM-extracted data
      leverage: domData.leverage,
      position: domData.position,
      marginType: domData.marginType,
    };
    
    // Check if context changed (including leverage changes)
    if (
      newContext.symbol !== currentContext.symbol ||
      newContext.timeframe !== currentContext.timeframe ||
      newContext.leverage !== currentContext.leverage
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
      // Show loading state
      if (panel && panel.container) {
        panel.container.querySelector('.lq-state-value').textContent = 'Analyzing...';
      }
      
      // Notify background script with full context including DOM data
      const response = await chrome.runtime.sendMessage({
        type: 'CONTEXT_CHANGED',
        symbol: context.symbol,
        timeframe: context.timeframe,
        context,
        domData: {
          leverage: context.leverage,
          position: context.position,
          marginType: context.marginType,
        },
      });
      
      if (response.analysis) {
        currentAnalysis = response.analysis;
        updatePanel(response.analysis);
        
        // Show source indicator (backend vs client-side)
        if (response.analysis.source === 'client') {
          console.log('[LenQuant] Using client-side analysis (backend unavailable or no data)');
        }
      }
      
      // Check for cooldown
      if (response.cooldown && response.cooldown.active) {
        showCooldownOverlay(response.cooldown);
      } else {
        hideCooldownOverlay();
      }
      
    } catch (error) {
      console.error('[LenQuant] Context change handler error:', error);
      // On error, try to show something useful
      if (panel && panel.container) {
        panel.container.querySelector('.lq-state-value').textContent = 'Connection error';
        panel.container.querySelector('.lq-reason-text').textContent = 'Unable to reach backend. Trying client-side analysis...';
      }
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
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
  }
  
  inject() {
    if (this.container) return;
    
    // Create panel container
    this.container = document.createElement('div');
    this.container.id = 'lenquant-panel';
    this.container.innerHTML = this.getTemplate();
    
    document.body.appendChild(this.container);
    
    // Restore saved position
    this.restorePosition();
    
    // Attach event listeners
    this.attachEventListeners();
    
    // Setup draggable functionality
    this.setupDraggable();
    
    console.log('[LenQuant] Panel injected');
  }
  
  setupDraggable() {
    const header = this.container.querySelector('.lq-header');
    if (!header) return;
    
    header.style.cursor = 'move';
    
    const onMouseDown = (e) => {
      // Don't drag if clicking buttons
      if (e.target.closest('.lq-btn-icon')) return;
      
      this.isDragging = true;
      const rect = this.container.getBoundingClientRect();
      this.dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      
      // Prevent text selection while dragging
      e.preventDefault();
    };
    
    const onMouseMove = (e) => {
      if (!this.isDragging) return;
      
      const newX = e.clientX - this.dragOffset.x;
      const newY = e.clientY - this.dragOffset.y;
      
      // Keep panel within viewport bounds
      const maxX = window.innerWidth - this.container.offsetWidth;
      const maxY = window.innerHeight - this.container.offsetHeight;
      
      const boundedX = Math.max(0, Math.min(newX, maxX));
      const boundedY = Math.max(0, Math.min(newY, maxY));
      
      this.container.style.left = `${boundedX}px`;
      this.container.style.top = `${boundedY}px`;
      this.container.style.right = 'auto';
    };
    
    const onMouseUp = () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.savePosition();
      }
    };
    
    header.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }
  
  savePosition() {
    const rect = this.container.getBoundingClientRect();
    const position = {
      left: rect.left,
      top: rect.top
    };
    localStorage.setItem('lenquant_panel_position', JSON.stringify(position));
  }
  
  restorePosition() {
    try {
      const saved = localStorage.getItem('lenquant_panel_position');
      if (saved) {
        const position = JSON.parse(saved);
        // Validate position is within current viewport
        const maxX = window.innerWidth - 320; // panel width
        const maxY = window.innerHeight - 200;
        
        if (position.left >= 0 && position.left <= maxX && 
            position.top >= 0 && position.top <= maxY) {
          this.container.style.left = `${position.left}px`;
          this.container.style.top = `${position.top}px`;
          this.container.style.right = 'auto';
        }
      }
    } catch (e) {
      console.log('[LenQuant] Could not restore panel position');
    }
  }
  
  getTemplate() {
    return `
      <div class="lq-panel">
        <div class="lq-signal-badge neutral">ANALYZING</div>
        <div class="lq-header">
          <span class="lq-logo">LenQuant</span>
          <div class="lq-header-actions">
            <button class="lq-btn-icon lq-refresh-btn" title="Refresh Analysis">↻</button>
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
          
          <div class="lq-signal-prob">
            <span class="lq-signal-prob-label">Trade Score:</span>
            <div class="lq-signal-prob-bar">
              <div class="lq-signal-prob-fill neutral" style="width: 50%;"></div>
            </div>
            <span class="lq-signal-prob-value neutral">50%</span>
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
            <div class="lq-leverage-header">
              <span class="lq-leverage-label">Leverage Band:</span>
              <span class="lq-leverage-value">--</span>
            </div>
            <div class="lq-leverage-bar">
              <div class="lq-leverage-fill"></div>
            </div>
            <div class="lq-current-leverage" style="display: none;">
              <span class="lq-current-leverage-label">Your leverage:</span>
              <span class="lq-current-leverage-value">--</span>
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
          
          <div class="lq-quick-action" style="display: none;">
            <div class="lq-quick-action-header">
              <span class="lq-quick-action-title">📊 Quick Trade Info</span>
              <span class="lq-quick-action-confidence">--% conf</span>
            </div>
            <div class="lq-quick-action-grid">
              <div class="lq-quick-action-item lq-bias-indicator">
                <span class="lq-quick-label">Bias</span>
                <span class="lq-quick-value lq-bias-value">--</span>
              </div>
              <div class="lq-quick-action-item">
                <span class="lq-quick-label">Wait</span>
                <span class="lq-quick-value lq-wait-value">--</span>
              </div>
              <div class="lq-quick-action-item">
                <span class="lq-quick-label">Entry Zone</span>
                <span class="lq-quick-value lq-entry-value">--</span>
              </div>
              <div class="lq-quick-action-item">
                <span class="lq-quick-label">Stop Loss</span>
                <span class="lq-quick-value lq-sl-value">--</span>
              </div>
              <div class="lq-quick-action-item">
                <span class="lq-quick-label">Take Profit 1</span>
                <span class="lq-quick-value lq-tp1-value">--</span>
              </div>
              <div class="lq-quick-action-item">
                <span class="lq-quick-label">Take Profit 2</span>
                <span class="lq-quick-value lq-tp2-value">--</span>
              </div>
            </div>
            <div class="lq-quick-action-note"></div>
          </div>
          
          <div class="lq-actions">
            <button class="lq-btn lq-btn-explain" title="Get AI-powered detailed trade plan with entry, stop loss, and targets">🔍 Explain</button>
            <button class="lq-btn lq-btn-bookmark" title="Save this analysis with a note for later review in Journal">📑 Bookmark</button>
          </div>
          
          <div class="lq-actions lq-actions-secondary">
            <button class="lq-btn lq-btn-secondary lq-btn-break" title="Start a cooldown period to prevent emotional/revenge trading">⏸️ Take Break</button>
            <button class="lq-btn lq-btn-secondary lq-btn-sync" title="Import your actual trades from Binance to match with analyses">🔄 Sync</button>
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
    // Refresh button
    const refreshBtn = this.container.querySelector('.lq-refresh-btn');
    refreshBtn.addEventListener('click', () => this.refreshAnalysis());

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

  async refreshAnalysis() {
    if (!currentContext.symbol) {
      console.log('[LenQuant] No symbol to refresh');
      return;
    }

    // Visual feedback - spin the refresh button
    const refreshBtn = this.container.querySelector('.lq-refresh-btn');
    refreshBtn.style.animation = 'spin 1s linear';
    refreshBtn.disabled = true;

    try {
      // Show loading state
      this.container.querySelector('.lq-state-value').textContent = 'Refreshing...';

      // Force fresh analysis by calling context change with forceRefresh flag
      const domData = extractAllDOMData();
      const response = await chrome.runtime.sendMessage({
        type: 'CONTEXT_CHANGED',
        symbol: currentContext.symbol,
        timeframe: currentContext.timeframe || '1m',
        context: { ...currentContext, forceRefresh: true },
        domData,
      });

      if (response && response.analysis) {
        currentAnalysis = response.analysis;
        updatePanelDisplay(response.analysis);
      }
    } catch (error) {
      console.error('[LenQuant] Refresh failed:', error);
      this.container.querySelector('.lq-state-value').textContent = 'Refresh failed';
    } finally {
      // Reset button after animation
      setTimeout(() => {
        refreshBtn.style.animation = '';
        refreshBtn.disabled = false;
      }, 1000);
    }
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
    : 'No Setup Detected';
  
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
  
  // Update Quick Action Info Section
  updateQuickActionInfo(analysis);
  
  // Update Signal Display (with external data if available)
  // Fetch external data asynchronously
  getExternalData(currentContext.symbol).then(externalData => {
    updatePanelSignal(analysis, externalData);
  }).catch(() => {
    // Fallback: update signal without external data
    updatePanelSignal(analysis, {});
  });
  
  // Update latency
  panel.container.querySelector('.lq-latency').textContent = `${analysis.latency_ms}ms`;
  
  // Update connection status - show source
  const sourceText = analysis.source === 'client' ? 'Client' : analysis.cached ? 'Cached' : 'Live';
  panel.container.querySelector('.lq-sync-status').textContent = sourceText;
  
  // Show user's current leverage if available
  const currentLeverageSection = panel.container.querySelector('.lq-current-leverage');
  const currentLeverageValue = panel.container.querySelector('.lq-current-leverage-value');
  
  if (analysis.dom_leverage && currentLeverageSection && currentLeverageValue) {
    const userLev = analysis.dom_leverage;
    const [minRec, maxRec] = analysis.suggested_leverage_band;
    
    currentLeverageValue.textContent = `${userLev}x`;
    
    // Color code: green if within range, yellow if borderline, red if too high
    if (userLev > maxRec) {
      currentLeverageValue.className = 'lq-current-leverage-value lq-leverage-warning';
      currentLeverageValue.title = `Your leverage (${userLev}x) exceeds recommended max (${maxRec}x)`;
    } else if (userLev >= minRec) {
      currentLeverageValue.className = 'lq-current-leverage-value lq-leverage-ok';
      currentLeverageValue.title = 'Your leverage is within recommended range';
    } else {
      currentLeverageValue.className = 'lq-current-leverage-value lq-leverage-conservative';
      currentLeverageValue.title = 'Your leverage is conservative';
    }
    
    currentLeverageSection.style.display = 'flex';
  } else if (currentLeverageSection) {
    currentLeverageSection.style.display = 'none';
  }
}

/**
 * Update Quick Action Info section with trade suggestions.
 */
function updateQuickActionInfo(analysis) {
  const quickAction = panel.container.querySelector('.lq-quick-action');
  if (!quickAction) return;
  
  // Only show if we have enough data and trading is allowed
  const hasSetup = analysis.setup_candidates && analysis.setup_candidates.length > 0;
  const hasFeatures = analysis.regime_features;
  
  if (!analysis.trade_allowed || analysis.market_state === 'chop' || analysis.market_state === 'undefined') {
    quickAction.style.display = 'none';
    return;
  }
  
  quickAction.style.display = 'block';
  
  // Get regime features for calculations
  const features = analysis.regime_features || {};
  const atrPct = features.atr_pct || 2.0;
  const rsi = features.rsi_14 || 50;
  
  // Determine bias
  let bias = 'neutral';
  let biasClass = 'neutral';
  if (analysis.trend_direction === 'up') {
    bias = '🟢 LONG';
    biasClass = 'bullish';
  } else if (analysis.trend_direction === 'down') {
    bias = '🔴 SHORT';
    biasClass = 'bearish';
  } else if (analysis.market_state === 'range') {
    // For ranging, check RSI
    if (rsi > 70) {
      bias = '🔴 SHORT (fade)';
      biasClass = 'bearish';
    } else if (rsi < 30) {
      bias = '🟢 LONG (fade)';
      biasClass = 'bullish';
    } else {
      bias = '⏳ WAIT';
      biasClass = 'neutral';
    }
  }
  
  // Update bias
  const biasValue = quickAction.querySelector('.lq-bias-value');
  if (biasValue) {
    biasValue.textContent = bias;
    biasValue.className = `lq-quick-value lq-bias-value ${biasClass}`;
  }
  
  // Calculate confidence class
  const confidence = analysis.confidence_pattern || 50;
  const confEl = quickAction.querySelector('.lq-quick-action-confidence');
  if (confEl) {
    confEl.textContent = `${confidence}% conf`;
    const confClass = confidence >= 70 ? 'high' : confidence >= 50 ? 'medium' : 'low';
    confEl.className = `lq-quick-action-confidence ${confClass}`;
  }
  
  // Calculate wait time based on timeframe and conditions
  const timeframe = currentContext.timeframe || '1m';
  let waitTime = 'Ready';
  if (analysis.risk_flags.includes('overbought') || analysis.risk_flags.includes('oversold')) {
    waitTime = 'Wait for reversal';
  } else if (analysis.market_state === 'range') {
    waitTime = 'At boundary';
  } else if (hasSetup) {
    waitTime = 'Ready';
  } else {
    // Suggest waiting based on timeframe
    const tfMinutes = { '1m': 5, '5m': 15, '15m': 30, '1h': 60, '4h': 120 };
    const waitMin = tfMinutes[timeframe] || 5;
    waitTime = `~${waitMin} min`;
  }
  
  const waitEl = quickAction.querySelector('.lq-wait-value');
  if (waitEl) waitEl.textContent = waitTime;
  
  // Try to get current price from DOM or use placeholder
  let currentPrice = getCurrentPrice();
  
  if (currentPrice) {
    // Calculate levels based on ATR
    const atr = (currentPrice * atrPct) / 100;
    const isLong = analysis.trend_direction === 'up' || 
                   (analysis.market_state === 'range' && rsi < 30);
    
    // Entry zone: near current price
    const entryLow = isLong ? currentPrice - atr * 0.3 : currentPrice - atr * 0.3;
    const entryHigh = isLong ? currentPrice + atr * 0.2 : currentPrice + atr * 0.2;
    
    // Stop loss: 1-1.5 ATR from entry
    const slDistance = atr * (analysis.market_state === 'range' ? 1.0 : 1.5);
    const sl = isLong ? currentPrice - slDistance : currentPrice + slDistance;
    
    // Take profit levels
    const tp1 = isLong ? currentPrice + atr * 1.5 : currentPrice - atr * 1.5;
    const tp2 = isLong ? currentPrice + atr * 2.5 : currentPrice - atr * 2.5;
    
    // Format prices
    const decimals = currentPrice < 1 ? 6 : currentPrice < 100 ? 4 : 2;
    
    const entryEl = quickAction.querySelector('.lq-entry-value');
    if (entryEl) entryEl.textContent = `${formatPrice(entryLow, decimals)} - ${formatPrice(entryHigh, decimals)}`;
    
    const slEl = quickAction.querySelector('.lq-sl-value');
    if (slEl) slEl.textContent = formatPrice(sl, decimals);
    
    const tp1El = quickAction.querySelector('.lq-tp1-value');
    if (tp1El) tp1El.textContent = formatPrice(tp1, decimals);
    
    const tp2El = quickAction.querySelector('.lq-tp2-value');
    if (tp2El) tp2El.textContent = formatPrice(tp2, decimals);
  } else {
    // Show percentages instead
    const entryEl = quickAction.querySelector('.lq-entry-value');
    if (entryEl) entryEl.textContent = 'Current ±0.3%';
    
    const slEl = quickAction.querySelector('.lq-sl-value');
    if (slEl) slEl.textContent = `-${(atrPct * 1.2).toFixed(1)}%`;
    
    const tp1El = quickAction.querySelector('.lq-tp1-value');
    if (tp1El) tp1El.textContent = `+${(atrPct * 1.5).toFixed(1)}%`;
    
    const tp2El = quickAction.querySelector('.lq-tp2-value');
    if (tp2El) tp2El.textContent = `+${(atrPct * 2.5).toFixed(1)}%`;
  }
  
  // Add note
  const noteEl = quickAction.querySelector('.lq-quick-action-note');
  if (noteEl) {
    let note = '';
    if (analysis.risk_flags.length > 0) {
      note = `⚠️ ${formatRiskFlag(analysis.risk_flags[0])} - reduce size`;
    } else if (hasSetup) {
      note = `✅ ${analysis.setup_candidates[0].replace(/_/g, ' ')} detected`;
    } else if (analysis.market_state === 'range') {
      note = '📊 Trade range boundaries, not middle';
    }
    noteEl.textContent = note;
  }
}

/**
 * Try to get current price from Binance DOM.
 */
function getCurrentPrice() {
  // Try to find price display elements
  const priceSelectors = [
    '[class*="lastPrice"]',
    '[class*="mark-price"]',
    '[class*="currentPrice"]',
    '[data-testid*="price"]',
    '.price',
  ];
  
  for (const selector of priceSelectors) {
    try {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.textContent?.replace(/[,\s]/g, '');
        const price = parseFloat(text);
        if (!isNaN(price) && price > 0) {
          return price;
        }
      }
    } catch (e) {
      // Continue
    }
  }
  
  return null;
}

/**
 * Format price with appropriate decimals.
 */
function formatPrice(price, decimals = 2) {
  if (price >= 1000) return price.toFixed(1);
  if (price >= 100) return price.toFixed(2);
  return price.toFixed(decimals);
}

/**
 * Calculate overall trade signal score (0-100).
 * Combines technical analysis, risk factors, and external data.
 */
function calculateTradeSignal(analysis, externalData = {}) {
  let score = 50; // Start neutral
  
  // === TECHNICAL FACTORS (weight: 40%) ===
  
  // Trade allowed is the base filter
  if (!analysis.trade_allowed) {
    score -= 30;
  }
  
  // Market state scoring
  const stateScores = {
    'trend': 15,
    'trend_volatile': 5,
    'range': 0,
    'chop': -25,
    'undefined': -20,
    'error': -30,
  };
  score += stateScores[analysis.market_state] || 0;
  
  // Setup detection bonus
  if (analysis.setup_candidates && analysis.setup_candidates.length > 0) {
    score += 15;
  }
  
  // Trend direction clarity
  if (analysis.trend_direction === 'up' || analysis.trend_direction === 'down') {
    score += 10;
  }
  
  // === RISK FLAGS (weight: 30%) ===
  const riskPenalties = {
    'extreme_volatility': -20,
    'low_volume': -10,
    'overbought': -15,
    'oversold': -10, // Less penalty, could be opportunity
    'choppy_momentum': -15,
    'insufficient_data': -25,
    'api_error': -30,
  };
  
  if (analysis.risk_flags) {
    for (const flag of analysis.risk_flags) {
      score += riskPenalties[flag] || -5;
    }
  }
  
  // === CONFIDENCE PATTERN (weight: 15%) ===
  if (analysis.confidence_pattern) {
    // Scale confidence to -15 to +15
    score += ((analysis.confidence_pattern - 50) / 50) * 15;
  }
  
  // === EXTERNAL DATA FACTORS (weight: 15%) ===
  if (externalData.sentiment) {
    // Sentiment score from -1 to 1
    score += externalData.sentiment * 15;
  }
  
  if (externalData.volumeSpike) {
    // Volume spike in right direction
    score += externalData.volumeSpike > 2 ? 10 : 5;
  }
  
  if (externalData.newsScore) {
    // News sentiment from -1 to 1
    score += externalData.newsScore * 10;
  }
  
  // Clamp to 0-100
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Get signal classification from score.
 */
function getSignalClass(score) {
  if (score >= 75) return 'strong-buy';
  if (score >= 60) return 'buy';
  if (score >= 45) return 'neutral';
  if (score >= 30) return 'caution';
  return 'dont-trade';
}

/**
 * Get signal label from score.
 */
function getSignalLabel(score) {
  if (score >= 75) return '🚀 STRONG BUY';
  if (score >= 60) return '✅ BUY';
  if (score >= 45) return '⏳ WAIT';
  if (score >= 30) return '⚠️ CAUTION';
  return '🛑 DON\'T TRADE';
}

/**
 * Update panel signal display.
 */
function updatePanelSignal(analysis, externalData = {}) {
  if (!panel || !panel.container) return;
  
  const score = calculateTradeSignal(analysis, externalData);
  const signalClass = getSignalClass(score);
  const signalLabel = getSignalLabel(score);
  
  // Update panel background class
  const panelEl = panel.container.querySelector('.lq-panel');
  if (panelEl) {
    // Remove all signal classes
    panelEl.classList.remove('signal-strong-buy', 'signal-buy', 'signal-neutral', 'signal-caution', 'signal-dont-trade');
    panelEl.classList.add(`signal-${signalClass}`);
  }
  
  // Update signal badge
  const badge = panel.container.querySelector('.lq-signal-badge');
  if (badge) {
    badge.textContent = signalLabel;
    badge.className = `lq-signal-badge ${signalClass}`;
  }
  
  // Update probability bar
  const probFill = panel.container.querySelector('.lq-signal-prob-fill');
  const probValue = panel.container.querySelector('.lq-signal-prob-value');
  
  if (probFill) {
    probFill.style.width = `${score}%`;
    probFill.className = `lq-signal-prob-fill ${signalClass}`;
  }
  
  if (probValue) {
    probValue.textContent = `${score}%`;
    probValue.className = `lq-signal-prob-value ${signalClass}`;
  }
  
  return score;
}

// ============================================================================
// External Data Integration (CoinGecko, News APIs)
// ============================================================================

/**
 * Fetch additional market data from CoinGecko API.
 */
async function fetchCoinGeckoData(symbol) {
  try {
    // Convert symbol to CoinGecko ID (e.g., BTCUSDT -> bitcoin)
    const coinId = symbolToCoinGeckoId(symbol);
    if (!coinId) return null;
    
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=true&developer_data=false&sparkline=false`
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    return {
      priceChange24h: data.market_data?.price_change_percentage_24h || 0,
      priceChange7d: data.market_data?.price_change_percentage_7d || 0,
      volumeChange24h: data.market_data?.total_volume?.usd || 0,
      marketCapRank: data.market_cap_rank || 999,
      sentiment: data.sentiment_votes_up_percentage 
        ? (data.sentiment_votes_up_percentage - 50) / 50 // Convert to -1 to 1
        : 0,
      communityScore: data.community_score || 0,
      trendingScore: data.coingecko_score || 0,
    };
  } catch (error) {
    console.log('[LenQuant] CoinGecko fetch error:', error.message);
    return null;
  }
}

/**
 * Map Binance symbol to CoinGecko ID.
 */
function symbolToCoinGeckoId(symbol) {
  // Remove USDT/USD suffix
  const base = symbol.replace(/USDT?$/i, '').toLowerCase();
  
  // Common mappings
  const mappings = {
    'btc': 'bitcoin',
    'eth': 'ethereum',
    'bnb': 'binancecoin',
    'sol': 'solana',
    'xrp': 'ripple',
    'ada': 'cardano',
    'doge': 'dogecoin',
    'dot': 'polkadot',
    'matic': 'matic-network',
    'shib': 'shiba-inu',
    'avax': 'avalanche-2',
    'link': 'chainlink',
    'ltc': 'litecoin',
    'atom': 'cosmos',
    'uni': 'uniswap',
    'xlm': 'stellar',
    'etc': 'ethereum-classic',
    'near': 'near',
    'apt': 'aptos',
    'arb': 'arbitrum',
    'op': 'optimism',
    'sui': 'sui',
    'inj': 'injective-protocol',
    'sei': 'sei-network',
    'wif': 'dogwifcoin',
    'pepe': 'pepe',
    'floki': 'floki',
    'bonk': 'bonk',
    'pippin': 'pippin', // Try direct match
    'pippinusdt': 'pippin',
  };
  
  return mappings[base] || base;
}

// Store external data cache
let externalDataCache = new Map();
const EXTERNAL_DATA_TTL = 60000; // 1 minute cache

/**
 * Get external data with caching.
 */
async function getExternalData(symbol) {
  const cacheKey = symbol.toUpperCase();
  const cached = externalDataCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp) < EXTERNAL_DATA_TTL) {
    return cached.data;
  }
  
  const data = await fetchCoinGeckoData(symbol);
  
  if (data) {
    externalDataCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  }
  
  return data || {};
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
let cooldownTimer = null;

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
  const endTime = cooldown.endsAt ? new Date(cooldown.endsAt) : null;

  cooldownOverlay.querySelector('.lq-cooldown-reason').textContent =
    cooldown.reason || 'Take a break to avoid emotional trading.';

  // Start countdown timer
  startCooldownCountdown(endTime, remaining);

  cooldownOverlay.style.display = 'flex';
}

function startCooldownCountdown(endTime, initialMinutes) {
  // Clear any existing timer
  if (cooldownTimer) {
    clearInterval(cooldownTimer);
  }

  let remainingMs;

  if (endTime) {
    // Use endTime for more accurate countdown
    remainingMs = endTime.getTime() - Date.now();
  } else {
    // Fallback to initial minutes
    remainingMs = initialMinutes * 60 * 1000;
  }

  function updateDisplay() {
    if (remainingMs <= 0) {
      // Cooldown ended
      hideCooldownOverlay();
      clearInterval(cooldownTimer);
      cooldownTimer = null;
      return;
    }

    const totalSeconds = Math.floor(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (cooldownOverlay) {
      cooldownOverlay.querySelector('.lq-cooldown-time').textContent =
        `${minutes}:${seconds.toString().padStart(2, '0')} remaining`;
    }

    remainingMs -= 1000;
  }

  // Update immediately
  updateDisplay();

  // Update every second
  cooldownTimer = setInterval(updateDisplay, 1000);
}

function hideCooldownOverlay() {
  if (cooldownOverlay) {
    cooldownOverlay.style.display = 'none';
  }

  // Clear any running countdown timer
  if (cooldownTimer) {
    clearInterval(cooldownTimer);
    cooldownTimer = null;
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
      
    case 'TRIGGER_ANALYSIS':
      // Manual trigger from popup - force immediate analysis
      console.log('[LenQuant] Manual analysis trigger');
      triggerManualAnalysis().then(result => {
        sendResponse(result);
      });
      return true; // Keep channel open for async response
      
    default:
      break;
  }
});

/**
 * Manually trigger analysis (from popup Quick Analyze button).
 */
async function triggerManualAnalysis() {
  if (!currentContext.symbol) {
    // Try to capture context first
    const observer = new BinanceContextObserver();
    observer.captureContext();
    
    // Wait a bit for context to be captured
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  if (!currentContext.symbol) {
    return { success: false, error: 'Could not detect symbol' };
  }
  
  try {
    // Show panel if hidden
    if (panel && panel.container) {
      panel.container.style.display = 'block';
      panel.container.querySelector('.lq-state-value').textContent = 'Analyzing...';
    }
    
    // Force fresh analysis
    const domData = extractAllDOMData();
    const response = await chrome.runtime.sendMessage({
      type: 'CONTEXT_CHANGED',
      symbol: currentContext.symbol,
      timeframe: currentContext.timeframe || '1m',
      context: { ...currentContext, forceRefresh: true },
      domData,
    });
    
    if (response.analysis) {
      currentAnalysis = response.analysis;
      updatePanel(response.analysis);
      return { success: true, symbol: currentContext.symbol };
    }
    
    return { success: false, error: 'Analysis failed' };
    
  } catch (error) {
    console.error('[LenQuant] Manual analysis error:', error);
    return { success: false, error: error.message };
  }
}

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

  // Auto-refresh analysis every 30 seconds when we have a symbol
  setInterval(async () => {
    try {
      if (currentContext.symbol && panel && panel.container && panel.container.style.display !== 'none') {
        // Only auto-refresh if panel is visible and we have a symbol
        const domData = extractAllDOMData();
        const response = await chrome.runtime.sendMessage({
          type: 'CONTEXT_CHANGED',
          symbol: currentContext.symbol,
          timeframe: currentContext.timeframe || '1m',
          context: { ...currentContext, autoRefresh: true },
          domData,
        });

        if (response && response.analysis) {
          currentAnalysis = response.analysis;
          updatePanelDisplay(response.analysis);
          console.log('[LenQuant] Auto-refreshed analysis for', currentContext.symbol);
        }
      }
    } catch (error) {
      console.error('[LenQuant] Auto-refresh failed:', error);
    }
  }, 30000); // Auto-refresh every 30 seconds
  
  console.log('[LenQuant] Initialization complete');
}

// Wait for page to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

