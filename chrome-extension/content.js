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

// ============================================================================
// Performance Optimizations - Phase 3
// ============================================================================

// Debug configuration
const DEBUG = {
  enabled: false, // Set to true for development
  categories: {
    dom: false,
    analysis: true,
    auth: true,
    network: false,
    observer: false,
  }
};

// Conditional logger
const logger = {
  log(category, ...args) {
    if (DEBUG.enabled && (DEBUG.categories[category] !== false)) {
      console.log(`[LenQuant:${category}]`, ...args);
    }
  },

  warn(category, ...args) {
    if (DEBUG.enabled) {
      console.warn(`[LenQuant:${category}]`, ...args);
    }
  },

  error(category, ...args) {
    // Always log errors
    console.error(`[LenQuant:${category}]`, ...args);
  },

  // Performance timing
  time(label) {
    if (DEBUG.enabled) {
      console.time(`[LenQuant] ${label}`);
    }
  },

  timeEnd(label) {
    if (DEBUG.enabled) {
      console.timeEnd(`[LenQuant] ${label}`);
    }
  }
};

// Load debug setting from storage
async function initDebugMode() {
  const result = await chrome.storage.local.get(['debugMode']);
  DEBUG.enabled = result.debugMode || false;

  // Also listen for sync settings changes (from options page)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.settings) {
      const newSettings = changes.settings.newValue || {};
      if (newSettings.debugMode !== undefined) {
        DEBUG.enabled = newSettings.debugMode;
        logger.log('dom', 'Debug mode updated:', DEBUG.enabled);
      }
    }
  });
}
initDebugMode();

// DOM element cache with TTL
class DOMCache {
  constructor(ttl = 5000) {
    this.cache = new Map();
    this.ttl = ttl;
  }

  get(key, selector, parent = document) {
    const cached = this.cache.get(key);
    const now = Date.now();

    if (cached && (now - cached.time) < this.ttl) {
      // Verify element is still in DOM
      if (document.body.contains(cached.element)) {
        return cached.element;
      }
    }

    // Query and cache
    const element = parent.querySelector(selector);
    if (element) {
      this.cache.set(key, { element, time: now });
    }
    return element;
  }

  getAll(key, selector, parent = document) {
    const cached = this.cache.get(key);
    const now = Date.now();

    if (cached && (now - cached.time) < this.ttl) {
      // Verify first element is still in DOM
      if (cached.elements[0] && document.body.contains(cached.elements[0])) {
        return cached.elements;
      }
    }

    const elements = Array.from(parent.querySelectorAll(selector));
    if (elements.length > 0) {
      this.cache.set(key, { elements, time: now });
    }
    return elements;
  }

  invalidate(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }
}

// ============================================================================
// HTML Sanitizer - Phase 4 Security
// ============================================================================

const HTMLSanitizer = {
  // Allowed tags and their allowed attributes
  allowedTags: {
    'p': [],
    'br': [],
    'strong': [],
    'b': [],
    'em': [],
    'i': [],
    'ul': [],
    'ol': [],
    'li': [],
    'span': ['class'],
    'div': ['class'],
  },

  // Sanitize HTML string
  sanitize(html) {
    if (!html) return '';

    // Create a temporary container
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Recursively clean nodes
    this.cleanNode(temp);

    return temp.innerHTML;
  },

  cleanNode(node) {
    const children = Array.from(node.childNodes);

    children.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        // Text nodes are safe
        return;
      }

      if (child.nodeType === Node.ELEMENT_NODE) {
        const tagName = child.tagName.toLowerCase();

        // Remove disallowed tags
        if (!this.allowedTags.hasOwnProperty(tagName)) {
          // Replace with text content or remove entirely
          if (tagName === 'script' || tagName === 'style' || tagName === 'iframe') {
            child.remove();
          } else {
            // Replace element with its text content
            const text = document.createTextNode(child.textContent);
            child.replaceWith(text);
          }
          return;
        }

        // Remove disallowed attributes
        const allowedAttrs = this.allowedTags[tagName];
        Array.from(child.attributes).forEach(attr => {
          if (!allowedAttrs.includes(attr.name)) {
            child.removeAttribute(attr.name);
          }

          // Extra check: no javascript: in any attribute
          if (attr.value.toLowerCase().includes('javascript:')) {
            child.removeAttribute(attr.name);
          }
        });

        // Clean children
        this.cleanNode(child);
      } else {
        // Remove other node types (comments, etc.)
        child.remove();
      }
    });
  },

  // Escape HTML entities for plain text insertion
  escapeHTML(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// ============================================================================
// Panel Storage Utility - Phase 4 Security
// ============================================================================

const PanelStorage = {
  async savePosition(x, y) {
    try {
      await chrome.storage.local.set({
        panelPosition: { x, y, timestamp: Date.now() }
      });
    } catch (e) {
      console.error('[LenQuant] Failed to save panel position:', e);
    }
  },

  async loadPosition() {
    try {
      const result = await chrome.storage.local.get(['panelPosition']);
      return result.panelPosition || null;
    } catch (e) {
      console.error('[LenQuant] Failed to load panel position:', e);
      return null;
    }
  },

  getDefaultPosition() {
    return {
      x: window.innerWidth - 340,
      y: 80
    };
  }
};

const domCache = new DOMCache(5000); // 5 second TTL

// Clear cache on navigation
window.addEventListener('popstate', () => domCache.clear());

// Performance metrics tracking
const performanceMetrics = {
  analysisRequests: 0,
  analysisTime: [],
  domQueries: 0,
  observerCallbacks: 0,

  recordAnalysis(duration) {
    this.analysisRequests++;
    this.analysisTime.push(duration);

    // Keep only last 100
    if (this.analysisTime.length > 100) {
      this.analysisTime.shift();
    }
  },

  getAverageAnalysisTime() {
    if (this.analysisTime.length === 0) return 0;
    return this.analysisTime.reduce((a, b) => a + b, 0) / this.analysisTime.length;
  },

  report() {
    console.log('[LenQuant Performance]', {
      analysisRequests: this.analysisRequests,
      avgAnalysisTime: this.getAverageAnalysisTime().toFixed(2) + 'ms',
      domQueries: this.domQueries,
      observerCallbacks: this.observerCallbacks,
    });
  }
};

// Report every 5 minutes if debug mode
setInterval(() => {
  if (DEBUG.enabled) {
    performanceMetrics.report();
  }
}, 300000);

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

// Feature gating components
let licenseManager = null;
let authUI = null;
let featureGate = null;

// ============================================================================
// Local Bookmarks Utility (Free Tier)
// ============================================================================

const LocalBookmarks = {
  STORAGE_KEY: 'lq_local_bookmarks',
  MAX_BOOKMARKS: 50,

  async save(bookmark) {
    const result = await chrome.storage.local.get([this.STORAGE_KEY]);
    const bookmarks = result[this.STORAGE_KEY] || [];

    // Add new bookmark at the beginning
    bookmarks.unshift({
      id: Date.now().toString(),
      ...bookmark,
      savedAt: new Date().toISOString(),
    });

    // Enforce limit for free users
    if (bookmarks.length > this.MAX_BOOKMARKS) {
      bookmarks.pop();
    }

    await chrome.storage.local.set({ [this.STORAGE_KEY]: bookmarks });

    // Update stats
    await this.updateStats();

    return true;
  },

  async getAll() {
    const result = await chrome.storage.local.get([this.STORAGE_KEY]);
    return result[this.STORAGE_KEY] || [];
  },

  async delete(id) {
    const result = await chrome.storage.local.get([this.STORAGE_KEY]);
    const bookmarks = (result[this.STORAGE_KEY] || []).filter(b => b.id !== id);
    await chrome.storage.local.set({ [this.STORAGE_KEY]: bookmarks });
  },

  async updateStats() {
    const bookmarks = await this.getAll();
    await chrome.storage.local.set({ bookmarksCount: bookmarks.length });
  },
};

// ============================================================================
// Sound Alert Utility
// ============================================================================

const alertSound = {
  audio: null,

  init() {
    // Create audio element for alert sound
    this.audio = new Audio();
    // Use a simple beep - can be a data URI or hosted file
    this.audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleC8LLoOw3M+ZaCs+hpHQw6Z4PTN4kL3GpXpJQnGQsbyheVNEaYursaSAWUdljammoYNdS2CHpKehg2FNX4OgnJ+AYVBfgpuanH9jUl+BmZiYfWNUX4GZl5d8Y1Vfgpmalnt...'; // Truncated for brevity
    this.audio.volume = 0.5;
  },

  async play() {
    if (!this.audio) this.init();

    try {
      await this.audio.play();
    } catch (e) {
      console.log('[LenQuant] Could not play alert sound:', e);
    }
  }
};

// ============================================================================
// DOM Data Extraction (Leverage, Positions, etc.)
// ============================================================================

// Optimized leverage extraction
function extractLeverageOptimized() {
  // Try cached leverage button first
  const cachedBtn = domCache.get('leverageBtn', 'button[class*="leverage"]');
  if (cachedBtn) {
    const text = cachedBtn.textContent?.trim();
    const match = text?.match(/(\d+)[xX]/);
    if (match) {
      const lev = parseInt(match[1], 10);
      if (lev >= 1 && lev <= 125) {
        logger.log('dom', 'Found leverage via cached button:', lev);
        return lev;
      }
    }
  }

  // Fallback: Query all buttons (cached)
  const buttons = domCache.getAll('allButtons', 'button, [role="button"]');
  for (const btn of buttons) {
    const text = btn.textContent?.trim();
    if (text && /^\d{1,3}[xX]$/.test(text)) {
      const lev = parseInt(text.match(/^(\d{1,3})/)[1], 10);
      if (lev >= 1 && lev <= 125) {
        // Cache this specific button for next time
        domCache.cache.set('leverageBtn', { element: btn, time: Date.now() });
        logger.log('dom', 'Found leverage via button scan:', lev);
        return lev;
      }
    }
  }

  logger.log('dom', 'Could not detect leverage');
  return null;
}

// Legacy function for backwards compatibility
function extractLeverage() {
  return extractLeverageOptimized();
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

class OptimizedContextObserver {
  constructor() {
    this.observers = [];
    this.targetSelectors = [
      // Header area with symbol and timeframe
      '[class*="header"]',
      '[class*="symbol-title"]',
      '[class*="symbolTitle"]',
      // Timeframe selector area
      '[class*="timeframe"]',
      '[class*="interval"]',
      // Leverage and margin settings area
      '[class*="leverage"]',
      '[class*="margin-type"]',
      '[class*="orderForm"]',
      // Position/order area
      '[class*="position"]',
      '[class*="order-panel"]',
    ];

    this.lastContext = null;
    this.throttledUpdate = this.throttle(this.captureContext.bind(this), 500);
  }

  init() {
    console.log('[LenQuant] Initializing optimized context observer');

    // Initial context capture
    this.captureContext();

    // Set up optimized observers
    this.start();

    // Also listen for URL changes (for symbol switches)
    this.watchUrlChanges();
  }

  start() {
    // Find and observe specific containers
    this.targetSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        if (this.isRelevantContainer(element)) {
          this.observeElement(element);
        }
      });
    });

    // Fallback: If no specific containers found, observe body but with filter
    if (this.observers.length === 0) {
      logger.log('observer', 'No specific containers found, using fallback observer');
      this.observeWithFilter(document.body);
    }

    // Also observe for new containers being added (Binance SPA navigation)
    this.observeNewContainers();
  }

  isRelevantContainer(element) {
    // Filter out tiny elements or ones that update too frequently (like price tickers)
    const rect = element.getBoundingClientRect();
    if (rect.width < 50 || rect.height < 20) return false;

    // Skip elements that are just price displays (update too often)
    if (element.className?.includes('price') && !element.className?.includes('entry')) {
      return false;
    }

    return true;
  }

  observeElement(element) {
    const observer = new MutationObserver((mutations) => {
      // Quick filter - only react to meaningful changes
      const hasRelevantChange = mutations.some(m =>
        m.type === 'characterData' ||
        (m.type === 'childList' && m.addedNodes.length > 0)
      );

      if (hasRelevantChange) {
        this.throttledUpdate();
      }
    });

    observer.observe(element, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    this.observers.push(observer);
    logger.log('observer', 'Observing:', element.className?.slice(0, 50));
  }

  observeWithFilter(root) {
    const observer = new MutationObserver((mutations) => {
      // Filter mutations to only relevant ones
      const relevantMutation = mutations.find(m => {
        const target = m.target;
        const className = target.className || '';

        // Skip price updates, charts, order book
        if (className.includes('price') && !className.includes('entry')) return false;
        if (className.includes('chart')) return false;
        if (className.includes('orderbook')) return false;
        if (className.includes('depth')) return false;
        if (className.includes('trade-history')) return false;

        return true;
      });

      if (relevantMutation) {
        this.throttledUpdate();
      }
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    this.observers.push(observer);
  }

  observeNewContainers() {
    // Watch for SPA navigation that might add new relevant containers
    const navObserver = new MutationObserver((mutations) => {
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.targetSelectors.forEach(selector => {
              const matches = node.querySelectorAll?.(selector) || [];
              matches.forEach(el => {
                if (this.isRelevantContainer(el) && !this.isAlreadyObserved(el)) {
                  this.observeElement(el);
                }
              });
            });
          }
        });
      });
    });

    navObserver.observe(document.body, {
      childList: true,
      subtree: false, // Only direct children
    });

    this.observers.push(navObserver);
  }

  isAlreadyObserved(element) {
    // Simple check - could be enhanced with WeakSet
    return element.dataset.lqObserved === 'true';
  }

  throttle(fn, delay) {
    let lastCall = 0;
    let timeout = null;

    return function(...args) {
      const now = Date.now();

      if (now - lastCall >= delay) {
        lastCall = now;
        fn.apply(this, args);
      } else if (!timeout) {
        timeout = setTimeout(() => {
          lastCall = Date.now();
          timeout = null;
          fn.apply(this, args);
        }, delay - (now - lastCall));
      }
    };
  }

  stop() {
    this.observers.forEach(obs => obs.disconnect());
    this.observers = [];
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
}

// ============================================================================
// Analysis Manager - Optimized Auto-Refresh
// ============================================================================

class AnalysisManager {
  constructor() {
    this.lastContext = null;
    this.lastAnalysisTime = 0;
    this.analysisInProgress = false;
  }

  async maybeRefresh(currentContext) {
    // Skip if analysis already in progress
    if (this.analysisInProgress) {
      logger.log('analysis', 'Skipping refresh - analysis in progress');
      return false;
    }

    // Skip if context unchanged and within TTL
    const contextKey = this.getContextKey(currentContext);
    const now = Date.now();
    const timeSinceLastAnalysis = now - this.lastAnalysisTime;

    if (contextKey === this.lastContext && timeSinceLastAnalysis < 30000) {
      logger.log('analysis', 'Skipping refresh - context unchanged');
      return false;
    }

    // Proceed with analysis
    this.analysisInProgress = true;

    try {
      const startTime = Date.now();
      const result = await this.fetchAnalysis(currentContext);
      const duration = Date.now() - startTime;

      performanceMetrics.recordAnalysis(duration);

      this.lastContext = contextKey;
      this.lastAnalysisTime = now;
      return true;
    } finally {
      this.analysisInProgress = false;
    }
  }

  getContextKey(context) {
    return `${context.symbol}:${context.timeframe}:${context.leverage}`;
  }

  async fetchAnalysis(context) {
    // This is the same logic as before, just moved here
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

      // Hide loading state and show real content
      if (panel) {
        panel.hideLoadingState();
      }

      updatePanel(response.analysis);

      // Update Multi-Timeframe Analysis (Phase 2)
      updateMTFSection(currentContext.symbol);

      // Show source indicator (backend vs client-side)
      if (response.analysis.source === 'client') {
        logger.log('analysis', 'Using client-side analysis (backend unavailable or no data)');
      }
    }

    // Check for cooldown
    if (response.cooldown && response.cooldown.active) {
      showCooldownOverlay(response.cooldown);
    } else {
      hideCooldownOverlay();
    }

    return response;
  }

  // Force refresh even if context unchanged
  async forceRefresh(currentContext) {
    this.lastContext = null;
    return this.maybeRefresh(currentContext);
  }

  invalidate() {
    this.lastContext = null;
  }
}

const analysisManager = new AnalysisManager();

// ============================================================================
// Lazy Loader for Non-Critical Features
// ============================================================================

class LazyLoader {
  constructor() {
    this.loaded = new Set();
  }

  async load(feature) {
    if (this.loaded.has(feature)) {
      return true;
    }

    switch (feature) {
      case 'tutorial':
        await this.loadTutorial();
        break;
      case 'mtf':
        await this.loadMultiTimeframe();
        break;
      case 'behaviorAnalysis':
        await this.loadBehaviorAnalysis();
        break;
    }

    this.loaded.add(feature);
    return true;
  }

  async loadTutorial() {
    // Tutorial code loaded on demand
    if (!window.TutorialOverlay) {
      logger.log('lazy', 'Tutorial module loaded');
    }
  }

  async loadMultiTimeframe() {
    logger.log('lazy', 'MTF module loaded');
  }

  async loadBehaviorAnalysis() {
    logger.log('lazy', 'Behavior analysis module loaded');
  }
}

const lazyLoader = new LazyLoader();

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

    // Show trial banner if needed
    this.showTrialBannerIfNeeded();

    console.log('[LenQuant] Panel injected');
  }

  showTrialBannerIfNeeded() {
    if (!licenseManager || !authUI) return;

    const tier = licenseManager.getTier();
    if (tier === 'trial') {
      const trial = licenseManager.getTrialRemaining();
      if (trial && trial.hours < 72) {
        authUI.showTrialBanner(trial.hours);
      }
    }
  }

  /**
   * Show toast notification
   */
  showToast({ title, message, action, onClick, duration = 5000, dismissible = true }) {
    const toast = document.createElement('div');
    toast.className = 'lq-toast lq-toast-upsell';
    toast.innerHTML = `
      <div class="lq-toast-content">
        ${title ? `<div class="lq-toast-title">${title}</div>` : ''}
        <div class="lq-toast-message">${message}</div>
      </div>
      <div class="lq-toast-actions">
        ${action ? `<button class="lq-toast-cta">${action}</button>` : ''}
        ${dismissible ? `<button class="lq-toast-dismiss">×</button>` : ''}
      </div>
    `;

    // Position at bottom of panel
    this.container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => toast.classList.add('lq-toast-visible'));

    // Handlers
    toast.querySelector('.lq-toast-cta')?.addEventListener('click', () => {
      onClick?.();
      toast.remove();
    });

    toast.querySelector('.lq-toast-dismiss')?.addEventListener('click', () => {
      toast.remove();
    });

    // Auto-dismiss
    if (duration > 0) {
      setTimeout(() => {
        toast.classList.remove('lq-toast-visible');
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }
  }

  /**
   * Show loading state for analysis
   */
  showLoadingState() {
    if (!this.container) return;

    // Update signal badge
    const signalBadge = this.container.querySelector('.lq-signal-badge');
    if (signalBadge) {
      signalBadge.className = 'lq-signal-badge neutral';
      signalBadge.innerHTML = '<div class="lq-loading"><div class="lq-loading-spinner"></div></div>';
    }

    // Show skeleton loaders
    const skeletons = this.container.querySelectorAll('.lq-skeleton');
    skeletons.forEach(el => {
      el.style.display = 'inline-block';
      el.style.visibility = 'visible';
    });

    // Hide actual content
    const contentElements = this.container.querySelectorAll('.lq-grade, .lq-state-value, .lq-setup-value, .lq-leverage-value, .lq-reason-text');
    contentElements.forEach(el => {
      if (!el.classList.contains('lq-skeleton')) {
        el.style.display = 'none';
      }
    });
  }

  /**
   * Hide loading state and show real content
   */
  hideLoadingState() {
    if (!this.container) return;

    // Remove skeleton class and reset inline styles from all skeleton elements
    const skeletons = this.container.querySelectorAll('.lq-skeleton');
    skeletons.forEach(el => {
      el.classList.remove('lq-skeleton');
      el.style.width = '';
      el.style.height = '';
    });

    // Show actual content elements
    const contentElements = this.container.querySelectorAll('.lq-grade, .lq-state-value, .lq-setup-value, .lq-leverage-value, .lq-reason-text, .lq-symbol, .lq-timeframe');
    contentElements.forEach(el => {
      el.style.display = '';
    });
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
  
  async savePosition() {
    try {
      const rect = this.container.getBoundingClientRect();
      await PanelStorage.savePosition(rect.left, rect.top);
    } catch (e) {
      console.log('[LenQuant] Could not save panel position');
    }
  }

  async restorePosition() {
    try {
      const saved = await PanelStorage.loadPosition();
      if (saved && this.isValidPosition(saved.x, saved.y)) {
        this.container.style.left = `${saved.x}px`;
        this.container.style.top = `${saved.y}px`;
        this.container.style.right = 'auto';
      } else {
        // Use default position
        const defaultPos = PanelStorage.getDefaultPosition();
        this.container.style.left = `${defaultPos.x}px`;
        this.container.style.top = `${defaultPos.y}px`;
      }
    } catch (e) {
      console.log('[LenQuant] Could not restore panel position');
      // Use default position on error
      const defaultPos = PanelStorage.getDefaultPosition();
      this.container.style.left = `${defaultPos.x}px`;
      this.container.style.top = `${defaultPos.y}px`;
    }
  }

  isValidPosition(x, y) {
    // Ensure position is within viewport
    return x >= 0 &&
           x < window.innerWidth - 100 &&
           y >= 0 &&
           y < window.innerHeight - 100;
  }
  
  getTemplate() {
    return `
      <div class="lq-panel">
        <div class="lq-signal-badge neutral">
          <div class="lq-loading">
            <div class="lq-loading-spinner"></div>
          </div>
        </div>
        <div class="lq-header">
          <span class="lq-logo">LenQuant</span>
          <div class="lq-header-actions">
            <button class="lq-btn-icon lq-refresh-btn" title="Refresh Analysis">↻</button>
            <button class="lq-btn-icon lq-menu-btn" title="Menu">☰</button>
            <button class="lq-btn-icon lq-collapse-btn" title="Collapse">−</button>
            <button class="lq-btn-icon lq-close-btn" title="Close">×</button>
          </div>
          <div class="lq-dropdown-menu" style="display: none;">
            <div class="lq-user-info">
              <span class="lq-user-email">Not signed in</span>
              <span class="lq-user-tier lq-tier-free">FREE</span>
            </div>
            <hr class="lq-menu-divider">
            <button class="lq-menu-item" data-action="dashboard">📊 Dashboard</button>
            <button class="lq-menu-item" data-action="journal">📔 Journal</button>
            <button class="lq-menu-item" data-action="settings">⚙️ Settings</button>
            <button class="lq-menu-item" data-action="help">❓ Help</button>
            <hr class="lq-menu-divider">
            <button class="lq-menu-item lq-menu-logout" data-action="logout">🚪 Logout</button>
          </div>
        </div>

        <div class="lq-content">
          <div class="lq-section-header">Analysis</div>
          <div class="lq-context">
            <span class="lq-symbol lq-skeleton" style="width: 60px; height: 18px;"></span>
            <span class="lq-separator">•</span>
            <span class="lq-timeframe lq-skeleton" style="width: 40px; height: 16px;"></span>
          </div>

          <div class="lq-signal-prob">
            <span class="lq-signal-prob-label">Trade Score:</span>
            <div class="lq-signal-prob-bar">
              <div class="lq-signal-prob-fill lq-skeleton" style="width: 50%; height: 8px;"></div>
            </div>
            <span class="lq-signal-prob-value lq-skeleton" style="width: 35px; height: 14px;"></span>
          </div>

          <div class="lq-grade-section">
            <div class="lq-grade-circle">
              <span class="lq-grade lq-skeleton" style="width: 24px; height: 24px; border-radius: 50%;"></span>
            </div>
            <div class="lq-market-state">
              <span class="lq-state-label">Market State</span>
              <span class="lq-state-value lq-skeleton" style="width: 80px; height: 15px;"></span>
            </div>
          </div>

          <div class="lq-setup-section">
            <span class="lq-setup-label">Setup:</span>
            <span class="lq-setup-value lq-skeleton" style="width: 100px; height: 13px;"></span>
          </div>

          <div class="lq-section-divider"></div>

          <div class="lq-section-header">Risk Assessment</div>

          <div class="lq-risk-section">
            <div class="lq-risk-flags">
              <span class="lq-risk-flag lq-skeleton" style="width: 60px; height: 20px;"></span>
            </div>
          </div>

          <div class="lq-leverage-section">
            <div class="lq-leverage-header">
              <span class="lq-leverage-label">Leverage Band:</span>
              <span class="lq-leverage-value lq-skeleton" style="width: 80px; height: 14px;"></span>
            </div>
            <div class="lq-leverage-bar">
              <div class="lq-leverage-fill lq-skeleton" style="width: 60%; height: 6px;"></div>
            </div>
            <div class="lq-current-leverage" style="display: none;">
              <span class="lq-current-leverage-label">Your leverage:</span>
              <span class="lq-current-leverage-value lq-skeleton" style="width: 50px; height: 13px;"></span>
            </div>
            <div class="lq-regime-info">
              <span class="lq-regime-multiplier lq-skeleton" style="width: 40px; height: 12px;"></span>
              <span class="lq-regime-desc lq-skeleton" style="width: 120px; height: 11px;"></span>
            </div>
          </div>

          <div class="lq-sizing-note" style="display: none;">
            <span class="lq-sizing-icon">📊</span>
            <span class="lq-sizing-text lq-skeleton" style="width: 200px; height: 12px;"></span>
          </div>

          <div class="lq-reason">
            <span class="lq-reason-text lq-skeleton" style="width: 150px; height: 12px;"></span>
          </div>

          <div class="lq-section-divider"></div>

          <div class="lq-section-header">Trade Setup</div>
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
          
          <div class="lq-action-buttons">
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
          
          <div class="lq-mtf-section" style="display: none;">
            <div class="lq-mtf-header">
              <span class="lq-mtf-title">📊 Multi-Timeframe</span>
              <button class="lq-btn-icon lq-mtf-refresh" title="Refresh MTF">↻</button>
            </div>
            <div class="lq-mtf-confluence">
              <span class="lq-mtf-confluence-label">Confluence:</span>
              <span class="lq-mtf-confluence-value">--</span>
            </div>
            <div class="lq-mtf-grid"></div>
            <div class="lq-mtf-recommendation"></div>
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
    // Manual refresh button
    const refreshBtn = this.container.querySelector('.lq-refresh-btn');
    refreshBtn.addEventListener('click', async () => {
      // Spinning animation
      refreshBtn.classList.add('lq-spinning');
      refreshBtn.disabled = true;

      try {
        await handleManualRefresh();
      } finally {
        refreshBtn.classList.remove('lq-spinning');
        refreshBtn.disabled = false;
      }
    });

    // Menu button
    const menuBtn = this.container.querySelector('.lq-menu-btn');
    const dropdownMenu = this.container.querySelector('.lq-dropdown-menu');
    
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = dropdownMenu.style.display !== 'none';
      dropdownMenu.style.display = isVisible ? 'none' : 'block';
      
      // Update user info in menu
      if (!isVisible && licenseManager && licenseManager.license) {
        this.updateMenuUserInfo();
      }
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.lq-header')) {
        dropdownMenu.style.display = 'none';
      }
    });
    
    // Menu item handlers
    const menuItems = this.container.querySelectorAll('.lq-menu-item');
    menuItems.forEach(item => {
      item.addEventListener('click', async () => {
        const action = item.dataset.action;
        dropdownMenu.style.display = 'none';
        
        switch (action) {
          case 'dashboard':
            window.open('https://lenquant.com/dashboard', '_blank');
            break;
          case 'journal':
            window.open('https://lenquant.com/journal', '_blank');
            break;
          case 'settings':
            chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
            break;
          case 'help':
            window.open('https://lenquant.com/help', '_blank');
            break;
          case 'logout':
            if (confirm('Are you sure you want to log out?')) {
              if (licenseManager) {
                await licenseManager.logout();
              }
              if (authUI) {
                authUI.showAuthModal();
              }
              this.updateMenuUserInfo();
            }
            break;
        }
      });
    });

    // Collapse button
    const collapseBtn = this.container.querySelector('.lq-collapse-btn');
    collapseBtn.addEventListener('click', () => this.toggleCollapse());

    // Close button
    const closeBtn = this.container.querySelector('.lq-close-btn');
    closeBtn.addEventListener('click', () => this.hide());
    
    // Explain button - gated feature
    const explainBtn = this.container.querySelector('.lq-btn-explain');
    explainBtn.addEventListener('click', async () => {
      // Check feature access
      if (featureGate) {
        const hasAccess = await featureGate.checkAccess('ai_explain');
        if (!hasAccess) return;
      }

      // Proceed with explanation
      this.requestExplanation();
    });
    
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
    syncBtn.addEventListener('click', async () => {
      // Check feature access first
      const hasAccess = await featureGate.checkAccess('trade_sync');
      if (!hasAccess) {
        // Paywall was shown by checkAccess
        return;
      }

      // Proceed with sync
      await this.syncTrades();
    });

    // MTF refresh button
    const mtfRefreshBtn = this.container.querySelector('.lq-mtf-refresh');
    if (mtfRefreshBtn) {
      mtfRefreshBtn.addEventListener('click', () => updateMTFSection(currentContext.symbol));
    }
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
        const count = response.trades_imported || response.count || 0;
        syncBtn.textContent = `✓ ${count} synced`;
        this.showAlert({
          type: 'info',
          severity: 'info',
          message: `Successfully synced ${count} trades`
        });
      } else {
        syncBtn.textContent = '❌ Sync failed';
        this.showAlert({
          type: 'error',
          severity: 'warning',
          message: `Sync failed: ${response.error || 'Unknown error'}`
        });
      }
    } catch (error) {
      console.error('[LenQuant] Sync error:', error);
      syncBtn.textContent = '❌ Error';
      this.showAlert({
        type: 'error',
        severity: 'warning',
        message: `Sync failed: ${error.message}`
      });
    } finally {
      setTimeout(() => {
        syncBtn.disabled = false;
        syncBtn.textContent = '🔄 Sync';
      }, 3000);
    }
  }

  /**
   * Update user info in the dropdown menu
   */
  updateMenuUserInfo() {
    const emailEl = this.container.querySelector('.lq-user-email');
    const tierEl = this.container.querySelector('.lq-user-tier');
    const logoutItem = this.container.querySelector('.lq-menu-logout');

    if (!emailEl || !tierEl) return;

    if (licenseManager && licenseManager.license) {
      // User is signed in
      const license = licenseManager.license;
      emailEl.textContent = license.email || 'Not signed in';

      const tier = license.tier || 'free';
      tierEl.textContent = tier.toUpperCase();
      tierEl.className = `lq-user-tier lq-tier-${tier}`;

      // Add trial remaining if applicable
      if (tier === 'trial') {
        const trialInfo = licenseManager.getTrialRemaining();
        if (trialInfo) {
          tierEl.textContent = `TRIAL • ${trialInfo.display}`;
        }
      }

      if (logoutItem) {
        logoutItem.textContent = '🚪 Logout';
        logoutItem.title = 'Sign out of LenQuant';
      }
    } else {
      // User is not signed in
      emailEl.textContent = 'Not signed in';
      tierEl.textContent = 'FREE';
      tierEl.className = 'lq-user-tier lq-tier-free';

      if (logoutItem) {
        logoutItem.textContent = '🔑 Sign In';
        logoutItem.title = 'Sign in to LenQuant';
      }
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
        updatePanel(response.analysis);
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
  
  extractTradeLevels() {
    const quickAction = this.container.querySelector('.lq-quick-action');
    if (!quickAction || quickAction.style.display === 'none') {
      return null;
    }

    const entryEl = quickAction.querySelector('.lq-entry-value');
    const slEl = quickAction.querySelector('.lq-sl-value');
    const tp1El = quickAction.querySelector('.lq-tp1-value');
    const tp2El = quickAction.querySelector('.lq-tp2-value');
    const biasEl = quickAction.querySelector('.lq-bias-value');

    return {
      entry_zone: entryEl ? entryEl.textContent : null,
      stop_loss: slEl ? slEl.textContent : null,
      take_profit_1: tp1El ? tp1El.textContent : null,
      take_profit_2: tp2El ? tp2El.textContent : null,
      bias: biasEl ? biasEl.textContent : null,
    };
  }

  async requestExplanation() {
    if (!currentContext.symbol || !currentAnalysis) {
      console.log('[LenQuant] No context/analysis for explanation');
      return;
    }

    // Extract calculated trade levels from panel
    const tradeLevels = this.extractTradeLevels();

    const explainBtn = this.container.querySelector('.lq-btn-explain');
    explainBtn.disabled = true;
    explainBtn.textContent = '⏳ Loading...';

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'REQUEST_EXPLAIN',
        context: currentContext,
        fastAnalysis: currentAnalysis,
        tradeLevels: tradeLevels,
      });

      if (response.explanation) {
        this.showExplanation(response.explanation);
        explainBtn.textContent = '✓ Done';
      } else if (response.error) {
        // Show error in panel
        this.showExplanationError(response.error);
        explainBtn.textContent = '❌ Failed';
        console.error('[LenQuant] Explanation error:', response.error);
      }

    } catch (error) {
      console.error('[LenQuant] Explanation request error:', error);
      this.showExplanationError('Could not get explanation. Please try again.');
      explainBtn.textContent = '❌ Error';
    } finally {
      setTimeout(() => {
        explainBtn.disabled = false;
        explainBtn.textContent = '🔍 Explain';
      }, 2000);
    }
  }

  showExplanationError(message) {
    const explanationArea = this.container.querySelector('.lq-explanation');
    if (explanationArea) {
      explanationArea.innerHTML = `
        <div class="lq-explanation-error" style="color: #f6465d; padding: 10px; border-radius: 4px; background: rgba(246, 70, 93, 0.1);">
          ❗ ${message}
        </div>
      `;
      explanationArea.style.display = 'block';
    }
  }

  showExplanation(explanation) {
    const section = this.container.querySelector('.lq-explanation');
    const content = this.container.querySelector('.lq-explanation-content');

    const plan = explanation.trade_plan;

    // Sanitize the reasoning content
    const safeReasoning = HTMLSanitizer.sanitize(explanation.reasoning || '');

    content.innerHTML = `
      <div class="lq-plan-bias ${plan.bias}">
        <strong>Bias:</strong> ${HTMLSanitizer.escapeHTML(plan.bias.toUpperCase())}
      </div>
      <div class="lq-plan-setup">
        <strong>Setup:</strong> ${HTMLSanitizer.escapeHTML(plan.setup_name)}
      </div>
      <div class="lq-plan-trigger">
        <strong>Trigger:</strong> ${HTMLSanitizer.escapeHTML(plan.trigger)}
      </div>
      <div class="lq-plan-invalidation">
        <strong>Invalidation:</strong> ${HTMLSanitizer.escapeHTML(plan.invalidation)}
      </div>
      <div class="lq-plan-targets">
        <strong>Targets:</strong> ${HTMLSanitizer.escapeHTML(plan.targets.join(', ') || 'N/A')}
      </div>
      <div class="lq-plan-confidence">
        <strong>Confidence:</strong> ${HTMLSanitizer.escapeHTML(plan.confidence_pattern)}%
      </div>
      ${plan.do_not_trade ? '<div class="lq-do-not-trade">⚠️ NOT RECOMMENDED TO TRADE</div>' : ''}
      <div class="lq-reasoning">${safeReasoning}</div>
      <div class="lq-provider">via ${HTMLSanitizer.escapeHTML(explanation.provider)} (${HTMLSanitizer.escapeHTML(explanation.latency_ms)}ms)</div>
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

      const bookmark = {
        symbol: currentContext.symbol,
        timeframe: currentContext.timeframe,
        analysis: currentAnalysis,
        note: note || '',
      };

      const tier = licenseManager?.getTier();

      if (['pro', 'premium'].includes(tier)) {
        // Cloud bookmark (existing flow)
        await chrome.runtime.sendMessage({
          type: 'BOOKMARK',
          ...bookmark,
        });
      } else {
        // Local bookmark for free/trial
        await LocalBookmarks.save(bookmark);
      }

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
  
  async showAlert(alert) {
    // Check if behavior alerts are enabled
    const result = await chrome.storage.sync.get('settings');
    const settings = result.settings || {};

    if (settings.behaviorAlerts === false) {
      console.log('[LenQuant] Behavior alerts disabled, skipping:', alert);
      return;
    }

    // Check sound setting for critical alerts
    if (alert.severity === 'critical' && settings.soundAlerts) {
      alertSound.play();
    }

    const alertsContainer = this.container.querySelector('.lq-alerts');

    const alertEl = document.createElement('div');
    alertEl.className = `lq-alert lq-alert-${alert.severity}`;

    // Create elements instead of innerHTML for security
    const icon = document.createElement('span');
    icon.className = 'lq-alert-icon';
    icon.textContent = alert.severity === 'critical' ? '🚨' : '⚠️';

    const message = document.createElement('span');
    message.className = 'lq-alert-message';
    message.textContent = alert.message; // Safe - textContent escapes HTML

    const closeBtn = document.createElement('button');
    closeBtn.className = 'lq-btn-icon lq-dismiss-alert';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => {
      alertEl.remove();
    });

    alertEl.appendChild(icon);
    alertEl.appendChild(message);
    alertEl.appendChild(closeBtn);

    alertsContainer.appendChild(alertEl);

    // Auto-dismiss info alerts after 10s
    if (alert.severity === 'info') {
      setTimeout(() => alertEl.remove(), 10000);
    }
  }
}

// ============================================================================
// Panel Updater - Batched DOM Updates
// ============================================================================

class PanelUpdater {
  constructor(panel) {
    this.panel = panel;
    this.pendingUpdates = {};
    this.rafId = null;
  }

  schedule(key, updateFn) {
    this.pendingUpdates[key] = updateFn;

    if (!this.rafId) {
      this.rafId = requestAnimationFrame(() => this.flush());
    }
  }

  flush() {
    this.rafId = null;

    // Execute all pending updates in one frame
    Object.values(this.pendingUpdates).forEach(fn => {
      try {
        fn();
      } catch (e) {
        logger.error('ui', 'Update error:', e);
      }
    });

    this.pendingUpdates = {};
  }
}

// ============================================================================
// Update Functions
// ============================================================================

async function updatePanel(analysis) {
  if (!panel || !panel.container) return;
  
  // IMPORTANT: First hide all skeletons
  panel.hideLoadingState();
  
  // Update context - ensure values are not undefined and remove skeleton class
  const symbolEl = panel.container.querySelector('.lq-symbol');
  if (symbolEl) {
    symbolEl.textContent = currentContext.symbol || 'N/A';
    symbolEl.classList.remove('lq-skeleton');
    symbolEl.style.width = 'auto';
    symbolEl.style.height = 'auto';
  }
  
  const timeframeEl = panel.container.querySelector('.lq-timeframe');
  if (timeframeEl) {
    timeframeEl.textContent = currentContext.timeframe || '1m';
    timeframeEl.classList.remove('lq-skeleton');
    timeframeEl.style.width = 'auto';
    timeframeEl.style.height = 'auto';
  }
  
  // Update grade with defensive coding
  const grade = calculateGrade(analysis);
  const gradeEl = panel.container.querySelector('.lq-grade');
  if (gradeEl) {
    gradeEl.textContent = grade;
    gradeEl.className = `lq-grade grade-${grade.toLowerCase()}`;
    gradeEl.classList.remove('lq-skeleton');
    gradeEl.style.width = 'auto';
    gradeEl.style.height = 'auto';
  }

  // Record high grade for smart upsell system
  await upsellManager.recordHighGrade(grade);
  
  // Update market state with defensive coding
  const stateValue = panel.container.querySelector('.lq-state-value');
  if (stateValue) {
    stateValue.textContent = formatMarketState(analysis.market_state || 'unknown', analysis.trend_direction);
    stateValue.className = `lq-state-value state-${analysis.market_state || 'unknown'}`;
    stateValue.classList.remove('lq-skeleton');
    stateValue.style.width = 'auto';
    stateValue.style.height = 'auto';
  }
  
  // Update setup with defensive coding
  const setupValue = panel.container.querySelector('.lq-setup-value');
  if (setupValue) {
    const setupCandidates = analysis.setup_candidates || [];
    setupValue.textContent = setupCandidates.length > 0 
      ? setupCandidates[0].replace(/_/g, ' ')
      : 'No Setup Detected';
    setupValue.classList.remove('lq-skeleton');
    setupValue.style.width = 'auto';
    setupValue.style.height = 'auto';
  }
  
  // Update risk flags with defensive coding
  const riskContainer = panel.container.querySelector('.lq-risk-flags');
  if (riskContainer) {
    const riskFlags = analysis.risk_flags || [];
    if (riskFlags.length > 0) {
      riskContainer.innerHTML = riskFlags.map(flag => 
        `<span class="lq-risk-flag">${formatRiskFlag(flag)}</span>`
      ).join('');
    } else {
      riskContainer.innerHTML = '<span class="lq-risk-flag" style="background: rgba(14, 203, 129, 0.1); border-color: rgba(14, 203, 129, 0.3); color: var(--lq-accent-green);">✓ No flags</span>';
    }
  }
  
  // Update leverage with defensive coding
  const leverageBand = analysis.suggested_leverage_band || [1, 10];
  const [minLev, maxLev] = leverageBand;
  const leverageValueEl = panel.container.querySelector('.lq-leverage-value');
  if (leverageValueEl) {
    leverageValueEl.textContent = `${minLev}x - ${maxLev}x`;
    leverageValueEl.classList.remove('lq-skeleton');
    leverageValueEl.style.width = 'auto';
    leverageValueEl.style.height = 'auto';
  }
  
  const leverageFill = panel.container.querySelector('.lq-leverage-fill');
  if (leverageFill) {
    leverageFill.style.width = `${(maxLev / 20) * 100}%`;
    leverageFill.classList.remove('lq-skeleton');
  }
  
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
  
  // Update reason with defensive coding
  const reasonEl = panel.container.querySelector('.lq-reason-text');
  if (reasonEl) {
    reasonEl.textContent = analysis.reason || 'Analysis complete';
    reasonEl.classList.remove('lq-skeleton');
    reasonEl.style.width = 'auto';
    reasonEl.style.height = 'auto';
  }
  
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

  // Auto-explain high grade setups
  maybeAutoExplain(analysis);

  // Show bookmark info for free users
  showBookmarkInfo();

  // Apply tooltips to complex metrics
  applyTooltips();

  // Update feature lock indicators
  updateFeatureLocks();

  // Start tutorial for new users after first analysis
  maybeStartTutorial();
}

async function maybeAutoExplain(analysis) {
  if (!analysis || !analysis.grade) return;

  const result = await chrome.storage.sync.get('settings');
  const settings = result.settings || {};

  if (!settings.autoExplain) return;

  // Only auto-explain for A or B grades
  if (['A', 'B'].includes(analysis.grade.toUpperCase())) {
    // Check if user has access to explain feature
    const hasAccess = await featureGate.checkAccess('ai_explain');
    if (hasAccess) {
      console.log('[LenQuant] Auto-explaining high grade setup:', analysis.grade);
      await requestExplanation();
    }
  }
}

async function updateMTFSection(symbol) {
  if (!panel || !panel.container) return;

  // Lazy load MTF feature
  await lazyLoader.load('mtf');

  const mtfSection = panel.container.querySelector('.lq-mtf-section');
  if (!mtfSection) return;

  mtfSection.style.display = 'block';

  const mtfGrid = mtfSection.querySelector('.lq-mtf-grid');
  mtfGrid.innerHTML = '<div class="lq-mtf-loading">Loading...</div>';

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'REQUEST_MTF_ANALYSIS',
      symbol: symbol,
      timeframes: ['5m', '1h', '4h'],
    });

    if (response.mtf) {
      const mtf = response.mtf;

      // Update confluence
      const confluenceValue = mtfSection.querySelector('.lq-mtf-confluence-value');
      confluenceValue.textContent = `${mtf.confluence.toUpperCase()} (${Math.round(mtf.confluence_score * 100)}%)`;
      confluenceValue.className = `lq-mtf-confluence-value confluence-${mtf.confluence}`;

      // Update grid
      let gridHTML = '';
      for (const [tf, result] of Object.entries(mtf.timeframes)) {
        const trend = result.trend_direction || 'sideways';
        const state = result.market_state || 'unknown';
        const trendIcon = trend === 'up' ? '📈' : trend === 'down' ? '📉' : '↔️';

        gridHTML += `
          <div class="lq-mtf-item">
            <span class="lq-mtf-tf">${tf}</span>
            <span class="lq-mtf-trend ${trend}">${trendIcon}</span>
            <span class="lq-mtf-state">${state}</span>
          </div>
        `;
      }
      mtfGrid.innerHTML = gridHTML;

      // Update recommendation
      const recEl = mtfSection.querySelector('.lq-mtf-recommendation');
      recEl.textContent = mtf.recommendation;
      recEl.className = `lq-mtf-recommendation bias-${mtf.recommended_bias}`;
    }

  } catch (error) {
    console.error('[LenQuant] MTF update error:', error);
    mtfGrid.innerHTML = '<div class="lq-mtf-error">Failed to load</div>';
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

/**
 * Initialize feature gating components.
 * Scripts are already loaded via manifest content_scripts (in order:
 * license-manager.js → auth-ui.js → feature-gate.js → content.js)
 */
async function initializeFeatureGating() {
  // Classes are already available on window from scripts loaded via manifest
  const { LicenseManager, AuthUI, FeatureGate } = window;

  if (LicenseManager && AuthUI && FeatureGate) {
    // Get API URL from settings
    let apiBaseUrl = 'https://lenquant.com/api/extension';
    try {
      const result = await chrome.storage.sync.get('settings');
      if (result.settings && result.settings.apiUrl) {
        const baseUrl = result.settings.apiUrl.replace(/\/$/, '');
        apiBaseUrl = `${baseUrl}/api/extension`;
      }
    } catch (err) {
      console.warn('[LenQuant] Failed to load settings for API URL:', err);
    }

    licenseManager = new LicenseManager(apiBaseUrl);
    authUI = new AuthUI(licenseManager);
    featureGate = new FeatureGate(licenseManager, authUI);

    // Initialize license manager (async, but don't block)
    licenseManager.init().then(license => {
      if (license) {
        console.log('[LenQuant] License loaded:', license.tier);
        // Show trial banner if applicable
        const trial = licenseManager.getTrialRemaining();
        if (trial && trial.hours < 72) {
          authUI.showTrialBanner(trial.hours);
        }
      } else {
        console.log('[LenQuant] No valid license, showing auth modal');
        // Show auth modal for new users after a short delay
        setTimeout(() => {
          if (!licenseManager.license) {
            authUI.showAuthModal();
          }
        }, 2000);
      }
    }).catch(err => {
      console.error('[LenQuant] License init error:', err);
    });

    console.log('[LenQuant] Feature gating initialized with API:', apiBaseUrl);
    return true;
  } else {
    console.error('[LenQuant] Feature gating components not available on window');
    return false;
  }
}

// ============================================================================

// Optimized auto-refresh using AnalysisManager
async function initAutoRefreshOptimized() {
  const tier = licenseManager?.getTier();
  const isPro = ['trial', 'pro', 'premium'].includes(tier);

  if (isPro) {
    // Pro users get auto-refresh
    setInterval(async () => {
      if (panel?.container?.style.display === 'none') {
        return; // Skip if panel hidden
      }

      await analysisManager.maybeRefresh(currentContext);
    }, 30000);

    logger.log('analysis', 'Auto-refresh enabled (Pro)');
  } else {
    // Free users - show manual refresh hint
    showManualRefreshHint();
    logger.log('analysis', 'Auto-refresh disabled (Free tier)');
  }
}

// Legacy function for backwards compatibility
async function initAutoRefresh() {
  return initAutoRefreshOptimized();
}

let manualRefreshCount = 0;

function showManualRefreshHint() {
  const refreshBtn = document.querySelector('.lq-refresh-btn');
  if (refreshBtn) {
    // Add pulsing animation to draw attention
    refreshBtn.classList.add('lq-refresh-hint');
    refreshBtn.title = 'Click to refresh analysis (Pro: auto-updates every 30s)';
  }
}

async function handleManualRefresh() {
  await fetchAndUpdateAnalysis();

  // Record manual refresh for smart upsell system
  await upsellManager.recordManualRefresh();
}

// Auto-refresh upsell is now handled by the smart upsell system
function showAutoRefreshUpsell() {
  // This function is kept for backwards compatibility but now handled by UpsellManager
}

async function showBookmarkInfo() {
  const tier = licenseManager?.getTier();
  const bookmarks = await LocalBookmarks.getAll();

  if (!['pro', 'premium'].includes(tier)) {
    // Show local bookmark count with limit
    const bookmarkBtn = document.querySelector('.lq-btn-bookmark');
    if (bookmarkBtn) {
      const count = bookmarks.length;
      bookmarkBtn.title = `Local bookmarks: ${count}/${LocalBookmarks.MAX_BOOKMARKS} (Upgrade for cloud sync)`;

      // Add visual indicator if near limit
      if (count >= LocalBookmarks.MAX_BOOKMARKS - 5) {
        bookmarkBtn.style.color = count >= LocalBookmarks.MAX_BOOKMARKS ? '#f6465d' : '#f0b90b';
      }
    }
  }
}

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

  // Initialize feature gating components (already loaded via manifest)
  await initializeFeatureGating();

  // Check auto-show setting before injecting panel
  const result = await chrome.storage.sync.get('settings');
  const settings = result.settings || {};
  const shouldAutoShow = settings.autoShow !== false; // Default true

  // Initialize panel
  panel = new TradingPanel();
  panel.inject();

  // Hide immediately if auto-show is disabled
  if (!shouldAutoShow) {
    panel.container.style.display = 'none';
  }

  // Initialize context observer
  const observer = new OptimizedContextObserver();
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

  // Initialize auto-refresh based on tier
  initAutoRefreshOptimized();

  // Initialize upsell manager
  await upsellManager.init();

  // Record daily activity for upsell system
  const today = new Date().toDateString();
  const lastActiveDate = await chrome.storage.local.get('lastActiveDate');
  if (lastActiveDate.lastActiveDate !== today) {
    await chrome.storage.local.set({ lastActiveDate: today });
    await upsellManager.recordDayActive();
  }

  console.log('[LenQuant] Initialization complete');
}

// ============================================================================
// Panel Walkthrough Tutorial System
// ============================================================================

// Tutorial overlay system
const tutorialSteps = [
  {
    element: '.lq-signal-badge',
    title: 'Trade Signal',
    description: 'This shows the overall recommendation: BUY, WAIT, or CAUTION based on our analysis.',
    position: 'bottom'
  },
  {
    element: '.lq-score-bar',
    title: 'Trade Score',
    description: 'The confidence level of this signal. Higher is better - we recommend acting on 70%+ scores.',
    position: 'bottom'
  },
  {
    element: '.lq-grade-badge',
    title: 'Setup Grade',
    description: 'Letter grade (A-D) for the current trading setup. A = excellent conditions, D = poor conditions.',
    position: 'right'
  },
  {
    element: '.lq-risk-flags',
    title: 'Risk Warnings',
    description: 'Important risks to watch. Red flags suggest caution or smaller position sizes.',
    position: 'bottom'
  },
  {
    element: '.lq-leverage-section',
    title: 'Leverage Guidance',
    description: 'Suggested leverage range based on volatility. Stay within this range to manage risk.',
    position: 'bottom'
  },
  {
    element: '.lq-quick-action',
    title: 'Quick Trade Info',
    description: 'Suggested entry, stop loss, and take profit levels when a setup is detected.',
    position: 'top'
  }
];

class TutorialOverlay {
  constructor() {
    this.currentStep = 0;
    this.overlay = null;
  }

  async shouldShow() {
    const result = await chrome.storage.local.get(['tutorialComplete']);
    return !result.tutorialComplete;
  }

  async start() {
    if (!(await this.shouldShow())) return;

    this.createOverlay();
    this.showStep(0);
  }

  createOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'lq-tutorial-overlay';
    this.overlay.innerHTML = `
      <div class="lq-tutorial-backdrop"></div>
      <div class="lq-tutorial-tooltip">
        <div class="lq-tutorial-header">
          <span class="lq-tutorial-step-count">1/${tutorialSteps.length}</span>
          <button class="lq-tutorial-skip">Skip Tutorial</button>
        </div>
        <h4 class="lq-tutorial-title"></h4>
        <p class="lq-tutorial-description"></p>
        <div class="lq-tutorial-actions">
          <button class="lq-tutorial-prev" disabled>← Back</button>
          <button class="lq-tutorial-next">Next →</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    // Event handlers
    this.overlay.querySelector('.lq-tutorial-skip').addEventListener('click', () => this.complete());
    this.overlay.querySelector('.lq-tutorial-prev').addEventListener('click', () => this.prevStep());
    this.overlay.querySelector('.lq-tutorial-next').addEventListener('click', () => this.nextStep());
  }

  showStep(index) {
    const step = tutorialSteps[index];
    const element = document.querySelector(step.element);

    if (!element) {
      // Skip to next if element not found
      if (index < tutorialSteps.length - 1) {
        this.showStep(index + 1);
      } else {
        this.complete();
      }
      return;
    }

    this.currentStep = index;

    // Update content
    this.overlay.querySelector('.lq-tutorial-step-count').textContent =
      `${index + 1}/${tutorialSteps.length}`;
    this.overlay.querySelector('.lq-tutorial-title').textContent = step.title;
    this.overlay.querySelector('.lq-tutorial-description').textContent = step.description;

    // Update buttons
    const prevBtn = this.overlay.querySelector('.lq-tutorial-prev');
    const nextBtn = this.overlay.querySelector('.lq-tutorial-next');

    prevBtn.disabled = index === 0;
    nextBtn.textContent = index === tutorialSteps.length - 1 ? 'Finish ✓' : 'Next →';

    // Position tooltip near element
    this.positionTooltip(element, step.position);

    // Highlight element
    this.highlightElement(element);
  }

  positionTooltip(element, position) {
    const tooltip = this.overlay.querySelector('.lq-tutorial-tooltip');
    const rect = element.getBoundingClientRect();

    // Reset position
    tooltip.style.top = '';
    tooltip.style.left = '';
    tooltip.style.right = '';
    tooltip.style.bottom = '';

    switch (position) {
      case 'bottom':
        tooltip.style.top = `${rect.bottom + 15}px`;
        tooltip.style.left = `${rect.left}px`;
        break;
      case 'top':
        tooltip.style.bottom = `${window.innerHeight - rect.top + 15}px`;
        tooltip.style.left = `${rect.left}px`;
        break;
      case 'right':
        tooltip.style.top = `${rect.top}px`;
        tooltip.style.left = `${rect.right + 15}px`;
        break;
      case 'left':
        tooltip.style.top = `${rect.top}px`;
        tooltip.style.right = `${window.innerWidth - rect.left + 15}px`;
        break;
    }
  }

  highlightElement(element) {
    // Remove previous highlight
    document.querySelectorAll('.lq-tutorial-highlight').forEach(el => {
      el.classList.remove('lq-tutorial-highlight');
    });

    // Add highlight to current element
    element.classList.add('lq-tutorial-highlight');
  }

  nextStep() {
    if (this.currentStep < tutorialSteps.length - 1) {
      this.showStep(this.currentStep + 1);
    } else {
      this.complete();
    }
  }

  prevStep() {
    if (this.currentStep > 0) {
      this.showStep(this.currentStep - 1);
    }
  }

  async complete() {
    await chrome.storage.local.set({ tutorialComplete: true });

    // Remove highlight
    document.querySelectorAll('.lq-tutorial-highlight').forEach(el => {
      el.classList.remove('lq-tutorial-highlight');
    });

    // Remove overlay
    this.overlay?.remove();
  }
}

// Start tutorial after first analysis loads (for new users)
async function maybeStartTutorial() {
  await lazyLoader.load('tutorial');
  const tutorial = new TutorialOverlay();
  await tutorial.start();
}

// ============================================================================
// Tooltip System for Complex Metrics
// ============================================================================

// Tooltip definitions
const tooltipDefinitions = {
  grade: 'Setup quality from A (excellent) to D (poor). Based on confidence, risk flags, and market conditions.',
  marketState: 'Current market behavior: Trending (strong direction), Ranging (sideways), or Choppy (unpredictable).',
  tradeScore: 'Overall confidence in this trade setup. 70%+ suggests favorable conditions.',
  riskFlags: 'Warnings about current market conditions that may affect this trade.',
  leverageBand: 'Suggested leverage range based on current volatility. Lower volatility = safer higher leverage.',
  regimeMultiplier: 'Suggested position size adjustment based on market regime. 100% = normal, lower = reduce size.',
  setup: 'Detected chart pattern or trade setup. Helps identify entry opportunities.',
};

// Apply tooltips when panel is created
function applyTooltips() {
  const tooltipMappings = [
    { selector: '.lq-grade-badge', key: 'grade' },
    { selector: '.lq-market-state', key: 'marketState' },
    { selector: '.lq-score-bar', key: 'tradeScore' },
    { selector: '.lq-risk-flags', key: 'riskFlags' },
    { selector: '.lq-leverage-section', key: 'leverageBand' },
    { selector: '.lq-regime-multiplier', key: 'regimeMultiplier' },
    { selector: '.lq-setup-name', key: 'setup' },
  ];

  tooltipMappings.forEach(({ selector, key }) => {
    const element = document.querySelector(selector);
    if (element && tooltipDefinitions[key]) {
      element.setAttribute('title', tooltipDefinitions[key]);
      element.style.cursor = 'help';
    }
  });
}

// Enhanced Tooltip (Optional)
class Tooltip {
  static show(element, text) {
    const tooltip = document.createElement('div');
    tooltip.className = 'lq-custom-tooltip';
    tooltip.textContent = text;

    const rect = element.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.bottom + 8}px`;

    document.body.appendChild(tooltip);

    element._tooltip = tooltip;
  }

  static hide(element) {
    element._tooltip?.remove();
    element._tooltip = null;
  }
}

// Add hover handlers for enhanced tooltips (optional)
// document.querySelectorAll('[data-tooltip]').forEach(el => {
//   el.addEventListener('mouseenter', () => {
//     Tooltip.show(el, el.dataset.tooltip);
//   });
//   el.addEventListener('mouseleave', () => {
//     Tooltip.hide(el);
//   });
// });

// ============================================================================
// Feature Lock Indicators
// ============================================================================

function updateFeatureLocks() {
  const tier = licenseManager?.getTier() || 'free';
  const hasProAccess = ['trial', 'pro', 'premium'].includes(tier);
  const hasPremiumAccess = tier === 'premium';

  // Define feature requirements
  const featureButtons = [
    { selector: '.lq-btn-explain', feature: 'ai_explain', needsPro: true },
    { selector: '.lq-btn-sync', feature: 'trade_sync', needsPremium: true },
    { selector: '.lq-btn-mtf', feature: 'mtf_analysis', needsPremium: true },
  ];

  featureButtons.forEach(({ selector, feature, needsPro, needsPremium }) => {
    const btn = document.querySelector(selector);
    if (!btn) return;

    const isLocked = (needsPro && !hasProAccess) || (needsPremium && !hasPremiumAccess);

    // Add/remove lock indicator
    let lockIcon = btn.querySelector('.lq-lock-icon');

    if (isLocked) {
      if (!lockIcon) {
        lockIcon = document.createElement('span');
        lockIcon.className = 'lq-lock-icon';
        lockIcon.textContent = '🔒';
        lockIcon.title = needsPremium ? 'Premium feature' : 'Pro feature';
        btn.appendChild(lockIcon);
      }
      btn.classList.add('lq-feature-locked');
    } else {
      lockIcon?.remove();
      btn.classList.remove('lq-feature-locked');
    }
  });
}

// ============================================================================
// Smart Upsell System
// ============================================================================

class UpsellManager {
  constructor() {
    this.triggers = {
      manualRefreshCount: 0,
      daysActive: 0,
      highGradesSeen: 0,
      lastUpsellShown: 0,
    };
    this.cooldownMs = 300000; // 5 min between upsells
  }

  async init() {
    const result = await chrome.storage.local.get(['upsellTriggers']);
    if (result.upsellTriggers) {
      this.triggers = { ...this.triggers, ...result.upsellTriggers };
    }
  }

  async save() {
    await chrome.storage.local.set({ upsellTriggers: this.triggers });
  }

  canShowUpsell() {
    const tier = licenseManager?.getTier();
    if (['pro', 'premium'].includes(tier)) return false;

    const now = Date.now();
    return (now - this.triggers.lastUpsellShown) > this.cooldownMs;
  }

  async recordManualRefresh() {
    this.triggers.manualRefreshCount++;
    await this.save();

    // Trigger after 5 refreshes
    if (this.triggers.manualRefreshCount === 5 && this.canShowUpsell()) {
      this.showUpsell('auto_refresh', {
        title: '⚡ Tired of clicking refresh?',
        message: 'Pro auto-updates your analysis every 30 seconds',
        cta: 'Try Pro Free',
      });
    }
  }

  async recordHighGrade(grade) {
    if (['A', 'B'].includes(grade.toUpperCase())) {
      this.triggers.highGradesSeen++;
      await this.save();

      // After 3 high grade signals
      if (this.triggers.highGradesSeen === 3 && this.canShowUpsell()) {
        this.showUpsell('ai_explain', {
          title: '🎯 Grade A Setup Detected!',
          message: 'Pro users get instant AI explanation for high-grade setups',
          cta: 'Unlock AI Explain',
        });
      }
    }
  }

  async recordDayActive() {
    this.triggers.daysActive++;
    await this.save();

    // After 7 days of use
    if (this.triggers.daysActive === 7 && this.canShowUpsell()) {
      this.showUpsell('pro_general', {
        title: '🏆 7 Days with LenQuant!',
        message: 'You\'re getting value from the free tier. Upgrade to unlock the full trading coach experience.',
        cta: 'Start Pro Trial',
      });
    }
  }

  showUpsell(feature, { title, message, cta }) {
    this.triggers.lastUpsellShown = Date.now();
    this.save();

    // Use non-intrusive toast, not modal
    panel.showToast({
      title,
      message,
      action: cta,
      onClick: () => {
        if (licenseManager?.license?.email) {
          authUI.showPaywall(feature);
        } else {
          authUI.showTrialPrompt(feature);
        }
      },
      duration: 8000,
      dismissible: true,
    });
  }
}

const upsellManager = new UpsellManager();

// Wait for page to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
// ============================================================================
// License Event Handlers - Phase 4 Security
// ============================================================================

// Listen for license events
window.addEventListener('lq:license-expired', (e) => {
  const { reason } = e.detail;

  // Show notification banner
  showLicenseBanner({
    type: 'expired',
    message: 'Your session has expired. Please sign in again.',
    reason: reason,
    action: 'Sign In',
    onClick: () => authUI.showAuthModal()
  });
});

window.addEventListener('lq:license-warning', (e) => {
  const { message } = e.detail;

  // Show warning in panel alerts
  if (panel) {
    panel.showAlert({
      severity: 'warning',
      message: message
    });
  }
});

window.addEventListener('lq:license-updated', () => {
  // Refresh feature locks when license updates
  updateFeatureLocks();
});

function showLicenseBanner({ type, message, action, onClick }) {
  // Remove existing banner
  document.querySelector('.lq-license-banner')?.remove();

  const banner = document.createElement('div');
  banner.className = `lq-license-banner lq-license-banner-${type}`;

  const messageSpan = document.createElement('span');
  messageSpan.textContent = message;

  const actionBtn = document.createElement('button');
  actionBtn.textContent = action;
  actionBtn.addEventListener('click', onClick);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'lq-banner-close';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => banner.remove());

  banner.appendChild(messageSpan);
  banner.appendChild(actionBtn);
  banner.appendChild(closeBtn);

  document.body.appendChild(banner);
}

} else {
  init();
}

