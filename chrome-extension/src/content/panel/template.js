/**
 * Panel HTML template
 */

export const panelTemplate = `
  <div class="lq-panel-header">
    <div class="lq-panel-title">
      <span class="lq-logo">LenQuant</span>
      <span class="lq-tier-badge">FREE</span>
    </div>
    <div class="lq-panel-actions">
      <button class="lq-btn-icon lq-btn-collapse" title="Collapse">−</button>
      <button class="lq-btn-icon lq-btn-close" title="Close">×</button>
    </div>
  </div>

  <div class="lq-panel-content">
    <div class="lq-context-info">
      <div class="lq-symbol-display">
        <span class="lq-symbol">BTCUSDT</span>
        <span class="lq-timeframe">1h</span>
      </div>
      <div class="lq-leverage-display">
        <span class="lq-leverage">10x</span>
      </div>
    </div>

    <div class="lq-analysis-section">
      <div class="lq-signal-badge neutral">
        <span class="lq-signal-text">ANALYZING</span>
      </div>

      <div class="lq-grade-display">
        <div class="lq-grade-circle">
          <span class="lq-grade-letter">-</span>
        </div>
        <div class="lq-grade-label">Setup Grade</div>
      </div>

      <div class="lq-score-bar">
        <div class="lq-score-fill" style="width: 0%"></div>
        <span class="lq-score-text">0%</span>
      </div>
    </div>

    <div class="lq-risk-section">
      <div class="lq-risk-flags">
        <!-- Risk flags will be inserted here -->
      </div>
      <div class="lq-leverage-recommendation">
        <span class="lq-leverage-label">Recommended Leverage:</span>
        <span class="lq-leverage-range">5-15x</span>
      </div>
    </div>

    <div class="lq-reason-section">
      <div class="lq-reason-text">Loading analysis...</div>
    </div>

    <div class="lq-mtf-section">
      <div class="lq-section-header">
        <span>📊 Multi-Timeframe Analysis</span>
        <div class="lq-mtf-controls">
          <button class="lq-btn-mtf-refresh" title="Refresh MTF data">↻</button>
          <span class="lq-mtf-status"></span>
        </div>
      </div>
      <div class="lq-mtf-content" style="display: none;">
        <table class="lq-mtf-table">
          <thead>
            <tr>
              <th>TF</th>
              <th>Trend</th>
              <th>RSI</th>
              <th>Signal</th>
            </tr>
          </thead>
          <tbody>
            <!-- Populated dynamically -->
          </tbody>
        </table>
        <div class="lq-mtf-confluence">
          <span class="label">Confluence:</span>
          <span class="value lq-mtf-confluence-value">--</span>
        </div>
      </div>
      <div class="lq-mtf-locked" style="display: none;">
        <span>🔒 Premium feature</span>
        <button class="lq-btn lq-btn-unlock-mtf">Unlock</button>
      </div>
    </div>
  </div>

  <div class="lq-panel-footer">
    <button class="lq-btn-action lq-btn-explain" title="Explain Analysis">
      <span class="lq-btn-icon">💡</span>
      Explain
    </button>
    <button class="lq-btn-action lq-btn-bookmark" title="Bookmark Setup">
      <span class="lq-btn-icon">📖</span>
      Save
    </button>
    <button class="lq-btn-action lq-btn-sync" title="Sync to Journal">
      <span class="lq-btn-icon">📤</span>
      Sync
    </button>
    <button class="lq-btn-action lq-btn-break" title="Take a Break">
      <span class="lq-btn-icon">⏸️</span>
      Break
    </button>
  </div>
`;
