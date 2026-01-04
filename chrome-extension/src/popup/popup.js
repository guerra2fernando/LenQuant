/**
 * Popup script entry point
 */

import { logger } from '../shared/logger.js';

// Initialize logger
logger.init();

const DASHBOARD_URL = 'https://lenquant.com';

// Get session info from background
async function loadSessionInfo() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_SESSION' });
    const sessionElement = document.getElementById('session-id');
    if (sessionElement) {
      sessionElement.textContent =
        `Session: ${response.sessionId.substring(0, 16)}...`;
    }
    logger.log('popup', 'Session info loaded');
  } catch (error) {
    logger.error('popup', 'Failed to load session:', error);
  }
}

// Load stats from storage
async function loadStats() {
  try {
    const result = await chrome.storage.local.get(['analysesCount', 'bookmarksCount', 'alertsCount']);

    const analysesEl = document.getElementById('analyses-count');
    const bookmarksEl = document.getElementById('bookmarks-count');
    const alertsEl = document.getElementById('alerts-count');

    if (analysesEl) analysesEl.textContent = result.analysesCount || 0;
    if (bookmarksEl) bookmarksEl.textContent = result.bookmarksCount || 0;
    if (alertsEl) alertsEl.textContent = result.alertsCount || 0;

    // Check if we should show first-time hint
    await checkFirstTimeUser(result.analysesCount);
    logger.log('popup', 'Stats loaded');
  } catch (error) {
    logger.error('popup', 'Failed to load stats:', error);
  }
}

// Check if user has ever analyzed - show hint if not
async function checkFirstTimeUser(analysesCount) {
  const result = await chrome.storage.local.get(['hasSeenHint']);

  // Show hint if user has never analyzed and hasn't dismissed hint
  if (!analysesCount && !result.hasSeenHint) {
    const hintBanner = document.getElementById('first-time-hint');
    if (hintBanner) {
      hintBanner.style.display = 'flex';

      // Add close button handler
      hintBanner.addEventListener('click', async (e) => {
        if (e.target.closest('a')) return; // Don't close if clicking the link
        hintBanner.style.display = 'none';
        await chrome.storage.local.set({ hasSeenHint: true });
      });
    }
  }
}

// Quick analyze current tab
async function quickAnalyze() {
  try {
    // Send message to content script to trigger analysis
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      await chrome.tabs.sendMessage(tabs[0].id, { type: 'TRIGGER_ANALYSIS' });
      logger.log('popup', 'Quick analyze triggered');
    }
  } catch (error) {
    logger.error('popup', 'Quick analyze failed:', error);
  }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  loadSessionInfo();
  loadStats();

  // Quick analyze button
  const analyzeBtn = document.getElementById('quick-analyze-btn');
  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', quickAnalyze);
  }

  // Dashboard link
  const dashboardLink = document.getElementById('dashboard-link');
  if (dashboardLink) {
    dashboardLink.href = DASHBOARD_URL;
  }

  // Settings link
  const settingsLink = document.getElementById('settings-link');
  if (settingsLink) {
    settingsLink.addEventListener('click', () => {
      chrome.tabs.create({ url: 'options.html' });
    });
  }

  logger.info('popup', 'Popup initialized');
});
