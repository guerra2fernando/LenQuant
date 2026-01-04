/**
 * API helpers with consistent error handling
 */


/**
 * Fetch with timeout
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch JSON with consistent error handling
 */
export async function fetchJSON(url, options = {}) {
  const {
    timeout = 5000,
    ...fetchOptions
  } = options;

  try {
    const response = await fetchWithTimeout(url, {
      ...fetchOptions,
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
    }, timeout);

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        error: data?.detail || data?.message || `HTTP ${response.status}`,
        status: response.status,
      };
    }

    return {
      success: true,
      data,
    };

  } catch (error) {
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: 'Request timeout',
        isTimeout: true,
      };
    }

    return {
      success: false,
      error: error.message || 'Network error',
      isNetworkError: true,
    };
  }
}

/**
 * Standard response wrapper for message handlers
 */
export function successResponse(data) {
  return { success: true, ...data };
}

export function errorResponse(error, data = {}) {
  return { success: false, error, ...data };
}
