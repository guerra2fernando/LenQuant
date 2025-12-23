/**
 * LenQuant Binance Assistant - Popup Script
 */

const DASHBOARD_URL = 'https://lenquant.com';

// Get session info from background
async function loadSessionInfo() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_SESSION' });
    document.getElementById('session-id').textContent = 
      `Session: ${response.sessionId.substring(0, 16)}...`;
  } catch (error) {
    console.error('Failed to load session:', error);
  }
}

// Load stats from storage
async function loadStats() {
  try {
    const result = await chrome.storage.local.get(['analysesCount', 'bookmarksCount', 'alertsCount']);
    
    document.getElementById('analyses-count').textContent = result.analysesCount || 0;
    document.getElementById('bookmarks-count').textContent = result.bookmarksCount || 0;
    document.getElementById('alerts-count').textContent = result.alertsCount || 0;
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
}

// Quick Analyze - triggers immediate analysis on current Binance tab
async function quickAnalyze() {
  const btn = document.getElementById('btn-analyze');
  const originalText = btn.textContent;
  
  try {
    btn.disabled = true;
    btn.textContent = '⏳ Analyzing...';
    
    // Find the active Binance Futures tab
    const tabs = await chrome.tabs.query({ 
      active: true, 
      currentWindow: true,
      url: 'https://www.binance.com/*/futures/*'
    });
    
    if (tabs.length === 0) {
      // Try any Binance futures tab
      const allBinanceTabs = await chrome.tabs.query({
        url: 'https://www.binance.com/*/futures/*'
      });
      
      if (allBinanceTabs.length === 0) {
        btn.textContent = '❌ No Binance tab';
        setTimeout(() => {
          btn.textContent = originalText;
          btn.disabled = false;
        }, 2000);
        return;
      }
      
      // Use first Binance tab found
      await chrome.tabs.update(allBinanceTabs[0].id, { active: true });
    }
    
    // Send message to content script to trigger analysis
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (activeTab) {
      try {
        const response = await chrome.tabs.sendMessage(activeTab.id, { 
          type: 'TRIGGER_ANALYSIS' 
        });
        
        if (response && response.success) {
          btn.textContent = '✅ Analysis triggered!';
        } else {
          btn.textContent = '⚠️ Open Binance first';
        }
      } catch (e) {
        // Content script might not be loaded
        btn.textContent = '⚠️ Open Binance first';
      }
    }
    
    setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
    }, 2000);
    
  } catch (error) {
    console.error('Quick analyze failed:', error);
    btn.textContent = '❌ Error';
    setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
    }, 2000);
  }
}

// Button handlers
document.getElementById('btn-analyze').addEventListener('click', quickAnalyze);

document.getElementById('btn-dashboard').addEventListener('click', () => {
  chrome.tabs.create({ url: DASHBOARD_URL });
});

document.getElementById('btn-report').addEventListener('click', () => {
  chrome.tabs.create({ url: `${DASHBOARD_URL}/reports` });
});

document.getElementById('link-settings').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

document.getElementById('link-journal').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: `${DASHBOARD_URL}/journal` });
});

document.getElementById('link-help').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: `${DASHBOARD_URL}/docs/extension` });
});

// Initialize
loadSessionInfo();
loadStats();

