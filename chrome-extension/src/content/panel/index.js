/**
 * Trading Panel main class
 */

import { panelTemplate } from './template.js';
import { PanelUpdater } from './updater.js';
import { DragHandler } from './drag-handler.js';
import { PanelStorage } from './storage.js';
import { logger } from '../../shared/logger.js';

class TradingPanel {
  constructor(options = {}) {
    this.container = null;
    this.updater = null;
    this.dragHandler = null;
    this.isCollapsed = false;
    this.isVisible = true;
    this.isMinimized = false;
    this.miniIcon = null;
    this.exchange = options.exchange;

    this.onExplainClick = options.onExplainClick || (() => {});
    this.onBookmarkClick = options.onBookmarkClick || (() => {});
    this.onSyncClick = options.onSyncClick || (() => {});
    this.onBreakClick = options.onBreakClick || (() => {});
  }

  async inject() {
    // Create container
    this.container = document.createElement('div');
    this.container.className = 'lq-panel';
    this.container.innerHTML = panelTemplate;

    document.body.appendChild(this.container);

    // Initialize components
    this.updater = new PanelUpdater(this.container);
    this.updater.panel = this; // Reference to panel for mini icon updates
    this.dragHandler = new DragHandler(this.container);

    // Load saved position
    await this.loadPosition();

    // Setup event handlers
    this.setupEventHandlers();

    logger.info('panel', 'Panel injected');
  }

  async loadPosition() {
    const position = await PanelStorage.loadPosition();

    if (position && this.isValidPosition(position.x, position.y)) {
      this.container.style.left = `${position.x}px`;
      this.container.style.top = `${position.y}px`;
    } else {
      // Default position
      this.container.style.right = '20px';
      this.container.style.top = '80px';
    }
  }

  isValidPosition(x, y) {
    return x >= 0 &&
           x < window.innerWidth - 100 &&
           y >= 0 &&
           y < window.innerHeight - 100;
  }

  setupEventHandlers() {
    // Collapse/expand
    this.container.querySelector('.lq-btn-collapse')?.addEventListener('click', () => {
      this.toggleCollapse();
    });

    // Close
    this.container.querySelector('.lq-btn-close')?.addEventListener('click', () => {
      this.hide();
    });

    // Double-click header to minimize
    this.container.querySelector('.lq-panel-header')?.addEventListener('dblclick', () => {
      this.toggleMinimize();
    });

    // Action buttons
    this.container.querySelector('.lq-btn-explain')?.addEventListener('click', () => {
      this.onExplainClick();
    });

    this.container.querySelector('.lq-btn-bookmark')?.addEventListener('click', () => {
      this.onBookmarkClick();
    });

    this.container.querySelector('.lq-btn-sync')?.addEventListener('click', () => {
      this.onSyncClick();
    });

    this.container.querySelector('.lq-btn-break')?.addEventListener('click', () => {
      this.onBreakClick();
    });

    // Drag end - save position
    this.dragHandler.onDragEnd = async (x, y) => {
      await PanelStorage.savePosition(x, y);
    };
  }

  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
    const content = this.container.querySelector('.lq-panel-content');
    const footer = this.container.querySelector('.lq-panel-footer');
    const btn = this.container.querySelector('.lq-btn-collapse');

    if (this.isCollapsed) {
      content.style.display = 'none';
      footer.style.display = 'none';
      btn.textContent = '+';
      btn.title = 'Expand panel';
    } else {
      content.style.display = 'block';
      footer.style.display = 'flex';
      btn.textContent = '−';
      btn.title = 'Collapse panel';
    }
  }

  show() {
    this.container.style.display = 'block';
    this.isVisible = true;
  }

  hide() {
    this.container.style.display = 'none';
    this.isVisible = false;
  }

  // Delegate update methods to updater
  updateAnalysis(analysis) {
    this.updater.updateAnalysis(analysis);
  }

  showLoading() {
    this.updater.showLoading();
  }

  showError(message) {
    this.updater.showError(message);
  }

  showAlert(alert) {
    this.updater.showAlert(alert);
  }

  updateUserInfo(license) {
    this.updater.updateUserInfo(license);
  }

  toggleMinimize() {
    if (this.isMinimized) {
      this.restore();
    } else {
      this.minimize();
    }
  }

  minimize() {
    this.isMinimized = true;
    this.container.style.display = 'none';

    // Create mini icon if not exists
    if (!this.miniIcon) {
      this.miniIcon = document.createElement('div');
      this.miniIcon.className = 'lq-mini-icon';
      this.miniIcon.innerHTML = `
        <img src="${chrome.runtime.getURL('icons/icon48.png')}" alt="LQ" />
        <span class="lq-mini-signal"></span>
      `;
      this.miniIcon.title = 'Click to expand LenQuant panel';

      // Make draggable
      new DragHandler(this.miniIcon);

      // Click to restore
      this.miniIcon.addEventListener('click', () => this.restore());

      document.body.appendChild(this.miniIcon);
    }

    this.miniIcon.style.display = 'flex';
    this.updateMiniSignal();
  }

  restore() {
    this.isMinimized = false;
    this.container.style.display = 'block';

    if (this.miniIcon) {
      this.miniIcon.style.display = 'none';
    }
  }

  updateMiniSignal() {
    if (!this.miniIcon) return;

    const signalDot = this.miniIcon.querySelector('.lq-mini-signal');
    // Get signal from last analysis
    const signal = this.updater?.lastAnalysis?.signal || 'wait';

    signalDot.className = `lq-mini-signal signal-${signal}`;
  }

  isShown() {
    return this.isVisible && this.container?.style.display !== 'none';
  }

  destroy() {
    this.dragHandler?.destroy();
    this.miniIcon?.remove();
    this.container?.remove();
    this.container = null;
    this.miniIcon = null;
  }
}

export { TradingPanel };
