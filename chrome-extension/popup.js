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

// Button handlers
document.getElementById('btn-dashboard').addEventListener('click', () => {
  chrome.tabs.create({ url: DASHBOARD_URL });
});

document.getElementById('btn-report').addEventListener('click', () => {
  chrome.tabs.create({ url: `${DASHBOARD_URL}/reports/daily` });
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

