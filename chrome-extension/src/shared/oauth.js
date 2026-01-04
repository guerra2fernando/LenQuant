/**
 * OAuth utilities - single source of truth for OAuth configuration
 */

import { CONFIG } from './config.js';
import { logger } from './logger.js';
import { fetchJSON } from './api-helpers.js';

let cachedClientId = null;

/**
 * Get Google OAuth client ID
 * Checks manifest first, falls back to backend
 */
export async function getGoogleClientId() {
  if (cachedClientId) {
    return cachedClientId;
  }

  // Try manifest first
  try {
    const manifest = chrome.runtime.getManifest();
    if (manifest.oauth2?.client_id) {
      cachedClientId = manifest.oauth2.client_id;
      logger.log('auth', 'Got client ID from manifest');
      return cachedClientId;
    }
  } catch (e) {
    logger.warn('auth', 'Could not read manifest:', e);
  }

  // Fallback to backend
  try {
    const response = await fetchJSON(`${CONFIG.API_BASE_URL}/auth/config`);
    if (response.success && response.data.google_client_id) {
      cachedClientId = response.data.google_client_id;
      logger.log('auth', 'Got client ID from backend');
      return cachedClientId;
    }
  } catch (e) {
    logger.warn('auth', 'Could not fetch client ID from backend:', e);
  }

  logger.error('auth', 'No Google client ID available');
  return null;
}

/**
 * Clear cached client ID (for testing or config changes)
 */
export function clearClientIdCache() {
  cachedClientId = null;
}
